#!/bin/sh
set -e

echo "=== Starting SURYA Backend Service ==="

# Run database migrations if alembic configuration is present
if [ -f "alembic.ini" ]; then
    echo "Applying database schema migrations with Alembic..."
    alembic upgrade head || echo "Migration warning: proceeding with existing schema"
fi

# Execute uvicorn server in production
echo "Starting Uvicorn ASGI server on 0.0.0.0:8000..."
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers ${WORKERS:-4} --proxy-headers --forwarded-allow-ips='*'
