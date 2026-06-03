#!/usr/bin/env python3
"""
CLI: seed staging / local database with realistic sample data.

Usage:
  export DATABASE_URL="postgresql+asyncpg://..."
  export SAMPLE_DATA_PASSWORD="your-staging-password"
  python seed_sample_database.py

Only runs on an empty database (no users). See docs/SAMPLE_DATA.md for accounts.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys

from app.seed.sample_database import seed_sample_database

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Mizan sample data (empty DB only).")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Not supported — use a fresh database instead.",
    )
    args = parser.parse_args()

    try:
        result = asyncio.run(seed_sample_database(force=args.force))
    except ValueError as exc:
        logger.error("%s", exc)
        sys.exit(1)

    if result.get("skipped"):
        logger.info("No changes made.")
        sys.exit(0)

    print("\nSample data ready.")
    print(f"  School: {result.get('school')}")
    print(f"  Students: {result.get('students')}")
    print(f"  Global admin: {result.get('global_admin')}")
    print(f"  School admin: {result.get('school_admin')}")
    print("  Password: value of SAMPLE_DATA_PASSWORD")
    print("  Details: docs/SAMPLE_DATA.md\n")


if __name__ == "__main__":
    main()
