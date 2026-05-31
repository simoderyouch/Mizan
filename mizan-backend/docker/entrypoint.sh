#!/usr/bin/env sh
set -e

if [ -n "${DATABASE_URL:-}" ]; then
  _pg="$(python - <<'PY'
import os
from urllib.parse import urlparse

raw = os.environ["DATABASE_URL"].replace("postgresql+asyncpg", "postgresql")
parsed = urlparse(raw)
print(parsed.hostname or "")
print(parsed.port or 5432)
print(parsed.username or "postgres")
PY
)"
  POSTGRES_HOST="$(printf '%s' "$_pg" | sed -n '1p')"
  POSTGRES_PORT="$(printf '%s' "$_pg" | sed -n '2p')"
  POSTGRES_USER="$(printf '%s' "$_pg" | sed -n '3p')"
else
  POSTGRES_HOST="${POSTGRES_HOST:-db}"
  POSTGRES_PORT="${POSTGRES_PORT:-5432}"
  POSTGRES_USER="${POSTGRES_USER:-postgres}"
fi

echo "Waiting for Postgres at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
attempt=0
max_attempts=90
until pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "Postgres not ready after ${max_attempts} attempts." >&2
    exit 1
  fi
  sleep 2
done
echo "Postgres is ready."

echo "Running database migrations..."
alembic upgrade heads

echo "Starting backend API..."
exec uvicorn main:app --host 0.0.0.0 --port 8000
