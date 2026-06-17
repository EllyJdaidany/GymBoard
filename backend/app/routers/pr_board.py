from uuid import UUID

from pydantic import BaseModel, Field
from fastapi import APIRouter

from app.models.member import Member
from app.services.opl_service import LIFTS, get_best_lifts_for_member
from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/pr-board", tags=["pr-board"])


class BestLift(BaseModel):
    weight_kg: float
    weight_lbs: float | None = None
    source: str
    equipment: str
    achieved_date: str | None = None
    meet_name: str | None = None
    federation: str | None = None
    is_meet_verified: bool
    canonical_bucket_id: str | None = None
    meet_ruleset: str | None = None
    meet_weight_class_kg: float | None = None
    bodyweight_kg: float | None = None


class PrBoardMember(BaseModel):
    member: Member
    best_lifts: dict[str, list[BestLift]] = Field(
        default_factory=lambda: {lift: [] for lift in LIFTS}
    )


@router.get("", response_model=list[PrBoardMember])
def get_pr_board() -> list[PrBoardMember]:
    supabase = get_supabase()
    members_response = (
        supabase.table("member").select("*").order("last_name").order("first_name").execute()
    )

    board: list[PrBoardMember] = []
    for row in members_response.data:
        member = Member.model_validate(row)
        best_lifts = get_best_lifts_for_member(supabase, UUID(str(member.id)))
        board.append(
            PrBoardMember(
                member=member,
                best_lifts={
                    lift: [BestLift.model_validate(entry) for entry in entries]
                    for lift, entries in best_lifts.items()
                },
            )
        )
    return board
