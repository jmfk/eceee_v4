# Generated manually

from django.db import migrations


def update_existing_records_to_default_namespace(apps, schema_editor):
    """Update all existing records to use the default namespace"""
    Namespace = apps.get_model("content", "Namespace")
    Category = apps.get_model("content", "Category")
    Tag = apps.get_model("content", "Tag")
    News = apps.get_model("content", "News")
    Event = apps.get_model("content", "Event")
    LibraryItem = apps.get_model("content", "LibraryItem")
    Member = apps.get_model("content", "Member")

    # Get the default namespace
    default_namespace = Namespace.objects.get(id=1)

    # Update all existing records to use the default namespace
    Category.objects.filter(namespace__isnull=True).update(namespace=default_namespace)
    Tag.objects.filter(namespace__isnull=True).update(namespace=default_namespace)
    News.objects.filter(namespace__isnull=True).update(namespace=default_namespace)
    Event.objects.filter(namespace__isnull=True).update(namespace=default_namespace)
    LibraryItem.objects.filter(namespace__isnull=True).update(
        namespace=default_namespace
    )
    Member.objects.filter(namespace__isnull=True).update(namespace=default_namespace)

    print("Updated all existing records to use default namespace")


def reverse_update_namespace(apps, schema_editor):
    """Reverse migration - this would be complex to implement properly"""
    # This is a data migration, so we'll leave the reverse empty
    # In practice, you'd need to handle the reverse case carefully
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0005_add_namespace_fields_nullable"),
    ]

    operations = [
        migrations.RunPython(
            update_existing_records_to_default_namespace, reverse_update_namespace
        ),
    ]
