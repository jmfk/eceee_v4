from django.core.management.base import BaseCommand
from forms.models import FormFieldType

class Command(BaseCommand):
    help = "Seeds initial form field types"

    def handle(self, *args, **options):
        initial_types = [
            {
                "name": "text",
                "label": "Text",
                "base_type": "text",
                "description": "Single line text input",
                "config": {"validation": {"required": False, "max_length": 255}},
                "is_custom": False,
            },
            {
                "name": "textarea",
                "label": "Textarea",
                "base_type": "textarea",
                "description": "Multi-line text input",
                "config": {"validation": {"required": False}, "ui": {"rows": 4}},
                "is_custom": False,
            },
            {
                "name": "number",
                "label": "Number",
                "base_type": "number",
                "description": "Numeric input",
                "config": {"validation": {"required": False}},
                "is_custom": False,
            },
            {
                "name": "email",
                "label": "Email",
                "base_type": "email",
                "description": "Email address input",
                "config": {"validation": {"required": False}},
                "is_custom": False,
            },
            {
                "name": "select",
                "label": "Select",
                "base_type": "select",
                "description": "Single choice dropdown",
                "config": {"validation": {"required": False}, "options": []},
                "is_custom": False,
            },
            {
                "name": "multiselect",
                "label": "Multi-select",
                "base_type": "multiselect",
                "description": "Multiple choice dropdown",
                "config": {"validation": {"required": False}, "options": []},
                "is_custom": False,
            },
            {
                "name": "checkbox",
                "label": "Checkbox",
                "base_type": "checkbox",
                "description": "Single checkbox / Toggle",
                "config": {"validation": {"required": False}},
                "is_custom": False,
            },
            {
                "name": "radio",
                "label": "Radio",
                "base_type": "radio",
                "description": "Single choice radio buttons",
                "config": {"validation": {"required": False}, "options": []},
                "is_custom": False,
            },
            {
                "name": "date",
                "label": "Date",
                "base_type": "date",
                "description": "Date picker",
                "config": {"validation": {"required": False}},
                "is_custom": False,
            },
            {
                "name": "datetime",
                "label": "Date & Time",
                "base_type": "datetime",
                "description": "Date and time picker",
                "config": {"validation": {"required": False}},
                "is_custom": False,
            },
            {
                "name": "file",
                "label": "File Upload",
                "base_type": "file",
                "description": "File upload input",
                "config": {"validation": {"required": False, "max_size": 10485760}},
                "is_custom": False,
            },
            {
                "name": "hidden",
                "label": "Hidden Field",
                "base_type": "hidden",
                "description": "Hidden system field",
                "config": {"defaultValue": ""},
                "is_custom": False,
            },
        ]

        for t_data in initial_types:
            obj, created = FormFieldType.objects.update_or_create(
                name=t_data["name"],
                defaults=t_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created field type: {obj.label}"))
            else:
                self.stdout.write(self.style.SUCCESS(f"Updated field type: {obj.label}"))

