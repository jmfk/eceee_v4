from django.core.management.base import BaseCommand, CommandError

from webpages.models import PageDataSchema, PageTheme, PageVersion


class Command(BaseCommand):
    help = "Read-only audit of layout keys referenced by themes, page versions, and page-data schemas"

    def handle(self, *args, **options):
        theme_keys = set()
        for layouts in PageTheme.objects.values_list("layouts", flat=True):
            theme_keys.update(
                item.get("key")
                for item in (layouts or {}).get("items", [])
                if isinstance(item, dict) and item.get("key")
            )
        page_keys = {
            layout_key or code_layout
            for layout_key, code_layout in PageVersion.objects.values_list("layout_key", "code_layout")
            if layout_key or code_layout
        }
        schema_keys = {
            layout_key or layout_name
            for layout_key, layout_name in PageDataSchema.objects.filter(scope="layout").values_list(
                "layout_key", "layout_name"
            )
            if layout_key or layout_name
        }
        referenced = page_keys | schema_keys
        self.stdout.write(f"Theme layout keys: {', '.join(sorted(theme_keys)) or '(none)'}")
        self.stdout.write(f"Referenced layout keys: {', '.join(sorted(referenced)) or '(none)'}")
        unknown = referenced - theme_keys
        if unknown:
            raise CommandError(f"Referenced keys have no database layout definition: {', '.join(sorted(unknown))}")
        self.stdout.write(self.style.SUCCESS("Every referenced layout key has a database definition."))
