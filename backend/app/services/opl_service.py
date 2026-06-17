from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

import httpx

from app.services.close_powerlifting import fetch_athlete_results
from app.services.dots import calculate_dots
from app.services.weight_class_buckets import (
    get_ruleset_from_federation,
    infer_sex_from_bucket_id,
    normalize_class_token,
    normalize_federation_name,
    normalize_sex,
    resolve_bucket_id,
    resolve_bucket_id_with_fallback,
    resolve_meet_bucket_id,
    resolve_member_bucket_id,
)

logger = logging.getLogger(__name__)

KG_TO_LBS = 2.2046226218
LIFTS = ("squat", "bench", "deadlift", "total")

MEET_LIFT_FIELDS: dict[str, tuple[str, ...]] = {
    "squat": ("squat_best", "best_squat", "Best3SquatKg", "squat", "squat_kg"),
    "bench": ("bench_best", "best_bench", "Best3BenchKg", "bench", "bench_kg"),
    "deadlift": (
        "deadlift_best",
        "best_deadlift",
        "Best3DeadliftKg",
        "deadlift",
        "deadlift_kg",
    ),
    "total": ("total", "total_kg", "TotalKg", "best_total"),
}

MEET_WEIGHT_CLASS_FIELDS = (
    "WeightClassKg",
    "weight_class_kg",
    "weight_class",
    "WeightClass",
)
MEET_BODYWEIGHT_FIELDS = ("BodyweightKg", "bodyweight_kg", "bodyweight", "Bodyweight")
MEET_SEX_FIELDS = ("Sex", "sex", "Gender", "gender")
MEET_FEDERATION_FIELDS = ("Federation", "federation")
MEET_NAME_FIELDS = ("MeetName", "meet_name", "Meet", "meet", "name")
MEET_DATE_FIELDS = ("meet_date", "date", "Date", "competition_date")

LiftBucketKey = tuple[str, str, str]


def kg_to_lbs(kg: float | None) -> float | None:
    if kg is None:
        return None
    return round(kg * KG_TO_LBS, 2)


def _first_value(record: dict[str, Any], fields: tuple[str, ...]) -> Any:
    for field in fields:
        value = record.get(field)
        if value is not None and value != "":
            return value
    return None


def _parse_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _normalize_equipment(value: Any) -> str:
    normalized = str(value or "raw").strip().lower()
    if normalized in {"equipped", "eq", "multi-ply", "single-ply"} or "ply" in normalized:
        return "equipped"
    return "classic raw"


def _lift_bucket_key(lift: str, equipment: str, bucket_id: str) -> LiftBucketKey:
    return (lift.lower(), _normalize_equipment(equipment), bucket_id)


def _extract_meets(payload: dict[str, Any] | list[dict[str, Any]]) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return payload

    data = payload.get("data", payload)
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("meets", "competitions", "competition_history", "competition_results", "results"):
            meets = data.get(key)
            if isinstance(meets, list):
                return meets
    return []


def _infer_sex_from_meets(meets: list[dict[str, Any]]) -> str | None:
    male_votes = 0
    female_votes = 0

    for meet in meets:
        federation = normalize_federation_name(_first_value(meet, MEET_FEDERATION_FIELDS))
        ruleset = get_ruleset_from_federation(federation)
        weight_class_token = normalize_class_token(
            _first_value(meet, MEET_WEIGHT_CLASS_FIELDS)
        )
        if weight_class_token is None:
            continue

        male_bucket, _ = resolve_bucket_id_with_fallback("male", ruleset, weight_class_token)
        female_bucket, _ = resolve_bucket_id_with_fallback("female", ruleset, weight_class_token)
        if male_bucket and not female_bucket:
            male_votes += 1
        elif female_bucket and not male_bucket:
            female_votes += 1

    if male_votes > female_votes and male_votes > 0:
        return "male"
    if female_votes > male_votes and female_votes > 0:
        return "female"
    return None


def _member_with_inferred_sex(
    member: dict[str, Any] | None,
    meets: list[dict[str, Any]],
) -> dict[str, Any] | None:
    if member is None:
        inferred = _infer_sex_from_meets(meets)
        return {"sex": inferred} if inferred else None

    if normalize_sex(member.get("sex")):
        return member

    inferred = _infer_sex_from_meets(meets)
    if not inferred:
        return member

    return {**member, "sex": inferred}


def persist_member_sex_if_missing(
    supabase: Any,
    member_id: str,
    sex: str | None,
) -> bool:
    normalized = normalize_sex(sex)
    if not normalized:
        return False

    member = (
        supabase.table("member")
        .select("sex")
        .eq("id", member_id)
        .maybe_single()
        .execute()
    ).data
    if not member or normalize_sex(member.get("sex")):
        return False

    supabase.table("member").update({"sex": normalized}).eq("id", member_id).execute()
    return True


def infer_member_sex_from_meet_bests(
    meet_bests: dict[LiftBucketKey, dict[str, Any]],
) -> str | None:
    bucket_ids = {bucket_id for (_lift, _equipment, bucket_id) in meet_bests if bucket_id}
    return infer_unanimous_sex_from_bucket_ids(bucket_ids)


def infer_unanimous_sex_from_bucket_ids(bucket_ids: set[str]) -> str | None:
    sexes = {infer_sex_from_bucket_id(bucket_id) for bucket_id in bucket_ids if bucket_id}
    sexes.discard(None)
    if len(sexes) == 1:
        return next(iter(sexes))
    return None


def reconcile_member_sex(
    supabase: Any,
    member_id: str,
    inferred_sex: str | None,
) -> bool:
    normalized = normalize_sex(inferred_sex)
    if not normalized:
        return False

    member = (
        supabase.table("member")
        .select("sex")
        .eq("id", member_id)
        .maybe_single()
        .execute()
    ).data
    if not member:
        return False

    current = normalize_sex(member.get("sex"))
    if current == normalized:
        return False

    if current is not None and inferred_sex is None:
        return False

    supabase.table("member").update({"sex": normalized}).eq("id", member_id).execute()
    return True


def _extract_meet_context(
    meet: dict[str, Any],
    member: dict[str, Any] | None = None,
) -> tuple[str | None, str, float | None, float | None]:
    sex = normalize_sex(_first_value(meet, MEET_SEX_FIELDS))
    if sex is None and member:
        sex = normalize_sex(member.get("sex"))

    federation = normalize_federation_name(_first_value(meet, MEET_FEDERATION_FIELDS))
    ruleset = get_ruleset_from_federation(federation)
    if member and member.get("ruleset"):
        ruleset = str(member["ruleset"])

    bodyweight_kg = _parse_float(_first_value(meet, MEET_BODYWEIGHT_FIELDS))
    weight_class_token = normalize_class_token(_first_value(meet, MEET_WEIGHT_CLASS_FIELDS))
    meet_weight_class_kg = (
        weight_class_token if isinstance(weight_class_token, (int, float)) else None
    )

    bucket_id, ruleset = resolve_meet_bucket_id(
        sex,
        ruleset,
        weight_class_token,
        bodyweight_kg,
    )
    return bucket_id, ruleset, meet_weight_class_kg, bodyweight_kg


def _parse_lift_weight(meet: dict[str, Any], lift: str) -> float | None:
    for field in MEET_LIFT_FIELDS[lift]:
        weight = _parse_float(meet.get(field))
        if weight is not None and weight > 0:
            return weight
    return None


def _compute_bests_from_meets(
    meets: list[dict[str, Any]],
    member: dict[str, Any] | None = None,
) -> dict[LiftBucketKey, dict[str, Any]]:
    best: dict[LiftBucketKey, dict[str, Any]] = {}
    member = _member_with_inferred_sex(member, meets)

    for meet in meets:
        bucket_id, ruleset, meet_weight_class_kg, bodyweight_kg = _extract_meet_context(
            meet, member
        )
        if not bucket_id:
            continue

        equipment = _normalize_equipment(meet.get("equipment") or meet.get("Equipment"))
        meet_name = _first_value(meet, MEET_NAME_FIELDS)
        federation = normalize_federation_name(_first_value(meet, MEET_FEDERATION_FIELDS))
        achieved_date = _parse_date(_first_value(meet, MEET_DATE_FIELDS))

        squat = _parse_lift_weight(meet, "squat")
        bench = _parse_lift_weight(meet, "bench")
        deadlift = _parse_lift_weight(meet, "deadlift")
        total = _parse_lift_weight(meet, "total")
        if total is None and squat is not None and bench is not None and deadlift is not None:
            total = squat + bench + deadlift

        for lift, weight in (
            ("squat", squat),
            ("bench", bench),
            ("deadlift", deadlift),
            ("total", total),
        ):
            if weight is None:
                continue

            key = _lift_bucket_key(lift, equipment, bucket_id)
            current = best.get(key)
            if current is None or weight > current["weight_kg"]:
                best[key] = {
                    "weight_kg": weight,
                    "weight_lbs": kg_to_lbs(weight),
                    "source": "opl",
                    "equipment": equipment,
                    "achieved_date": achieved_date.isoformat() if achieved_date else None,
                    "meet_name": str(meet_name) if meet_name else None,
                    "federation": str(federation) if federation else None,
                    "is_meet_verified": True,
                    "canonical_bucket_id": bucket_id,
                    "meet_ruleset": ruleset,
                    "meet_weight_class_kg": meet_weight_class_kg,
                    "bodyweight_kg": bodyweight_kg,
                }

    return best


def compute_highest_dots_from_meets(
    meets: list[dict[str, Any]],
    member: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Find the highest DOTS score across OPL meet results for a member."""
    member = _member_with_inferred_sex(member, meets)
    best: dict[str, Any] | None = None

    for meet in meets:
        sex = normalize_sex(_first_value(meet, MEET_SEX_FIELDS))
        if sex is None and member:
            sex = normalize_sex(member.get("sex"))
        if sex is None:
            continue

        bodyweight_kg = _parse_float(_first_value(meet, MEET_BODYWEIGHT_FIELDS))
        if bodyweight_kg is None or bodyweight_kg <= 0:
            continue

        squat = _parse_lift_weight(meet, "squat")
        bench = _parse_lift_weight(meet, "bench")
        deadlift = _parse_lift_weight(meet, "deadlift")
        total = _parse_lift_weight(meet, "total")
        if total is None and squat is not None and bench is not None and deadlift is not None:
            total = squat + bench + deadlift
        if total is None or total <= 0:
            continue

        dots_score = calculate_dots(total, bodyweight_kg, sex)
        if dots_score is None:
            continue

        meet_name = _first_value(meet, MEET_NAME_FIELDS)
        achieved_date = _parse_date(_first_value(meet, MEET_DATE_FIELDS))
        entry = {
            "highest_dots_score": dots_score,
            "highest_dots_total_kg": total,
            "highest_dots_bodyweight_kg": bodyweight_kg,
            "highest_dots_achieved_date": achieved_date.isoformat() if achieved_date else None,
            "highest_dots_meet_name": str(meet_name) if meet_name else None,
        }

        if best is None or dots_score > best["highest_dots_score"]:
            best = entry

    return best


_HIGHEST_DOTS_CLEAR_FIELDS = {
    "highest_dots_score": None,
    "highest_dots_total_kg": None,
    "highest_dots_bodyweight_kg": None,
    "highest_dots_achieved_date": None,
    "highest_dots_meet_name": None,
}


def persist_highest_dots(
    supabase: Any,
    member_id: str,
    dots_data: dict[str, Any] | None,
) -> bool:
    payload = dots_data if dots_data else _HIGHEST_DOTS_CLEAR_FIELDS
    supabase.table("member").update(payload).eq("id", member_id).execute()
    return dots_data is not None


def _resolve_gym_pr_bucket_id(
    pr: dict[str, Any],
    member: dict[str, Any] | None = None,
) -> str | None:
    bucket_id = pr.get("canonical_bucket_id")
    if bucket_id:
        return bucket_id

    sex = normalize_sex(member.get("sex")) if member else None
    if not sex:
        return None

    ruleset = pr.get("meet_ruleset") or (
        member.get("ruleset") if member else None
    ) or get_ruleset_from_federation(member.get("federation") if member else None)

    class_token = pr.get("meet_weight_class_kg")
    if class_token is None and member:
        class_token = member.get("weight_class_kg")
    if class_token is None and member:
        class_token = normalize_class_token(member.get("weight_class"))

    return resolve_bucket_id(sex, ruleset, class_token)


def _compute_bests_from_gym_prs(
    gym_prs: list[dict[str, Any]],
    member: dict[str, Any] | None = None,
) -> dict[LiftBucketKey, dict[str, Any]]:
    best: dict[LiftBucketKey, dict[str, Any]] = {}

    for pr in gym_prs:
        bucket_id = _resolve_gym_pr_bucket_id(pr, member)
        if not bucket_id:
            continue

        lift = str(pr.get("lift", "")).lower()
        if lift not in MEET_LIFT_FIELDS:
            continue

        weight = _parse_float(pr.get("weight_kg"))
        if weight is None or weight <= 0:
            continue

        equipment = _normalize_equipment(pr.get("equipment"))
        key = _lift_bucket_key(lift, equipment, bucket_id)
        current = best.get(key)
        if current is None or weight > current["weight_kg"]:
            best[key] = {
                "weight_kg": weight,
                "weight_lbs": kg_to_lbs(weight),
                "source": "gym",
                "equipment": equipment,
                "achieved_date": pr.get("logged_at"),
                "meet_name": None,
                "federation": None,
                "is_meet_verified": False,
                "canonical_bucket_id": bucket_id,
                "meet_ruleset": pr.get("meet_ruleset")
                or (member.get("ruleset") if member else None),
                "meet_weight_class_kg": pr.get("meet_weight_class_kg")
                or (member.get("weight_class_kg") if member else None),
                "bodyweight_kg": None,
            }

    return best


def _merge_best_lifts(
    meet_bests: dict[LiftBucketKey, dict[str, Any]],
    gym_bests: dict[LiftBucketKey, dict[str, Any]],
) -> dict[LiftBucketKey, dict[str, Any]]:
    merged = dict(meet_bests)
    for key, gym_entry in gym_bests.items():
        meet_entry = merged.get(key)
        if meet_entry is None or gym_entry["weight_kg"] > meet_entry["weight_kg"]:
            merged[key] = gym_entry
    return merged


def _entry_to_row(member_id: UUID, lift: str, entry: dict[str, Any]) -> dict[str, Any]:
    equipment = _normalize_equipment(entry.get("equipment"))

    return {
        "member_id": str(member_id),
        "lift": lift,
        "equipment": equipment,
        "weight_kg": entry["weight_kg"],
        "weight_lbs": entry.get("weight_lbs") or kg_to_lbs(entry["weight_kg"]),
        "source": entry["source"],
        "achieved_date": entry.get("achieved_date"),
        "meet_name": entry.get("meet_name"),
        "federation": entry.get("federation"),
        "is_meet_verified": bool(entry.get("is_meet_verified", False)),
        "canonical_bucket_id": entry["canonical_bucket_id"],
        "meet_ruleset": entry.get("meet_ruleset"),
        "meet_weight_class_kg": entry.get("meet_weight_class_kg"),
        "bodyweight_kg": entry.get("bodyweight_kg"),
    }


def _entries_to_meet_bests(rows: list[dict[str, Any]]) -> dict[LiftBucketKey, dict[str, Any]]:
    meet_bests: dict[LiftBucketKey, dict[str, Any]] = {}
    for row in rows:
        if row.get("source") not in {"meet", "opl"}:
            continue
        bucket_id = row.get("canonical_bucket_id")
        if not bucket_id:
            continue

        lift = str(row.get("lift", "")).lower()
        equipment = _normalize_equipment(row.get("equipment"))
        key = _lift_bucket_key(lift, equipment, bucket_id)
        meet_bests[key] = {
            "weight_kg": float(row["weight_kg"]),
            "weight_lbs": row.get("weight_lbs"),
            "source": row.get("source") or "opl",
            "equipment": equipment,
            "achieved_date": row.get("achieved_date"),
            "meet_name": row.get("meet_name"),
            "federation": row.get("federation"),
            "is_meet_verified": bool(row.get("is_meet_verified", False)),
            "canonical_bucket_id": bucket_id,
            "meet_ruleset": row.get("meet_ruleset"),
            "meet_weight_class_kg": row.get("meet_weight_class_kg"),
            "bodyweight_kg": row.get("bodyweight_kg"),
        }
    return meet_bests


def _load_member(supabase: Any, member_id: UUID) -> dict[str, Any] | None:
    result = (
        supabase.table("member")
        .select("*")
        .eq("id", str(member_id))
        .maybe_single()
        .execute()
    )
    return result.data if result.data else None


def store_best_lifts(
    supabase: Any,
    member_id: UUID,
    meet_bests: dict[LiftBucketKey, dict[str, Any]] | None = None,
    member: dict[str, Any] | None = None,
) -> int:
    member_key = str(member_id)
    member = member or _load_member(supabase, member_id)

    if meet_bests is None:
        existing = (
            supabase.table("pr_board_entry")
            .select("*")
            .eq("member_id", member_key)
            .execute()
        )
        meet_bests = _entries_to_meet_bests(existing.data or [])

    gym_prs = (
        supabase.table("gym_pr").select("*").eq("member_id", member_key).execute()
    )
    gym_bests = _compute_bests_from_gym_prs(gym_prs.data or [], member)
    merged = _merge_best_lifts(meet_bests, gym_bests)

    if not merged:
        return 0

    rows = []
    for (lift, equipment, _bucket_id), entry in merged.items():
        row = _entry_to_row(member_id, lift, {**entry, "equipment": equipment})
        rows.append(row)

    supabase.table("pr_board_entry").upsert(
        rows,
        on_conflict="member_id,lift,equipment,canonical_bucket_id",
    ).execute()
    return len(rows)


def get_best_lifts_for_member(
    supabase: Any,
    member_id: UUID,
) -> dict[str, list[dict[str, Any]]]:
    rows = (
        supabase.table("pr_board_entry")
        .select("*")
        .eq("member_id", str(member_id))
        .execute()
    ).data
    best: dict[str, list[dict[str, Any]]] = {lift: [] for lift in LIFTS}

    for row in rows:
        lift = str(row.get("lift", "")).lower()
        if lift not in best:
            continue
        best[lift].append(
            {
                "weight_kg": float(row["weight_kg"]),
                "weight_lbs": row.get("weight_lbs"),
                "source": row.get("source"),
                "equipment": _normalize_equipment(row.get("equipment")),
                "achieved_date": row.get("achieved_date"),
                "meet_name": row.get("meet_name"),
                "federation": row.get("federation"),
                "is_meet_verified": bool(row.get("is_meet_verified", False)),
                "canonical_bucket_id": row.get("canonical_bucket_id"),
                "meet_ruleset": row.get("meet_ruleset"),
                "meet_weight_class_kg": row.get("meet_weight_class_kg"),
                "bodyweight_kg": row.get("bodyweight_kg"),
            }
        )

    for lift in LIFTS:
        best[lift].sort(key=lambda entry: entry["weight_kg"], reverse=True)

    return best


async def fetch_opl_athlete_results(username: str) -> dict[str, Any]:
    return await fetch_athlete_results(username)


async def sync_member_opl(member_id: UUID) -> dict[str, Any]:
    from app.services.supabase_client import get_supabase

    supabase = get_supabase()

    member = _load_member(supabase, member_id)
    if not member:
        raise ValueError("Member not found")

    username = member.get("opl_username")
    if not username:
        raise ValueError("Member has no linked OPL username")

    try:
        payload = await fetch_opl_athlete_results(username)
        meets = _extract_meets(payload)
        meet_bests = _compute_bests_from_meets(meets, member=member)
        lifts_stored = store_best_lifts(
            supabase,
            member_id,
            meet_bests=meet_bests,
            member=member,
        )
        if meets:
            persist_highest_dots(
                supabase,
                str(member_id),
                compute_highest_dots_from_meets(meets, member=member),
            )

        supabase.table("member").update(
            {
                "opl_match_status": "linked",
                "opl_linked_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", str(member_id)).execute()

        log = (
            supabase.table("opl_sync_log")
            .insert(
                {
                    "member_id": str(member_id),
                    "status": "success",
                    "results_added": lifts_stored,
                }
            )
            .execute()
        )

        return {
            "member_id": str(member_id),
            "status": "success",
            "results_added": lifts_stored,
            "sync_log_id": log.data[0]["id"],
        }
    except Exception as exc:
        supabase.table("opl_sync_log").insert(
            {
                "member_id": str(member_id),
                "status": "error",
                "error_message": str(exc),
                "results_added": 0,
            }
        ).execute()
        raise
