# Generated migration for moving title and description to page_data

from django.db import migrations


def migrate_title_description_to_page_data(apps, schema_editor):
    """Copy title and description from WebPage to PageVersion.page_data"""
    WebPage = apps.get_model("webpages", "WebPage")
    PageVersion = apps.get_model("webpages", "PageVersion")

    # Get all pages
    for page in WebPage.objects.all():
        # Update all versions of this page
        for version in page.versions.all():
            # Ensure page_data is a dict
            if not version.page_data:
                version.page_data = {}

            # Copy title and description from page to page_data if not already there
            if "title" not in version.page_data:
                version.page_data["title"] = page.title

            if "description" not in version.page_data:
                version.page_data["description"] = page.description or ""

            # Save the updated version
            version.save(update_fields=["page_data"])

    print(f"Migrated title and description to page_data for all PageVersions")


def reverse_migrate_title_description_from_page_data(apps, schema_editor):
    """Copy title and description from PageVersion.page_data back to WebPage"""
    WebPage = apps.get_model("webpages", "WebPage")
    PageVersion = apps.get_model("webpages", "PageVersion")

    # Get all pages
    for page in WebPage.objects.all():
        # Get the latest version to use as source for page title/description
        latest_version = page.versions.order_by("-version_number").first()

        if latest_version and latest_version.page_data:
            # Copy title and description from page_data back to page if they exist
            if "title" in latest_version.page_data:
                page.title = latest_version.page_data["title"]

            if "description" in latest_version.page_data:
                page.description = latest_version.page_data["description"] or ""

            # Save the updated page
            page.save(update_fields=["title", "description"])

    print(f"Restored title and description from page_data to WebPage for all pages")


class Migration(migrations.Migration):
    dependencies = [
        ("webpages", "0017_remove_legacy_publishing_fields"),
    ]

    operations = [
        migrations.RunPython(
            migrate_title_description_to_page_data,
            reverse_migrate_title_description_from_page_data,
        ),
    ]
