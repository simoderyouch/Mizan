# app/services/resource_service.py
from typing import List

from sqlalchemy import func, select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from uuid import UUID

from app.models.resource import ResourceType, WellbeingResource
from app.schemas.resource import ResourceCreate, ResourceUpdate


async def get_resources_for_mood(db: AsyncSession, mood_score: int) -> List[WellbeingResource]:
    if mood_score in [1, 2]:
        triggers = ["anxiete", "stress"]
    elif mood_score == 3:
        triggers = ["motivation"]
    else:
        triggers = ["performance"]
        
    result = await db.execute(
        select(WellbeingResource).where(WellbeingResource.mood_trigger.in_(triggers))
    )
    return list(result.scalars().all())


async def get_all_resources(db: AsyncSession) -> List[WellbeingResource]:
    result = await db.execute(select(WellbeingResource))
    return list(result.scalars().all())


async def create_resource(db: AsyncSession, data: ResourceCreate) -> WellbeingResource:
    resource = WellbeingResource(
        title=data.title,
        description=data.description,
        category=data.category,
        type=data.type,
        url=data.url,
        tags=data.tags,
        mood_trigger=data.mood_trigger,
        ai_instruction=data.ai_instruction
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)
    return resource


async def update_resource(db: AsyncSession, resource_id: UUID, data: ResourceUpdate) -> WellbeingResource:
    result = await db.execute(select(WellbeingResource).where(WellbeingResource.id == resource_id))
    resource = result.scalars().first()
    if not resource:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

    if data.title is not None:
        resource.title = data.title
    if data.description is not None:
        resource.description = data.description
    if data.category is not None:
        resource.category = data.category
    if data.type is not None:
        resource.type = data.type
    if data.url is not None:
        resource.url = data.url
    if data.tags is not None:
        resource.tags = data.tags
    if data.mood_trigger is not None:
        resource.mood_trigger = data.mood_trigger
    if data.ai_instruction is not None:
        resource.ai_instruction = data.ai_instruction

    await db.commit()
    await db.refresh(resource)
    return resource


async def delete_resource(db: AsyncSession, resource_id: UUID) -> None:
    await db.execute(delete(WellbeingResource).where(WellbeingResource.id == resource_id))
    await db.commit()


async def seed_default_resources(db: AsyncSession) -> None:
    # Clear existing resources for a fresh start as requested
    await db.execute(delete(WellbeingResource))
    
    defaults = [
        {
            "title": "Guided 4-7-8 Breathing Technique",
            "description": "The official 4-7-8 breathing exercise by Dr. Andrew Weil. A natural tranquilizer for the nervous system.",
            "category": "Stress Management",
            "type": ResourceType.VIDEO,
            "url": "https://www.youtube.com/watch?v=17Xp-2J7Svs",
            "tags": ["stress", "anxiety", "sleep", "calm"],
            "mood_trigger": "anxiete",
            "ai_instruction": "Recommend this video as a first step for students reporting high anxiety or trouble falling asleep. It works in under 2 minutes."
        },
        {
            "title": "Mastering Sleep Hygiene",
            "description": "Comprehensive guide on creating the perfect sleep environment and habits for peak cognitive performance.",
            "category": "Physical Health",
            "type": ResourceType.ARTICLE,
            "url": "https://www.sleepfoundation.org/sleep-hygiene",
            "tags": ["sleep", "rest", "energy", "health"],
            "mood_trigger": "stress",
            "ai_instruction": "Offer this guide if a student mentions feeling constantly tired or 'brain fogged' despite studying."
        },
        {
            "title": "The Pomodoro Technique Explained",
            "description": "A deep dive into the world's most popular productivity method to help you study smarter, not longer.",
            "category": "Academic Performance",
            "type": ResourceType.VIDEO,
            "url": "https://www.youtube.com/watch?v=mNBmG24djoY",
            "tags": ["productivity", "focus", "revision", "study"],
            "mood_trigger": "motivation",
            "ai_instruction": "Suggest this when a student is overwhelmed by a large assignment or struggling to stay seated for study sessions."
        },
        {
            "title": "How to Deal with Exam Stress",
            "description": "14 practical and evidence-based tips to manage the pressure of the exam season.",
            "category": "Academic Support",
            "type": ResourceType.ARTICLE,
            "url": "https://www.savethestudent.org/extra-guides/health/how-to-deal-with-exam-stress.html",
            "tags": ["exams", "stress", "pressure", "action"],
            "mood_trigger": "performance",
            "ai_instruction": "Send this to students who express fear of failure or intense pressure during the finals season."
        },
        {
            "title": "5-4-3-2-1 Grounding Technique",
            "description": "Complete guide to the sensory grounding method to stop a panic attack in its tracks.",
            "category": "Crisis Support",
            "type": ResourceType.ARTICLE,
            "url": "https://www.healthline.com/health/grounding-techniques",
            "tags": ["anxiety", "panic", "grounding", "safety"],
            "mood_trigger": "anxiete",
            "ai_instruction": "Critical: Mention this grounding exercise immediately if a student describes physical symptoms of a panic attack (racing heart, shortness of breath)."
        }
    ]
    
    for r_data in defaults:
        resource = WellbeingResource(
            title=r_data["title"],
            description=r_data["description"],
            category=r_data["category"],
            type=r_data["type"],
            url=r_data["url"],
            tags=r_data["tags"],
            mood_trigger=r_data["mood_trigger"],
            ai_instruction=r_data["ai_instruction"]
        )
        db.add(resource)
        
    await db.commit()