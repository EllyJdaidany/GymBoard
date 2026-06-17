from datetime import date
from uuid import UUID

from pydantic import BaseModel


class PrBoardEntryBase(BaseModel):
    lift: str
    weight_kg: float
    weight_lbs: float | None = None
    source: str | None = None
    equipment: str | None = None
    achieved_date: date | None = None
    meet_name: str | None = None
    federation: str | None = None
    is_meet_verified: bool = False
    canonical_bucket_id: str | None = None
    meet_ruleset: str | None = None
    meet_weight_class_kg: float | None = None
    bodyweight_kg: float | None = None


class PrBoardEntryCreate(PrBoardEntryBase):
    member_id: UUID


class PrBoardEntry(PrBoardEntryBase):
    id: UUID
    member_id: UUID

    model_config = {"from_attributes": True}
