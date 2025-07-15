"""
Django management command to seed basic widget types for the widget system foundation.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from webpages.models import WidgetType


class Command(BaseCommand):
    help = "Seed basic widget types for the widget system foundation"

    def handle(self, *args, **options):
        # Get or create a superuser for widget type creation
        admin_user = User.objects.filter(is_superuser=True).first()
        if not admin_user:
            self.stdout.write(
                self.style.WARNING("No superuser found. Creating default admin user.")
            )
            admin_user = User.objects.create_superuser(
                username="admin",
                email="admin@example.com",
                password="admin123",
                first_name="Admin",
                last_name="User",
            )

        # Define basic widget types with JSON schemas
        widget_types = [
            {
                "name": "Text Block",
                "description": "Rich text content block with title and formatting options",
                "template_name": "webpages/widgets/text_block.html",
                "json_schema": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string",
                            "title": "Title",
                            "description": "Optional title for the text block",
                        },
                        "content": {
                            "type": "string",
                            "title": "Content",
                            "description": "Main text content",
                            "format": "textarea",
                        },
                        "alignment": {
                            "type": "string",
                            "title": "Text Alignment",
                            "enum": ["left", "center", "right", "justify"],
                            "default": "left",
                        },
                        "style": {
                            "type": "string",
                            "title": "Text Style",
                            "enum": ["normal", "bold", "italic"],
                            "default": "normal",
                        },
                    },
                    "required": ["content"],
                },
            },
            {
                "name": "Image",
                "description": "Image display with caption and sizing options",
                "template_name": "webpages/widgets/image.html",
                "json_schema": {
                    "type": "object",
                    "properties": {
                        "image_url": {
                            "type": "string",
                            "title": "Image URL",
                            "description": "URL or path to the image",
                            "format": "uri",
                        },
                        "alt_text": {
                            "type": "string",
                            "title": "Alt Text",
                            "description": "Alternative text for accessibility",
                        },
                        "caption": {
                            "type": "string",
                            "title": "Caption",
                            "description": "Optional caption below the image",
                        },
                        "size": {
                            "type": "string",
                            "title": "Image Size",
                            "enum": ["small", "medium", "large", "full"],
                            "default": "medium",
                        },
                        "alignment": {
                            "type": "string",
                            "title": "Alignment",
                            "enum": ["left", "center", "right"],
                            "default": "center",
                        },
                    },
                    "required": ["image_url", "alt_text"],
                },
            },
            {
                "name": "Button",
                "description": "Call-to-action button with customizable text and link",
                "template_name": "webpages/widgets/button.html",
                "json_schema": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string",
                            "title": "Button Text",
                            "description": "Text displayed on the button",
                        },
                        "url": {
                            "type": "string",
                            "title": "URL",
                            "description": "Link destination",
                            "format": "uri",
                        },
                        "style": {
                            "type": "string",
                            "title": "Button Style",
                            "enum": ["primary", "secondary", "outline"],
                            "default": "primary",
                        },
                        "size": {
                            "type": "string",
                            "title": "Button Size",
                            "enum": ["small", "medium", "large"],
                            "default": "medium",
                        },
                        "open_in_new_tab": {
                            "type": "boolean",
                            "title": "Open in New Tab",
                            "default": False,
                        },
                    },
                    "required": ["text", "url"],
                },
            },
            {
                "name": "Spacer",
                "description": "Vertical spacing element for layout control",
                "template_name": "webpages/widgets/spacer.html",
                "json_schema": {
                    "type": "object",
                    "properties": {
                        "height": {
                            "type": "string",
                            "title": "Height",
                            "enum": ["small", "medium", "large", "custom"],
                            "default": "medium",
                        },
                        "custom_height": {
                            "type": "string",
                            "title": "Custom Height (px)",
                            "description": "Custom height in pixels (only used if height is 'custom')",
                            "pattern": "^[0-9]+px$",
                        },
                    },
                    "required": ["height"],
                },
            },
            {
                "name": "HTML Block",
                "description": "Custom HTML content block for advanced users",
                "template_name": "webpages/widgets/html_block.html",
                "json_schema": {
                    "type": "object",
                    "properties": {
                        "html_content": {
                            "type": "string",
                            "title": "HTML Content",
                            "description": "Raw HTML content",
                            "format": "textarea",
                        },
                        "allow_scripts": {
                            "type": "boolean",
                            "title": "Allow Scripts",
                            "description": "WARNING: Only enable for trusted content",
                            "default": False,
                        },
                    },
                    "required": ["html_content"],
                },
            },
        ]

        created_count = 0
        updated_count = 0

        for widget_data in widget_types:
            widget_type, created = WidgetType.objects.get_or_create(
                name=widget_data["name"],
                defaults={
                    "description": widget_data["description"],
                    "json_schema": widget_data["json_schema"],
                    "template_name": widget_data["template_name"],
                    "is_active": True,
                    "created_by": admin_user,
                },
            )

            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f"Created widget type: {widget_type.name}")
                )
            else:
                # Update existing widget type with new schema
                widget_type.description = widget_data["description"]
                widget_type.json_schema = widget_data["json_schema"]
                widget_type.template_name = widget_data["template_name"]
                widget_type.save()
                updated_count += 1
                self.stdout.write(
                    self.style.WARNING(f"Updated widget type: {widget_type.name}")
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Widget types seeding completed. Created: {created_count}, Updated: {updated_count}"
            )
        )
