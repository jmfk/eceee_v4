"""
Management command to fix permissions on all MinIO assets.
Ensures that files intended to be public (like images) are accessible.
Uses Bucket Policies as the primary method (compatible with Linode/modern MinIO).
"""

import logging
import time
from django.core.management.base import BaseCommand
from django.core.files.storage import default_storage
from django.conf import settings
from file_manager.models import MediaFile

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Fix permissions on all MinIO assets using Bucket Policies and provide a report"

    def add_arguments(self, parser):
        parser.add_argument(
            "--prefix",
            type=str,
            default="uploads/",
            help="Prefix path to make public via bucket policy (default: uploads/)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be changed without making changes",
        )
        parser.add_argument(
            "--check-only",
            action="store_true",
            help="Only check and report accessibility without changing anything",
        )

    def handle(self, *args, **options):
        prefix = options["prefix"]
        dry_run = options["dry_run"]
        check_only = options["check_only"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN MODE - No changes will be made"))

        # Get the storage backend
        from file_manager.storage import storage as fm_storage
        storage_backend = fm_storage

        if not hasattr(storage_backend, "set_public_bucket_policy"):
            self.stdout.write(self.style.ERROR("Storage backend does not support bucket policies."))
            return

        # 1. Apply Bucket Policy (The Fix)
        if not check_only:
            self.stdout.write(self.style.SUCCESS(f"Applying public-read bucket policy to '{prefix}*'..."))
            if not dry_run:
                if storage_backend.set_public_bucket_policy(prefix):
                    self.stdout.write(self.style.SUCCESS("✓ Bucket policy applied successfully."))
                    self.stdout.write("Waiting a few seconds for policy to propagate...")
                    time.sleep(2)
                else:
                    self.stdout.write(self.style.ERROR("✗ Failed to apply bucket policy."))
            else:
                self.stdout.write(self.style.WARNING(f"Would apply bucket policy to {prefix}*"))

        # 2. Report on Accessibility
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.HTTP_INFO("ACCESSIBILITY REPORT"))
        self.stdout.write("=" * 60)
        
        public_files = MediaFile.objects.filter(access_level="public")
        total_files = public_files.count()
        self.stdout.write(f"Checking {total_files} public media files...")

        broken_count = 0
        accessible_count = 0
        processed = 0

        for media_file in public_files:
            processed += 1
            is_accessible = storage_backend.is_publicly_accessible(media_file.file_path)
            
            if is_accessible:
                accessible_count += 1
            else:
                broken_count += 1
                self.stdout.write(self.style.WARNING(f"BROKEN: {media_file.file_path} (URL: {storage_backend.get_public_url(media_file.file_path)})"))

            if processed % 50 == 0:
                self.stdout.write(f"Processed {processed}/{total_files}...")

        self.stdout.write("-" * 60)
        self.stdout.write(f"Total Public Files: {total_files}")
        self.stdout.write(self.style.SUCCESS(f"Accessible:         {accessible_count}"))
        
        if broken_count > 0:
            self.stdout.write(self.style.ERROR(f"Broken/Forbidden:   {broken_count}"))
            if not check_only and not dry_run:
                self.stdout.write(self.style.WARNING("\nNote: If files are still broken, the bucket policy might still be propagating or the prefix is incorrect."))
        else:
            self.stdout.write(self.style.SUCCESS("\n✓ All public files are accessible!"))
        
        self.stdout.write("=" * 60 + "\n")
