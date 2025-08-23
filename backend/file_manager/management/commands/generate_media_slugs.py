"""
Management command to generate SEO-friendly slugs for existing media files.
"""

from django.core.management.base import BaseCommand
from django.utils.text import slugify
from file_manager.models import MediaFile


class Command(BaseCommand):
    help = "Generate SEO-friendly slugs for existing media files"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be changed without making changes",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Regenerate slugs even for files that already have them",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        force = options["force"]

        # Get files that need slug generation
        if force:
            files = MediaFile.objects.all()
            self.stdout.write(f"Processing all {files.count()} media files...")
        else:
            files = MediaFile.objects.filter(slug__in=["", None])
            self.stdout.write(
                f"Processing {files.count()} media files without slugs..."
            )

        updated_count = 0
        error_count = 0

        for media_file in files:
            try:
                old_slug = media_file.slug

                if force or not old_slug:
                    # Generate new slug
                    new_slug = media_file._generate_unique_slug()

                    if dry_run:
                        self.stdout.write(
                            f"Would update: {media_file.title} "
                            f"({old_slug or 'no slug'} -> {new_slug})"
                        )
                    else:
                        media_file.slug = new_slug
                        media_file.save(update_fields=["slug"])
                        self.stdout.write(
                            f"Updated: {media_file.title} "
                            f"({old_slug or 'no slug'} -> {new_slug})"
                        )

                    updated_count += 1

            except Exception as e:
                error_count += 1
                self.stderr.write(
                    f"Error processing {media_file.title} (ID: {media_file.id}): {e}"
                )

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"DRY RUN: Would update {updated_count} files. "
                    f"Run without --dry-run to apply changes."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f"Successfully updated {updated_count} media files.")
            )

        if error_count > 0:
            self.stderr.write(self.style.ERROR(f"Encountered {error_count} errors."))
