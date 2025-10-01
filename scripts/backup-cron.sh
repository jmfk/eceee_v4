#!/bin/bash
# Automated backup script for cron jobs
# This script performs backups and manages retention

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/path/to/backups}"  # Set this or use environment variable
RETENTION_DAYS="${RETENTION_DAYS:-30}"  # Keep backups for 30 days by default
PROJECT_DIR="${PROJECT_DIR:-/Users/jmfk/code/eceee_v4}"  # Adjust to your project path

# Change to project directory
cd "${PROJECT_DIR}"

# Run backup
./scripts/backup.sh "${BACKUP_DIR}"

# Clean up old backups
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "eceee_v4_backup_*.tar.gz" -mtime +${RETENTION_DAYS} -delete
echo "✓ Old backups removed"

# Optional: Upload to cloud storage (uncomment and configure as needed)
# AWS S3 example:
# aws s3 sync "${BACKUP_DIR}" s3://your-bucket/eceee_v4_backups/

# Google Cloud Storage example:
# gsutil -m rsync -r "${BACKUP_DIR}" gs://your-bucket/eceee_v4_backups/

echo "Backup cron job complete: $(date)"


