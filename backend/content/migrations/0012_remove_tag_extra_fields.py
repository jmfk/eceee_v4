# Generated manually to remove extra fields from Tag model using raw SQL

from django.db import migrations


def remove_tag_fields(apps, schema_editor):
    """Remove extra fields from tag table using raw SQL"""
    with schema_editor.connection.cursor() as cursor:
        # Check if columns exist before trying to drop them
        cursor.execute(
            """
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'content_tag' 
            AND column_name IN ('color', 'description', 'is_system', 'last_used_at', 'updated_at')
        """
        )
        existing_columns = [row[0] for row in cursor.fetchall()]

        # Drop columns that exist
        for column in existing_columns:
            cursor.execute(f"ALTER TABLE content_tag DROP COLUMN IF EXISTS {column}")


def add_tag_fields(apps, schema_editor):
    """Reverse migration - add the fields back"""
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            ALTER TABLE content_tag 
            ADD COLUMN color VARCHAR(7) DEFAULT '#3B82F6',
            ADD COLUMN description TEXT DEFAULT '',
            ADD COLUMN is_system BOOLEAN DEFAULT FALSE,
            ADD COLUMN last_used_at TIMESTAMP NULL,
            ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        """
        )


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0011_alter_tag_unique_together_alter_tag_name_and_more"),
    ]

    operations = [
        migrations.RunPython(remove_tag_fields, add_tag_fields),
    ]
