"""
Management command to clear theme CSS cache.

Usage:
    python manage.py clear_theme_cache [theme_id]
    python manage.py clear_theme_cache --all
"""

from django.core.management.base import BaseCommand
from django.core.cache import cache
from webpages.services import ThemeCSSGenerator
from webpages.models import PageTheme


class Command(BaseCommand):
    help = "Clear theme CSS cache"

    def add_arguments(self, parser):
        parser.add_argument(
            "theme_id",
            nargs="?",
            type=int,
            help="Specific theme ID to clear cache for",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            help="Clear cache for all themes",
        )

    def handle(self, *args, **options):
        theme_id = options.get("theme_id")
        clear_all = options.get("all")

        generator = ThemeCSSGenerator()

        if clear_all:
            self.stdout.write(self.style.WARNING("Clearing all theme CSS caches..."))
            
            # Clear all theme CSS cache entries
            cache.delete_pattern("theme_css_*")
            
            self.stdout.write(
                self.style.SUCCESS("✓ Successfully cleared all theme CSS caches")
            )
            
            # Show count of themes
            theme_count = PageTheme.objects.count()
            self.stdout.write(f"  • {theme_count} theme(s) affected")

        elif theme_id:
            try:
                theme = PageTheme.objects.get(id=theme_id)
                self.stdout.write(
                    self.style.WARNING(f"Clearing cache for theme: {theme.name} (ID: {theme_id})")
                )
                
                generator.invalidate_cache(theme_id)
                
                self.stdout.write(
                    self.style.SUCCESS(f"✓ Successfully cleared cache for theme '{theme.name}'")
                )
                
            except PageTheme.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f"✗ Theme with ID {theme_id} does not exist")
                )
                return

        else:
            # No arguments - show help
            self.stdout.write(
                self.style.WARNING("Please specify a theme ID or use --all flag")
            )
            self.stdout.write("\nExamples:")
            self.stdout.write("  python manage.py clear_theme_cache 1")
            self.stdout.write("  python manage.py clear_theme_cache --all")
            self.stdout.write("\nAvailable themes:")
            
            themes = PageTheme.objects.all()
            for theme in themes:
                default_marker = " (default)" if theme.is_default else ""
                self.stdout.write(f"  • ID {theme.id}: {theme.name}{default_marker}")

