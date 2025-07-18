# Generated manually on 2025-07-18

from django.db import migrations, models
import uuid


def migrate_widgets_to_pageversion(apps, schema_editor):
    """
    Move widget data from PageWidget model to PageVersion.widgets field
    """
    PageWidget = apps.get_model("webpages", "PageWidget")
    PageVersion = apps.get_model("webpages", "PageVersion")
    WebPage = apps.get_model("webpages", "WebPage")

    # Process each page
    for page in WebPage.objects.all():
        # Get all widgets for this page
        widgets = PageWidget.objects.filter(page=page).order_by(
            "slot_name", "sort_order"
        )

        if widgets.exists():
            # Serialize widget data
            widgets_data = []
            for widget in widgets:
                widget_data = {
                    "widget_type_id": widget.widget_type_id,
                    "slot_name": widget.slot_name,
                    "sort_order": widget.sort_order,
                    "configuration": widget.configuration,
                    "inherit_from_parent": widget.inherit_from_parent,
                    "override_parent": widget.override_parent,
                    "inheritance_behavior": getattr(
                        widget, "inheritance_behavior", "inherit"
                    ),
                    "inheritance_conditions": getattr(
                        widget, "inheritance_conditions", {}
                    ),
                    "priority": getattr(widget, "priority", 0),
                    "is_visible": getattr(widget, "is_visible", True),
                    "max_inheritance_depth": getattr(
                        widget, "max_inheritance_depth", None
                    ),
                }
                widgets_data.append(widget_data)

            # Find or create a PageVersion for this page
            current_version = PageVersion.objects.filter(
                page=page, is_current=True
            ).first()

            if current_version:
                # Update existing current version
                current_version.widgets = widgets_data
                current_version.save()
            else:
                # Create a new version with the widgets
                PageVersion.objects.create(
                    page=page,
                    version_number=1,
                    page_data={
                        "title": page.title,
                        "slug": page.slug,
                        "description": page.description or "",
                        "hostnames": getattr(page, "hostnames", []),
                        "layout_id": page.layout_id,
                        "theme_id": page.theme_id,
                        "publication_status": getattr(
                            page, "publication_status", "published"
                        ),
                        "effective_date": (
                            page.effective_date.isoformat()
                            if getattr(page, "effective_date", None)
                            else None
                        ),
                        "expiry_date": (
                            page.expiry_date.isoformat()
                            if getattr(page, "expiry_date", None)
                            else None
                        ),
                        "meta_title": getattr(page, "meta_title", ""),
                        "meta_description": getattr(page, "meta_description", ""),
                        "meta_keywords": getattr(page, "meta_keywords", ""),
                        "linked_object_type": getattr(page, "linked_object_type", ""),
                        "linked_object_id": getattr(page, "linked_object_id", None),
                        "parent_id": page.parent_id,
                        "sort_order": getattr(page, "sort_order", 0),
                    },
                    widgets=widgets_data,
                    status="published",
                    is_current=True,
                    description="Migrated from PageWidget model",
                    created_by_id=1,  # Assume first user for migration
                )


class Migration(migrations.Migration):

    dependencies = [
        ("webpages", "0006_pagelayout_template_name"),
    ]

    operations = [
        # First, add the widgets field to PageVersion
        migrations.AddField(
            model_name="pageversion",
            name="widgets",
            field=models.JSONField(
                default=list, help_text="Widget configuration data for this version"
            ),
        ),
        # Data migration: Move existing PageWidget data to PageVersion.widgets
        migrations.RunPython(
            code=migrate_widgets_to_pageversion,
            reverse_code=migrations.RunPython.noop,
        ),
        # Remove the PageWidget model
        migrations.DeleteModel(
            name="PageWidget",
        ),
    ]
