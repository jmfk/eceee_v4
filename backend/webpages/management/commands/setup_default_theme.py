"""
Management command to ensure a default theme exists for object content editors.

This command can be run during deployment or setup to ensure there's always
a default theme available for the system.
"""

from django.core.management.base import BaseCommand
from webpages.models import PageTheme


class Command(BaseCommand):
    help = "Ensure a default theme exists for object content editors"

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Force creation of default theme even if one exists",
        )
        
        parser.add_argument(
            "--theme-name",
            type=str,
            help="Name of existing theme to set as default",
        )

    def handle(self, *args, **options):
        force = options["force"]
        theme_name = options.get("theme_name")

        # Check if default theme already exists
        current_default = PageTheme.get_default_theme()
        
        if current_default and not force:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Default theme already exists: '{current_default.name}'"
                )
            )
            return

        if theme_name:
            # Set specific theme as default
            try:
                theme = PageTheme.objects.get(name=theme_name, is_active=True)
                
                # Clear existing default
                PageTheme.objects.filter(is_default=True).update(is_default=False)
                
                # Set new default
                theme.is_default = True
                theme.save()
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Set '{theme.name}' as the default theme"
                    )
                )
                
            except PageTheme.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(
                        f"Theme '{theme_name}' not found or inactive"
                    )
                )
                return
        else:
            # Use the automatic default theme creation
            if current_default and force:
                self.stdout.write(
                    self.style.WARNING(
                        f"Replacing existing default theme: '{current_default.name}'"
                    )
                )
                # Clear existing default
                PageTheme.objects.filter(is_default=True).update(is_default=False)
            
            # This will trigger the automatic creation
            default_theme = PageTheme.get_default_theme()
            
            if default_theme:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Default theme ensured: '{default_theme.name}'"
                    )
                )
            else:
                self.stdout.write(
                    self.style.ERROR(
                        "Failed to create default theme"
                    )
                )

        # Show current status
        self.stdout.write("\nCurrent theme status:")
        themes = PageTheme.objects.filter(is_active=True).order_by('name')
        
        for theme in themes:
            status_parts = []
            if theme.is_default:
                status_parts.append(self.style.WARNING("DEFAULT"))
            if theme.is_active:
                status_parts.append("Active")
            
            status = " | ".join(status_parts)
            self.stdout.write(f"  {theme.name}: {status}")
