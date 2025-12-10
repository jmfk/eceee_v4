"""
Management command to migrate widget image references to full MediaFile objects.

This command:
1. Scans all PageVersion.widgets JSONFields
2. Identifies image fields in widget configurations
3. Recursively processes nested widgets (widgets with slots)
4. Replaces image IDs/partial objects with complete MediaFile objects
5. Handles missing/deleted MediaFiles gracefully
6. Provides dry-run mode and detailed progress reporting
"""

import json
import re
from typing import Any, Dict, List, Set, Optional
from uuid import UUID
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.core.serializers.json import DjangoJSONEncoder
import logging

from webpages.models import PageVersion
from file_manager.models import MediaFile
from file_manager.serializers import MediaFileListSerializer

logger = logging.getLogger(__name__)


# Known image field names across all widgets
IMAGE_FIELD_NAMES = {
    'image', 'image_1', 'image1', 
    'background_image', 'backgroundImage',
    'mobile_image', 'mobileImage',
    'tablet_image', 'tabletImage',
    'logo',
}

# Field name patterns that indicate image fields
IMAGE_FIELD_PATTERNS = [
    r'.*_image$',  # Ends with _image
    r'.*Image$',   # Ends with Image
    r'^image.*',   # Starts with image
    r'^logo$',     # Exactly 'logo'
]


class Command(BaseCommand):
    help = "Migrate widget image references to complete MediaFile objects"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be migrated without making changes",
        )
        parser.add_argument(
            "--backup",
            action="store_true",
            help="Create JSON backup file before migration",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=50,
            help="Number of PageVersions to process in each batch (default: 50)",
        )
        parser.add_argument(
            "--version-id",
            type=int,
            help="Process only a specific PageVersion ID",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Show detailed output for each processed widget",
        )

    def handle(self, *args, **options):
        self.dry_run = options["dry_run"]
        self.create_backup = options["backup"]
        self.batch_size = options["batch_size"]
        self.version_id = options.get("version_id")
        self.verbose = options["verbose"]

        if self.dry_run:
            self.stdout.write(
                self.style.WARNING("🔍 DRY RUN MODE - No changes will be made")
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"🚀 Starting widget image migration (batch size: {self.batch_size})"
            )
        )

        try:
            with transaction.atomic():
                if self.create_backup and not self.dry_run:
                    self._create_backup()

                stats = self._migrate_widget_images()
                self._print_summary(stats)

                if self.dry_run:
                    # Rollback the transaction in dry-run mode
                    transaction.set_rollback(True)

        except Exception as e:
            logger.error(f"Migration failed: {str(e)}", exc_info=True)
            raise CommandError(f"Migration failed: {str(e)}")

    def _create_backup(self):
        """Create JSON backup file before migration"""
        timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
        backup_file = f"page_versions_widgets_backup_{timestamp}.json"

        self.stdout.write("📦 Creating backup...")

        versions = list(PageVersion.objects.all().values('id', 'widgets', 'page_id'))
        with open(backup_file, "w") as f:
            json.dump(versions, f, cls=DjangoJSONEncoder, indent=2)

        self.stdout.write(f"   ✅ Widgets backed up to {backup_file}")

    def _migrate_widget_images(self):
        """Main migration logic"""
        self.stdout.write("🔄 Migrating widget image references...")

        # Build queryset
        if self.version_id:
            queryset = PageVersion.objects.filter(id=self.version_id)
        else:
            queryset = PageVersion.objects.exclude(widgets__isnull=True)

        total_count = queryset.count()
        
        if total_count == 0:
            self.stdout.write(self.style.WARNING("No PageVersions found to process"))
            return {"versions": 0, "widgets": 0, "images": 0, "missing": 0, "errors": 0}

        stats = {
            "versions_processed": 0,
            "versions_updated": 0,
            "widgets_processed": 0,
            "images_migrated": 0,
            "missing_media": 0,
            "errors": 0,
        }

        # Process in batches
        for i in range(0, total_count, self.batch_size):
            batch = queryset[i : i + self.batch_size]
            
            # Collect all image IDs from this batch first (for bulk fetch)
            all_image_ids = set()
            batch_widgets_data = []
            
            for version in batch:
                if not isinstance(version.widgets, dict):
                    continue
                    
                image_ids = set()
                self._collect_image_ids(version.widgets, image_ids)
                all_image_ids.update(image_ids)
                batch_widgets_data.append((version, image_ids))

            # Bulk fetch all MediaFiles for this batch
            media_map = self._bulk_fetch_media_files(all_image_ids)
            
            if self.verbose and media_map:
                self.stdout.write(f"   📥 Loaded {len(media_map)} MediaFile objects")

            # Process each version in the batch
            for version, image_ids in batch_widgets_data:
                version_stats = self._process_version(version, media_map)
                stats["versions_processed"] += 1
                if version_stats["updated"]:
                    stats["versions_updated"] += 1
                stats["widgets_processed"] += version_stats["widgets"]
                stats["images_migrated"] += version_stats["images"]
                stats["missing_media"] += version_stats["missing"]
                stats["errors"] += version_stats["errors"]

            self.stdout.write(
                f"   📊 Processed {min(i + self.batch_size, total_count)}/{total_count} versions"
            )

        return stats

    def _collect_image_ids(self, data: Any, image_ids: Set[str]) -> None:
        """Recursively collect all image IDs from widget configurations"""
        if isinstance(data, dict):
            # Check if this is a widget config
            if 'config' in data and isinstance(data['config'], dict):
                self._collect_image_ids_from_config(data['config'], image_ids)
            
            # Recursively check all dict values
            for value in data.values():
                self._collect_image_ids(value, image_ids)
                
        elif isinstance(data, list):
            for item in data:
                self._collect_image_ids(item, image_ids)

    def _collect_image_ids_from_config(self, config: Dict, image_ids: Set[str]) -> None:
        """Collect image IDs from a widget config dict"""
        for key, value in config.items():
            if self._is_image_field(key):
                image_id = self._extract_image_id(value)
                if image_id:
                    image_ids.add(image_id)
            
            # Recursively process nested structures
            elif isinstance(value, dict):
                self._collect_image_ids(value, image_ids)
            elif isinstance(value, list):
                for item in value:
                    self._collect_image_ids(item, image_ids)

    def _is_image_field(self, field_name: str) -> bool:
        """Check if a field name indicates an image field"""
        # Check exact matches first
        if field_name in IMAGE_FIELD_NAMES:
            return True
        
        # Check patterns
        for pattern in IMAGE_FIELD_PATTERNS:
            if re.match(pattern, field_name):
                return True
        
        return False

    def _extract_image_id(self, value: Any) -> Optional[str]:
        """Extract image ID from various value formats"""
        if not value:
            return None
            
        # If it's a dict with an 'id' field
        if isinstance(value, dict):
            image_id = value.get('id')
            if image_id:
                return str(image_id)
        
        # If it's a string that looks like a UUID
        elif isinstance(value, str):
            # Try to validate as UUID
            try:
                UUID(value)
                return value
            except (ValueError, AttributeError):
                pass
        
        return None

    def _bulk_fetch_media_files(self, image_ids: Set[str]) -> Dict[str, Dict]:
        """Bulk fetch MediaFile objects and serialize them"""
        if not image_ids:
            return {}
        
        media_files = MediaFile.objects.filter(id__in=image_ids)
        media_map = {}
        
        for media_file in media_files:
            try:
                serializer = MediaFileListSerializer(media_file)
                media_map[str(media_file.id)] = serializer.data
            except Exception as e:
                logger.error(f"Error serializing MediaFile {media_file.id}: {e}")
        
        return media_map

    def _process_version(self, version: PageVersion, media_map: Dict[str, Dict]) -> Dict:
        """Process a single PageVersion"""
        stats = {
            "updated": False,
            "widgets": 0,
            "images": 0,
            "missing": 0,
            "errors": 0,
        }

        if not isinstance(version.widgets, dict):
            return stats

        original_widgets = version.widgets
        updated_widgets = self._process_widgets_structure(
            original_widgets, media_map, stats
        )

        # Check if anything changed
        if updated_widgets != original_widgets:
            stats["updated"] = True
            
            if not self.dry_run:
                version.widgets = updated_widgets
                version.save(update_fields=["widgets"])
            
            if self.verbose or self.dry_run:
                action = "would be updated" if self.dry_run else "updated"
                self.stdout.write(
                    f"   🔄 Version {version.id} (Page {version.page_id}): {action} "
                    f"({stats['images']} images migrated, {stats['missing']} missing)"
                )

        return stats

    def _process_widgets_structure(
        self, widgets_data: Dict, media_map: Dict[str, Dict], stats: Dict
    ) -> Dict:
        """Process the entire widgets structure (all slots)"""
        updated_widgets = {}
        
        for slot_name, widgets_list in widgets_data.items():
            if not isinstance(widgets_list, list):
                updated_widgets[slot_name] = widgets_list
                continue
            
            updated_list = []
            for widget in widgets_list:
                if not isinstance(widget, dict):
                    updated_list.append(widget)
                    continue
                
                stats["widgets"] += 1
                updated_widget = self._process_widget(widget, media_map, stats)
                updated_list.append(updated_widget)
            
            updated_widgets[slot_name] = updated_list
        
        return updated_widgets

    def _process_widget(
        self, widget: Dict, media_map: Dict[str, Dict], stats: Dict
    ) -> Dict:
        """Process a single widget, including its config and nested widgets"""
        updated_widget = widget.copy()
        
        # Process widget config
        if 'config' in widget and isinstance(widget['config'], dict):
            updated_config = self._process_config(widget['config'], media_map, stats)
            if updated_config != widget['config']:
                updated_widget['config'] = updated_config
        
        return updated_widget

    def _process_config(
        self, config: Dict, media_map: Dict[str, Dict], stats: Dict
    ) -> Dict:
        """Process widget config, replacing image IDs with full objects"""
        updated_config = {}
        
        for key, value in config.items():
            if self._is_image_field(key):
                # This is an image field - try to hydrate it
                updated_value = self._hydrate_image_field(value, media_map, stats)
                updated_config[key] = updated_value
            
            elif key == 'slots' and isinstance(value, dict):
                # Nested widgets (e.g., TabsWidget, AccordionWidget)
                updated_config[key] = self._process_widgets_structure(
                    value, media_map, stats
                )
            
            elif key == 'items' and isinstance(value, list):
                # Process items list (might contain nested widgets)
                updated_items = []
                for item in value:
                    if isinstance(item, dict):
                        updated_item = self._process_config(item, media_map, stats)
                        updated_items.append(updated_item)
                    else:
                        updated_items.append(item)
                updated_config[key] = updated_items
            
            elif isinstance(value, dict):
                # Recursively process nested dicts
                updated_config[key] = self._process_config(value, media_map, stats)
            
            elif isinstance(value, list):
                # Process lists (might contain dicts with image fields)
                updated_list = []
                for item in value:
                    if isinstance(item, dict):
                        updated_list.append(self._process_config(item, media_map, stats))
                    else:
                        updated_list.append(item)
                updated_config[key] = updated_list
            
            else:
                # No processing needed
                updated_config[key] = value
        
        return updated_config

    def _hydrate_image_field(
        self, value: Any, media_map: Dict[str, Dict], stats: Dict
    ) -> Any:
        """Hydrate an image field value with full MediaFile object"""
        if not value:
            return value
        
        # If it's already a complete object with imgproxyBaseUrl, keep it
        if isinstance(value, dict) and ('imgproxyBaseUrl' in value or 'imgproxy_base_url' in value):
            if self.verbose:
                self.stdout.write(f"      ✓ Image already complete: {value.get('id')}")
            return value
        
        # Extract image ID
        image_id = self._extract_image_id(value)
        
        if not image_id:
            if self.verbose:
                self.stdout.write(f"      ⚠ Could not extract image ID from: {value}")
            return value
        
        # Look up in media map
        if image_id in media_map:
            stats["images"] += 1
            if self.verbose:
                media_data = media_map[image_id]
                self.stdout.write(
                    f"      ✓ Hydrated image: {media_data.get('title', 'untitled')} ({image_id[:8]}...)"
                )
            return media_map[image_id]
        else:
            stats["missing"] += 1
            if self.verbose:
                self.stdout.write(
                    f"      ⚠ MediaFile not found: {image_id[:8]}..."
                )
            # Return None for missing images
            return None

    def _print_summary(self, stats: Dict):
        """Print migration summary"""
        self.stdout.write("\n" + "=" * 70)
        self.stdout.write(self.style.SUCCESS("📈 MIGRATION SUMMARY"))
        self.stdout.write("=" * 70)

        self.stdout.write(
            f"📋 Versions processed: {stats['versions_processed']}"
        )
        self.stdout.write(
            f"✏️  Versions updated: {stats['versions_updated']}"
        )
        self.stdout.write(
            f"🧩 Widgets processed: {stats['widgets_processed']}"
        )
        self.stdout.write(
            f"🖼️  Images migrated: {stats['images_migrated']}"
        )
        
        if stats['missing_media'] > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"⚠️  Missing MediaFiles: {stats['missing_media']}"
                )
            )
        
        if stats['errors'] > 0:
            self.stdout.write(
                self.style.ERROR(
                    f"❌ Errors encountered: {stats['errors']}"
                )
            )

        if self.dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"\n🔍 DRY RUN: {stats['versions_updated']} versions would be updated"
                )
            )
            self.stdout.write("Run without --dry-run to perform the actual migration")
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\n✅ Successfully migrated {stats['images_migrated']} images "
                    f"across {stats['versions_updated']} versions!"
                )
            )

        self.stdout.write("=" * 70)

