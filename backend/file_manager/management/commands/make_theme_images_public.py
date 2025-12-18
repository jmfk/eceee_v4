"""
Management command to set theme images to public-read ACL.

This command fixes existing theme images that were uploaded before
public-read ACL was configured, ensuring they can be accessed directly
by browsers and imgproxy.
"""

import logging
from django.core.management.base import BaseCommand
from django.core.files.storage import default_storage
from django.conf import settings

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Set theme images to public-read ACL for direct browser access"

    def add_arguments(self, parser):
        parser.add_argument(
            "--prefix",
            type=str,
            default="theme_images/",
            help="Prefix path for files to make public (default: theme_images/)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be changed without making changes",
        )

    def handle(self, *args, **options):
        prefix = options["prefix"]
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN MODE - No changes will be made")
            )

        # Check if storage backend supports make_public method
        if not hasattr(default_storage, "make_public"):
            self.stdout.write(
                self.style.ERROR(
                    "Storage backend does not support make_public method. "
                    "This command requires LinodeObjectStorage."
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(f"Making files public under prefix: {prefix}")
        )

        # List all files with the prefix
        try:
            directories, files = default_storage.listdir(prefix)
            all_files = []

            # Get all files recursively
            def collect_files(path):
                dirs, files = default_storage.listdir(path)
                for file in files:
                    all_files.append(f"{path}{file}")
                for dir in dirs:
                    collect_files(f"{path}{dir}/")

            collect_files(prefix)

            self.stdout.write(f"Found {len(all_files)} files to process")

            success_count = 0
            error_count = 0

            for file_path in all_files:
                try:
                    if dry_run:
                        self.stdout.write(f"Would make public: {file_path}")
                    else:
                        if default_storage.make_public(file_path):
                            success_count += 1
                            self.stdout.write(
                                self.style.SUCCESS(f"Made public: {file_path}")
                            )
                        else:
                            error_count += 1
                            self.stdout.write(
                                self.style.WARNING(f"Failed: {file_path}")
                            )
                except Exception as e:
                    error_count += 1
                    logger.error(f"Error processing {file_path}: {e}")
                    self.stdout.write(
                        self.style.ERROR(f"Error processing {file_path}: {e}")
                    )

            if not dry_run:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"\nCompleted: {success_count} successful, {error_count} errors"
                    )
                )
            else:
                self.stdout.write(
                    self.style.SUCCESS(f"\nWould process {len(all_files)} files")
                )

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Failed to list files: {e}"))
            logger.error(f"Failed to list files: {e}")
