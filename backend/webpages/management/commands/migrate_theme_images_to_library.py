"""
Management command to migrate theme images from design_groups to library folder.

This command:
1. Lists all themes
2. For each theme, finds images in theme_images/{theme_id}/design_groups/
3. Copies them to theme_images/{theme_id}/library/
4. Updates image URLs in design_groups JSON
5. Optionally deletes old files after verification

Usage:
    python manage.py migrate_theme_images_to_library --dry-run  # Preview changes
    python manage.py migrate_theme_images_to_library              # Execute migration
    python manage.py migrate_theme_images_to_library --delete-old # Delete old files after migration
"""

from django.core.management.base import BaseCommand, CommandError
from django.core.files.base import ContentFile
from webpages.models import PageTheme
from file_manager.storage import S3MediaStorage
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Migrate theme images from design_groups folder to library folder'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without executing them',
        )
        parser.add_argument(
            '--delete-old',
            action='store_true',
            help='Delete old design_groups files after successful migration',
        )
        parser.add_argument(
            '--theme-id',
            type=int,
            help='Migrate only a specific theme by ID',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        delete_old = options['delete_old']
        theme_id = options.get('theme_id')
        
        storage = S3MediaStorage()
        
        # Get themes to migrate
        if theme_id:
            themes = PageTheme.objects.filter(id=theme_id)
            if not themes.exists():
                raise CommandError(f'Theme with ID {theme_id} does not exist')
        else:
            themes = PageTheme.objects.all()
        
        total_themes = themes.count()
        self.stdout.write(f"Found {total_themes} themes to process")
        
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN MODE - No changes will be made"))
        
        migrated_count = 0
        error_count = 0
        skipped_count = 0
        
        for theme in themes:
            self.stdout.write(f"\nProcessing theme: {theme.name} (ID: {theme.id})")
            
            try:
                # Check for legacy design_groups path
                old_path = f"theme_images/{theme.id}/design_groups/"
                new_path = f"theme_images/{theme.id}/library/"
                
                # List files in old location
                try:
                    if hasattr(storage, 'listdir'):
                        directories, files = storage.listdir(old_path)
                        
                        if not files:
                            self.stdout.write(f"  No images found in {old_path}")
                            skipped_count += 1
                            continue
                        
                        self.stdout.write(f"  Found {len(files)} images to migrate")
                        
                        url_mapping = {}
                        migrated_files = []
                        
                        for filename in files:
                            old_file_path = f"{old_path}{filename}"
                            new_file_path = f"{new_path}{filename}"
                            
                            self.stdout.write(f"    Migrating: {filename}")
                            
                            if not dry_run:
                                # Check if file exists in old location
                                if storage.exists(old_file_path):
                                    # Check if already exists in new location
                                    if storage.exists(new_file_path):
                                        self.stdout.write(
                                            self.style.WARNING(
                                                f"      File already exists in library: {filename}"
                                            )
                                        )
                                    else:
                                        # Copy file to new location
                                        old_file = storage._open(old_file_path, "rb")
                                        file_content = old_file.read()
                                        old_file.close()
                                        
                                        storage._save(new_file_path, ContentFile(file_content))
                                        self.stdout.write(
                                            self.style.SUCCESS(f"      Copied to library")
                                        )
                                    
                                    # Build URL mapping
                                    old_url = storage.url(old_file_path)
                                    new_url = storage.url(new_file_path)
                                    url_mapping[old_url] = new_url
                                    url_mapping[old_file_path] = new_file_path
                                    
                                    migrated_files.append(filename)
                                else:
                                    self.stdout.write(
                                        self.style.WARNING(
                                            f"      File not found: {old_file_path}"
                                        )
                                    )
                        
                        if not dry_run and url_mapping:
                            # Update design_groups JSON with new URLs
                            self.stdout.write("  Updating design_groups URLs...")
                            updated_design_groups = PageTheme._update_image_urls_in_design_groups(
                                theme.design_groups, url_mapping
                            )
                            theme.design_groups = updated_design_groups
                            theme.save(update_fields=['design_groups'])
                            self.stdout.write(self.style.SUCCESS("  URLs updated in design_groups"))
                            
                            # Delete old files if requested
                            if delete_old:
                                self.stdout.write("  Deleting old files...")
                                for filename in migrated_files:
                                    old_file_path = f"{old_path}{filename}"
                                    try:
                                        if storage.exists(old_file_path):
                                            storage.delete(old_file_path)
                                            self.stdout.write(f"    Deleted: {filename}")
                                    except Exception as e:
                                        self.stdout.write(
                                            self.style.WARNING(
                                                f"    Failed to delete {filename}: {str(e)}"
                                            )
                                        )
                        
                        migrated_count += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"  Migrated {len(migrated_files)} images for theme {theme.name}"
                            )
                        )
                        
                except Exception as e:
                    # Directory might not exist
                    if "NoSuchKey" in str(e) or "does not exist" in str(e).lower():
                        self.stdout.write(f"  No design_groups folder found (this is normal)")
                        skipped_count += 1
                    else:
                        raise
                    
            except Exception as e:
                error_count += 1
                self.stdout.write(
                    self.style.ERROR(f"  Error processing theme {theme.name}: {str(e)}")
                )
                logger.error(f"Error migrating theme {theme.id}: {str(e)}", exc_info=True)
        
        # Summary
        self.stdout.write("\n" + "="*60)
        self.stdout.write(self.style.SUCCESS("MIGRATION SUMMARY"))
        self.stdout.write("="*60)
        self.stdout.write(f"Total themes processed: {total_themes}")
        self.stdout.write(self.style.SUCCESS(f"Successfully migrated: {migrated_count}"))
        self.stdout.write(f"Skipped (no images): {skipped_count}")
        if error_count > 0:
            self.stdout.write(self.style.ERROR(f"Errors: {error_count}"))
        
        if dry_run:
            self.stdout.write("\n" + self.style.WARNING("DRY RUN COMPLETED - No changes were made"))
            self.stdout.write("Run without --dry-run to execute the migration")
        else:
            self.stdout.write("\n" + self.style.SUCCESS("MIGRATION COMPLETED"))
            if not delete_old:
                self.stdout.write(
                    self.style.WARNING(
                        "Old files were NOT deleted. Run with --delete-old to remove them."
                    )
                )

