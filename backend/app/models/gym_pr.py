from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GymPrBase(BaseModel):
    lift: str
    weight_kg: float
    weight_lbs: float | None = None
    equipment: str | None = None
    source: str | None = None
    canonical_bucket_id: str | None = None
    meet_ruleset: str | None = None
    meet_weight_class_kg: float | None = None


class GymPrCreate(GymPrBase):
    member_id: UUID


class GymPr(GymPrBase):
    id: UUID
    member_id: UUID
    logged_at: datetime

    model_config = {"from_attributes": True}
