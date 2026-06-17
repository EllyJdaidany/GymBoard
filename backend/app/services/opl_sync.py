from __future__ import annotations

from typing import Any
from uuid import UUID

import httpx

from app.services.weight_class_buckets import normalize_sex
from app.services.opl_service import (
    LiftBucketKey,
    _compute_bests_from_meets,
    _extract_meets,
    _infer_sex_from_meets,
    _normalize_equipment,
    compute_highest_dots_from_meets,
    fetch_opl_athlete_results,
    infer_member_sex_from_meet_bests,
    persist_highest_dots,
    persist_member_sex_if_missing,
    reconcile_member_sex,
    store_best_lifts,
)

OPL_BOARD_SOURCES = ("opl", "meet")
from app.services.supabase_client import get_supabase


def _load_existing_entries(
    supabase: Any, member_id: str
) -> dict[LiftBucketKey, dict[str, Any]]:
    response = (
        supabase.table("pr_board_entry")
        .select("*")
        .eq("member_id", member_id)
        .execute()
    )
    existing: dict[LiftBucketKey, dict[str, Any]] = {}
    for row in response.data or []:
        bucket_id = row.get("canonical_bucket_id")
        if not bucket_id:
            continue
        lift = str(row.get("lift", "")).lower()
        equipment = _normalize_equipment(row.get("equipment"))
        existing[(lift, equipment, bucket_id)] = row
    return existing


def _has_improved_entries(
    existing: dict[LiftBucketKey, dict[str, Any]],
    computed: dict[LiftBucketKey, dict[str, Any]],
) -> bool:
    for key, entry in computed.items():
        current = existing.get(key)
        if current is None:
            return True
        if entry["weight_kg"] > float(current["weight_kg"]):
            return True
    return False


async def sync_member_results(member_id: str, opl_username: str) -> dict[str, Any]:
    supabase = get_supabase()
    prs_updated = False
    status = "success"

    try:
        member_result = (
            supabase.table("member")
            .select("*")
            .eq("id", member_id)
            .maybe_single()
            .execute()
        )
        member = member_result.data

        payload = await fetch_opl_athlete_results(opl_username)
        meets = _extract_meets(payload)
        computed_bests = _compute_bests_from_meets(meets, member=member)
        existing_entries = _load_existing_entries(supabase, member_id)
        prs_updated = _has_improved_entries(existing_entries, computed_bests)

        if computed_bests:
            store_best_lifts(
                supabase,
                UUID(member_id),
                meet_bests=computed_bests,
                member=member,
            )

        if meets:
            persist_highest_dots(
                supabase,
                member_id,
                compute_highest_dots_from_meets(meets, member=member),
            )

        bucket_sex = infer_member_sex_from_meet_bests(computed_bests)
        if bucket_sex:
            reconcile_member_sex(supabase, member_id, bucket_sex)
        elif member and not normalize_sex(member.get("sex")):
            inferred_sex = _infer_sex_from_meets(meets)
            if inferred_sex:
                persist_member_sex_if_missing(supabase, member_id, inferred_sex)

        supabase.table("opl_sync_log").insert(
            {
                "member_id": member_id,
                "status": status,
                "results_added": 1 if prs_updated else 0,
            }
        ).execute()

        return {"prs_updated": prs_updated, "status": status}

    except httpx.HTTPError as exc:
        status = "error"
        supabase.table("opl_sync_log").insert(
            {
                "member_id": member_id,
                "status": status,
                "error_message": str(exc),
                "results_added": 0,
            }
        ).execute()
        return {"prs_updated": False, "status": status}

    except Exception as exc:
        status = "error"
        supabase.table("opl_sync_log").insert(
            {
                "member_id": member_id,
                "status": status,
                "error_message": str(exc),
                "results_added": 0,
            }
        ).execute()
        raise


def unlink_member_opl(member_id: str) -> dict[str, Any]:
    """Clear OPL link and remove meet-sourced board data for a member."""
    supabase = get_supabase()
    response = (
        supabase.table("member")
        .select("id, opl_username")
        .eq("id", member_id)
        .limit(1)
        .execute()
    )
    if not response.data:
        raise ValueError("Member not found")

    member = response.data[0]
    previous_username = member.get("opl_username")
    if not previous_username:
        return {
            "member_id": member_id,
            "opl_username": None,
            "opl_match_status": "no_profile",
            "already_unlinked": True,
        }

    supabase.table("pr_board_entry").delete().eq("member_id", member_id).in_(
        "source", list(OPL_BOARD_SOURCES)
    ).execute()
    store_best_lifts(supabase, UUID(member_id), meet_bests={})
    persist_highest_dots(supabase, member_id, None)

    supabase.table("member").update(
        {
            "opl_username": None,
            "opl_match_status": "no_profile",
            "opl_linked_at": None,
        }
    ).eq("id", member_id).execute()

    supabase.table("opl_sync_log").insert(
        {
            "member_id": member_id,
            "status": "unlinked",
            "error_message": f"Unlinked from @{previous_username}",
            "results_added": 0,
        }
    ).execute()

    return {
        "member_id": member_id,
        "opl_username": None,
        "opl_match_status": "no_profile",
        "previous_username": previous_username,
    }
