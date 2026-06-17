from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.services.supabase_client import get_supabase

router = APIRouter(prefix="/health", tags=["health"])


@router.get("")
async def health_check():
    return {"status": "ok"}


@router.get("/supabase")
async def supabase_health_check():
    try:
        supabase = get_supabase()
        supabase.table("member").select("id").limit(1).execute()
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "detail": str(exc),
            },
        )
    return {"status": "ok"}
