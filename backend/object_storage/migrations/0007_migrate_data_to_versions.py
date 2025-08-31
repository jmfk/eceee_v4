"""
Data migration to move existing data and widgets from ObjectInstance to ObjectVersion.
This ensures no data is lost when we remove the data/widgets fields from ObjectInstance.
"""

from django.db import migrations


def migrate_data_to_versions(apps, schema_editor):
    """Move data and widgets from ObjectInstance to their current ObjectVersion"""
    ObjectInstance = apps.get_model("object_storage", "ObjectInstance")
    ObjectVersion = apps.get_model("object_storage", "ObjectVersion")

    # Get all object instances that have data or widgets but no current_version
    instances_to_migrate = ObjectInstance.objects.filter(current_version__isnull=True)

    for instance in instances_to_migrate:
        # Find the latest version for this instance
        latest_version = (
            ObjectVersion.objects.filter(object=instance)
            .order_by("-version_number")
            .first()
        )

        if latest_version:
            # Update the existing latest version with current data/widgets
            if hasattr(instance, "data") and instance.data:
                latest_version.data = instance.data
            if hasattr(instance, "widgets") and instance.widgets:
                latest_version.widgets = instance.widgets
            latest_version.save()

            # Set this version as current
            instance.current_version = latest_version
            instance.save()
        else:
            # No versions exist, create one if there's data or widgets
            if (hasattr(instance, "data") and instance.data) or (
                hasattr(instance, "widgets") and instance.widgets
            ):
                # Create a new version with the current data
                new_version = ObjectVersion.objects.create(
                    object=instance,
                    version_number=1,
                    data=getattr(instance, "data", {}) or {},
                    widgets=getattr(instance, "widgets", {}) or {},
                    created_by=instance.created_by,
                    change_description="Migrated from ObjectInstance",
                )

                # Set this as current version
                instance.current_version = new_version
                instance.version = 1
                instance.save()


def reverse_migrate_data_from_versions(apps, schema_editor):
    """Reverse migration - move data back from ObjectVersion to ObjectInstance"""
    ObjectInstance = apps.get_model("object_storage", "ObjectInstance")

    for instance in ObjectInstance.objects.filter(current_version__isnull=False):
        if instance.current_version:
            # Copy data back to instance fields (these fields should exist in reverse migration)
            instance.data = instance.current_version.data
            instance.widgets = instance.current_version.widgets
            instance.save()


class Migration(migrations.Migration):
    dependencies = [
        ("object_storage", "0006_move_data_widgets_to_versions"),
    ]

    operations = [
        migrations.RunPython(
            migrate_data_to_versions, reverse_migrate_data_from_versions
        ),
    ]
