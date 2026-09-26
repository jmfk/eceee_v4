import importlib
from contextlib import nullcontext
from types import SimpleNamespace

from django.test import SimpleTestCase

migration = importlib.import_module("object_storage.migrations.0023_ensure_objectversion_updated_at")


class EnsureObjectVersionUpdatedAtMigrationTests(SimpleTestCase):
    def run_migration(self, columns):
        model = SimpleNamespace(_meta=SimpleNamespace(db_table="object_storage_objectversion"))
        apps = SimpleNamespace(get_model=lambda *args: model)
        added_fields = []
        introspection = SimpleNamespace(
            get_table_description=lambda cursor, table_name: [SimpleNamespace(name=name) for name in columns]
        )
        connection = SimpleNamespace(
            cursor=lambda: nullcontext(object()),
            introspection=introspection,
        )
        schema_editor = SimpleNamespace(
            connection=connection,
            add_field=lambda added_model, field: added_fields.append((added_model, field)),
        )

        migration.add_updated_at_column_if_missing(apps, schema_editor)
        return added_fields

    def test_adds_the_column_when_missing(self):
        added_fields = self.run_migration(["id", "created_at"])

        self.assertEqual(len(added_fields), 1)
        self.assertEqual(added_fields[0][1].name, "updated_at")

    def test_leaves_an_existing_column_unchanged(self):
        self.assertEqual(self.run_migration(["id", "updated_at"]), [])
