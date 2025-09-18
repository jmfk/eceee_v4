"""
Celery tasks for file manager operations.
"""

import logging
from celery import shared_task
from django.core.management import call_command

logger = logging.getLogger(__name__)


@shared_task
def cleanup_deleted_files(days=30, batch_size=100):
    """
    Celery task to clean up soft-deleted files with no references.

    Args:
        days (int): Number of days after deletion to wait before cleanup
        batch_size (int): Number of files to process in each batch
    """
    try:
        # Call the management command
        call_command(
            "cleanup_deleted_files", days=days, batch_size=batch_size, dry_run=False
        )
        return True
    except Exception as e:
        logger.error(f"Failed to clean up deleted files: {str(e)}")
        return False
