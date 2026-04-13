from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, Role
from app.schemas.institution import (
    ClassCreate, ClassResponse,
    FiliereCreate, FiliereResponse,
    PromotionCreate, PromotionResponse,
    SchoolCreate, SchoolResponse,
)
from app.services.institutional_service import (
    create_class, create_filiere, create_promotion, create_school,
    get_all_schools, get_classes_by_promotion,
    get_filieres_by_school, get_promotions_by_filiere, get_school_id_for_filiere,
    get_school_id_for_promotion,
)

router = APIRouter(prefix="/institutional", tags=["Institutional"])

admin_dep = Depends(require_role(Role.ADMIN))


def _require_school_scope(current_user: User, target_school_id: UUID) -> None:
    if current_user.role != Role.ADMIN:
        raise PermissionError("Not enough permissions for this school scope")
    if current_user.school_id is None:
        return
    if current_user.school_id == target_school_id:
        return
    raise PermissionError("Not enough permissions for this school scope")

@router.post("/schools", response_model=SchoolResponse, dependencies=[admin_dep])
async def create_school_route(
    data: SchoolCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.school_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return await create_school(db, data)

@router.get("/schools", response_model=List[SchoolResponse], dependencies=[admin_dep])
async def api_get_all_schools(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    schools = await get_all_schools(db)
    if current_user.school_id:
        return [s for s in schools if s.id == current_user.school_id]
    return schools

@router.post("/filieres", response_model=FiliereResponse, dependencies=[admin_dep])
async def api_create_filiere(
    data: FiliereCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.school_id:
        data.school_id = current_user.school_id
    return await create_filiere(db, data)

@router.get("/filieres/{school_id}", response_model=List[FiliereResponse], dependencies=[admin_dep])
async def api_get_filieres_by_school(
    school_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        _require_school_scope(current_user, school_id)
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return await get_filieres_by_school(db, school_id)

@router.post("/promotions", response_model=PromotionResponse, dependencies=[admin_dep])
async def api_create_promotion(
    data: PromotionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.school_id:
        school_id = await get_school_id_for_filiere(db, data.filiere_id)
        try:
            _require_school_scope(current_user, school_id)
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return await create_promotion(db, data)

@router.get("/promotions/{filiere_id}", response_model=List[PromotionResponse], dependencies=[admin_dep])
async def api_get_promotions_by_filiere(
    filiere_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.school_id:
        school_id = await get_school_id_for_filiere(db, filiere_id)
        try:
            _require_school_scope(current_user, school_id)
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return await get_promotions_by_filiere(db, filiere_id)

@router.post("/classes", response_model=ClassResponse, dependencies=[admin_dep])
async def api_create_class(
    data: ClassCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.school_id:
        school_id = await get_school_id_for_promotion(db, data.promotion_id)
        try:
            _require_school_scope(current_user, school_id)
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return await create_class(db, data)

@router.get("/classes/{promotion_id}", response_model=List[ClassResponse], dependencies=[admin_dep])
async def api_get_classes_by_promotion(
    promotion_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.school_id:
        school_id = await get_school_id_for_promotion(db, promotion_id)
        try:
            _require_school_scope(current_user, school_id)
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return await get_classes_by_promotion(db, promotion_id)
