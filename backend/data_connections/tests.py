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
