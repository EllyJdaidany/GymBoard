from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator

from app.utils.names import capitalize_name_part


class MemberBase(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: date | None = None
    email: EmailStr
    opl_username: str | None = None
    opl_match_status: str | None = None
    opl_linked_at: datetime | None = None
    sex: str | None = None
    weight_class: str | None = None
    weight_class_kg: float | None = None
    ruleset: str | None = None
    federation: str | None = None
    highest_dots_score: float | None = None
    highest_dots_total_kg: float | None = None
    highest_dots_bodyweight_kg: float | None = None
    highest_dots_achieved_date: date | None = None
    highest_dots_meet_name: str | None = None

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        if value is None or not isinstance(value, str):
            return value
        return capitalize_name_part(value)


class MemberCreate(MemberBase):
    pass


class MemberUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: date | None = None
    email: EmailStr | None = None
    opl_username: str | None = None
    opl_match_status: str | None = None
    opl_linked_at: datetime | None = None
    sex: str | None = None
    weight_class: str | None = None
    weight_class_kg: float | None = None
    ruleset: str | None = None
    federation: str | None = None

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        if value is None or not isinstance(value, str):
            return value
        return capitalize_name_part(value)


class Member(MemberBase):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}
