"""
Management command to create sample value lists for testing and demonstration.
"""

from django.core.management.base import BaseCommand
from utils.models import ValueList, ValueListItem


class Command(BaseCommand):
    help = "Create sample value lists for testing and demonstration"

    def handle(self, *args, **options):
        self.stdout.write("Creating sample value lists...")

        # Countries value list
        countries_list, created = ValueList.objects.get_or_create(
            name="Countries",
            defaults={
                "description": "List of countries for address forms",
                "value_type": "string",
                "is_active": True,
            },
        )

        if created or countries_list.items.count() == 0:
            country_items = [
                {"label": "United States", "value": "US", "order": 1},
                {"label": "Canada", "value": "CA", "order": 2},
                {"label": "United Kingdom", "value": "GB", "order": 3},
                {"label": "Germany", "value": "DE", "order": 4},
                {"label": "France", "value": "FR", "order": 5},
                {"label": "Japan", "value": "JP", "order": 6},
                {"label": "Australia", "value": "AU", "order": 7},
                {"label": "Brazil", "value": "BR", "order": 8},
                {"label": "India", "value": "IN", "order": 9},
                {"label": "China", "value": "CN", "order": 10},
            ]

            for item_data in country_items:
                ValueListItem.objects.get_or_create(
                    value_list=countries_list,
                    label=item_data["label"],
                    defaults={"value": item_data["value"], "order": item_data["order"]},
                )

            self.stdout.write(
                f"  ✓ Created countries list with {len(country_items)} items"
            )

        # Priorities value list
        priorities_list, created = ValueList.objects.get_or_create(
            name="Priority Levels",
            defaults={
                "description": "Task and project priority levels",
                "value_type": "integer",
                "is_active": True,
            },
        )

        if created or priorities_list.items.count() == 0:
            priority_items = [
                {"label": "Low", "value": "1", "order": 1},
                {"label": "Medium", "value": "2", "order": 2},
                {"label": "High", "value": "3", "order": 3},
                {"label": "Critical", "value": "4", "order": 4},
                {"label": "Emergency", "value": "5", "order": 5},
            ]

            for item_data in priority_items:
                ValueListItem.objects.get_or_create(
                    value_list=priorities_list,
                    label=item_data["label"],
                    defaults={"value": item_data["value"], "order": item_data["order"]},
                )

            self.stdout.write(
                f"  ✓ Created priorities list with {len(priority_items)} items"
            )

        # Status options value list
        status_list, created = ValueList.objects.get_or_create(
            name="Status Options",
            defaults={
                "description": "Common status values for various entities",
                "value_type": "string",
                "is_active": True,
            },
        )

        if created or status_list.items.count() == 0:
            status_items = [
                {"label": "Draft", "value": "draft", "order": 1},
                {"label": "In Review", "value": "review", "order": 2},
                {"label": "Approved", "value": "approved", "order": 3},
                {"label": "Published", "value": "published", "order": 4},
                {"label": "Archived", "value": "archived", "order": 5},
            ]

            for item_data in status_items:
                ValueListItem.objects.get_or_create(
                    value_list=status_list,
                    label=item_data["label"],
                    defaults={"value": item_data["value"], "order": item_data["order"]},
                )

            self.stdout.write(
                f"  ✓ Created statuses list with {len(status_items)} items"
            )

        # Departments value list
        departments_list, created = ValueList.objects.get_or_create(
            name="Departments",
            defaults={
                "description": "Organizational departments",
                "value_type": "string",
                "is_active": True,
            },
        )

        if created or departments_list.items.count() == 0:
            department_items = [
                {"label": "Engineering", "order": 1},
                {"label": "Design", "order": 2},
                {"label": "Product Management", "order": 3},
                {"label": "Marketing", "order": 4},
                {"label": "Sales", "order": 5},
                {"label": "Customer Support", "order": 6},
                {"label": "Human Resources", "order": 7},
                {"label": "Finance", "order": 8},
            ]

            for item_data in department_items:
                ValueListItem.objects.get_or_create(
                    value_list=departments_list,
                    label=item_data["label"],
                    defaults={"order": item_data["order"]},
                )

            self.stdout.write(
                f"  ✓ Created departments list with {len(department_items)} items"
            )

        # Summary
        total_lists = ValueList.objects.count()
        total_items = ValueListItem.objects.count()

        self.stdout.write(
            self.style.SUCCESS(
                f"\n✅ Sample value lists created successfully!\n"
                f"   Total lists: {total_lists}\n"
                f"   Total items: {total_items}\n"
                f"   You can now use these in your form fields by referencing their names."
            )
        )
