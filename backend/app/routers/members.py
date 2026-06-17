from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from postgrest.exceptions import APIError

from app.models.member import Member, MemberCreate, MemberUpdate
from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/members", tags=["members"])


def _handle_supabase_error(exc: APIError) -> None:
    if exc.code == "PGRST116":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if exc.code == "23505":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already exists"
        )
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
    )


@router.get("", response_model=list[Member])
def list_members() -> list[Member]:
    supabase = get_supabase()
    response = supabase.table("member").select("*").order("created_at", desc=True).execute()
    return [Member.model_validate(row) for row in response.data]


@router.get("/{member_id}", response_model=Member)
def get_member(member_id: UUID) -> Member:
    supabase = get_supabase()
    try:
        response = (
            supabase.table("member")
            .select("*")
            .eq("id", str(member_id))
            .single()
            .execute()
        )
    except APIError as exc:
        _handle_supabase_error(exc)
    return Member.model_validate(response.data)


@router.post("", response_model=Member, status_code=status.HTTP_201_CREATED)
def create_member(payload: MemberCreate) -> Member:
    supabase = get_supabase()
    data = payload.model_dump(mode="json")
    try:
        response = supabase.table("member").insert(data).execute()
    except APIError as exc:
        _handle_supabase_error(exc)
    return Member.model_validate(response.data[0])


@router.put("/{member_id}", response_model=Member)
def update_member(member_id: UUID, payload: MemberUpdate) -> Member:
    supabase = get_supabase()
    data = payload.model_dump(mode="json", exclude_unset=True)
    if not data:
        return get_member(member_id)
    try:
        response = (
            supabase.table("member")
            .update(data)
            .eq("id", str(member_id))
            .select()
            .execute()
        )
    except APIError as exc:
        _handle_supabase_error(exc)
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    return Member.model_validate(response.data[0])


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(member_id: UUID) -> None:
    supabase = get_supabase()
    response = supabase.table("member").delete().eq("id", str(member_id)).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
