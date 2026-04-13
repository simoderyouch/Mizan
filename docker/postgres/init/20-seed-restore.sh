#!/usr/bin/env sh
set -e

AUTO_SEED="${DB_AUTO_SEED:-true}"
SEED_FILE="${DB_SEED_FILE:-local.dump}"
SEED_PATH="/seed/${SEED_FILE}"

if [ "$AUTO_SEED" != "true" ]; then
  echo "[postgres-init] DB_AUTO_SEED is not true, skipping seed restore."
  exit 0
fi

if [ ! -f "$SEED_PATH" ]; then
  echo "[postgres-init] Seed file not found at $SEED_PATH, starting with empty database."
  exit 0
fi

echo "[postgres-init] Found seed file: $SEED_PATH"

case "$SEED_PATH" in
  *.dump)
    echo "[postgres-init] Restoring custom-format dump with pg_restore..."
    pg_restore \
      --no-owner \
      --no-privileges \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB" \
      "$SEED_PATH"
    ;;
  *.sql)
    echo "[postgres-init] Restoring SQL file with psql..."
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$SEED_PATH"
    ;;
  *.sql.gz)
    echo "[postgres-init] Restoring gzipped SQL with psql..."
    gunzip -c "$SEED_PATH" | psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
    ;;
  *)
    echo "[postgres-init] Unsupported seed format: $SEED_PATH (use .dump, .sql, or .sql.gz)"
    exit 1
    ;;
esac

echo "[postgres-init] Seed restore completed."
