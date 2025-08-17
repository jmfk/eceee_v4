"""
Management command to test system schema creation
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from webpages.models import PageDataSchema
from webpages.serializers import PageDataSchemaSerializer


class Command(BaseCommand):
    help = "Test system schema creation to verify the serializer fix"

    def handle(self, *args, **options):
        self.stdout.write("Testing system schema creation...")

        # Get or create admin user
        admin_user, created = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@example.com",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            admin_user.set_password("admin")
            admin_user.save()
            self.stdout.write(self.style.SUCCESS("Created admin user"))

        # Test system schema data (without layout_name field)
        schema_data = {
            "scope": "system",
            "schema": {
                "type": "object",
                "properties": {
                    "test_field": {
                        "type": "string",
                        "title": "Test Field",
                        "description": "A test field for system schema",
                    },
                    "another_field": {
                        "type": "boolean",
                        "title": "Another Field",
                        "description": "Another test field",
                    },
                },
            },
            "is_active": True,
        }

        # Delete any existing system schema first
        deleted_count, _ = PageDataSchema.objects.filter(scope="system").delete()
        if deleted_count > 0:
            self.stdout.write(f"Deleted {deleted_count} existing system schema(s)")

        # Test serializer validation
        self.stdout.write("Testing serializer validation...")
        self.stdout.write(f"Input data: {schema_data}")
        serializer = PageDataSchemaSerializer(data=schema_data)

        # Debug serializer fields
        self.stdout.write("Serializer fields:")
        for field_name, field in serializer.fields.items():
            required = getattr(field, "required", "N/A")
            allow_blank = getattr(field, "allow_blank", "N/A")
            self.stdout.write(
                f"  - {field_name}: required={required}, allow_blank={allow_blank}"
            )

        # Test is_valid with debugging
        self.stdout.write("Calling serializer.is_valid()...")
        try:
            is_valid = serializer.is_valid()
            self.stdout.write(f"is_valid returned: {is_valid}")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Exception during is_valid(): {e}"))
            import traceback

            traceback.print_exc()
            return

        if is_valid:
            self.stdout.write(self.style.SUCCESS("✅ Serializer validation passed!"))
            self.stdout.write(f"Validated data: {serializer.validated_data}")

            # Test saving
            try:
                # Delete any existing system schema first
                PageDataSchema.objects.filter(scope="system").delete()

                schema = serializer.save(created_by=admin_user)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"✅ System schema created successfully! ID: {schema.id}"
                    )
                )
                self.stdout.write(f"Schema details:")
                self.stdout.write(f"  - Scope: {schema.scope}")
                self.stdout.write(
                    f"  - Layout name: '{schema.layout_name}' (should be empty)"
                )
                self.stdout.write(f"  - Name: '{schema.name}' (should be empty)")
                self.stdout.write(f"  - Active: {schema.is_active}")
                self.stdout.write(
                    f"  - Schema properties: {list(schema.schema.get('properties', {}).keys())}"
                )

                return

            except Exception as e:
                self.stdout.write(self.style.ERROR(f"❌ Failed to save schema: {e}"))
                import traceback

                traceback.print_exc()
                return

        else:
            self.stdout.write(self.style.ERROR("❌ Serializer validation failed!"))
            self.stdout.write(f"All errors: {serializer.errors}")
            for field, errors in serializer.errors.items():
                self.stdout.write(f"  - {field}: {errors}")

            # Debug: check what data made it to validate() method
            if hasattr(serializer, "_validated_data"):
                self.stdout.write(
                    f"Partial validated data: {serializer._validated_data}"
                )

            return
