#!/bin/bash
set -e

echo "Waiting for backend container to be ready..."

# Wait for backend container to be healthy
MAX_WAIT=120
WAIT_TIME=0
while [ $WAIT_TIME -lt $MAX_WAIT ]; do
    if docker compose -f docker-compose.prod.yml ps backend | grep -q "healthy"; then
        echo "Backend container is healthy, proceeding with migrations..."
        break
    fi
    
    if [ $WAIT_TIME -eq 0 ]; then
        echo "Waiting for backend container to become healthy..."
    fi
    
    sleep 5
    WAIT_TIME=$((WAIT_TIME + 5))
    
    if [ $WAIT_TIME -ge $MAX_WAIT ]; then
        echo "Timeout waiting for backend container to become healthy"
        echo "Container status:"
        docker compose -f docker-compose.prod.yml ps
        echo "Backend logs:"
        docker compose -f docker-compose.prod.yml logs backend --tail 20
        exit 1
    fi
done

echo "Running database migrations..."
if docker compose -f docker-compose.prod.yml exec -T backend npx prisma migrate deploy; then
    echo "✅ Database migrations completed successfully"
else
    echo "❌ Database migrations failed"
    echo "Backend logs:"
    docker compose -f docker-compose.prod.yml logs backend --tail 20
    exit 1
fi 