#!/bin/bash

# =============================================================================
# Safety Backup Script
# =============================================================================
# Creates a comprehensive backup before any potentially dangerous operations.
# Works both locally (on the on-prem server) and via SSH (remote deployment).
#
# Usage: ./create-safety-backup.sh [REASON]
#
# Examples:
#   ./create-safety-backup.sh "Pre-deployment backup"
#   ./create-safety-backup.sh  # Uses default reason
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ONPREM_DIR="$SCRIPT_DIR/.."

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo -e "${BLUE}🛡️  SAFETY BACKUP SYSTEM${NC}"
echo -e "${BLUE}========================${NC}"
echo ""

REASON="${1:-Pre-deployment safety backup}"
log_info "Backup reason: ${REASON}"
echo ""

# Determine backup directory
BACKUP_DIR="${ONPREM_DIR}/backups"
mkdir -p "$BACKUP_DIR/data" "$BACKUP_DIR/volumes"

# Create timestamped backup name
BACKUP_NAME="safety-backup-$(date +%Y%m%d_%H%M%S)"
log_info "Creating backup: $BACKUP_NAME"

# 1. Backup databases (if running)
log_info "Backing up databases..."

# DocuSeal database
if docker ps --format "{{.Names}}" | grep -q "docuseal-postgres"; then
    log_info "  Backing up DocuSeal database..."
    docker exec $(docker ps --format "{{.Names}}" | grep docuseal-postgres | head -1) \
        pg_dump -U docuseal -d docuseal > "$BACKUP_DIR/data/${BACKUP_NAME}-docuseal.sql" 2>/dev/null \
        && log_success "  DocuSeal database backed up" \
        || log_warn "  DocuSeal database backup failed"
else
    log_warn "  DocuSeal database not running - skipping"
fi

# Agreements database
if docker ps --format "{{.Names}}" | grep -q "agreements-postgres"; then
    log_info "  Backing up Agreements database..."
    docker exec $(docker ps --format "{{.Names}}" | grep agreements-postgres | head -1) \
        pg_dump -U agreements_user -d agreements_db > "$BACKUP_DIR/data/${BACKUP_NAME}-agreements.sql" 2>/dev/null \
        && log_success "  Agreements database backed up" \
        || log_warn "  Agreements database backup failed"
else
    log_warn "  Agreements database not running - skipping"
fi

# 2. Backup Docker volumes
log_info "Backing up Docker volumes..."

VOLUME_COUNT=0
for volume in $(docker volume ls --format "{{.Name}}" | grep -E "(docuseal|agreements|signed|original|stamped)" 2>/dev/null || true); do
    log_info "  Backing up volume: $volume"
    docker run --rm \
        -v "$volume":/source:ro \
        -v "$BACKUP_DIR/volumes":/backup \
        alpine tar czf "/backup/${BACKUP_NAME}-${volume}.tar.gz" -C /source . 2>/dev/null \
        && log_success "  Volume $volume backed up" \
        || log_warn "  Volume $volume backup failed"
    VOLUME_COUNT=$((VOLUME_COUNT + 1))
done

if [ $VOLUME_COUNT -eq 0 ]; then
    log_warn "  No matching Docker volumes found"
fi

# 3. Create backup manifest
cat > "$BACKUP_DIR/${BACKUP_NAME}-manifest.txt" << EOF
🛡️  SAFETY BACKUP MANIFEST
===========================
Backup Name: $BACKUP_NAME
Created: $(date)
Reason: $REASON

📦 Contents:
- DocuSeal database: data/${BACKUP_NAME}-docuseal.sql (if exists)
- Agreements database: data/${BACKUP_NAME}-agreements.sql (if exists)  
- Docker volumes: volumes/${BACKUP_NAME}-*.tar.gz

🔧 Restore Instructions:
1. Stop services: docker compose -f docker-compose.unified.yml down
2. Restore databases:
   docker exec -i <container> psql -U <user> -d <db> < data/${BACKUP_NAME}-<db>.sql
3. Restore volumes:
   docker run --rm -v <volume>:/target -v \$(pwd)/backups/volumes:/backup \\
     alpine tar xzf /backup/${BACKUP_NAME}-<volume>.tar.gz -C /target
4. Start services: docker compose -f docker-compose.unified.yml up -d
EOF

log_success "Backup manifest created: ${BACKUP_NAME}-manifest.txt"

# 4. Clean up old backups (keep last 10)
log_info "Cleaning up old backups (keeping last 10)..."
ls -t "$BACKUP_DIR"/safety-backup-*-manifest.txt 2>/dev/null | tail -n +11 | while read manifest; do
    backup_base=$(basename "$manifest" "-manifest.txt")
    log_info "  Removing old backup: $backup_base"
    rm -f "$BACKUP_DIR/${backup_base}"* "$BACKUP_DIR/data/${backup_base}"* "$BACKUP_DIR/volumes/${backup_base}"* 2>/dev/null || true
done

# Summary
echo ""
echo -e "${GREEN}✅ Safety backup completed!${NC}"
echo ""
echo "  Backup location: $BACKUP_DIR"
echo "  Backup name: $BACKUP_NAME"
echo ""
echo "  To restore if something goes wrong:"
echo "    1. Check manifest: cat $BACKUP_DIR/${BACKUP_NAME}-manifest.txt"
echo "    2. Follow restore instructions in manifest"
echo ""
