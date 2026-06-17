from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.services.opl_sync import sync_member_results
from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/sync", tags=["sync"])


class SyncResponse(BaseModel):
    member_id: str
    status: str
    prs_updated: bool


@router.post("/{member_id}", response_model=SyncResponse)
async def trigger_opl_sync(member_id: UUID) -> SyncResponse:
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

    member = response.data[0]
    opl_username = member.get("opl_username")
    if not opl_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Member has no linked OPL username",
        )

    try:
        result = await sync_member_results(str(member_id), opl_username)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )

    if result["status"] == "error":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OPL sync failed",
        )

    return SyncResponse(
        member_id=str(member_id),
        status=result["status"],
        prs_updated=result["prs_updated"],
    )
