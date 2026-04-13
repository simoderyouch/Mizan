# create_global_admin.py
import asyncio
import logging
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.user import User, Role
from app.core.security import hash_password

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def create_global_admin():
    email = "admin@mizan.ai"
    password = "MizanGlobal2024!"
    
    async with AsyncSessionLocal() as db:
        # Check if already exists
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        
        if user:
            logger.info(f"User {email} already exists. Updating role and status.")
            user.role = Role.ADMIN
            user.school_id = None
            user.is_active = True
            await db.commit()
            logger.info("User updated successfully.")
            return

        # Create new global admin
        new_admin = User(
            email=email,
            password_hash=hash_password(password),
            role=Role.ADMIN,
            school_id=None,
            is_active=True
        )
        
        db.add(new_admin)
        await db.commit()
        logger.info(f"Global Admin created successfully: {email}")

if __name__ == "__main__":
    asyncio.run(create_global_admin())
