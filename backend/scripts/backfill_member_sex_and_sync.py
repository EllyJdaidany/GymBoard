#!/usr/bin/env python3
"""Backfill member sex from PR bucket data / CSV gender, then sync linked members."""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import pandas as pd

from app.services.opl_sync import sync_member_results
from app.services.pushpress_import import _normalize_sex_from_gender
from app.services.supabase_client import get_supabase
from app.services.weight_class_buckets import infer_sex_from_bucket_id, normalize_sex
from app.services.opl_service import infer_unanimous_sex_from_bucket_ids

CONNECTED_STATUSES = ("auto_linked", "probable_match", "linked")


def backfill_sex_from_csv(csv_path: Path) -> int:
    supabase = get_supabase()
    df = pd.read_csv(csv_path)
    updated = 0

    for _, row in df.iterrows():
        sex = _normalize_sex_from_gender(row.get("gender"))
        if not sex:
            continue

        email = str(row.get("email", "")).strip().lower()
        if not email:
            continue

        response = (
            supabase.table("member")
            .select("id, sex")
            .eq("email", email)
            .limit(1)
            .execute()
        )
        if not response.data:
            continue

        member = response.data[0]
        if normalize_sex(member.get("sex")):
            continue

        supabase.table("member").update({"sex": sex}).eq("id", member["id"]).execute()
        updated += 1

    return updated


def backfill_sex_from_pr_entries() -> int:
    supabase = get_supabase()
    members = (
        supabase.table("member")
        .select("id, sex")
        .execute()
    ).data

    entries = (
        supabase.table("pr_board_entry")
        .select("member_id, canonical_bucket_id")
        .execute()
    ).data

    buckets_by_member: dict[str, set[str]] = {}
    for entry in entries:
        bucket_id = entry.get("canonical_bucket_id")
        if not bucket_id:
            continue
        member_id = str(entry["member_id"])
        buckets_by_member.setdefault(member_id, set()).add(str(bucket_id))

    updated = 0
    for member in members:
        member_id = str(member["id"])
        bucket_ids = buckets_by_member.get(member_id, set())
        inferred = infer_unanimous_sex_from_bucket_ids(bucket_ids)
        if not inferred:
            continue

        current = normalize_sex(member.get("sex"))
        if current == inferred:
            continue

        supabase.table("member").update({"sex": inferred}).eq("id", member_id).execute()
        updated += 1

    return updated


async def sync_connected_members(
    *,
    only_missing_prs: bool = False,
    limit: int | None = None,
) -> dict[str, int]:
    supabase = get_supabase()
    members = (
        supabase.table("member")
        .select("id, opl_username, first_name, last_name, opl_match_status")
        .in_("opl_match_status", list(CONNECTED_STATUSES))
        .execute()
    ).data
    members = [row for row in members if row.get("opl_username")]

    if only_missing_prs:
        entry_rows = (
            supabase.table("pr_board_entry")
            .select("member_id")
            .execute()
        ).data
        members_with_prs = {str(row["member_id"]) for row in entry_rows}
        members = [row for row in members if str(row["id"]) not in members_with_prs]

    if limit is not None:
        members = members[:limit]

    summary = {"attempted": len(members), "synced": 0, "prs_updated": 0, "errors": 0}

    for index, member in enumerate(members):
        if index > 0:
            await asyncio.sleep(1)

        member_id = str(member["id"])
        opl_username = str(member["opl_username"])
        try:
            result = await sync_member_results(member_id, opl_username)
            if result["status"] == "success":
                summary["synced"] += 1
                if result["prs_updated"]:
                    summary["prs_updated"] += 1
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
    parser.add_argument(
        "--csv",
        default=str(BACKEND_ROOT.parent / "data" / "Catalyst-Members-061226.csv"),
        help="Catalyst member CSV for gender backfill",
    )
    parser.add_argument(
        "--skip-sync",
        action="store_true",
        help="Only backfill sex, do not run OPL sync",
    )
    parser.add_argument(
        "--sync-all-connected",
        action="store_true",
        help="Sync every connected member, not only those missing PR rows",
    )
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if csv_path.exists():
        csv_updated = backfill_sex_from_csv(csv_path)
        print(f"Backfilled sex from CSV gender: {csv_updated}")
    else:
        print(f"CSV not found, skipping gender backfill: {csv_path}")

    pr_updated = backfill_sex_from_pr_entries()
    print(f"Backfilled sex from PR bucket data: {pr_updated}")

    if args.skip_sync:
        return

    sync_summary = await sync_connected_members(
        only_missing_prs=not args.sync_all_connected,
        limit=args.limit,
    )
    print("Sync summary:", sync_summary)


if __name__ == "__main__":
    asyncio.run(main())
