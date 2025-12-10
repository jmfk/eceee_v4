"""
Fix HeaderWidget image fields that are arrays instead of objects.

This command:
1. Scans all PageVersion.widgets JSONFields
2. Identifies HeaderWidget instances
3. Fixes image fields (image, mobile_image, tablet_image) that are arrays
4. Converts arrays to single objects (extracts first item)
5. Saves modified PageVersion records

Usage:
    python manage.py fix_header_widget_image_arrays
    python manage.py fix_header_widget_image_arrays --dry-run
"""

import logging
from django.core.management.base import BaseCommand
from webpages.models import PageVersion

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Fix HeaderWidget image fields stored as arrays"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be fixed without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be saved'))
        
        fixed_count = 0
        widget_count = 0
        field_count = 0
        versions = PageVersion.objects.all()
        
        self.stdout.write(f'Scanning {versions.count()} PageVersion records...')
        
        for version in versions:
            if not version.widgets:
                continue
                
            modified = False
            
            for slot_name, widgets in version.widgets.items():
                if not isinstance(widgets, list):
                    continue
                
                for widget in widgets:
                    if not isinstance(widget, dict):
                        continue
                    
                    if widget.get('type') != 'easy_widgets.HeaderWidget':
                        continue
                    
                    widget_count += 1
                    config = widget.get('config', {})
                    
                    # Fix each image field if it's an array
                    for field in ['image', 'mobile_image', 'tablet_image', 'mobileImage', 'tabletImage']:
                        if field in config:
                            value = config[field]
                            if isinstance(value, list) and len(value) > 0:
                                config[field] = value[0]
                                modified = True
                                field_count += 1
                                self.stdout.write(
                                    self.style.SUCCESS(
                                        f'  Fixed {field} in widget {widget.get("id")} '
                                        f'(PageVersion {version.id}, slot: {slot_name})'
                                    )
                                )
                            elif isinstance(value, list) and len(value) == 0:
                                config[field] = None
                                modified = True
                                field_count += 1
                                self.stdout.write(
                                    self.style.WARNING(
                                        f'  Cleared empty array for {field} in widget {widget.get("id")} '
                                        f'(PageVersion {version.id}, slot: {slot_name})'
                                    )
                                )
            
            if modified:
                if not dry_run:
                    version.save()
                fixed_count += 1
        
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS(f'Summary:'))
        self.stdout.write(self.style.SUCCESS(f'  HeaderWidgets found: {widget_count}'))
        self.stdout.write(self.style.SUCCESS(f'  Image fields fixed: {field_count}'))
        self.stdout.write(self.style.SUCCESS(f'  PageVersions modified: {fixed_count}'))
        if dry_run:
            self.stdout.write(self.style.WARNING('  No changes saved (dry run mode)'))
        else:
            self.stdout.write(self.style.SUCCESS(f'  Changes saved to database'))
        self.stdout.write(self.style.SUCCESS('=' * 60))

