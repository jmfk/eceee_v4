#!/bin/bash
# Backup script for eceee_v4 - Database and Media Files
# Usage: ./scripts/backup.sh [backup_dir]

set -e

# Configuration
BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="eceee_v4_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== eceee_v4 Backup Script ===${NC}"
echo "Backup timestamp: ${TIMESTAMP}"
echo "Backup location: ${BACKUP_PATH}"
echo

# Create backup directory
mkdir -p "${BACKUP_PATH}"

# 1. Backup PostgreSQL Database
echo -e "${BLUE}[1/3] Backing up PostgreSQL database...${NC}"
docker-compose exec -T db pg_dump -U postgres eceee_v4 | gzip > "${BACKUP_PATH}/database.sql.gz"
echo -e "${GREEN}✓ Database backup complete${NC}"
echo

# 2. Backup MinIO Storage
echo -e "${BLUE}[2/3] Backing up MinIO storage...${NC}"
if [ -d "./storage/minio" ]; then
    tar -czf "${BACKUP_PATH}/minio_storage.tar.gz" -C ./storage minio
    echo -e "${GREEN}✓ MinIO storage backup complete${NC}"
else
    echo -e "${RED}⚠ MinIO storage directory not found${NC}"
fi
echo

# 3. Backup Environment and Configuration
echo -e "${BLUE}[3/3] Backing up configuration...${NC}"
# Create a metadata file
cat > "${BACKUP_PATH}/backup_info.txt" << EOF
Backup Information
==================
Date: $(date)
Database: eceee_v4
PostgreSQL Version: $(docker-compose exec -T db psql -U postgres -c "SELECT version();" | head -n 3 | tail -n 1)

File Counts:
- Database size: $(docker-compose exec -T db psql -U postgres -d eceee_v4 -c "SELECT pg_size_pretty(pg_database_size('eceee_v4'));" | tail -n 2 | head -n 1)
- MinIO storage size: $(du -sh ./storage/minio 2>/dev/null || echo "N/A")

Media Files in Database:
$(docker-compose exec -T backend python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from file_manager.models import MediaFile
print(f'  Total files: {MediaFile.objects.with_deleted().count()}')
print(f'  Active files: {MediaFile.objects.count()}')
print(f'  Deleted files: {MediaFile.objects.with_deleted().filter(is_deleted=True).count()}')
" 2>/dev/null || echo "  Could not retrieve file counts")

Backup Contents:
- database.sql.gz (PostgreSQL dump)
- minio_storage.tar.gz (Media files)
- backup_info.txt (This file)
EOF
echo -e "${GREEN}✓ Configuration backup complete${NC}"
echo

# Create a compressed archive of the entire backup
echo -e "${BLUE}Creating final backup archive...${NC}"
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
BACKUP_SIZE=$(du -sh "${BACKUP_NAME}.tar.gz" | cut -f1)
rm -rf "${BACKUP_NAME}"
cd - > /dev/null

echo
echo -e "${GREEN}=== Backup Complete ===${NC}"
echo -e "Backup file: ${BLUE}${BACKUP_DIR}/${BACKUP_NAME}.tar.gz${NC}"
echo -e "Backup size: ${BLUE}${BACKUP_SIZE}${NC}"
echo
echo "To restore this backup, use:"
echo "  ./scripts/restore.sh ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo


