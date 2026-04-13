# main.py
from contextlib import asynccontextmanager
import logging

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.routes.agent import router as agent_router
from app.api.v1.routes.analytics import router as analytics_router
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.checkins import router as checkins_router
from app.api.v1.routes.class_content import router as class_content_router
from app.api.v1.routes.files import router as files_router
from app.api.v1.routes.goals import router as goals_router
from app.api.v1.routes.institutional import router as institutional_router
from app.api.v1.routes.modes import router as modes_router
from app.api.v1.routes.resources import router as resources_router
from app.api.v1.routes.students import router as students_router
from app.api.v1.routes.tasks import router as tasks_router
from app.api.v1.routes.voice import router as voice_router
from app.api.v1.routes.global_admin import router as global_admin_router
from app.api.v1.routes.notifications import router as notifications_router
from app.core.database import AsyncSessionLocal, get_db
from app.services.resource_service import seed_default_resources
from app.services.scheduler_service import scheduler

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with AsyncSessionLocal() as db:
            await seed_default_resources(db)
    except Exception as exc:
        logger.exception("Startup resource seeding skipped due to DB connectivity issue: %s", exc)
    
    # Start the Autonomous Scheduler
    await scheduler.start()
    
    yield
    
    # Stop the Autonomous Scheduler
    await scheduler.stop()

app = FastAPI(
    title="Mizan API",
    description="Backend for Mizan - Student Wellbeing AI Platform",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(institutional_router, prefix="/api/v1")
app.include_router(students_router, prefix="/api/v1")
app.include_router(class_content_router, prefix="/api/v1")
app.include_router(checkins_router, prefix="/api/v1")
app.include_router(goals_router, prefix="/api/v1")
app.include_router(modes_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(voice_router, prefix="/api/v1")
app.include_router(tasks_router, prefix="/api/v1")
app.include_router(files_router, prefix="/api/v1")
app.include_router(resources_router, prefix="/api/v1")
app.include_router(agent_router, prefix="/api/v1")
app.include_router(global_admin_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")


@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "healthy"}


@app.get("/api/v1/health/detailed", tags=["System"])
async def detailed_health_check(db: AsyncSession = Depends(get_db)):
    db_status = "error"
    try:
        await db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        pass
        
    return {
        "status": "ok",
        "database": db_status,
        "services": [
            "auth", 
            "institutional", 
            "students", 
            "class-content",
            "checkins", 
            "goals", 
            "modes", 
            "analytics", 
            "voice", 
            "resources",
            "agent",
            "notifications",
        ]
    }
