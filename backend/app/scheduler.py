from __future__ import annotations

import asyncio
import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.services.opl_matching import match_member_to_opl, parse_birth_year
from app.services.opl_sync import sync_member_results
from app.services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
CHICAGO = ZoneInfo("America/Chicago")

scheduler = AsyncIOScheduler(timezone=CHICAGO)


async def nightly_sync() -> None:
    supabase = get_supabase()
    response = (
        supabase.table("member")
        .select("id, opl_username")
        .in_("opl_match_status", ["auto_linked", "probable_match"])
        .execute()
    )
    members = [row for row in response.data if row.get("opl_username")]

    members_synced = 0
    prs_updated = 0
    errors = 0

    for index, member in enumerate(members):
        if index > 0:
            await asyncio.sleep(1)

        member_id = str(member["id"])
        opl_username = str(member["opl_username"])

        try:
            result = await sync_member_results(member_id, opl_username)
            if result["status"] == "success":
                members_synced += 1
                if result["prs_updated"]:
                    prs_updated += 1
            else:
                errors += 1
        except Exception:
            errors += 1
            logger.exception("nightly_sync failed for member %s", member_id)

    logger.info(
        "nightly_sync complete: total=%s synced=%s prs_updated=%s errors=%s",
        len(members),
        members_synced,
        prs_updated,
        errors,
    )


async def weekly_rematch() -> None:
    supabase = get_supabase()
    response = (
        supabase.table("member")
        .select("id, first_name, last_name, date_of_birth, opl_match_status")
        .in_("opl_match_status", ["needs_review", "probable_match"])
        .execute()
    )

    summary = {
        "total": len(response.data),
        "auto_linked": 0,
        "needs_review": 0,
        "probable_match": 0,
        "no_profile": 0,
        "error": 0,
        "skipped": 0,
    }

    for index, member in enumerate(response.data):
        if index > 0:
            await asyncio.sleep(1)

        member_id = str(member["id"])
        first_name = member.get("first_name")
        last_name = member.get("last_name")
        birth_year = parse_birth_year(member.get("date_of_birth"))

        if not first_name or not last_name or birth_year is None:
            summary["skipped"] += 1
            continue

        try:
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
        except Exception:
            summary["error"] += 1
            logger.exception("weekly_rematch failed for member %s", member_id)

    logger.info("weekly_rematch complete: %s", summary)


def start_scheduler() -> None:
    if scheduler.running:
        return

    scheduler.add_job(
        nightly_sync,
        trigger="cron",
        hour=3,
        minute=0,
        id="nightly_sync",
        replace_existing=True,
    )
    scheduler.add_job(
        weekly_rematch,
        trigger="cron",
        day_of_week="sun",
        hour=4,
        minute=0,
        id="weekly_rematch",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started with nightly_sync and weekly_rematch jobs")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
