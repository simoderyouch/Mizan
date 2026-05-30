from typing import List
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.models.user import Role, User
from app.schemas.class_content import (
    ExamCreate,
    ExamResponse,
    ExamUpdate,
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    ScheduleCreate,
    ScheduleResponse,
    ScheduleUpdate,
)
from app.services.class_exam_service import (
    create_exam_for_class,
    delete_exam_entry,
    import_exams_from_csv,
    list_exams_by_class,
    update_exam_entry,
)
from app.services.class_project_service import (
    create_project_for_class,
    delete_project_entry,
    import_projects_from_csv,
    list_projects_by_class,
    update_project_entry,
)
from app.services.class_schedule_service import (
    create_schedule_for_class,
    delete_schedule_entry,
    import_schedule_from_csv,
    list_schedules_by_class,
    sync_class_schedules_to_students,
    update_schedule_entry,
)
from app.services.class_content_autonomy import trigger_class_metadata_update_events
from app.services.class_content_notifications import (
    notify_class_students_exam_change,
    notify_class_students_project_change,
)
from app.services.class_project_service import class_project_member_names

router = APIRouter(prefix="/class-content", tags=["Class Content"])
admin_dep = Depends(require_role(Role.ADMIN))


@router.post("/{class_id}/schedules", dependencies=[admin_dep])
async def api_create_schedule_for_class(
    class_id: UUID,
    data: ScheduleCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    created = await create_schedule_for_class(db, current_user, class_id, data)
    background_tasks.add_task(
        trigger_class_metadata_update_events,
        class_id=class_id,
        metadata_type="SCHEDULE",
        operation="CREATE",
    )
    return {"message": f"Schedule saved and synced to all students in this class ({created} rows)."}


@router.post("/{class_id}/schedules/sync-students", dependencies=[admin_dep])
async def api_sync_class_schedules_to_students(
    class_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await sync_class_schedules_to_students(db, current_user, class_id)
    return {
        "message": (
            f"Synced {result['template_slots']} slot(s) across {result['students']} student(s); "
            f"{result['rows_added']} new row(s) added."
        ),
        **result,
    }


@router.get("/{class_id}/schedules", response_model=List[ScheduleResponse], dependencies=[admin_dep])
async def api_list_schedules_by_class(
    class_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await list_schedules_by_class(db, current_user, class_id)


@router.patch("/{class_id}/schedules/{schedule_id}", dependencies=[admin_dep])
async def api_update_schedule_entry(
    class_id: UUID,
    schedule_id: UUID,
    data: ScheduleUpdate,
    background_tasks: BackgroundTasks,
    apply_to_class: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updated = await update_schedule_entry(db, current_user, class_id, schedule_id, data, apply_to_class)
    background_tasks.add_task(
        trigger_class_metadata_update_events,
        class_id=class_id,
        metadata_type="SCHEDULE",
        operation="UPDATE",
    )
    return {"message": f"Updated {updated} schedule entries"}


@router.delete("/{class_id}/schedules/{schedule_id}", dependencies=[admin_dep])
async def api_delete_schedule_entry(
    class_id: UUID,
    schedule_id: UUID,
    background_tasks: BackgroundTasks,
    apply_to_class: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await delete_schedule_entry(db, current_user, class_id, schedule_id, apply_to_class)
    background_tasks.add_task(
        trigger_class_metadata_update_events,
        class_id=class_id,
        metadata_type="SCHEDULE",
        operation="DELETE",
    )
    return {"message": f"Deleted {deleted} schedule entries"}


@router.post("/{class_id}/schedules/import", dependencies=[admin_dep])
async def api_import_schedule(
    class_id: UUID,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    replace_existing: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await import_schedule_from_csv(db, current_user, class_id, file, replace_existing)
    background_tasks.add_task(
        trigger_class_metadata_update_events,
        class_id=class_id,
        metadata_type="SCHEDULE",
        operation="IMPORT",
    )
    return {"message": f"Successfully imported {count} schedule entries"}


@router.post("/{class_id}/exams", dependencies=[admin_dep])
async def api_create_exam_for_class(
    class_id: UUID,
    data: ExamCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    created = await create_exam_for_class(db, current_user, class_id, data)
    await notify_class_students_exam_change(
        db,
        class_id,
        operation="CREATE",
        subject=data.subject,
        exam_date=data.exam_date,
        start_time=data.start_time,
        end_time=data.end_time,
        room=data.room,
    )
    content_details = {
        "subject": data.subject,
        "exam_date": data.exam_date.isoformat(),
        "room": data.room,
    }
    agent_result = await trigger_class_metadata_update_events(
        class_id=class_id,
        metadata_type="EXAM",
        operation="CREATE",
        content_details=content_details,
    )
    return {
        "message": f"Created exam for {created} students",
        "agent": agent_result,
    }


@router.get("/{class_id}/exams", response_model=List[ExamResponse], dependencies=[admin_dep])
async def api_list_exams_by_class(
    class_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await list_exams_by_class(db, current_user, class_id)


@router.patch("/{class_id}/exams/{exam_id}", dependencies=[admin_dep])
async def api_update_exam_entry(
    class_id: UUID,
    exam_id: UUID,
    data: ExamUpdate,
    background_tasks: BackgroundTasks,
    apply_to_class: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updated = await update_exam_entry(db, current_user, class_id, exam_id, data, apply_to_class)
    await notify_class_students_exam_change(
        db,
        class_id,
        operation="UPDATE",
        subject=data.subject,
        exam_date=data.exam_date,
        start_time=data.start_time,
        end_time=data.end_time,
        room=data.room,
    )
    content_details = {
        "subject": data.subject,
        "exam_date": data.exam_date.isoformat() if data.exam_date else None,
        "room": data.room,
    }
    background_tasks.add_task(
        trigger_class_metadata_update_events,
        class_id=class_id,
        metadata_type="EXAM",
        operation="UPDATE",
        content_details=content_details,
    )
    return {"message": f"Updated {updated} exam entries"}


@router.delete("/{class_id}/exams/{exam_id}", dependencies=[admin_dep])
async def api_delete_exam_entry(
    class_id: UUID,
    exam_id: UUID,
    background_tasks: BackgroundTasks,
    apply_to_class: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await delete_exam_entry(db, current_user, class_id, exam_id, apply_to_class)
    await notify_class_students_exam_change(db, class_id, operation="DELETE")
    background_tasks.add_task(
        trigger_class_metadata_update_events,
        class_id=class_id,
        metadata_type="EXAM",
        operation="DELETE",
    )
    return {"message": f"Deleted {deleted} exam entries"}


@router.post("/{class_id}/exams/import", dependencies=[admin_dep])
async def api_import_exams(
    class_id: UUID,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    replace_existing: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await import_exams_from_csv(db, current_user, class_id, file, replace_existing)
    await notify_class_students_exam_change(
        db,
        class_id,
        operation="IMPORT",
        import_count=count,
    )
    background_tasks.add_task(
        trigger_class_metadata_update_events,
        class_id=class_id,
        metadata_type="EXAM",
        operation="IMPORT",
    )
    return {"message": f"Successfully imported {count} exam entries"}


@router.post("/{class_id}/projects", dependencies=[admin_dep])
async def api_create_project_for_class(
    class_id: UUID,
    data: ProjectCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    created = await create_project_for_class(db, current_user, class_id, data)
    members = await class_project_member_names(db, class_id)
    await notify_class_students_project_change(
        db,
        class_id,
        operation="CREATE",
        name=data.name,
        subject=data.subject,
        due_date=data.due_date,
        members=members,
    )
    content_details = {
        "name": data.name,
        "subject": data.subject,
        "due_date": data.due_date.isoformat(),
        "members": members,
    }
    agent_result = await trigger_class_metadata_update_events(
        class_id=class_id,
        metadata_type="PROJECT",
        operation="CREATE",
        content_details=content_details,
    )
    return {
        "message": f"Created project for {created} students",
        "agent": agent_result,
    }


@router.get("/{class_id}/projects", response_model=List[ProjectResponse], dependencies=[admin_dep])
async def api_list_projects_by_class(
    class_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await list_projects_by_class(db, current_user, class_id)


@router.patch("/{class_id}/projects/{project_id}", dependencies=[admin_dep])
async def api_update_project_entry(
    class_id: UUID,
    project_id: UUID,
    data: ProjectUpdate,
    background_tasks: BackgroundTasks,
    apply_to_class: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updated = await update_project_entry(db, current_user, class_id, project_id, data, apply_to_class)
    members = await class_project_member_names(db, class_id)
    await notify_class_students_project_change(
        db,
        class_id,
        operation="UPDATE",
        name=data.name,
        subject=data.subject,
        due_date=data.due_date,
        members=members,
    )
    content_details = {
        "name": data.name,
        "subject": data.subject,
        "due_date": data.due_date.isoformat() if data.due_date else None,
        "members": members or [],
    }
    background_tasks.add_task(
        trigger_class_metadata_update_events,
        class_id=class_id,
        metadata_type="PROJECT",
        operation="UPDATE",
        content_details=content_details,
    )
    return {"message": f"Updated {updated} project entries"}


@router.delete("/{class_id}/projects/{project_id}", dependencies=[admin_dep])
async def api_delete_project_entry(
    class_id: UUID,
    project_id: UUID,
    background_tasks: BackgroundTasks,
    apply_to_class: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    deleted = await delete_project_entry(db, current_user, class_id, project_id, apply_to_class)
    background_tasks.add_task(
        trigger_class_metadata_update_events,
        class_id=class_id,
        metadata_type="PROJECT",
        operation="DELETE",
    )
    return {"message": f"Deleted {deleted} project entries"}


@router.post("/{class_id}/projects/import", dependencies=[admin_dep])
async def api_import_projects(
    class_id: UUID,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    replace_existing: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await import_projects_from_csv(db, current_user, class_id, file, replace_existing)
    background_tasks.add_task(
        trigger_class_metadata_update_events,
        class_id=class_id,
        metadata_type="PROJECT",
        operation="IMPORT",
    )
    return {"message": f"Successfully imported {count} project entries"}
