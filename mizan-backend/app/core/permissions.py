from uuid import UUID

from fastapi import HTTPException, status

from app.models.user import Role, User


def is_global_admin(user: User) -> bool:
    return user.role == Role.ADMIN and user.school_id is None


def require_admin_user(user: User) -> None:
    if user.role != Role.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")


def ensure_admin_school_scope(user: User, target_school_id: UUID) -> None:
    require_admin_user(user)
    if user.school_id is not None and user.school_id != target_school_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")


def admin_scoped_school_id(user: User) -> UUID | None:
    require_admin_user(user)
    return None if is_global_admin(user) else user.school_id


def ensure_student_self(user: User, target_user_id: UUID) -> None:
    if user.role != Role.STUDENT or user.id != target_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
