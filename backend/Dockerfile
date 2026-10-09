# ==============================================================================
# SURYA Backend Production Dockerfile
# Python 3.11-slim base with non-root security execution
# ==============================================================================

FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

# Install system runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code and migrations
COPY backend /app/backend
COPY alembic.ini /app/alembic.ini
COPY backend/entrypoint.sh /app/entrypoint.sh

# Set executable permissions
RUN chmod +x /app/entrypoint.sh

# Create non-root system user for security
RUN addgroup --system suryagroup && adduser --system --group suryauser && \
    chown -R suryauser:suryagroup /app

USER suryauser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
