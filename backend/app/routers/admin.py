import asyncio
from datetime import date, datetime, timezone
from typing import Any, Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from pydantic import BaseModel, field_validator

from app.services.close_powerlifting import (
    OplProfileAmbiguousError,
    OplProfileNotFoundError,
    REQUEST_TIMEOUT,
    lookup_opl_profile,
    resolve_opl_profile_input,
    search_athletes,
)
from app.services.gym_pr_service import (
    AmbiguousMemberError,
    get_member_gym_prs,
    list_gym_pr_members,
    upsert_member_gym_prs,
)
from app.services.opl_matching import match_member_to_opl, parse_birth_year, run_batch_matching
from app.services.opl_sync import sync_member_results, unlink_member_opl
from app.services.pushpress_import import import_members_from_csv
from app.utils.names import capitalize_name_part
from app.services.supabase_client import get_supabase
from app.services.weight_class_buckets import normalize_sex

router = APIRouter(prefix="/admin", tags=["admin"])

ATTENTION_STATUSES = ("needs_review", "probable_match", "error")
LINKED_STATUSES = ("auto_linked", "probable_match", "linked")
CONNECTED_STATUSES = ("auto_linked", "probable_match", "linked")
OTHER_STATUSES = ("needs_review", "error")


class ImportSummary(BaseModel):
    created: int
    updated: int
    already_exists: int
    skipped: int
    inactive_filtered: int
    excluded_plan_filtered: int
    expired_plan_filtered: int
    duplicates_discarded: int
    data_conflicts: int
    invalid_email: int
    missing_dob: int
    invalid_dob: int
    queued_for_matching: int


class MatchingSummary(BaseModel):
    auto_linked: int
    needs_review: int
    probable_match: int
    no_profile: int
    error: int
    skipped: int


class ImportCsvResponse(BaseModel):
    import_summary: ImportSummary
    matching_summary: MatchingSummary


class AdminStats(BaseModel):
    total_members: int
    opl_linked: int
    needs_review: int
    no_profile: int


class LastSyncAttempt(BaseModel):
    run_at: str | None = None
    status: str | None = None
    error_message: str | None = None


class AttentionMember(BaseModel):
    id: str
    first_name: str
    last_name: str
    opl_match_status: str
    opl_username: str | None = None
    last_sync: LastSyncAttempt | None = None

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        if value is None or not isinstance(value, str):
            return value
        return capitalize_name_part(value)


class AttentionMembersResponse(BaseModel):
    members: list[AttentionMember]


class AdminMemberRow(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: str | None = None
    opl_match_status: str | None = None
    opl_username: str | None = None
    opl_linked_at: str | None = None

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        if value is None or not isinstance(value, str):
            return value
        return capitalize_name_part(value)


class AdminMemberFilterCounts(BaseModel):
    all: int
    connected: int
    no_connection: int
    other: int


class AdminMembersResponse(BaseModel):
    members: list[AdminMemberRow]
    counts: AdminMemberFilterCounts
    filter: str


class OplCandidate(BaseModel):
    username: str
    name: str


class OplProfilePreview(BaseModel):
    username: str
    name: str
    total_entries: int | None = None
    first_meet: str | None = None
    last_meet: str | None = None


class OplProfileLookupResponse(BaseModel):
    profile: OplProfilePreview | None = None
    candidates: list[OplCandidate] = []
    error: str | None = None


class ResolveMemberRequest(BaseModel):
    username: str


class CreateManualMemberRequest(BaseModel):
    first_name: str
    last_name: str
    opl: str
    email: str | None = None
    sex: str | None = None
    date_of_birth: date | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Value is required")
        return capitalize_name_part(trimmed)

    @field_validator("opl")
    @classmethod
    def strip_required_opl(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Value is required")
        return trimmed

    @field_validator("email")
    @classmethod
    def strip_optional_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip().lower()
        return trimmed or None


class CreateManualMemberResponse(BaseModel):
    member: AdminMemberRow
    opl_profile_name: str | None = None
    email_generated: bool = False
    sync: dict[str, Any]


class SyncAllSummary(BaseModel):
    total: int
    members_synced: int
    prs_updated: int
    errors: int


class SyncLogEntry(BaseModel):
    id: str
    member_id: str
    member_name: str | None = None
    run_at: str
    status: str
    error_message: str | None = None
    results_added: int


class SyncLogResponse(BaseModel):
    entries: list[SyncLogEntry]


class UpsertGymPrsRequest(BaseModel):
    first_name: str
    last_name: str
    sex: str
    weight_class_kg: float
    squat_kg: float | None = None
    bench_kg: float | None = None
    deadlift_kg: float | None = None
    total_kg: float | None = None
    member_id: UUID | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Value is required")
        return capitalize_name_part(trimmed)

    @field_validator("sex")
    @classmethod
    def validate_sex(cls, value: str) -> str:
        normalized = normalize_sex(value)
        if not normalized:
            raise ValueError("Sex must be male, female, or mx")
        return normalized

    @field_validator("weight_class_kg", "squat_kg", "bench_kg", "deadlift_kg", "total_kg")
    @classmethod
    def validate_positive_weight(cls, value: float | None) -> float | None:
        if value is None:
            return None
        if value <= 0:
            raise ValueError("Weight must be greater than zero")
        return value


class UpsertGymPrsResponse(BaseModel):
    member_id: str
    member_created: bool
    prs_updated: int
    board_entries_updated: int


class GymPrMemberEntry(BaseModel):
    member_id: str
    first_name: str
    last_name: str
    sex: str | None = None
    weight_class_kg: float | None = None
    email: str | None = None
    squat_kg: float | None = None
    bench_kg: float | None = None
    deadlift_kg: float | None = None
    total_kg: float | None = None


class GymPrMemberListResponse(BaseModel):
    members: list[GymPrMemberEntry]


def _count_members_by_status() -> AdminStats:
    supabase = get_supabase()
    members = supabase.table("member").select("opl_match_status, opl_username").execute().data

    total_members = len(members)
    opl_linked = sum(
        1
        for member in members
        if member.get("opl_match_status") in LINKED_STATUSES and member.get("opl_username")
    )
    needs_review = sum(
        1 for member in members if member.get("opl_match_status") == "needs_review"
    )
    no_profile = sum(
        1
        for member in members
        if member.get("opl_match_status") in (None, "", "no_profile")
    )

    return AdminStats(
        total_members=total_members,
        opl_linked=opl_linked,
        needs_review=needs_review,
        no_profile=no_profile,
    )


def _opl_filter_group(status: str | None) -> str:
    if status in CONNECTED_STATUSES:
        return "connected"
    if status in OTHER_STATUSES:
        return "other"
    return "no_connection"


async def _resolve_opl_profile_input(raw_input: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            return await resolve_opl_profile_input(client, raw_input)
    except OplProfileAmbiguousError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Multiple OPL profiles match that input",
                "candidates": exc.candidates,
            },
        ) from exc
    except OplProfileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


def _assert_opl_username_available(supabase: Any, username: str) -> None:
    response = (
        supabase.table("member")
        .select("id, first_name, last_name")
        .eq("opl_username", username)
        .limit(1)
        .execute()
    )
    if response.data:
        existing = response.data[0]
        name = f"{existing.get('first_name', '')} {existing.get('last_name', '')}".strip()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"OPL profile @{username} is already linked to {name or 'another member'}",
        )


def _resolve_manual_member_email(
    supabase: Any,
    opl_username: str,
    provided_email: str | None,
) -> tuple[str, bool]:
    if provided_email:
        existing = (
            supabase.table("member")
            .select("id")
            .eq("email", provided_email)
            .limit(1)
            .execute()
        )
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A member with that email already exists",
            )
        return provided_email, False

    base = f"{opl_username}@opl.manual.catalyst"
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
            return candidate, True
        suffix += 1
        candidate = f"{opl_username}+{suffix}@opl.manual.catalyst"


def _latest_sync_by_member(member_ids: list[str]) -> dict[str, dict[str, Any]]:
    if not member_ids:
        return {}

    supabase = get_supabase()
    logs = (
        supabase.table("opl_sync_log")
        .select("member_id, run_at, status, error_message")
        .in_("member_id", member_ids)
        .order("run_at", desc=True)
        .execute()
    ).data

    latest: dict[str, dict[str, Any]] = {}
    for row in logs:
        member_id = str(row["member_id"])
        if member_id not in latest:
            latest[member_id] = row
    return latest


@router.get("/stats", response_model=AdminStats)
def get_admin_stats() -> AdminStats:
    return _count_members_by_status()


@router.get("/attention-members", response_model=AttentionMembersResponse)
def get_attention_members() -> AttentionMembersResponse:
    supabase = get_supabase()
    response = (
        supabase.table("member")
        .select("id, first_name, last_name, opl_match_status, opl_username")
        .in_("opl_match_status", list(ATTENTION_STATUSES))
        .order("last_name")
        .order("first_name")
        .execute()
    )
    members = response.data or []
    member_ids = [str(member["id"]) for member in members]
    latest_sync = _latest_sync_by_member(member_ids)

    attention_members: list[AttentionMember] = []
    for member in members:
        member_id = str(member["id"])
        sync_row = latest_sync.get(member_id)
        last_sync = None
        if sync_row:
            last_sync = LastSyncAttempt(
                run_at=sync_row.get("run_at"),
                status=sync_row.get("status"),
                error_message=sync_row.get("error_message"),
            )

        attention_members.append(
            AttentionMember(
                id=member_id,
                first_name=member.get("first_name") or "",
                last_name=member.get("last_name") or "",
                opl_match_status=member.get("opl_match_status") or "error",
                opl_username=member.get("opl_username"),
                last_sync=last_sync,
            )
        )

    return AttentionMembersResponse(members=attention_members)


@router.get("/members", response_model=AdminMembersResponse)
def list_admin_members(
    filter: Literal["all", "connected", "no_connection", "other"] = "all",
) -> AdminMembersResponse:
    supabase = get_supabase()
    response = (
        supabase.table("member")
        .select(
            "id, first_name, last_name, email, opl_match_status, opl_username, opl_linked_at"
        )
        .order("last_name")
        .order("first_name")
        .execute()
    )
    rows = response.data or []

    counts = AdminMemberFilterCounts(all=len(rows), connected=0, no_connection=0, other=0)
    members: list[AdminMemberRow] = []

    for row in rows:
        status = row.get("opl_match_status") or None
        group = _opl_filter_group(status)
        if group == "connected":
            counts.connected += 1
        elif group == "other":
            counts.other += 1
        else:
            counts.no_connection += 1

        if filter != "all" and group != filter:
            continue

        members.append(
            AdminMemberRow(
                id=str(row["id"]),
                first_name=row.get("first_name") or "",
                last_name=row.get("last_name") or "",
                email=row.get("email"),
                opl_match_status=status,
                opl_username=row.get("opl_username"),
                opl_linked_at=row.get("opl_linked_at"),
            )
        )

    return AdminMembersResponse(members=members, counts=counts, filter=filter)


@router.post("/members", response_model=CreateManualMemberResponse)
async def create_manual_member(body: CreateManualMemberRequest) -> CreateManualMemberResponse:
    supabase = get_supabase()
    profile = await _resolve_opl_profile_input(body.opl)
    username = profile["username"]
    _assert_opl_username_available(supabase, username)

    email, email_generated = _resolve_manual_member_email(
        supabase,
        username,
        body.email,
    )
    now = datetime.now(timezone.utc).isoformat()
    member_row: dict[str, Any] = {
        "first_name": body.first_name,
        "last_name": body.last_name,
        "email": email,
        "opl_username": username,
        "opl_match_status": "auto_linked",
        "opl_linked_at": now,
    }

    normalized_sex = normalize_sex(body.sex)
    if normalized_sex:
        member_row["sex"] = normalized_sex
    if body.date_of_birth:
        member_row["date_of_birth"] = body.date_of_birth.isoformat()

    try:
        response = supabase.table("member").insert(member_row).execute()
    except Exception as exc:
        message = str(exc)
        if "23505" in message and "email" in message.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A member with that email already exists",
            ) from exc
        raise

    created = response.data[0]
    member_id = str(created["id"])
    sync_result = await sync_member_results(member_id, username)

    return CreateManualMemberResponse(
        member=AdminMemberRow(
            id=member_id,
            first_name=created.get("first_name") or "",
            last_name=created.get("last_name") or "",
            email=created.get("email"),
            opl_match_status=created.get("opl_match_status"),
            opl_username=created.get("opl_username"),
            opl_linked_at=created.get("opl_linked_at"),
        ),
        opl_profile_name=profile.get("name"),
        email_generated=email_generated,
        sync=sync_result,
    )


@router.get("/members/{member_id}/candidates", response_model=list[OplCandidate])
async def get_member_candidates(member_id: UUID) -> list[OplCandidate]:
    supabase = get_supabase()
    response = (
        supabase.table("member")
        .select("id, first_name, last_name")
        .eq("id", str(member_id))
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    member = response.data[0]
    first_name = member.get("first_name")
    last_name = member.get("last_name")
    if not first_name or not last_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Member is missing first or last name",
        )

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        candidates = await search_athletes(client, first_name, last_name)

    return [OplCandidate(username=c["username"], name=c["name"]) for c in candidates]


@router.get("/opl-profiles/lookup", response_model=OplProfileLookupResponse)
async def lookup_opl_profile_endpoint(q: str) -> OplProfileLookupResponse:
    query = q.strip()
    if not query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query is required",
        )

    try:
        profile = await lookup_opl_profile(query)
        return OplProfileLookupResponse(
            profile=OplProfilePreview(
                username=profile["username"],
                name=profile["name"],
                total_entries=profile.get("total_entries"),
                first_meet=profile.get("first_meet"),
                last_meet=profile.get("last_meet"),
            )
        )
    except OplProfileAmbiguousError as exc:
        return OplProfileLookupResponse(
            candidates=[
                OplCandidate(username=c["username"], name=c["name"])
                for c in exc.candidates
            ],
            error="Multiple OPL profiles match that input",
        )
    except OplProfileNotFoundError as exc:
        return OplProfileLookupResponse(error=str(exc))


@router.post("/members/{member_id}/unlink")
def unlink_member(member_id: UUID) -> dict[str, Any]:
    supabase = get_supabase()
    response = (
        supabase.table("member")
        .select("id, opl_username")
        .eq("id", str(member_id))
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    if not response.data[0].get("opl_username"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Member has no linked OPL profile",
        )

    try:
        return unlink_member_opl(str(member_id))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post("/members/{member_id}/resolve")
async def resolve_member(member_id: UUID, body: ResolveMemberRequest) -> dict[str, Any]:
    supabase = get_supabase()
    response = (
        supabase.table("member")
        .select("id, opl_username")
        .eq("id", str(member_id))
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    raw_input = body.username.strip()
    if not raw_input:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is required",
        )

    profile = await _resolve_opl_profile_input(raw_input)
    username = profile["username"]

    now = datetime.now(timezone.utc).isoformat()
    supabase.table("member").update(
        {
            "opl_username": username,
            "opl_match_status": "auto_linked",
            "opl_linked_at": now,
        }
    ).eq("id", str(member_id)).execute()

    sync_result = await sync_member_results(str(member_id), username)
    return {
        "member_id": str(member_id),
        "opl_username": username,
        "opl_profile_name": profile.get("name"),
        "opl_match_status": "auto_linked",
        "sync": sync_result,
    }


@router.post("/members/{member_id}/retry")
async def retry_member(member_id: UUID) -> dict[str, Any]:
    supabase = get_supabase()
    response = (
        supabase.table("member")
        .select("id, first_name, last_name, date_of_birth, opl_username")
        .eq("id", str(member_id))
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    member = response.data[0]
    first_name = member.get("first_name")
    last_name = member.get("last_name")
    birth_year = parse_birth_year(member.get("date_of_birth"))

    if not first_name or not last_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Member is missing first or last name",
        )
    if birth_year is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Member is missing date of birth",
        )

    match_result = await match_member_to_opl(
        member_id=str(member_id),
        first_name=first_name,
        last_name=last_name,
        birth_year=birth_year,
    )

    sync_result: dict[str, Any] | None = None
    username = match_result.get("username") or member.get("opl_username")
    if username and match_result.get("status") in {"auto_linked", "probable_match"}:
        refreshed = (
            supabase.table("member")
            .select("opl_username")
            .eq("id", str(member_id))
            .limit(1)
            .execute()
        )
        if refreshed.data and refreshed.data[0].get("opl_username"):
            sync_result = await sync_member_results(
                str(member_id),
                str(refreshed.data[0]["opl_username"]),
            )

    return {"match": match_result, "sync": sync_result}


@router.post("/sync-all", response_model=SyncAllSummary)
async def sync_all_members() -> SyncAllSummary:
    supabase = get_supabase()
    response = (
        supabase.table("member")
        .select("id, opl_username")
        .in_("opl_match_status", list(LINKED_STATUSES))
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

    return SyncAllSummary(
        total=len(members),
        members_synced=members_synced,
        prs_updated=prs_updated,
        errors=errors,
    )


@router.get("/sync-log", response_model=SyncLogResponse)
def get_sync_log(limit: int = 100) -> SyncLogResponse:
    supabase = get_supabase()
    logs = (
        supabase.table("opl_sync_log")
        .select("id, member_id, run_at, status, error_message, results_added")
        .order("run_at", desc=True)
        .limit(limit)
        .execute()
    ).data

    member_ids = list({str(row["member_id"]) for row in logs})
    members_by_id: dict[str, dict[str, Any]] = {}
    if member_ids:
        members = (
            supabase.table("member")
            .select("id, first_name, last_name")
            .in_("id", member_ids)
            .execute()
        ).data
        members_by_id = {str(member["id"]): member for member in members}

    entries = []
    for row in logs:
        member = members_by_id.get(str(row["member_id"]), {})
        member_name = None
        if member:
            member_name = f"{member.get('first_name', '')} {member.get('last_name', '')}".strip()

        entries.append(
            SyncLogEntry(
                id=str(row["id"]),
                member_id=str(row["member_id"]),
                member_name=member_name or None,
                run_at=str(row["run_at"]),
                status=row["status"],
                error_message=row.get("error_message"),
                results_added=int(row.get("results_added") or 0),
            )
        )

    return SyncLogResponse(entries=entries)


@router.post("/import-csv", response_model=ImportCsvResponse)
async def import_csv(file: UploadFile = File(...)) -> ImportCsvResponse:
    import os
    import tempfile

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A CSV file is required",
        )

    tmp_path: str | None = None
    try:
        suffix = os.path.splitext(file.filename)[1] or ".csv"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        import_result = import_members_from_csv(tmp_path)
        queued_member_ids = import_result.get("queued_member_ids", [])
        matching_result = await run_batch_matching(queued_member_ids)

        return ImportCsvResponse(
            import_summary=ImportSummary(
                created=int(import_result["created"]),
                updated=int(import_result["updated"]),
                already_exists=int(import_result["already_exists"]),
                skipped=int(import_result["skipped"]),
                inactive_filtered=int(import_result["inactive_filtered"]),
                excluded_plan_filtered=int(import_result["excluded_plan_filtered"]),
                expired_plan_filtered=int(import_result["expired_plan_filtered"]),
                duplicates_discarded=int(import_result["duplicates_discarded"]),
                data_conflicts=int(import_result["data_conflicts"]),
                invalid_email=int(import_result["invalid_email"]),
                missing_dob=int(import_result["missing_dob"]),
                invalid_dob=int(import_result["invalid_dob"]),
                queued_for_matching=int(import_result["queued_for_matching"]),
            ),
            matching_summary=MatchingSummary(**matching_result),
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.get("/gym-prs", response_model=GymPrMemberListResponse)
def list_gym_prs() -> GymPrMemberListResponse:
    supabase = get_supabase()
    members = list_gym_pr_members(supabase)
    return GymPrMemberListResponse(members=[GymPrMemberEntry(**row) for row in members])


@router.get("/gym-prs/{member_id}", response_model=GymPrMemberEntry)
def get_gym_prs_for_member(member_id: UUID) -> GymPrMemberEntry:
    supabase = get_supabase()
    entry = get_member_gym_prs(supabase, member_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No gym PRs found for this member",
        )
    return GymPrMemberEntry(**entry)


@router.post("/gym-prs", response_model=UpsertGymPrsResponse)
def upsert_gym_prs(body: UpsertGymPrsRequest) -> UpsertGymPrsResponse:
    supabase = get_supabase()
    try:
        result = upsert_member_gym_prs(
            supabase,
            first_name=body.first_name,
            last_name=body.last_name,
            sex=body.sex,
            weight_class_kg=body.weight_class_kg,
            squat_kg=body.squat_kg,
            bench_kg=body.bench_kg,
            deadlift_kg=body.deadlift_kg,
            total_kg=body.total_kg,
            member_id=body.member_id,
        )
    except AmbiguousMemberError as exc:
        candidates = [
            {
                "id": str(member["id"]),
                "first_name": member.get("first_name") or "",
                "last_name": member.get("last_name") or "",
                "email": member.get("email"),
            }
            for member in exc.members
        ]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Multiple members match that name — pass member_id to select one",
                "candidates": candidates,
            },
        ) from exc
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return UpsertGymPrsResponse(**result)


@router.post("/rematch/{member_id}")
async def rematch_member(member_id: UUID) -> dict[str, Any]:
    supabase = get_supabase()
    response = (
        supabase.table("member")
        .select("id, first_name, last_name, date_of_birth")
        .eq("id", str(member_id))
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )

    member = response.data[0]
    first_name = member.get("first_name")
    last_name = member.get("last_name")
    birth_year = parse_birth_year(member.get("date_of_birth"))

    if not first_name or not last_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Member is missing first or last name",
        )
    if birth_year is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Member is missing date of birth",
        )

    return await match_member_to_opl(
        member_id=str(member_id),
        first_name=first_name,
        last_name=last_name,
        birth_year=birth_year,
    )
