from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class OplSyncLogBase(BaseModel):
    status: str
    error_message: str | None = None
    results_added: int = 0


class OplSyncLogCreate(OplSyncLogBase):
    member_id: UUID


class OplSyncLog(OplSyncLogBase):
    id: UUID
    member_id: UUID
    run_at: datetime

    model_config = {"from_attributes": True}
