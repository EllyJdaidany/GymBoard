from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from app.services.opl_service import LIFTS, kg_to_lbs, store_best_lifts
from app.services.weight_class_buckets import (
    get_ruleset_from_federation,
    normalize_sex,
    resolve_bucket_id_with_fallback,
)
from app.utils.names import capitalize_name_part


def _generate_gym_member_email(
    supabase: Any,
    first_name: str,
    last_name: str,
) -> str:
    slug = f"{first_name}-{last_name}".lower().replace(" ", "-")
    base = f"{slug}@gym.manual.catalyst"
    candidate = base
    suffix = 1
    while True:
        existing = (
            supabase.table("member")
            .select("id")
            .eq("email", candidate)
            .limit(1)
            .execute()
        )
        if not existing.data:
            return candidate
        suffix += 1
        candidate = f"{slug}+{suffix}@gym.manual.catalyst"


def find_members_by_name(
    supabase: Any,
    first_name: str,
    last_name: str,
) -> list[dict[str, Any]]:
    return (
        supabase.table("member")
        .select("*")
        .eq("first_name", first_name)
        .eq("last_name", last_name)
        .order("created_at")
        .execute()
    ).data or []


def resolve_or_create_gym_member(
    supabase: Any,
    *,
    first_name: str,
    last_name: str,
    sex: str,
    weight_class_kg: float,
    member_id: UUID | None = None,
) -> tuple[dict[str, Any], bool]:
    normalized_sex = normalize_sex(sex)
    if not normalized_sex:
        raise ValueError("Sex must be male, female, or mx")

    if member_id is not None:
        response = (
            supabase.table("member")
            .select("*")
            .eq("id", str(member_id))
            .limit(1)
            .execute()
        )
        if not response.data:
            raise LookupError("Member not found")
        member = response.data[0]
        _update_member_profile(
            supabase,
            member,
            sex=normalized_sex,
            weight_class_kg=weight_class_kg,
        )
        return member, False

    matches = find_members_by_name(supabase, first_name, last_name)
    if len(matches) > 1:
        raise AmbiguousMemberError(matches)
    if len(matches) == 1:
        member = matches[0]
        _update_member_profile(
            supabase,
            member,
            sex=normalized_sex,
            weight_class_kg=weight_class_kg,
        )
        return member, False

    email = _generate_gym_member_email(supabase, first_name, last_name)
    ruleset = "traditional"
    member_row = {
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "sex": normalized_sex,
        "weight_class_kg": weight_class_kg,
        "weight_class": f"{weight_class_kg:g}kg",
        "ruleset": ruleset,
        "opl_match_status": "no_profile",
    }
    response = supabase.table("member").insert(member_row).execute()
    return response.data[0], True


def _update_member_profile(
    supabase: Any,
    member: dict[str, Any],
    *,
    sex: str,
    weight_class_kg: float,
) -> None:
    updates: dict[str, Any] = {}
    if member.get("sex") != sex:
        updates["sex"] = sex
    if member.get("weight_class_kg") != weight_class_kg:
        updates["weight_class_kg"] = weight_class_kg
        updates["weight_class"] = f"{weight_class_kg:g}kg"
    if not member.get("ruleset"):
        updates["ruleset"] = get_ruleset_from_federation(member.get("federation"))

    if updates:
        supabase.table("member").update(updates).eq("id", str(member["id"])).execute()
        member.update(updates)


class AmbiguousMemberError(Exception):
    def __init__(self, members: list[dict[str, Any]]) -> None:
        self.members = members
        super().__init__("Multiple members match that name")


def replace_gym_prs_for_member(
    supabase: Any,
    member: dict[str, Any],
    lifts: dict[str, float | None],
    *,
    clear_when_empty: bool = False,
) -> int:
    member_id = str(member["id"])
    sex = normalize_sex(member.get("sex"))
    ruleset = member.get("ruleset") or get_ruleset_from_federation(member.get("federation"))
    class_token = member.get("weight_class_kg")
    bucket_id, resolved_ruleset = resolve_bucket_id_with_fallback(sex, ruleset, class_token)
    if not bucket_id:
        raise ValueError("Could not resolve weight class bucket for this member")

    now = datetime.now(timezone.utc).isoformat()
    updated = 0

    for lift in LIFTS:
        weight_kg = lifts.get(lift)
        if weight_kg is None or weight_kg <= 0:
            if clear_when_empty:
                supabase.table("gym_pr").delete().eq("member_id", member_id).eq("lift", lift).execute()
            continue

        supabase.table("gym_pr").delete().eq("member_id", member_id).eq("lift", lift).execute()
        supabase.table("gym_pr").insert(
            {
                "member_id": member_id,
                "lift": lift,
                "weight_kg": weight_kg,
                "weight_lbs": kg_to_lbs(weight_kg),
                "equipment": "raw",
                "source": "gym",
                "logged_at": now,
                "canonical_bucket_id": bucket_id,
                "meet_ruleset": resolved_ruleset,
                "meet_weight_class_kg": class_token,
            }
        ).execute()
        updated += 1

    return updated


def _aggregate_gym_prs_by_member(gym_prs: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
    by_member: dict[str, dict[str, float]] = {}
    for pr in gym_prs:
        member_id = str(pr["member_id"])
        lift = pr.get("lift")
        weight_kg = pr.get("weight_kg")
        if not lift or weight_kg is None:
            continue
        current = by_member.setdefault(member_id, {}).get(lift, 0)
        if weight_kg > current:
            by_member[member_id][lift] = float(weight_kg)
    return by_member


def _member_gym_pr_entry(member: dict[str, Any], lifts: dict[str, float]) -> dict[str, Any]:
    return {
        "member_id": str(member["id"]),
        "first_name": member.get("first_name") or "",
        "last_name": member.get("last_name") or "",
        "sex": member.get("sex"),
        "weight_class_kg": member.get("weight_class_kg"),
        "email": member.get("email"),
        "squat_kg": lifts.get("squat"),
        "bench_kg": lifts.get("bench"),
        "deadlift_kg": lifts.get("deadlift"),
        "total_kg": lifts.get("total"),
    }


def list_gym_pr_members(supabase: Any) -> list[dict[str, Any]]:
    gym_prs = supabase.table("gym_pr").select("*").execute().data or []
    if not gym_prs:
        return []

    by_member = _aggregate_gym_prs_by_member(gym_prs)
    member_ids = list(by_member.keys())
    members_response = (
        supabase.table("member")
        .select("id, first_name, last_name, sex, weight_class_kg, email")
        .in_("id", member_ids)
        .execute()
    )
    members_by_id = {str(row["id"]): row for row in (members_response.data or [])}

    entries = [
        _member_gym_pr_entry(members_by_id[member_id], lifts)
        for member_id, lifts in by_member.items()
        if member_id in members_by_id
    ]
    entries.sort(key=lambda row: (row["last_name"].lower(), row["first_name"].lower()))
    return entries


def get_member_gym_prs(supabase: Any, member_id: UUID) -> dict[str, Any] | None:
    member_key = str(member_id)
    member_response = (
        supabase.table("member")
        .select("id, first_name, last_name, sex, weight_class_kg, email")
        .eq("id", member_key)
        .limit(1)
        .execute()
    )
    if not member_response.data:
        return None

    gym_prs = (
        supabase.table("gym_pr")
        .select("*")
        .eq("member_id", member_key)
        .execute()
    ).data or []
    if not gym_prs:
        return None

    lifts = _aggregate_gym_prs_by_member(gym_prs).get(member_key, {})
    return _member_gym_pr_entry(member_response.data[0], lifts)


def upsert_member_gym_prs(
    supabase: Any,
    *,
    first_name: str,
    last_name: str,
    sex: str,
    weight_class_kg: float,
    squat_kg: float | None = None,
    bench_kg: float | None = None,
    deadlift_kg: float | None = None,
    total_kg: float | None = None,
    member_id: UUID | None = None,
) -> dict[str, Any]:
    normalized_first = capitalize_name_part(first_name.strip())
    normalized_last = capitalize_name_part(last_name.strip())
    if not normalized_first or not normalized_last:
        raise ValueError("First and last name are required")

    lifts = {
        "squat": squat_kg,
        "bench": bench_kg,
        "deadlift": deadlift_kg,
        "total": total_kg,
    }
    if not any(weight is not None and weight > 0 for weight in lifts.values()):
        raise ValueError("At least one lift must be greater than zero")

    member, member_created = resolve_or_create_gym_member(
        supabase,
        first_name=normalized_first,
        last_name=normalized_last,
        sex=sex,
        weight_class_kg=weight_class_kg,
        member_id=member_id,
    )

    prs_updated = replace_gym_prs_for_member(
        supabase,
        member,
        lifts,
        clear_when_empty=member_id is not None,
    )
    board_entries_updated = store_best_lifts(
        supabase,
        UUID(str(member["id"])),
        member=member,
    )

    return {
        "member_id": str(member["id"]),
        "member_created": member_created,
        "prs_updated": prs_updated,
        "board_entries_updated": board_entries_updated,
    }
