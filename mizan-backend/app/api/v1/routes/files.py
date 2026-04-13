# app/api/v1/routes/files.py
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import Role, User
from app.models.student import Student
from app.models.institution import Class, Promotion, Filiere
from app.services.file_service import (
    delete_photo_from_cloudinary,
    upload_photo_to_cloudinary,
    validate_image_file,
)
admin_dep = Depends(require_role(Role.ADMIN))
router = APIRouter(
    prefix="/files", 
    tags=["Files"]
)


@router.post("/students/{student_id}/photo", dependencies=[admin_dep])
async def api_upload_student_photo(
    student_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    validate_image_file(file)

    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalars().first()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    if current_user.school_id:
        school_result = await db.execute(
            select(Filiere.school_id)
            .select_from(Student)
            .join(Class, Student.class_id == Class.id)
            .join(Promotion, Class.promotion_id == Promotion.id)
            .join(Filiere, Promotion.filiere_id == Filiere.id)
            .where(Student.id == student_id)
        )
        student_school_id = school_result.scalar()
        if student_school_id != current_user.school_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    secure_url = await upload_photo_to_cloudinary(file, student.cne)
    
    student.photo_url = secure_url
    await db.commit()
    await db.refresh(student)

    return {"photo_url": secure_url}


@router.delete("/students/{student_id}/photo", dependencies=[admin_dep])
async def api_delete_student_photo(
    student_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalars().first()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    if current_user.school_id:
        school_result = await db.execute(
            select(Filiere.school_id)
            .select_from(Student)
            .join(Class, Student.class_id == Class.id)
            .join(Promotion, Class.promotion_id == Promotion.id)
            .join(Filiere, Promotion.filiere_id == Filiere.id)
            .where(Student.id == student_id)
        )
        student_school_id = school_result.scalar()
        if student_school_id != current_user.school_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    if student.photo_url:
        await delete_photo_from_cloudinary(student.cne)
        student.photo_url = None
        await db.commit()

    return {"message": "Photo deleted"}


@router.post("/me/photo")
async def api_upload_my_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    validate_image_file(file)

    result = await db.execute(select(Student).where(Student.user_id == current_user.id))
    student = result.scalars().first()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found"
        )

    secure_url = await upload_photo_to_cloudinary(file, student.cne)
    student.photo_url = secure_url
    await db.commit()
    await db.refresh(student)

    return {"photo_url": secure_url}


@router.delete("/me/photo")
async def api_delete_my_photo(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Student).where(Student.user_id == current_user.id))
    student = result.scalars().first()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found"
        )

    if student.photo_url:
        await delete_photo_from_cloudinary(student.cne)
        student.photo_url = None
        await db.commit()

    return {"message": "Photo deleted"}
