from typing import Literal

from pydantic import BaseModel
from fastapi import APIRouter, Query

from app.models.member import Member
from app.services.supabase_client import get_supabase
from app.services.weight_class_buckets import normalize_sex

router = APIRouter(prefix="/dots-leaderboard", tags=["dots-leaderboard"])

LEADERBOARD_LIMIT = 10


class DotsLeaderboardEntry(BaseModel):
    rank: int
    member: Member
    dots_score: float
    total_kg: float
    bodyweight_kg: float
    achieved_date: str | None = None
    meet_name: str | None = None


@router.get("", response_model=list[DotsLeaderboardEntry])
def get_dots_leaderboard(
    sex: Literal["male", "female", "mx"] | None = Query(default=None),
) -> list[DotsLeaderboardEntry]:
    supabase = get_supabase()
    query = (
        supabase.table("member")
        .select(
            "id, first_name, last_name, date_of_birth, email, opl_username, "
            "opl_match_status, opl_linked_at, sex, weight_class, weight_class_kg, "
            "ruleset, federation, created_at, "
            "highest_dots_score, highest_dots_total_kg, highest_dots_bodyweight_kg, "
            "highest_dots_achieved_date, highest_dots_meet_name"
        )
        .not_.is_("highest_dots_score", "null")
    )

    if sex is not None:
        normalized = normalize_sex(sex)
        if normalized:
            query = query.eq("sex", normalized)

    response = query.order("highest_dots_score", desc=True).limit(LEADERBOARD_LIMIT).execute()

    entries: list[DotsLeaderboardEntry] = []
    for index, row in enumerate(response.data or [], start=1):
        entries.append(
            DotsLeaderboardEntry(
                rank=index,
                member=Member.model_validate(row),
                dots_score=float(row["highest_dots_score"]),
                total_kg=float(row["highest_dots_total_kg"]),
                bodyweight_kg=float(row["highest_dots_bodyweight_kg"]),
                achieved_date=row.get("highest_dots_achieved_date"),
                meet_name=row.get("highest_dots_meet_name"),
            )
        )
    return entries
