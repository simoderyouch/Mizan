"""Create or update the global platform admin (school_id=NULL). Run once per environment."""
import asyncio
import logging
import os
import sys

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.user import Role, User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def create_global_admin() -> None:
    email = os.environ.get("ADMIN_EMAIL", "admin@mizan.ai").strip()
    password = os.environ.get("ADMIN_PASSWORD", "").strip()
    if not password or len(password) < 8:
        logger.error("Set ADMIN_PASSWORD (min 8 characters) in the environment.")
        sys.exit(1)

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()

        if user:
            logger.info("User %s already exists — updating role and activation.", email)
            user.role = Role.ADMIN
            user.school_id = None
            user.is_active = True
            user.password_hash = hash_password(password)
            await db.commit()
            logger.info("Global admin updated.")
            return

        db.add(
            User(
                email=email,
                password_hash=hash_password(password),
                role=Role.ADMIN,
                school_id=None,
                is_active=True,
            )
        )
        await db.commit()
        logger.info("Global admin created: %s", email)


if __name__ == "__main__":
    asyncio.run(create_global_admin())
