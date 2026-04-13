# app/api/v1/routes/global_admin.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import Role, User
from app.services.institutional_service import (
    get_all_schools,
    get_pending_schools,
    verify_school,
    delete_school,
    toggle_school_active
)
from app.schemas.institution import SchoolResponse, SchoolVerify

router = APIRouter(prefix="/global", tags=["Global Administration"])

async def require_global_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != Role.ADMIN or current_user.school_id is not None:
        raise HTTPException(status_code=403, detail="Global Admin access required")
    return current_user

@router.get("/verify/schools", response_model=list[SchoolResponse])
async def handle_get_pending_schools(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_global_admin)
):
    """List all schools waiting for verification."""
    return await get_pending_schools(db)

@router.post("/verify/schools/{school_id}", response_model=SchoolResponse)
async def handle_verify_school(
    school_id: UUID,
    payload: SchoolVerify,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_global_admin)
):
    """Approve or Reject a school registration."""
    return await verify_school(db, school_id, payload.status, payload.note)


@router.get("/schools", response_model=list[SchoolResponse])
async def handle_get_all_schools(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_global_admin)
):
    """List all schools in the system."""
    return await get_all_schools(db)


@router.delete("/schools/{school_id}")
async def handle_delete_school(
    school_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_global_admin)
):
    """Delete a school."""
    await delete_school(db, school_id)
    return {"message": "School deleted successfully"}


@router.patch("/schools/{school_id}/active", response_model=SchoolResponse)
async def handle_toggle_school(
    school_id: UUID,
    is_active: bool,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_global_admin)
):
    """Toggle a school's active status."""
    return await toggle_school_active(db, school_id, is_active)
