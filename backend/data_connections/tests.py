import json
from types import SimpleNamespace
from unittest.mock import Mock, patch

from cryptography.fernet import Fernet
from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase, override_settings

from content.models import Namespace
from core.models import Tenant
from object_storage.models import ObjectInstance, ObjectTypeDefinition

from .credentials import encrypt_connection_secrets
from .services.engine import InternalQueryEngine
from .services.manager import DataConnectionManager


@override_settings(THEME_REMOTE_CREDENTIAL_KEYS=[Fernet.generate_key().decode()])
class DataConnectionCredentialTests(SimpleTestCase):
    @patch("data_connections.services.manager.ConnectionCacheService.set")
    @patch("data_connections.services.manager.ConnectionCacheService.get")
    @patch("data_connections.services.manager.get_engine")
    def test_internal_stream_does_not_serve_cached_deleted_content(self, get_engine, cache_get, cache_set):
        engine = Mock()
        engine.execute.return_value = [{"id": 1}]
        get_engine.return_value = engine
        connection = SimpleNamespace(connection_type="INTERNAL", config={}, encrypted_secrets="")

        result = DataConnectionManager()._run_engine_workflow_transformer(
            connection, "{}", [], None, cache_ttl=3600, stream_id=5
        )

        self.assertEqual(result, [{"id": 1}])
        cache_get.assert_not_called()
        cache_set.assert_not_called()

    @patch("data_connections.services.manager.get_engine")
    def test_manager_resolves_write_only_credentials_for_server_side_engine(self, get_engine):
        engine = Mock()
        engine.execute.return_value = []
        get_engine.return_value = engine
        connection = SimpleNamespace(
            connection_type="EXTERNAL_REST",
            config={"baseUrl": "https://example.test", "authType": "bearer"},
            encrypted_secrets=encrypt_connection_secrets({"token": "server-only-token"}),
        )

        DataConnectionManager()._run_engine_workflow_transformer(
            connection,
            "/items",
            [],
            None,
            cache_ttl=0,
            bypass_cache=True,
        )

        engine.execute.assert_called_once_with(
            "/items",
            {
                "baseUrl": "https://example.test",
                "authType": "bearer",
                "token": "server-only-token",
            },
        )

    @patch("data_connections.services.engine.get_engine")
    @patch("content_migration.tasks.MigrationJob.objects")
    def test_migration_job_resolves_write_only_credentials(self, migration_jobs, get_engine):
        from content_migration.tasks import run_migration_job

        engine = Mock()
        engine.execute.return_value = []
        get_engine.return_value = engine
        connection = SimpleNamespace(
            connection_type="EXTERNAL_REST",
            config={"baseUrl": "https://example.test", "authType": "bearer"},
            encrypted_secrets=encrypt_connection_secrets({"token": "server-only-token"}),
        )
        plan = SimpleNamespace(source_connection=connection, query_dsl="/items", config={})
        job = SimpleNamespace(plan=plan, status="PENDING", started_at=None, save=Mock())
        migration_jobs.select_related.return_value.get.return_value = job

        run_migration_job.run("job-id")

        engine.execute.assert_called_once_with(
            "/items",
            {
                "baseUrl": "https://example.test",
                "authType": "bearer",
                "token": "server-only-token",
            },
        )


class InternalQueryTrashTests(TestCase):
    def test_internal_queries_exclude_trashed_objects_and_types(self):
        user = User.objects.create_user("query-trash")
        tenant = Tenant.objects.create(name="Query trash", identifier="query-trash", created_by=user)
        namespace = Namespace.objects.create(name="Query trash", slug="query-trash", tenant=tenant, created_by=user)
        object_type = ObjectTypeDefinition.objects.create(
            name="query_trash_type",
            label="Query type",
            plural_label="Query types",
            namespace=namespace,
            created_by=user,
        )
        obj = ObjectInstance.objects.create(title="Query item", object_type=object_type, tenant=tenant, created_by=user)
        engine = InternalQueryEngine()
        object_query = json.dumps({"model": "ObjectInstance", "fields": ["id", "title"]})
        type_query = json.dumps({"model": "ObjectTypeDefinition", "fields": ["id", "label"]})
        self.assertEqual([item["id"] for item in engine.execute(object_query, {})], [obj.pk])
        obj.soft_delete(user)
        self.assertEqual(engine.execute(object_query, {}), [])
        obj.restore(user)
        object_type.soft_delete(user)
        self.assertEqual(engine.execute(object_query, {}), [])
        self.assertEqual(engine.execute(type_query, {}), [])
