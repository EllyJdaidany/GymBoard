from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any

import httpx

from app.services.close_powerlifting import REQUEST_TIMEOUT, search_athletes
from app.services.supabase_client import get_supabase


def _determine_outcome(
    candidates: list[dict[str, Any]], birth_year: int
) -> dict[str, Any]:
    if not candidates:
        return {"status": "no_profile"}

    matches = [c for c in candidates if c.get("birth_year") == birth_year]

    if len(matches) == 1:
        return {"status": "auto_linked", "username": matches[0]["username"]}

    if len(matches) > 1:
        return {
            "status": "needs_review",
            "candidates": [
                {"username": c["username"], "name": c["name"]} for c in matches
            ],
        }

    has_any_birth_year = any(c.get("birth_year") is not None for c in candidates)

    if not has_any_birth_year and len(candidates) == 1:
        return {"status": "probable_match", "username": candidates[0]["username"]}

    if len(candidates) > 1:
        return {
            "status": "needs_review",
            "candidates": [
                {"username": c["username"], "name": c["name"]} for c in candidates
            ],
        }

    return {"status": "no_profile"}


def _persist_matching_result(member_id: str, result: dict[str, Any]) -> None:
    supabase = get_supabase()
    status = result["status"]
    now = datetime.now(timezone.utc).isoformat()

    member_update: dict[str, Any] = {"opl_match_status": status}

    if status == "auto_linked":
        member_update["opl_username"] = result["username"]
        member_update["opl_linked_at"] = now
    elif status == "probable_match":
        member_update["opl_username"] = result["username"]

    supabase.table("member").update(member_update).eq("id", member_id).execute()

    log_payload: dict[str, Any] = {
        "member_id": member_id,
        "status": status,
        "results_added": 0,
    }
    if status == "error":
        log_payload["error_message"] = result.get("reason", "unknown error")
    elif status == "needs_review":
        log_payload["error_message"] = json.dumps(result.get("candidates", []))

    supabase.table("opl_sync_log").insert(log_payload).execute()


async def match_member_to_opl(
    member_id: str, first_name: str, last_name: str, birth_year: int
) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            candidates = await search_athletes(client, first_name, last_name)
            enriched_candidates = [{**candidate, "birth_year": None} for candidate in candidates]
            result = _determine_outcome(enriched_candidates, birth_year)
    except httpx.TimeoutException:
        result = {"status": "error", "reason": "timeout"}
    except httpx.HTTPError as exc:
        result = {"status": "error", "reason": str(exc)}

    _persist_matching_result(member_id, result)
    return result


def parse_birth_year(date_of_birth: Any) -> int | None:
    if date_of_birth is None or str(date_of_birth).strip() == "":
        return None
    try:
        return int(str(date_of_birth)[:4])
    except ValueError:
        return None


async def run_batch_matching(member_ids: list[str]) -> dict[str, int]:
    supabase = get_supabase()
    summary: dict[str, int] = {
        "auto_linked": 0,
        "needs_review": 0,
        "probable_match": 0,
        "no_profile": 0,
        "error": 0,
        "skipped": 0,
    }

    for index, member_id in enumerate(member_ids):
        if index > 0:
            await asyncio.sleep(1)

        response = (
            supabase.table("member")
            .select("id, first_name, last_name, date_of_birth")
            .eq("id", member_id)
            .limit(1)
            .execute()
        )
        if not response.data:
            summary["skipped"] += 1
            continue

        member = response.data[0]
        first_name = member.get("first_name")
        last_name = member.get("last_name")
        birth_year = parse_birth_year(member.get("date_of_birth"))

        if not first_name or not last_name or birth_year is None:
            summary["skipped"] += 1
            continue

        result = await match_member_to_opl(
            member_id=member_id,
            first_name=first_name,
            last_name=last_name,
            birth_year=birth_year,
        )
        status = result.get("status", "error")
        if status in summary:
            summary[status] += 1
        else:
            summary["error"] += 1

    return summary
