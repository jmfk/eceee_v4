"""
Migration to convert path_pattern from raw regex to registry-based pattern keys.

This migration:
1. Clears all existing path_pattern values (raw regex strings)
2. Updates field metadata to reflect new registry-based approach
3. Maintains same database column name for backward compatibility
"""

from django.db import migrations, models


def clear_path_patterns(apps, schema_editor):
    """Clear all existing path_pattern values since they're raw regex, not keys"""
    WebPage = apps.get_model("webpages", "WebPage")
    count = (
        WebPage.objects.filter(path_pattern__isnull=False)
        .exclude(path_pattern="")
        .count()
    )
    if count > 0:
        WebPage.objects.update(path_pattern="")
        print(
            f"Cleared {count} raw regex path_pattern values. Use registry-based patterns instead."
        )


class Migration(migrations.Migration):

    dependencies = [
        ("webpages", "0036_add_soft_delete_fields"),
    ]

    operations = [
        # Clear existing path_pattern data first (it's raw regex, not registry keys)
        migrations.RunPython(clear_path_patterns, migrations.RunPython.noop),
        # Rename field in Django (keeps same db_column, so no database change)
        migrations.RenameField(
            model_name="webpage",
            old_name="path_pattern",
            new_name="path_pattern_key",
        ),
        # Update field definition with new help text and constraints
        migrations.AlterField(
            model_name="webpage",
            name="path_pattern_key",
            field=models.CharField(
                blank=True,
                default="",
                help_text=(
                    "Select a predefined pattern for dynamic path matching. "
                    "Patterns are defined in code for security. "
                    "See path_pattern_registry for available patterns."
                ),
                max_length=100,
                db_column="path_pattern",  # Keep same DB column name
            ),
        ),
    ]
