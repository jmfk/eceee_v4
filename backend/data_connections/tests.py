from types import SimpleNamespace
from unittest.mock import Mock, patch

from cryptography.fernet import Fernet
from django.test import SimpleTestCase, override_settings

from .credentials import encrypt_connection_secrets
from .services.manager import DataConnectionManager


@override_settings(THEME_REMOTE_CREDENTIAL_KEYS=[Fernet.generate_key().decode()])
class DataConnectionCredentialTests(SimpleTestCase):
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
