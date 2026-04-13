from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import User, Role
from app.schemas.student import StudentCreateAdmin, StudentResponse, StudentUpdateAdmin
from app.services.student_service import (
    create_student_admin, delete_student_admin, get_student_by_user_id, get_student_context,
    import_students_from_csv, list_students_by_class, update_student_admin,
)

router = APIRouter(prefix="/students", tags=["Students"])
admin_dep = Depends(require_role(Role.ADMIN))

@router.post("/import/trombi/{class_id}", dependencies=[admin_dep])
async def api_import_trombi(
    class_id: UUID,
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    count = await import_students_from_csv(db, current_user, class_id, file)
    return {"message": f"Successfully imported {count} students"}

@router.post("", response_model=StudentResponse, dependencies=[admin_dep])
async def api_create_student(
    data: StudentCreateAdmin,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await create_student_admin(db, current_user, data)

@router.get("/class/{class_id}", response_model=List[StudentResponse], dependencies=[admin_dep])
async def api_get_students_by_class(
    class_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await list_students_by_class(db, current_user, class_id)

@router.put("/{student_id}", response_model=StudentResponse, dependencies=[admin_dep])
async def api_update_student(
    student_id: UUID,
    data: StudentUpdateAdmin,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await update_student_admin(db, current_user, student_id, data)

@router.delete("/{student_id}", dependencies=[admin_dep])
async def api_delete_student(
    student_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await delete_student_admin(db, current_user, student_id)
    return {"message": "Student deleted"}

@router.get("/me", response_model=StudentResponse)
async def api_get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await get_student_by_user_id(db, current_user.id)

@router.get("/me/context")
async def api_get_me_context(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    student = await get_student_by_user_id(db, current_user.id)
    return await get_student_context(db, student.id)
