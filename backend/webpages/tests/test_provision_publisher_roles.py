from unittest.mock import MagicMock, patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection as database_connection
from django.test import SimpleTestCase, TestCase
from psycopg2 import sql


class ProvisionPublisherRolesTests(SimpleTestCase):
    @patch("webpages.management.commands.provision_publisher_roles.transaction.atomic")
    @patch("webpages.management.commands.provision_publisher_roles.connection")
    def test_provisions_both_roles_without_printing_credentials(self, connection, atomic):
        cursor = MagicMock()
        cursor.fetchone.side_effect = [None, (1,), (False,), (False,)]
        cursor.fetchall.side_effect = [[], [], [("public",)], [], [], [], [("public",)], []]
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
        self.assertIn("NOBYPASSRLS", statements)
        self.assertIn("webpages_webpage", statements)
        self.assertIn("file_manager_mediafile", statements)
        self.assertIn("file_manager_mediacollection", statements)
        self.assertIn("file_manager_mediafile_collections", statements)
        self.assertIn("content_namespace", statements)
        self.assertIn("file_url, file_path, file_type", statements)
        self.assertIn("access_level, is_deleted, created_at", statements)
        self.assertNotIn("ai_extracted_text", statements)
        self.assertIn("tenant_id, page_id, widget_id, submitted_at", statements)
        self.assertIn("form_title, data, submitted_at", statements)
        self.assertIn("ALL ROUTINES IN SCHEMA", statements)

    @patch("webpages.management.commands.provision_publisher_roles.transaction.atomic")
    @patch("webpages.management.commands.provision_publisher_roles.connection")
    def test_revokes_preexisting_role_memberships(self, connection, atomic):
        cursor = MagicMock()
        cursor.fetchone.side_effect = [(1,), (1,), (False,), (False,)]
        cursor.fetchall.side_effect = [
            [("legacy_reader",), ("legacy_writer",)],
            [("legacy_consumer",)],
            [("public",)],
            [],
            [],
            [],
            [("public",)],
            [],
        ]
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
        self.assertIn(
            "Identifier('eceee_publisher'), SQL(' FROM '), Identifier('legacy_consumer')",
            statements,
        )

    @patch("webpages.management.commands.provision_publisher_roles.transaction.atomic")
    @patch("webpages.management.commands.provision_publisher_roles.connection")
    def test_revokes_preexisting_column_privileges(self, connection, atomic):
        cursor = MagicMock()
        cursor.fetchone.side_effect = [(1,), (1,), (False,), (False,)]
        cursor.fetchall.side_effect = [
            [],
            [],
            [],
            [("public", "webpages_publicformsubmission", "data", "SELECT")],
            [],
            [],
            [],
            [],
        ]
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
            "SQL('REVOKE '), SQL('SELECT'), SQL(' ('), Identifier('data')",
            statements,
        )
        self.assertIn("Identifier('webpages_publicformsubmission')", statements)

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

    @patch("webpages.management.commands.provision_publisher_roles.transaction.atomic")
    @patch("webpages.management.commands.provision_publisher_roles.connection")
    def test_rejects_role_ownership_drift(self, connection, atomic):
        cursor = MagicMock()
        cursor.fetchone.side_effect = [(1,), (1,), (True,)]
        connection.cursor.return_value.__enter__.return_value = cursor
        connection.settings_dict = {"NAME": "eceee_v4"}
        atomic.return_value.__enter__.return_value = None

        with patch.dict(
            "os.environ",
            {"PUBLISHER_DB_PASSWORD": "a" * 32, "PUBLISHER_FORM_DB_PASSWORD": "b" * 32},
            clear=False,
        ):
            with self.assertRaisesMessage(CommandError, "own database objects"):
                call_command("provision_publisher_roles")

    @patch("webpages.management.commands.provision_publisher_roles.transaction.atomic")
    @patch("webpages.management.commands.provision_publisher_roles.connection")
    def test_rejects_public_privilege_drift(self, connection, atomic):
        cursor = MagicMock()
        cursor.fetchone.side_effect = [(1,), (1,), (False,), (True,)]
        connection.cursor.return_value.__enter__.return_value = cursor
        connection.settings_dict = {"NAME": "eceee_v4"}
        atomic.return_value.__enter__.return_value = None

        with patch.dict(
            "os.environ",
            {"PUBLISHER_DB_PASSWORD": "a" * 32, "PUBLISHER_FORM_DB_PASSWORD": "b" * 32},
            clear=False,
        ):
            with self.assertRaisesMessage(CommandError, "PUBLIC grants"):
                call_command("provision_publisher_roles")


class ProvisionPublisherRolesPostgresTests(TestCase):
    def test_removes_stale_column_grant_and_memberships(self):
        if database_connection.vendor != "postgresql":
            self.skipTest("PostgreSQL role ACL semantics required")

        role_names = ["eceee_publisher", "eceee_publisher_forms", "eceee_publisher_test_consumer"]
        with database_connection.cursor() as cursor:
            cursor.execute("SELECT rolname FROM pg_roles WHERE rolname = ANY(%s)", [role_names])
            existing_roles = [row[0] for row in cursor.fetchall()]
            if existing_roles:
                self.skipTest(f"isolated PostgreSQL roles required; already present: {', '.join(existing_roles)}")

            for role_name in ("eceee_publisher", "eceee_publisher_forms"):
                cursor.execute(sql.SQL("CREATE ROLE {} BYPASSRLS").format(sql.Identifier(role_name)))
            cursor.execute(sql.SQL("CREATE ROLE {}").format(sql.Identifier("eceee_publisher_test_consumer")))
            cursor.execute("CREATE SEQUENCE eceee_publisher_test_sequence")
            cursor.execute(
                sql.SQL("GRANT SELECT (data) ON webpages_publicformsubmission TO {}").format(
                    sql.Identifier("eceee_publisher_forms")
                )
            )
            cursor.execute(
                sql.SQL("GRANT USAGE, SELECT, UPDATE ON SEQUENCE eceee_publisher_test_sequence TO {}").format(
                    sql.Identifier("eceee_publisher_forms")
                )
            )
            cursor.execute(
                sql.SQL("GRANT {} TO {}").format(
                    sql.Identifier("eceee_publisher_forms"),
                    sql.Identifier("eceee_publisher_test_consumer"),
                )
            )

        with patch.dict(
            "os.environ",
            {"PUBLISHER_DB_PASSWORD": "a" * 32, "PUBLISHER_FORM_DB_PASSWORD": "b" * 32},
            clear=False,
        ):
            call_command("provision_publisher_roles")

        with database_connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT rolbypassrls
                FROM pg_roles
                WHERE rolname IN ('eceee_publisher', 'eceee_publisher_forms')
                ORDER BY rolname
                """
            )
            self.assertEqual(cursor.fetchall(), [(False,), (False,)])
            cursor.execute(
                """
                SELECT 1
                FROM information_schema.column_privileges
                WHERE grantee = 'eceee_publisher_forms'
                  AND table_schema = 'public'
                  AND table_name = 'webpages_publicformsubmission'
                  AND column_name = 'data'
                  AND privilege_type = 'SELECT'
                """
            )
            self.assertIsNone(cursor.fetchone())
            cursor.execute(
                """
                SELECT has_sequence_privilege(
                    'eceee_publisher_forms',
                    'eceee_publisher_test_sequence',
                    'USAGE, SELECT, UPDATE'
                )
                """
            )
            self.assertFalse(cursor.fetchone()[0])
            cursor.execute(
                """
                SELECT 1
                FROM pg_auth_members AS membership
                JOIN pg_roles AS granted_role ON granted_role.oid = membership.roleid
                JOIN pg_roles AS member_role ON member_role.oid = membership.member
                WHERE granted_role.rolname = 'eceee_publisher_forms'
                  AND member_role.rolname = 'eceee_publisher_test_consumer'
                """
            )
            self.assertIsNone(cursor.fetchone())

    def test_rejects_public_table_grants(self):
        if database_connection.vendor != "postgresql":
            self.skipTest("PostgreSQL role ACL semantics required")

        role_names = ["eceee_publisher", "eceee_publisher_forms"]
        with database_connection.cursor() as cursor:
            cursor.execute("SELECT rolname FROM pg_roles WHERE rolname = ANY(%s)", [role_names])
            existing_roles = [row[0] for row in cursor.fetchall()]
            if existing_roles:
                self.skipTest(f"isolated PostgreSQL roles required; already present: {', '.join(existing_roles)}")
            cursor.execute("GRANT SELECT (data) ON webpages_publicformsubmission TO PUBLIC")

        with patch.dict(
            "os.environ",
            {"PUBLISHER_DB_PASSWORD": "a" * 32, "PUBLISHER_FORM_DB_PASSWORD": "b" * 32},
            clear=False,
        ):
            with self.assertRaisesMessage(CommandError, "PUBLIC grants"):
                call_command("provision_publisher_roles")

    def test_rejects_publisher_owned_relations(self):
        if database_connection.vendor != "postgresql":
            self.skipTest("PostgreSQL role ACL semantics required")

        role_names = ["eceee_publisher", "eceee_publisher_forms"]
        with database_connection.cursor() as cursor:
            cursor.execute("SELECT rolname FROM pg_roles WHERE rolname = ANY(%s)", [role_names])
            existing_roles = [row[0] for row in cursor.fetchall()]
            if existing_roles:
                self.skipTest(f"isolated PostgreSQL roles required; already present: {', '.join(existing_roles)}")
            cursor.execute(sql.SQL("CREATE ROLE {}").format(sql.Identifier("eceee_publisher")))
            cursor.execute("CREATE TABLE eceee_publisher_owned_test (id integer)")
            cursor.execute(
                sql.SQL("ALTER TABLE eceee_publisher_owned_test OWNER TO {}").format(sql.Identifier("eceee_publisher"))
            )

        with patch.dict(
            "os.environ",
            {"PUBLISHER_DB_PASSWORD": "a" * 32, "PUBLISHER_FORM_DB_PASSWORD": "b" * 32},
            clear=False,
        ):
            with self.assertRaisesMessage(CommandError, "own database objects"):
                call_command("provision_publisher_roles")

    def test_rejects_publisher_owned_non_public_schema(self):
        if database_connection.vendor != "postgresql":
            self.skipTest("PostgreSQL role ACL semantics required")

        role_names = ["eceee_publisher", "eceee_publisher_forms"]
        with database_connection.cursor() as cursor:
            cursor.execute("SELECT rolname FROM pg_roles WHERE rolname = ANY(%s)", [role_names])
            existing_roles = [row[0] for row in cursor.fetchall()]
            if existing_roles:
                self.skipTest(f"isolated PostgreSQL roles required; already present: {', '.join(existing_roles)}")
            cursor.execute(sql.SQL("CREATE ROLE {}").format(sql.Identifier("eceee_publisher_forms")))
            cursor.execute(
                sql.SQL("CREATE SCHEMA publisher_private AUTHORIZATION {}").format(
                    sql.Identifier("eceee_publisher_forms")
                )
            )

        with patch.dict(
            "os.environ",
            {"PUBLISHER_DB_PASSWORD": "a" * 32, "PUBLISHER_FORM_DB_PASSWORD": "b" * 32},
            clear=False,
        ):
            with self.assertRaisesMessage(CommandError, "own database objects"):
                call_command("provision_publisher_roles")

    def test_rejects_publisher_owned_non_public_relation(self):
        if database_connection.vendor != "postgresql":
            self.skipTest("PostgreSQL role ACL semantics required")

        role_names = ["eceee_publisher", "eceee_publisher_forms"]
        with database_connection.cursor() as cursor:
            cursor.execute("SELECT rolname FROM pg_roles WHERE rolname = ANY(%s)", [role_names])
            existing_roles = [row[0] for row in cursor.fetchall()]
            if existing_roles:
                self.skipTest(f"isolated PostgreSQL roles required; already present: {', '.join(existing_roles)}")
            cursor.execute(sql.SQL("CREATE ROLE {}").format(sql.Identifier("eceee_publisher")))
            cursor.execute("CREATE SCHEMA publisher_test")
            cursor.execute("CREATE TABLE publisher_test.owned_relation (id integer)")
            cursor.execute(
                sql.SQL("ALTER TABLE publisher_test.owned_relation OWNER TO {}").format(
                    sql.Identifier("eceee_publisher")
                )
            )

        with patch.dict(
            "os.environ",
            {"PUBLISHER_DB_PASSWORD": "a" * 32, "PUBLISHER_FORM_DB_PASSWORD": "b" * 32},
            clear=False,
        ):
            with self.assertRaisesMessage(CommandError, "own database objects"):
                call_command("provision_publisher_roles")

    def test_rejects_public_grants_outside_public_schema(self):
        if database_connection.vendor != "postgresql":
            self.skipTest("PostgreSQL role ACL semantics required")

        role_names = ["eceee_publisher", "eceee_publisher_forms"]
        with database_connection.cursor() as cursor:
            cursor.execute("SELECT rolname FROM pg_roles WHERE rolname = ANY(%s)", [role_names])
            existing_roles = [row[0] for row in cursor.fetchall()]
            if existing_roles:
                self.skipTest(f"isolated PostgreSQL roles required; already present: {', '.join(existing_roles)}")
            cursor.execute("CREATE SCHEMA publisher_shared")
            cursor.execute("CREATE TABLE publisher_shared.shared_relation (id integer)")
            cursor.execute("GRANT USAGE ON SCHEMA publisher_shared TO PUBLIC")
            cursor.execute("GRANT SELECT ON publisher_shared.shared_relation TO PUBLIC")

        with patch.dict(
            "os.environ",
            {"PUBLISHER_DB_PASSWORD": "a" * 32, "PUBLISHER_FORM_DB_PASSWORD": "b" * 32},
            clear=False,
        ):
            with self.assertRaisesMessage(CommandError, "PUBLIC grants"):
                call_command("provision_publisher_roles")

    def test_revokes_direct_grants_outside_public_schema(self):
        if database_connection.vendor != "postgresql":
            self.skipTest("PostgreSQL role ACL semantics required")

        role_names = ["eceee_publisher", "eceee_publisher_forms"]
        with database_connection.cursor() as cursor:
            cursor.execute("SELECT rolname FROM pg_roles WHERE rolname = ANY(%s)", [role_names])
            existing_roles = [row[0] for row in cursor.fetchall()]
            if existing_roles:
                self.skipTest(f"isolated PostgreSQL roles required; already present: {', '.join(existing_roles)}")
            for role_name in role_names:
                cursor.execute(sql.SQL("CREATE ROLE {}").format(sql.Identifier(role_name)))
            cursor.execute("CREATE SCHEMA publisher_grants")
            cursor.execute("CREATE TABLE publisher_grants.granted_relation (id integer)")
            cursor.execute(
                sql.SQL("GRANT CREATE ON SCHEMA publisher_grants TO {}").format(sql.Identifier("eceee_publisher_forms"))
            )
            cursor.execute(
                sql.SQL("GRANT SELECT ON publisher_grants.granted_relation TO {}").format(
                    sql.Identifier("eceee_publisher_forms")
                )
            )

        with patch.dict(
            "os.environ",
            {"PUBLISHER_DB_PASSWORD": "a" * 32, "PUBLISHER_FORM_DB_PASSWORD": "b" * 32},
            clear=False,
        ):
            call_command("provision_publisher_roles")

        with database_connection.cursor() as cursor:
            cursor.execute("SELECT has_schema_privilege('eceee_publisher_forms', 'publisher_grants', 'CREATE')")
            self.assertFalse(cursor.fetchone()[0])
            cursor.execute(
                "SELECT has_table_privilege('eceee_publisher_forms', " "'publisher_grants.granted_relation', 'SELECT')"
            )
            self.assertFalse(cursor.fetchone()[0])

    def test_rejects_public_routine_execution(self):
        if database_connection.vendor != "postgresql":
            self.skipTest("PostgreSQL role ACL semantics required")

        role_names = ["eceee_publisher", "eceee_publisher_forms"]
        with database_connection.cursor() as cursor:
            cursor.execute("SELECT rolname FROM pg_roles WHERE rolname = ANY(%s)", [role_names])
            existing_roles = [row[0] for row in cursor.fetchall()]
            if existing_roles:
                self.skipTest(f"isolated PostgreSQL roles required; already present: {', '.join(existing_roles)}")
            cursor.execute("CREATE SCHEMA publisher_routines")
            cursor.execute(
                "CREATE FUNCTION publisher_routines.public_function() RETURNS integer " "LANGUAGE sql AS 'SELECT 1'"
            )

        with patch.dict(
            "os.environ",
            {"PUBLISHER_DB_PASSWORD": "a" * 32, "PUBLISHER_FORM_DB_PASSWORD": "b" * 32},
            clear=False,
        ):
            with self.assertRaisesMessage(CommandError, "PUBLIC grants"):
                call_command("provision_publisher_roles")
