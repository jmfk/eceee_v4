from unittest.mock import MagicMock, patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase


class ProvisionPublisherRolesTests(SimpleTestCase):
    @patch("webpages.management.commands.provision_publisher_roles.transaction.atomic")
    @patch("webpages.management.commands.provision_publisher_roles.connection")
    def test_provisions_both_roles_without_printing_credentials(self, connection, atomic):
        cursor = MagicMock()
        cursor.fetchone.side_effect = [None, (1,)]
        cursor.fetchall.side_effect = [[], []]
        connection.cursor.return_value.__enter__.return_value = cursor
        connection.settings_dict = {"NAME": "eceee_v4"}
        atomic.return_value.__enter__.return_value = None
        read_password = "a" * 32
        form_password = "b" * 32

        with patch.dict(
            "os.environ",
            {"PUBLISHER_DB_PASSWORD": read_password, "PUBLISHER_FORM_DB_PASSWORD": form_password},
            clear=False,
        ):
            out = MagicMock()
            call_command("provision_publisher_roles", stdout=out)

        parameters = [call.args[1] for call in cursor.execute.call_args_list if len(call.args) > 1]
        self.assertIn([read_password], parameters)
        self.assertIn([form_password], parameters)
        rendered_output = "".join(str(call) for call in out.write.call_args_list)
        self.assertNotIn(read_password, rendered_output)
        self.assertNotIn(form_password, rendered_output)
        statements = "\n".join(repr(call.args[0]) for call in cursor.execute.call_args_list)
        self.assertIn("webpages_webpage", statements)
        self.assertIn("tenant_id, page_id, widget_id, submitted_at", statements)
        self.assertIn("form_title, data, submitted_at", statements)

    @patch("webpages.management.commands.provision_publisher_roles.transaction.atomic")
    @patch("webpages.management.commands.provision_publisher_roles.connection")
    def test_revokes_preexisting_role_memberships(self, connection, atomic):
        cursor = MagicMock()
        cursor.fetchone.side_effect = [(1,), (1,)]
        cursor.fetchall.side_effect = [[("legacy_reader",), ("legacy_writer",)], []]
        connection.cursor.return_value.__enter__.return_value = cursor
        connection.settings_dict = {"NAME": "eceee_v4"}
        atomic.return_value.__enter__.return_value = None

        with patch.dict(
            "os.environ",
            {"PUBLISHER_DB_PASSWORD": "a" * 32, "PUBLISHER_FORM_DB_PASSWORD": "b" * 32},
            clear=False,
        ):
            call_command("provision_publisher_roles")

        statements = "\n".join(repr(call.args[0]) for call in cursor.execute.call_args_list)
        self.assertIn(
            "SQL('REVOKE '), Identifier('legacy_reader'), SQL(' FROM '), Identifier('eceee_publisher')",
            statements,
        )
        self.assertIn(
            "SQL('REVOKE '), Identifier('legacy_writer'), SQL(' FROM '), Identifier('eceee_publisher')",
            statements,
        )
        self.assertNotIn(
            "SQL('REVOKE '), Identifier('legacy_reader'), SQL(' FROM '), Identifier('eceee_publisher_forms')",
            statements,
        )

    def test_rejects_missing_or_placeholder_passwords(self):
        with patch.dict(
            "os.environ",
            {
                "PUBLISHER_DB_PASSWORD": "replace-with-independent-hex-password",
                "PUBLISHER_FORM_DB_PASSWORD": "b" * 32,
            },
            clear=False,
        ):
            with self.assertRaisesMessage(CommandError, "PUBLISHER_DB_PASSWORD"):
                call_command("provision_publisher_roles")

    def test_rejects_reused_passwords(self):
        with patch.dict(
            "os.environ",
            {"PUBLISHER_DB_PASSWORD": "a" * 32, "PUBLISHER_FORM_DB_PASSWORD": "a" * 32},
            clear=False,
        ):
            with self.assertRaisesMessage(CommandError, "independent passwords"):
                call_command("provision_publisher_roles")
