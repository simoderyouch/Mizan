#!/usr/bin/env sh
# Run after infrastructure is up and DATABASE_URL points at the target RDS/Postgres.
# Safe to run multiple times — skips if users already exist.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="${ROOT}/mizan-backend"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: Set DATABASE_URL to the target database." >&2
  exit 1
fi

if [ -z "${SAMPLE_DATA_PASSWORD:-}" ]; then
  echo "ERROR: Set SAMPLE_DATA_PASSWORD (min 8 characters) for all sample accounts." >&2
  exit 1
fi

cd "${BACKEND}"

if [ -d ".venv" ]; then
  # shellcheck disable=SC1091
  . .venv/bin/activate
elif [ -d "venv" ]; then
  # shellcheck disable=SC1091
  . venv/bin/activate
fi

echo "Running sample data seed against ${DATABASE_URL%%@*}@..."
python seed_sample_database.py
echo "Done. See ${ROOT}/docs/SAMPLE_DATA.md for login accounts."
