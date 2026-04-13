from datetime import date
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.task import (
    ChatTaskSuggestionRequest,
    TaskBulkComplete,
    TaskBulkCreate,
    TaskResponse,
    TaskStatus,
    TaskStatusUpdate,
    TaskSuggestionResponse,
    TaskCreate,
    TaskUpdate,
)
from app.services.student_service import get_student_basic_by_user_id
from app.services.task_service import (
    complete_many_tasks,
    create_tasks,
    delete_task,
    list_tasks,
    suggest_tasks_from_chat,
    update_task,
    update_task_status,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("/", response_model=List[TaskResponse])
async def api_list_tasks(
    status: TaskStatus | None = Query(default=None),
    due_date: date | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_basic_by_user_id(db, current_user.id)
    return await list_tasks(db, student.id, status, due_date)


@router.post("/bulk", response_model=List[TaskResponse])
async def api_create_tasks(
    payload: TaskBulkCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_basic_by_user_id(db, current_user.id)
    return await create_tasks(db, student.id, payload)


@router.post("/", response_model=TaskResponse)
async def api_create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_basic_by_user_id(db, current_user.id)
    created = await create_tasks(db, student.id, TaskBulkCreate(tasks=[payload]))
    return created[0]


@router.patch("/{task_id}", response_model=TaskResponse)
async def api_update_task_status(
    task_id: UUID,
    payload: TaskStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_basic_by_user_id(db, current_user.id)
    return await update_task_status(db, student.id, task_id, payload.status)


@router.put("/{task_id}", response_model=TaskResponse)
async def api_update_task(
    task_id: UUID,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_basic_by_user_id(db, current_user.id)
    return await update_task(db, student.id, task_id, payload)


@router.delete("/{task_id}")
async def api_delete_task(
    task_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_basic_by_user_id(db, current_user.id)
    await delete_task(db, student.id, task_id)
    return {"message": "Task deleted"}


@router.post("/complete-many")
async def api_complete_many_tasks(
    payload: TaskBulkComplete,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_basic_by_user_id(db, current_user.id)
    updated_count = await complete_many_tasks(db, student.id, payload.task_ids)
    return {"updated_count": updated_count}


@router.post("/suggest-from-chat", response_model=TaskSuggestionResponse)
async def api_suggest_tasks_from_chat(
    payload: ChatTaskSuggestionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    student = await get_student_basic_by_user_id(db, current_user.id)
    student_name = f"{student.first_name} {student.last_name}".strip() or "Student"
    suggestions = await suggest_tasks_from_chat(student_name, payload.user_message, payload.assistant_message)
    return {"suggestions": suggestions}
