#!/bin/bash

set -Eeuo pipefail

APP_DIR="/opt/accounting-app"
BACKUP_DIR="${APP_DIR}/backups"
DB_NAME="finflow"
RETENTION_DAYS=14

TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
GIT_COMMIT="$(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo 'nogit')"

PROJECT_BACKUP="${BACKUP_DIR}/FinFlow-${GIT_COMMIT}-${TIMESTAMP}.tar.gz"
DB_TMP="/tmp/finflow-${TIMESTAMP}.dump"
DB_BACKUP="${BACKUP_DIR}/finflow-${GIT_COMMIT}-${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "=== FinFlow backup started ==="
echo "Time:       $(date)"
echo "Git commit: $GIT_COMMIT"

cleanup() {
    rm -f "$DB_TMP"
}
trap cleanup EXIT

echo
echo "=== PROJECT BACKUP ==="

tar \
    --exclude='./.git' \
    --exclude='./venv' \
    --exclude='./.venv' \
    --exclude='./backups' \
    --exclude='./__pycache__' \
    --exclude='*.pyc' \
    --exclude='*.log' \
    --exclude='./accounting.db' \
    -czf "$PROJECT_BACKUP" \
    -C "$APP_DIR" .

chmod 600 "$PROJECT_BACKUP"

if ! tar -tzf "$PROJECT_BACKUP" >/dev/null; then
    echo "ERROR: project archive verification failed"
    rm -f "$PROJECT_BACKUP"
    exit 1
fi

echo "PROJECT BACKUP: OK"
echo "File: $PROJECT_BACKUP"

echo
echo "=== POSTGRESQL BACKUP ==="

su - postgres -c "pg_dump -Fc -d '$DB_NAME' -f '$DB_TMP'"

if ! pg_restore --list "$DB_TMP" >/dev/null; then
    echo "ERROR: PostgreSQL dump verification failed"
    rm -f "$DB_TMP"
    exit 1
fi

mv "$DB_TMP" "$DB_BACKUP"
chown postgres:postgres "$DB_BACKUP"
chmod 600 "$DB_BACKUP"

echo "POSTGRES BACKUP: OK"
echo "File: $DB_BACKUP"

echo
echo "=== ROTATION ==="

find "$BACKUP_DIR" -maxdepth 1 -type f \
    \( -name 'FinFlow-*.tar.gz' -o -name 'finflow-*.dump' \) \
    -mtime +"$RETENTION_DAYS" \
    -delete

echo "Removed backups older than ${RETENTION_DAYS} days."

echo
echo "=== BACKUP INVENTORY ==="

ls -lh "$BACKUP_DIR"

echo
echo "=== FinFlow backup completed successfully ==="
