#!/bin/bash
# Restore script for eceee_v4 - Database and Media Files
# Usage: ./scripts/restore.sh <backup_file.tar.gz>

set -e

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.tar.gz>"
    echo "Example: $0 backups/eceee_v4_backup_20250101_120000.tar.gz"
    exit 1
fi

BACKUP_FILE="$1"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    echo -e "${RED}Error: Backup file not found: ${BACKUP_FILE}${NC}"
    exit 1
fi

echo -e "${BLUE}=== eceee_v4 Restore Script ===${NC}"
echo "Backup file: ${BACKUP_FILE}"
echo

# Warning
echo -e "${YELLOW}⚠️  WARNING ⚠️${NC}"
echo -e "${YELLOW}This will REPLACE your current database and media files!${NC}"
echo -e "${YELLOW}Make sure you have a backup of your current data if needed.${NC}"
echo
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Create temporary directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf ${TEMP_DIR}" EXIT

# Extract backup
echo -e "${BLUE}[1/4] Extracting backup archive...${NC}"
tar -xzf "${BACKUP_FILE}" -C "${TEMP_DIR}"
BACKUP_NAME=$(ls "${TEMP_DIR}")
BACKUP_PATH="${TEMP_DIR}/${BACKUP_NAME}"
echo -e "${GREEN}✓ Backup extracted${NC}"
echo

# Show backup info
if [ -f "${BACKUP_PATH}/backup_info.txt" ]; then
    echo -e "${BLUE}Backup Information:${NC}"
    cat "${BACKUP_PATH}/backup_info.txt"
    echo
fi

# Stop services
echo -e "${BLUE}[2/4] Stopping services...${NC}"
docker-compose stop backend frontend
echo -e "${GREEN}✓ Services stopped${NC}"
echo

# Restore database
echo -e "${BLUE}[3/4] Restoring PostgreSQL database...${NC}"
if [ -f "${BACKUP_PATH}/database.sql.gz" ]; then
    # Drop and recreate database
    docker-compose exec -T db psql -U postgres -c "DROP DATABASE IF EXISTS eceee_v4;"
    docker-compose exec -T db psql -U postgres -c "CREATE DATABASE eceee_v4;"
    
    # Restore database
    gunzip -c "${BACKUP_PATH}/database.sql.gz" | docker-compose exec -T db psql -U postgres eceee_v4
    echo -e "${GREEN}✓ Database restored${NC}"
else
    echo -e "${RED}⚠ Database backup not found${NC}"
fi
echo

# Restore MinIO storage
echo -e "${BLUE}[4/4] Restoring MinIO storage...${NC}"
if [ -f "${BACKUP_PATH}/minio_storage.tar.gz" ]; then
    # Backup current MinIO data (just in case)
    if [ -d "./storage/minio" ]; then
        echo "Creating safety backup of current MinIO data..."
        mv ./storage/minio "./storage/minio_backup_$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Extract MinIO backup
    mkdir -p ./storage
    tar -xzf "${BACKUP_PATH}/minio_storage.tar.gz" -C ./storage
    echo -e "${GREEN}✓ MinIO storage restored${NC}"
else
    echo -e "${RED}⚠ MinIO storage backup not found${NC}"
fi
echo

# Restart services
echo -e "${BLUE}Restarting services...${NC}"
docker-compose up -d backend frontend
echo -e "${GREEN}✓ Services restarted${NC}"
echo

# Run migrations (just in case)
echo -e "${BLUE}Running migrations...${NC}"
sleep 5  # Wait for services to start
docker-compose exec backend python manage.py migrate --noinput
echo -e "${GREEN}✓ Migrations complete${NC}"
echo

echo -e "${GREEN}=== Restore Complete ===${NC}"
echo "Your database and media files have been restored."
echo "Please verify that everything is working correctly."
echo


