from __future__ import annotations

import re
from datetime import date
from typing import Any

import pandas as pd
from email_validator import EmailNotValidError, validate_email

from app.services.supabase_client import get_supabase
from app.utils.names import capitalize_name_part

INACTIVE_STATUSES = {"paused", "cancelled", "canceled"}
EXCLUDED_PLAN_PATTERNS = ("owner", "paused membership")
MIN_MEMBER_AGE = 13
MAX_MEMBER_AGE = 100


def _normalize_status(value: Any) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip().lower()


def _normalize_email(value: Any) -> str | None:
    if pd.isna(value):
        return None
    email = str(value).strip().lower()
    return email or None


def _is_valid_email(email: str) -> bool:
    try:
        validate_email(email, check_deliverability=False)
        return True
    except EmailNotValidError:
        return False


def _parse_name(value: Any) -> str | None:
    if pd.isna(value):
        return None
    name = re.sub(r"\s+", " ", str(value).strip().strip(","))
    if not name:
        return None
    return capitalize_name_part(name)


def _parse_dob(value: Any) -> str | None:
    if pd.isna(value) or str(value).strip() == "":
        return None
    try:
        return pd.to_datetime(value).date().isoformat()
    except (ValueError, TypeError):
        return None


def _validate_dob(value: Any, today: date | None = None) -> tuple[str | None, str | None]:
    if today is None:
        today = date.today()

    parsed = _parse_dob(value)
    if parsed is None:
        return None, "missing"

    dob_date = date.fromisoformat(parsed)
    if dob_date > today:
        return None, "future"

    age = today.year - dob_date.year - (
        (today.month, today.day) < (dob_date.month, dob_date.day)
    )
    if age < MIN_MEMBER_AGE or age > MAX_MEMBER_AGE:
        return None, "implausible"

    return parsed, None


def _plan_priority(plan: Any) -> int:
    plan_lower = str(plan).lower() if not pd.isna(plan) else ""
    if any(term in plan_lower for term in ("personal training", "semi private", "pt only", "pt-")):
        return 1
    if any(
        term in plan_lower
        for term in ("membership", "catalyzer", "open membership", "student", "summer pass")
    ):
        return 3
    return 2


def _is_excluded_plan(plan: Any) -> bool:
    plan_lower = str(plan).lower() if not pd.isna(plan) else ""
    return any(pattern in plan_lower for pattern in EXCLUDED_PLAN_PATTERNS)


def _normalize_sex_from_gender(value: Any) -> str | None:
    if pd.isna(value):
        return None
    gender = str(value).strip().upper()
    if gender == "F":
        return "female"
    if gender == "M":
        return "male"
    return None


def _find_member_by_email(supabase: Any, email: str) -> dict[str, Any] | None:
    response = (
        supabase.table("member")
        .select("id, email, opl_match_status")
        .eq("email", email)
        .limit(1)
        .execute()
    )
    if response.data:
        return response.data[0]

    response = (
        supabase.table("member")
        .select("id, email, opl_match_status")
        .ilike("email", email)
        .limit(1)
        .execute()
    )
    return response.data[0] if response.data else None



def _filter_active_members(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    plan_status = df["planStatus"].map(_normalize_status)
    member_status = df["status"].map(_normalize_status)

    active_mask = (
        (plan_status == "active")
        & (member_status == "active")
        & ~plan_status.isin(INACTIVE_STATUSES)
        & ~member_status.isin(INACTIVE_STATUSES)
    )
    filtered = df[active_mask].copy()
    return filtered, len(df) - len(filtered)


def _filter_excluded_plans(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    excluded_mask = df["plan"].map(_is_excluded_plan)
    filtered = df[~excluded_mask].copy()
    return filtered, int(excluded_mask.sum())


def _filter_expired_plans(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    today = pd.Timestamp.now().normalize()
    plan_end = pd.to_datetime(df["planEndDate"], errors="coerce")
    expired_mask = plan_end.notna() & (plan_end < today)
    filtered = df[~expired_mask].copy()
    return filtered, int(expired_mask.sum())


def _prepare_member_keys(df: pd.DataFrame) -> pd.DataFrame:
    working = df.copy()
    working["_email"] = working["email"].map(_normalize_email)
    working["_member_id"] = working["memberId"].astype(str).str.strip()
    working.loc[
        working["_member_id"].isin(["", "nan", "none", "<na>"]),
        "_member_id",
    ] = pd.NA
    working["_dedup_key"] = working["_member_id"].fillna(working["_email"])
    working["_first_name"] = working["firstName"].map(_parse_name)
    working["_last_name"] = working["lastName"].map(_parse_name)
    working["_dob"] = working["dob"].map(_parse_dob)
    return working


def _count_data_conflicts(df: pd.DataFrame) -> int:
    conflicts = 0
    for _, group in df.groupby("_dedup_key", dropna=True):
        emails = {email for email in group["_email"].dropna().unique()}
        first_names = {name for name in group["_first_name"].dropna().unique()}
        last_names = {name for name in group["_last_name"].dropna().unique()}
        dobs = {dob for dob in group["_dob"].dropna().unique()}
        if len(emails) > 1 or len(first_names) > 1 or len(last_names) > 1 or len(dobs) > 1:
            conflicts += 1
    return conflicts


def _deduplicate_members(df: pd.DataFrame) -> tuple[pd.DataFrame, int, int]:
    working = _prepare_member_keys(df)
    data_conflicts = _count_data_conflicts(working)

    before_dedup = len(working)
    working = working.dropna(subset=["_dedup_key", "_email"])

    working["_plan_rank"] = working["plan"].map(_plan_priority)
    working["_last_checkin"] = pd.to_datetime(working["lastCheckin"], errors="coerce")
    working = working.sort_values(
        by=["_dedup_key", "_plan_rank", "_last_checkin"],
        ascending=[True, False, False],
    )
    deduped = working.drop_duplicates(subset=["_dedup_key"], keep="first")
    duplicates_discarded = before_dedup - len(deduped)
    return deduped, duplicates_discarded, data_conflicts


def import_members_from_csv(file_path: str) -> dict[str, int | list[str]]:
    df = pd.read_csv(file_path)
    today = date.today()

    active, inactive_filtered = _filter_active_members(df)
    eligible, excluded_plan_filtered = _filter_excluded_plans(active)
    current, expired_plan_filtered = _filter_expired_plans(eligible)
    unique_members, duplicates_discarded, data_conflicts = _deduplicate_members(current)

    supabase = get_supabase()
    created = 0
    updated = 0
    already_exists = 0
    skipped = 0
    invalid_email = 0
    missing_dob = 0
    invalid_dob = 0
    queued_for_matching = 0
    queued_member_ids: list[str] = []

    for _, row in unique_members.iterrows():
        email = row["_email"]
        first_name = row["_first_name"]
        last_name = row["_last_name"]
        date_of_birth, dob_issue = _validate_dob(row.get("dob"), today=today)

        if not email or not first_name or not last_name:
            skipped += 1
            continue

        if not _is_valid_email(email):
            invalid_email += 1
            continue

        if dob_issue == "missing":
            missing_dob += 1
        elif dob_issue is not None:
            invalid_dob += 1

        member_payload = {
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "date_of_birth": date_of_birth,
            "sex": _normalize_sex_from_gender(row.get("gender")),
        }

        existing = _find_member_by_email(supabase, email)

        if existing:
            already_exists += 1
            continue

        insert_response = supabase.table("member").insert(member_payload).execute()
        created += 1
        member_id = str(insert_response.data[0]["id"])

        if date_of_birth:
            queued_for_matching += 1
            queued_member_ids.append(member_id)

    return {
        "created": created,
        "updated": updated,
        "already_exists": already_exists,
        "skipped": skipped,
        "inactive_filtered": inactive_filtered,
        "excluded_plan_filtered": excluded_plan_filtered,
        "expired_plan_filtered": expired_plan_filtered,
        "duplicates_discarded": duplicates_discarded,
        "data_conflicts": data_conflicts,
        "invalid_email": invalid_email,
        "missing_dob": missing_dob,
        "invalid_dob": invalid_dob,
        "queued_for_matching": queued_for_matching,
        "queued_member_ids": queued_member_ids,
    }
