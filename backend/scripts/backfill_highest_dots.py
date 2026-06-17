#!/usr/bin/env python3
"""Recompute member highest DOTS by re-syncing connected OPL members."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.opl_sync import sync_member_results
from app.services.supabase_client import get_supabase

CONNECTED_STATUSES = ("auto_linked", "probable_match", "linked")


async def backfill_highest_dots(*, limit: int | None = None) -> dict[str, int]:
    supabase = get_supabase()
    members = (
        supabase.table("member")
        .select("id, opl_username, first_name, last_name, opl_match_status")
        .in_("opl_match_status", list(CONNECTED_STATUSES))
        .execute()
    ).data
    members = [row for row in members if row.get("opl_username")]

    if limit is not None:
        members = members[:limit]

    summary = {"attempted": len(members), "synced": 0, "errors": 0}

    for index, member in enumerate(members):
        if index > 0:
            await asyncio.sleep(1)

        member_id = str(member["id"])
        opl_username = str(member["opl_username"])
        try:
            result = await sync_member_results(member_id, opl_username)
            if result["status"] == "success":
                summary["synced"] += 1
            else:
                summary["errors"] += 1
            print(
                f"[{index + 1}/{len(members)}] "
                f"{member.get('first_name')} {member.get('last_name')} "
                f"@{opl_username} -> {result['status']}"
            )
        except Exception as exc:
            summary["errors"] += 1
            print(
                f"[{index + 1}/{len(members)}] "
                f"{member.get('first_name')} {member.get('last_name')} "
                f"@{opl_username} -> error: {exc}"
            )

    return summary


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    summary = await backfill_highest_dots(limit=args.limit)
    print("DOTS backfill summary:", summary)


if __name__ == "__main__":
    asyncio.run(main())
