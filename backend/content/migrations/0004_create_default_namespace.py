# Generated manually

from django.db import migrations


def create_default_namespace(apps, schema_editor):
    """Create a default namespace for existing content"""
    Namespace = apps.get_model("content", "Namespace")
    User = apps.get_model("auth", "User")

    # Get or create a user for the namespace
    try:
        user = User.objects.first()
    except:
        user = None

    # Create default namespace
    default_namespace, created = Namespace.objects.get_or_create(
        id=1,
        defaults={
            "name": "Default",
            "slug": "default",
            "description": "Default namespace for existing content",
            "is_active": True,
            "is_default": True,
            "created_by": user,
        },
    )

    if created:
        print(f"Created default namespace: {default_namespace.name}")
    else:
        print(f"Using existing namespace: {default_namespace.name}")


def reverse_default_namespace(apps, schema_editor):
    """Reverse migration - delete default namespace"""
    Namespace = apps.get_model("content", "Namespace")
    Namespace.objects.filter(id=1).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0003_create_namespace_model"),
    ]

    operations = [
        migrations.RunPython(create_default_namespace, reverse_default_namespace),
    ]
