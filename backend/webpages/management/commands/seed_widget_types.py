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
            # Phase 6: Extended Widget Types
            {
                "name": "News",
                "description": "News article widget with title, summary, content, and metadata",
                "template_name": "webpages/widgets/news.html",
                "json_schema": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string",
                            "title": "Article Title",
                            "description": "Main headline for the news article",
                        },
                        "summary": {
                            "type": "string",
                            "title": "Summary",
                            "description": "Brief summary or lead paragraph",
                            "format": "textarea",
                        },
                        "content": {
                            "type": "string",
                            "title": "Article Content",
                            "description": "Full article content",
                            "format": "html",
                        },
                        "author": {
                            "type": "string",
                            "title": "Author",
                            "description": "Article author name",
                        },
                        "publication_date": {
                            "type": "string",
                            "title": "Publication Date",
                            "description": "When the article was published",
                            "format": "date",
                        },
                        "featured_image": {
                            "type": "string",
                            "title": "Featured Image",
                            "description": "URL to featured image",
                            "format": "uri",
                        },
                        "category": {
                            "type": "string",
                            "title": "Category",
                            "description": "News category",
                            "enum": [
                                "general",
                                "business",
                                "technology",
                                "sports",
                                "health",
                                "politics",
                            ],
                            "default": "general",
                        },
                        "show_meta": {
                            "type": "boolean",
                            "title": "Show Metadata",
                            "description": "Display author and publication date",
                            "default": True,
                        },
                    },
                    "required": ["title", "content"],
                },
            },
            {
                "name": "Events",
                "description": "Event display widget with date, location, and registration details",
                "template_name": "webpages/widgets/events.html",
                "json_schema": {
                    "type": "object",
                    "properties": {
                        "event_title": {
                            "type": "string",
                            "title": "Event Title",
                            "description": "Name of the event",
                        },
                        "description": {
                            "type": "string",
                            "title": "Description",
                            "description": "Event description",
                            "format": "textarea",
                        },
                        "start_date": {
                            "type": "string",
                            "title": "Start Date",
                            "description": "Event start date and time",
                            "format": "datetime-local",
                        },
                        "end_date": {
                            "type": "string",
                            "title": "End Date",
                            "description": "Event end date and time",
                            "format": "datetime-local",
                        },
                        "location": {
                            "type": "string",
                            "title": "Location",
                            "description": "Event venue or address",
                        },
                        "registration_url": {
                            "type": "string",
                            "title": "Registration URL",
                            "description": "Link for event registration",
                            "format": "uri",
                        },
                        "price": {
                            "type": "string",
                            "title": "Price",
                            "description": "Event cost (e.g., 'Free', '$25', '$10-50')",
                        },
                        "capacity": {
                            "type": "integer",
                            "title": "Capacity",
                            "description": "Maximum number of attendees",
                            "minimum": 1,
                        },
                        "event_type": {
                            "type": "string",
                            "title": "Event Type",
                            "enum": [
                                "conference",
                                "workshop",
                                "seminar",
                                "meeting",
                                "social",
                                "other",
                            ],
                            "default": "other",
                        },
                    },
                    "required": ["event_title", "start_date"],
                },
            },
            {
                "name": "Calendar",
                "description": "Calendar widget displaying events for a specific month or period",
                "template_name": "webpages/widgets/calendar.html",
                "json_schema": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string",
                            "title": "Calendar Title",
                            "description": "Optional title for the calendar",
                        },
                        "view_type": {
                            "type": "string",
                            "title": "View Type",
                            "enum": ["month", "week", "agenda"],
                            "default": "month",
                        },
                        "default_date": {
                            "type": "string",
                            "title": "Default Date",
                            "description": "Initial date to display (YYYY-MM-DD)",
                            "format": "date",
                        },
                        "event_source": {
                            "type": "string",
                            "title": "Event Source",
                            "enum": ["manual", "api", "external"],
                            "default": "manual",
                        },
                        "events": {
                            "type": "array",
                            "title": "Events",
                            "description": "Manual events for the calendar",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "title": {"type": "string"},
                                    "date": {"type": "string", "format": "date"},
                                    "time": {"type": "string"},
                                    "description": {"type": "string"},
                                },
                                "required": ["title", "date"],
                            },
                        },
                        "show_navigation": {
                            "type": "boolean",
                            "title": "Show Navigation",
                            "description": "Show month/week navigation controls",
                            "default": True,
                        },
                        "highlight_today": {
                            "type": "boolean",
                            "title": "Highlight Today",
                            "description": "Highlight current date",
                            "default": True,
                        },
                    },
                    "required": [],
                },
            },
            {
                "name": "Forms",
                "description": "Contact or general purpose form widget with custom fields",
                "template_name": "webpages/widgets/forms.html",
                "json_schema": {
                    "type": "object",
                    "properties": {
                        "form_title": {
                            "type": "string",
                            "title": "Form Title",
                            "description": "Title displayed above the form",
                        },
                        "form_description": {
                            "type": "string",
                            "title": "Form Description",
                            "description": "Optional description text",
                            "format": "textarea",
                        },
                        "submit_url": {
                            "type": "string",
                            "title": "Submit URL",
                            "description": "Where to submit the form data",
                            "format": "uri",
                        },
                        "success_message": {
                            "type": "string",
                            "title": "Success Message",
                            "description": "Message shown after successful submission",
                            "default": "Thank you for your submission!",
                        },
                        "fields": {
                            "type": "array",
                            "title": "Form Fields",
                            "description": "List of form fields to display",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string", "title": "Field Name"},
                                    "label": {"type": "string", "title": "Field Label"},
                                    "type": {
                                        "type": "string",
                                        "title": "Field Type",
                                        "enum": [
                                            "text",
                                            "email",
                                            "phone",
                                            "textarea",
                                            "select",
                                            "checkbox",
                                            "radio",
                                        ],
                                    },
                                    "required": {
                                        "type": "boolean",
                                        "title": "Required",
                                        "default": False,
                                    },
                                    "placeholder": {
                                        "type": "string",
                                        "title": "Placeholder",
                                    },
                                    "options": {
                                        "type": "array",
                                        "title": "Options (for select/radio)",
                                        "items": {"type": "string"},
                                    },
                                },
                                "required": ["name", "label", "type"],
                            },
                        },
                        "submit_button_text": {
                            "type": "string",
                            "title": "Submit Button Text",
                            "default": "Submit",
                        },
                    },
                    "required": ["form_title", "fields"],
                },
            },
            {
                "name": "Gallery",
                "description": "Image gallery widget with multiple display options",
                "template_name": "webpages/widgets/gallery.html",
                "json_schema": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string",
                            "title": "Gallery Title",
                            "description": "Optional title for the gallery",
                        },
                        "layout": {
                            "type": "string",
                            "title": "Gallery Layout",
                            "enum": ["grid", "masonry", "carousel", "lightbox"],
                            "default": "grid",
                        },
                        "columns": {
                            "type": "integer",
                            "title": "Number of Columns",
                            "description": "For grid layout",
                            "minimum": 1,
                            "maximum": 6,
                            "default": 3,
                        },
                        "images": {
                            "type": "array",
                            "title": "Images",
                            "description": "List of images in the gallery",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "url": {
                                        "type": "string",
                                        "format": "uri",
                                        "title": "Image URL",
                                    },
                                    "thumbnail": {
                                        "type": "string",
                                        "format": "uri",
                                        "title": "Thumbnail URL",
                                    },
                                    "alt_text": {"type": "string", "title": "Alt Text"},
                                    "caption": {"type": "string", "title": "Caption"},
                                    "description": {
                                        "type": "string",
                                        "title": "Description",
                                    },
                                },
                                "required": ["url", "alt_text"],
                            },
                        },
                        "show_captions": {
                            "type": "boolean",
                            "title": "Show Captions",
                            "description": "Display image captions",
                            "default": True,
                        },
                        "enable_lightbox": {
                            "type": "boolean",
                            "title": "Enable Lightbox",
                            "description": "Allow full-size viewing",
                            "default": True,
                        },
                        "auto_play": {
                            "type": "boolean",
                            "title": "Auto Play (Carousel)",
                            "description": "Auto-advance carousel slides",
                            "default": False,
                        },
                    },
                    "required": ["images"],
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
