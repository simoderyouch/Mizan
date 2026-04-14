# CRUD operations for School, Filière, and Class institutional entities
# app/services/institutional_service.py
from typing import Optional
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.institution import Class, Filiere, Promotion, School, VerificationStatus
from app.models.user import Role, User
from app.core.security import hash_password, send_school_approval_email, send_school_rejection_email
from app.schemas.institution import (
    ClassCreate,
    FiliereCreate,
    PromotionCreate,
    SchoolCreate,
)


async def create_school(db: AsyncSession, data: SchoolCreate) -> School:
    result = await db.execute(select(School).where(School.name == data.name))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="School with this name already exists"
        )
        
    existing_admin = await db.execute(select(User).where(User.email == data.admin_email))
    if existing_admin.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin email already exists"
        )

    school = School(
        name=data.name,
        official_identifier=data.official_identifier,
        contact_phone=data.contact_phone,
        verification_status=VerificationStatus.PENDING
    )
    db.add(school)
    await db.flush()

    school_admin = User(
        email=data.admin_email,
        password_hash=hash_password(data.admin_password),
        is_active=False, # Must be verified first
        role=Role.ADMIN,
        school_id=school.id,
    )
    db.add(school_admin)
    await db.commit()
    await db.refresh(school)
    return school


async def verify_school(db: AsyncSession, school_id: UUID, status: str, note: Optional[str] = None) -> School:
    result = await db.execute(select(School).where(School.id == school_id))
    school = result.scalars().first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")

    if status == "VERIFIED":
        school.verification_status = VerificationStatus.VERIFIED
        # Activate the associated admin
        admin_result = await db.execute(select(User).where(User.school_id == school_id, User.role == Role.ADMIN))
        admin = admin_result.scalars().first()
        if admin:
            admin.is_active = True
            # Send approval email
            send_school_approval_email(admin.email, school.name)
    elif status == "REJECTED":
        school.verification_status = VerificationStatus.REJECTED
        school.verification_note = note
        # Send rejection email
        admin_result = await db.execute(select(User).where(User.school_id == school_id, User.role == Role.ADMIN))
        admin = admin_result.scalars().first()
        if admin:
            send_school_rejection_email(admin.email, school.name, note)
    
    await db.commit()
    await db.refresh(school)
    return school


async def get_pending_schools(db: AsyncSession) -> list[School]:
    result = await db.execute(select(School).where(School.verification_status == VerificationStatus.PENDING))
    return list(result.scalars().all())


async def get_all_schools(db: AsyncSession) -> list[School]:
    result = await db.execute(select(School))
    return list(result.scalars().all())


async def delete_school(db: AsyncSession, school_id: UUID) -> None:
    result = await db.execute(select(School).where(School.id == school_id))
    school = result.scalars().first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    
    # In a real system, we might want to delete all related data or use CASCADE
    # For now, we delete the school (cascade should handle it if configured, or we delete users manually)
    await db.delete(school)
    await db.commit()


async def toggle_school_active(db: AsyncSession, school_id: UUID, is_active: bool) -> School:
    result = await db.execute(select(School).where(School.id == school_id))
    school = result.scalars().first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    
    # This toggles whether the school is "operational" in our platform
    # We can use a property or update the is_active of the primary admin
    admin_result = await db.execute(select(User).where(User.school_id == school_id, User.role == Role.ADMIN))
    admin = admin_result.scalars().first()
    if admin:
        admin.is_active = is_active
        
    await db.commit()
    await db.refresh(school)
    return school


async def create_filiere(db: AsyncSession, data: FiliereCreate) -> Filiere:
    if not data.school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="school_id is required"
        )

    school_result = await db.execute(select(School).where(School.id == data.school_id))
    if not school_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="School not found"
        )

    filiere_result = await db.execute(
        select(Filiere).where(Filiere.name == data.name, Filiere.school_id == data.school_id)
    )
    if filiere_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Filiere with this name already exists in this school"
        )

    filiere = Filiere(name=data.name, school_id=data.school_id)
    db.add(filiere)
    await db.commit()
    await db.refresh(filiere)
    return filiere


async def get_filieres_by_school(db: AsyncSession, school_id: UUID) -> list[Filiere]:
    school_result = await db.execute(select(School).where(School.id == school_id))
    if not school_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="School not found"
        )

    result = await db.execute(select(Filiere).where(Filiere.school_id == school_id))
    return list(result.scalars().all())


async def create_promotion(db: AsyncSession, data: PromotionCreate) -> Promotion:
    filiere_result = await db.execute(select(Filiere).where(Filiere.id == data.filiere_id))
    if not filiere_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Filiere not found"
        )

    promo_result = await db.execute(
        select(Promotion).where(Promotion.name == data.name, Promotion.filiere_id == data.filiere_id)
    )
    if promo_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Promotion with this name already exists in this filiere"
        )

    promotion = Promotion(name=data.name, filiere_id=data.filiere_id)
    db.add(promotion)
    await db.commit()
    await db.refresh(promotion)
    return promotion


async def get_promotions_by_filiere(db: AsyncSession, filiere_id: UUID) -> list[Promotion]:
    filiere_result = await db.execute(select(Filiere).where(Filiere.id == filiere_id))
    if not filiere_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Filiere not found"
        )

    result = await db.execute(select(Promotion).where(Promotion.filiere_id == filiere_id))
    return list(result.scalars().all())


async def create_class(db: AsyncSession, data: ClassCreate) -> Class:
    promo_result = await db.execute(select(Promotion).where(Promotion.id == data.promotion_id))
    if not promo_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Promotion not found"
        )

    class_result = await db.execute(
        select(Class).where(Class.name == data.name, Class.promotion_id == data.promotion_id)
    )
    if class_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Class with this name already exists in this promotion"
        )

    new_class = Class(
        name=data.name, 
        promotion_id=data.promotion_id, 
        academic_year=data.academic_year
    )
    db.add(new_class)
    await db.commit()
    await db.refresh(new_class)
    return new_class


async def get_classes_by_promotion(db: AsyncSession, promotion_id: UUID) -> list[Class]:
    promo_result = await db.execute(select(Promotion).where(Promotion.id == promotion_id))
    if not promo_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Promotion not found"
        )

    result = await db.execute(select(Class).where(Class.promotion_id == promotion_id))
    return list(result.scalars().all())


async def get_school_id_for_filiere(db: AsyncSession, filiere_id: UUID) -> UUID:
    result = await db.execute(select(Filiere).where(Filiere.id == filiere_id))
    filiere = result.scalars().first()
    if not filiere:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filiere not found")
    return filiere.school_id


async def get_school_id_for_promotion(db: AsyncSession, promotion_id: UUID) -> UUID:
    result = await db.execute(select(Promotion, Filiere).join(Filiere, Promotion.filiere_id == Filiere.id).where(Promotion.id == promotion_id))
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Promotion not found")
    _, filiere = row
    return filiere.school_id


async def scope_school_admin_school_id(user: User) -> UUID:
    if user.role == Role.ADMIN:
        if not user.school_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin has no school scope")
        return user.school_id
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin scope required")
