"""
Management command to add shortTitle field to the system page data schema
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from webpages.models import PageDataSchema


class Command(BaseCommand):
    help = "Add shortTitle field to the system page data schema"

    def handle(self, *args, **options):
        self.stdout.write("Adding shortTitle to system schema...")

        # Get or create admin user
        admin_user = User.objects.filter(is_superuser=True).first()
        if not admin_user:
            self.stdout.write(
                self.style.ERROR("No superuser found. Please create one first.")
            )
            return

        # Get or create system schema
        system_schema, created = PageDataSchema.objects.get_or_create(
            scope="system",
            defaults={
                "schema": {"type": "object", "properties": {}},
                "is_active": True,
                "created_by": admin_user,
            },
        )

        if created:
            self.stdout.write(self.style.SUCCESS("Created new system schema"))
        else:
            self.stdout.write("Found existing system schema")

        # Get current schema
        schema = system_schema.schema
        properties = schema.get("properties", {})

        # Add shortTitle field if it doesn't exist
        if "shortTitle" not in properties:
            properties["shortTitle"] = {
                "type": "string",
                "title": "Short Title",
                "description": "Shorter version of the title for navigation menus",
                "maxLength": 100,
            }

            schema["properties"] = properties
            system_schema.schema = schema
            system_schema.save()

            self.stdout.write(
                self.style.SUCCESS("✅ Added shortTitle field to system schema")
            )
        else:
            self.stdout.write(
                self.style.WARNING("shortTitle field already exists in schema")
            )

        # Display current schema properties
        self.stdout.write("\nCurrent schema properties:")
        for prop_name in properties.keys():
            prop = properties[prop_name]
            self.stdout.write(f"  - {prop_name}: {prop.get('title', 'No title')}")

        self.stdout.write(self.style.SUCCESS("\n✅ Done!"))
