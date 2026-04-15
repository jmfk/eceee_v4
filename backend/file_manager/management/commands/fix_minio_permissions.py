"""
Management command to fix permissions on all MinIO assets.
Ensures that files intended to be public (like images) have public-read ACL.
"""

import logging
from django.core.management.base import BaseCommand
from django.core.files.storage import default_storage
from django.conf import settings
from file_manager.models import MediaFile

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Fix permissions on all MinIO assets to ensure they are public-read where appropriate"

    def add_arguments(self, parser):
        parser.add_argument(
            "--prefix",
            type=str,
            default="",
            help="Prefix path for files to check (default: all files)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be changed without making changes",
        )
        parser.add_argument(
            "--all-media",
            action="store_true",
            help="Process all files in MediaFile database with public access level",
        )

    def handle(self, *args, **options):
        prefix = options["prefix"]
        dry_run = options["dry_run"]
        all_media = options["all_media"]

        if dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN MODE - No changes will be made")
            )

        # Check if storage backend supports make_public method
        storage_backend = default_storage
        if hasattr(settings, "STORAGES") and "default" in settings.STORAGES:
            from django.core.files.storage import get_storage_class
            backend_class = get_storage_class(settings.STORAGES["default"]["BACKEND"])
            # If it's our custom storage, it might be instantiated differently
            # but default_storage should be an instance of it.
            pass

        if not hasattr(storage_backend, "make_public"):
            # Try to see if we can find it in file_manager.storage
            from file_manager.storage import storage as fm_storage
            if hasattr(fm_storage, "make_public"):
                storage_backend = fm_storage
            else:
                self.stdout.write(
                    self.style.ERROR(
                        "Storage backend does not support make_public method."
                    )
                )
                return

        success_count = 0
        error_count = 0
        total_processed = 0

        if all_media:
            self.stdout.write(self.style.SUCCESS("Processing all public MediaFile records..."))
            public_files = MediaFile.objects.filter(access_level="public")
            total_files = public_files.count()
            self.stdout.write(f"Found {total_files} public media files to check")

            for media_file in public_files:
                total_processed += 1
                file_path = media_file.file_path
                if self._fix_permission(storage_backend, file_path, dry_run):
                    success_count += 1
                else:
                    error_count += 1
                
                if total_processed % 100 == 0:
                    self.stdout.write(f"Processed {total_processed}/{total_files}...")

        else:
            # Process by prefix in storage
            self.stdout.write(self.style.SUCCESS(f"Processing files in storage under prefix: '{prefix}'"))
            try:
                all_files = self._collect_files(storage_backend, prefix)
                self.stdout.write(f"Found {len(all_files)} files in storage to check")

                for file_path in all_files:
                    total_processed += 1
                    if self._fix_permission(storage_backend, file_path, dry_run):
                        success_count += 1
                    else:
                        error_count += 1
                    
                    if total_processed % 100 == 0:
                        self.stdout.write(f"Processed {total_processed}/{len(all_files)}...")

            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed to list files: {e}"))
                return

        if not dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\nCompleted: {success_count} successful, {error_count} errors"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f"\nDry run completed. Would have processed {total_processed} files.")
            )

    def _fix_permission(self, storage_backend, file_path, dry_run):
        """Set public-read ACL on a file."""
        try:
            if dry_run:
                self.stdout.write(f"Would make public: {file_path}")
                return True
            else:
                if storage_backend.make_public(file_path):
                    self.stdout.write(self.style.SUCCESS(f"Made public: {file_path}"))
                    return True
                else:
                    self.stdout.write(self.style.WARNING(f"Failed to make public: {file_path}"))
                    return False
        except Exception as e:
            logger.error(f"Error processing {file_path}: {e}")
            self.stdout.write(self.style.ERROR(f"Error processing {file_path}: {e}"))
            return False

    def _collect_files(self, storage_backend, prefix):
        """Collect all files recursively from storage."""
        all_files = []
        
        def collect_recursive(path):
            dirs, files = storage_backend.listdir(path)
            for file in files:
                all_files.append(f"{path}{file}")
            for dir in dirs:
                collect_recursive(f"{path}{dir}/")
        
        collect_recursive(prefix)
        return all_files
