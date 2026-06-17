#!/usr/bin/env python3
"""Import Catalyst member CSV, match OPL profiles, and sync PR board data."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.opl_matching import run_batch_matching
from app.services.opl_sync import sync_member_results
from app.services.pushpress_import import import_members_from_csv
from app.services.supabase_client import get_supabase


async def sync_auto_linked_members(limit: int | None = None) -> dict[str, int]:
    supabase = get_supabase()
    response = (
        supabase.table("member")
        .select("id, opl_username, first_name, last_name")
        .in_("opl_match_status", ["auto_linked", "probable_match"])
        .execute()
    )
    members = [row for row in response.data if row.get("opl_username")]
    if limit is not None:
        members = members[:limit]

    summary = {"synced": 0, "prs_updated": 0, "errors": 0}
    for index, member in enumerate(members):
        if index > 0:
            await asyncio.sleep(1)

        member_id = str(member["id"])
        opl_username = str(member["opl_username"])
        try:
            result = await sync_member_results(member_id, opl_username)
            summary["synced"] += 1
            if result.get("prs_updated"):
                summary["prs_updated"] += 1
            print(
                f"  synced {member.get('first_name')} {member.get('last_name')} "
                f"({opl_username}) -> prs_updated={result.get('prs_updated')}"
            )
        except Exception as exc:
            summary["errors"] += 1
            print(
                f"  error syncing {member.get('first_name')} {member.get('last_name')}: {exc}",
                file=sys.stderr,
            )

    return summary


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--csv",
        default=str(Path(__file__).resolve().parents[2] / "data" / "Catalyst-Members-061226.csv"),
        help="Path to Catalyst member CSV export",
    )
    parser.add_argument(
        "--skip-matching",
        action="store_true",
        help="Only import members; do not run OPL name matching",
    )
    parser.add_argument(
        "--skip-sync",
        action="store_true",
        help="Skip OPL results sync after matching",
    )
    parser.add_argument(
        "--match-limit",
        type=int,
        default=None,
        help="Only match the first N imported members to OPL",
    )
    parser.add_argument(
        "--sync-limit",
        type=int,
        default=None,
        help="Only sync PR data for the first N auto-linked members",
    )
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"CSV not found: {csv_path}", file=sys.stderr)
        return 1

    print(f"Importing members from {csv_path} ...")
    import_result = import_members_from_csv(str(csv_path))
    print("Import summary:")
    for key, value in import_result.items():
        if key == "queued_member_ids":
            print(f"  {key}: {len(value)}")
        else:
            print(f"  {key}: {value}")

    if args.skip_matching:
        return 0

    queued_ids = import_result.get("queued_member_ids", [])
    if args.match_limit is not None:
        queued_ids = queued_ids[: args.match_limit]
    print(f"\nMatching {len(queued_ids)} members to OPL profiles ...")
    matching_summary = await run_batch_matching(queued_ids)
    print("Matching summary:")
    for key, value in matching_summary.items():
        print(f"  {key}: {value}")

    if args.skip_sync:
        return 0

    print("\nSyncing OPL results for auto-linked members ...")
    sync_summary = await sync_auto_linked_members(limit=args.sync_limit)
    print("Sync summary:")
    for key, value in sync_summary.items():
        print(f"  {key}: {value}")

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
