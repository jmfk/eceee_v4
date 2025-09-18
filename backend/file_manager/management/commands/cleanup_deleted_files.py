"""
Management command to clean up soft-deleted files with no references.
"""

import logging
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from file_manager.models import MediaFile

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Clean up soft-deleted files that have no references and have been deleted for a specified period"

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="Number of days after deletion to wait before cleanup (default: 30)",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=100,
            help="Number of files to process in each batch (default: 100)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without actually deleting",
        )

    def handle(self, *args, **options):
        days = options["days"]
        batch_size = options["batch_size"]
        dry_run = options["dry_run"]

        cutoff_date = timezone.now() - timedelta(days=days)

        # Get files that are:
        # 1. Soft deleted
        # 2. Have no references
        # 3. Were deleted before the cutoff date
        files_to_delete = MediaFile.objects.with_deleted().filter(
            is_deleted=True, reference_count=0, deleted_at__lt=cutoff_date
        )

        total_count = files_to_delete.count()
        if total_count == 0:
            self.stdout.write("No files to clean up")
            return

        self.stdout.write(f"Found {total_count} files to clean up")
        if dry_run:
            self.stdout.write("DRY RUN - no files will be deleted")

        processed_count = 0
        error_count = 0

        # Process in batches
        while processed_count < total_count:
            batch = files_to_delete[processed_count : processed_count + batch_size]

            with transaction.atomic():
                for file in batch:
                    try:
                        if not dry_run:
                            # Perform hard delete
                            file.delete(force=True)
                        self.stdout.write(
                            f"Deleted file: {file.original_filename} (ID: {file.id})"
                        )
                    except Exception as e:
                        error_count += 1
                        logger.error(f"Failed to delete file {file.id}: {str(e)}")
                        self.stderr.write(f"Error deleting file {file.id}: {str(e)}")

            processed_count += len(batch)
            self.stdout.write(f"Processed {processed_count} of {total_count} files")

        summary = f"""
Cleanup Summary:
---------------
Total files processed: {processed_count}
Successfully deleted: {processed_count - error_count}
Errors: {error_count}
"""
        self.stdout.write(summary)

        if dry_run:
            self.stdout.write("DRY RUN - no files were actually deleted")
