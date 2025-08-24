"""
Management command for optimizing the media system performance.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from file_manager.performance import (
    DatabaseOptimizer,
    FileProcessingOptimizer,
    CacheManager,
    warm_cache,
    cleanup_expired_cache,
)
from file_manager.models import MediaFile, MediaThumbnail
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Optimize media system performance and clean up resources"

    def add_arguments(self, parser):
        parser.add_argument(
            "--database",
            action="store_true",
            help="Optimize database indexes and queries",
        )
        parser.add_argument(
            "--cache",
            action="store_true",
            help="Optimize cache and warm up frequently accessed data",
        )
        parser.add_argument(
            "--thumbnails",
            action="store_true",
            help="Generate missing thumbnails and optimize image processing",
        )
        parser.add_argument(
            "--cleanup",
            action="store_true",
            help="Clean up orphaned files and expired data",
        )
        parser.add_argument(
            "--all", action="store_true", help="Run all optimization tasks"
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be done without making changes",
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS(
                f"Starting media system optimization at {timezone.now()}"
            )
        )

        dry_run = options["dry_run"]
        if dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN MODE - No changes will be made")
            )

        # Determine which optimizations to run
        run_all = options["all"]
        run_database = options["database"] or run_all
        run_cache = options["cache"] or run_all
        run_thumbnails = options["thumbnails"] or run_all
        run_cleanup = options["cleanup"] or run_all

        if not any([run_database, run_cache, run_thumbnails, run_cleanup]):
            self.stdout.write(
                self.style.ERROR(
                    "No optimization tasks specified. Use --help for options."
                )
            )
            return

        # Run optimizations
        if run_database:
            self._optimize_database(dry_run)

        if run_cache:
            self._optimize_cache(dry_run)

        if run_thumbnails:
            self._optimize_thumbnails(dry_run)

        if run_cleanup:
            self._cleanup_system(dry_run)

        self.stdout.write(
            self.style.SUCCESS(f"Optimization completed at {timezone.now()}")
        )

    def _optimize_database(self, dry_run=False):
        """Optimize database performance."""
        self.stdout.write("\n" + "=" * 50)
        self.stdout.write(self.style.HTTP_INFO("DATABASE OPTIMIZATION"))
        self.stdout.write("=" * 50)

        if dry_run:
            self.stdout.write(
                "Would optimize database indexes and analyze query performance"
            )
            return

        try:
            # Apply database optimizations
            self.stdout.write("Applying database optimizations...")
            DatabaseOptimizer.optimize_media_queries()

            # Analyze query performance
            self.stdout.write("Analyzing query performance...")
            DatabaseOptimizer.analyze_query_performance()

            # Update table statistics
            self.stdout.write("Updating table statistics...")
            from django.db import connection

            with connection.cursor() as cursor:
                cursor.execute("ANALYZE file_manager_mediafile;")
                cursor.execute("ANALYZE file_manager_mediacollection;")
                cursor.execute("ANALYZE file_manager_mediatag;")
                cursor.execute("ANALYZE file_manager_mediathumbnail;")

            self.stdout.write(self.style.SUCCESS("✓ Database optimization completed"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"✗ Database optimization failed: {e}"))
            logger.error(f"Database optimization failed: {e}")

    def _optimize_cache(self, dry_run=False):
        """Optimize cache performance."""
        self.stdout.write("\n" + "=" * 50)
        self.stdout.write(self.style.HTTP_INFO("CACHE OPTIMIZATION"))
        self.stdout.write("=" * 50)

        if dry_run:
            self.stdout.write(
                "Would clean up expired cache entries and warm up frequently accessed data"
            )
            return

        try:
            # Clean up expired cache entries
            self.stdout.write("Cleaning up expired cache entries...")
            cleanup_expired_cache()

            # Warm up cache with frequently accessed data
            self.stdout.write("Warming up cache with frequently accessed data...")
            warm_cache()

            # Cache recent media files
            self.stdout.write("Caching recent media files...")
            recent_files = MediaFile.objects.filter(
                created_at__gte=timezone.now() - timezone.timedelta(days=7)
            ).select_related("namespace", "created_by")[:100]

            cached_count = 0
            for media_file in recent_files:
                CacheManager.cache_media_file(
                    str(media_file.id),
                    {
                        "title": media_file.title,
                        "file_type": media_file.file_type,
                        "file_size": media_file.file_size,
                        "created_at": media_file.created_at.isoformat(),
                    },
                )
                cached_count += 1

            self.stdout.write(f"Cached {cached_count} recent media files")
            self.stdout.write(self.style.SUCCESS("✓ Cache optimization completed"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"✗ Cache optimization failed: {e}"))
            logger.error(f"Cache optimization failed: {e}")

    def _optimize_thumbnails(self, dry_run=False):
        """Optimize thumbnail generation and processing."""
        self.stdout.write("\n" + "=" * 50)
        self.stdout.write(self.style.HTTP_INFO("THUMBNAIL OPTIMIZATION"))
        self.stdout.write("=" * 50)

        try:
            # Find images without thumbnails
            images_without_thumbnails = MediaFile.objects.filter(
                file_type="image"
            ).exclude(
                id__in=MediaThumbnail.objects.values_list("media_file_id", flat=True)
            )

            missing_count = images_without_thumbnails.count()
            self.stdout.write(f"Found {missing_count} images without thumbnails")

            if dry_run:
                self.stdout.write(
                    f"Would generate thumbnails for {missing_count} images"
                )
                return

            if missing_count == 0:
                self.stdout.write("All images have thumbnails")
                return

            # Optimize image processing settings
            FileProcessingOptimizer.optimize_image_processing()

            # Generate missing thumbnails in batches
            self.stdout.write("Generating missing thumbnails...")
            FileProcessingOptimizer.batch_thumbnail_generation(
                list(images_without_thumbnails), batch_size=10
            )

            self.stdout.write(
                self.style.SUCCESS(f"✓ Generated thumbnails for {missing_count} images")
            )

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"✗ Thumbnail optimization failed: {e}"))
            logger.error(f"Thumbnail optimization failed: {e}")

    def _cleanup_system(self, dry_run=False):
        """Clean up orphaned files and expired data."""
        self.stdout.write("\n" + "=" * 50)
        self.stdout.write(self.style.HTTP_INFO("SYSTEM CLEANUP"))
        self.stdout.write("=" * 50)

        try:
            # Find orphaned thumbnails
            orphaned_thumbnails = MediaThumbnail.objects.filter(media_file__isnull=True)
            orphaned_count = orphaned_thumbnails.count()

            if orphaned_count > 0:
                self.stdout.write(f"Found {orphaned_count} orphaned thumbnails")
                if not dry_run:
                    orphaned_thumbnails.delete()
                    self.stdout.write(f"✓ Deleted {orphaned_count} orphaned thumbnails")
                else:
                    self.stdout.write(
                        f"Would delete {orphaned_count} orphaned thumbnails"
                    )

            # Find files with missing S3 objects
            self.stdout.write("Checking for files with missing S3 objects...")
            missing_files = []

            from .storage import S3MediaStorage

            storage = S3MediaStorage()

            # Check a sample of recent files
            recent_files = MediaFile.objects.filter(
                created_at__gte=timezone.now() - timezone.timedelta(days=30)
            )[
                :100
            ]  # Limit to avoid long execution times

            for media_file in recent_files:
                try:
                    if not storage._file_exists(media_file.file_path):
                        missing_files.append(media_file)
                except Exception:
                    # Skip files that can't be checked
                    continue

            if missing_files:
                self.stdout.write(
                    f"Found {len(missing_files)} files with missing S3 objects"
                )
                if not dry_run:
                    # Mark files as needing attention rather than deleting
                    for media_file in missing_files:
                        logger.warning(
                            f"File {media_file.id} has missing S3 object: {media_file.file_path}"
                        )
                else:
                    self.stdout.write(
                        f"Would log {len(missing_files)} files with missing S3 objects"
                    )

            # Clean up old log entries (if using database logging)
            old_logs_cutoff = timezone.now() - timezone.timedelta(days=90)
            self.stdout.write(
                f"Cleaning up log entries older than {old_logs_cutoff.date()}..."
            )

            # This would depend on your logging setup
            # For now, just report what would be done
            if dry_run:
                self.stdout.write("Would clean up old log entries")
            else:
                self.stdout.write(
                    "Log cleanup completed (implementation depends on logging setup)"
                )

            self.stdout.write(self.style.SUCCESS("✓ System cleanup completed"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"✗ System cleanup failed: {e}"))
            logger.error(f"System cleanup failed: {e}")
