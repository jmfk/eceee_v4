"""Provision the standalone publisher's least-privilege PostgreSQL roles."""

import os
import re

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from psycopg2 import sql

READ_ROLE = "eceee_publisher"
FORM_ROLE = "eceee_publisher_forms"
PASSWORD_PATTERN = re.compile(r"^[A-Za-z0-9._~-]{24,128}$")
COLUMN_PRIVILEGES = {"SELECT", "INSERT", "UPDATE", "REFERENCES"}
PUBLISHER_ROLES = [READ_ROLE, FORM_ROLE]


def publisher_password(name):
    value = os.environ.get(name, "")
    if not PASSWORD_PATTERN.fullmatch(value) or value.startswith("replace-with-"):
        raise CommandError(f"{name} must contain a generated 24-128 character URL-safe password.")
    return value


class Command(BaseCommand):
    help = "Create or update the production publisher database roles without printing their credentials"

    def handle(self, *args, **options):
        read_password = publisher_password("PUBLISHER_DB_PASSWORD")
        form_password = publisher_password("PUBLISHER_FORM_DB_PASSWORD")
        if read_password == form_password:
            raise CommandError("Publisher read and form roles must use independent passwords.")
        database_name = connection.settings_dict["NAME"]

        with transaction.atomic(), connection.cursor() as cursor:
            for role, password in ((READ_ROLE, read_password), (FORM_ROLE, form_password)):
                cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", [role])
                if cursor.fetchone() is None:
                    cursor.execute(sql.SQL("CREATE ROLE {} LOGIN").format(sql.Identifier(role)))
                cursor.execute(
                    sql.SQL(
                        "ALTER ROLE {} WITH LOGIN PASSWORD %s NOSUPERUSER NOCREATEDB NOCREATEROLE "
                        "NOREPLICATION NOBYPASSRLS NOINHERIT"
                    ).format(sql.Identifier(role)),
                    [password],
                )

            cursor.execute(
                """
                WITH publisher_roles AS (
                    SELECT oid
                    FROM pg_roles
                    WHERE rolname = ANY(%s)
                )
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_database
                    WHERE datname = current_database()
                      AND datdba IN (SELECT oid FROM publisher_roles)
                    UNION ALL
                    SELECT 1
                    FROM pg_namespace
                    WHERE nspname NOT IN ('pg_catalog', 'information_schema')
                      AND nspname NOT LIKE 'pg_toast%%'
                      AND nspname NOT LIKE 'pg_temp_%%'
                      AND nspowner IN (SELECT oid FROM publisher_roles)
                    UNION ALL
                    SELECT 1
                    FROM pg_class AS relation
                    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
                    WHERE namespace.nspname NOT IN ('pg_catalog', 'information_schema')
                      AND namespace.nspname NOT LIKE 'pg_toast%%'
                      AND namespace.nspname NOT LIKE 'pg_temp_%%'
                      AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
                      AND relation.relowner IN (SELECT oid FROM publisher_roles)
                    UNION ALL
                    SELECT 1
                    FROM pg_proc AS routine
                    JOIN pg_namespace AS namespace ON namespace.oid = routine.pronamespace
                    WHERE namespace.nspname NOT IN ('pg_catalog', 'information_schema')
                      AND namespace.nspname NOT LIKE 'pg_toast%%'
                      AND namespace.nspname NOT LIKE 'pg_temp_%%'
                      AND routine.proowner IN (SELECT oid FROM publisher_roles)
                )
                """,
                [PUBLISHER_ROLES],
            )
            if cursor.fetchone()[0]:
                raise CommandError("Publisher roles own database objects and cannot be constrained to least privilege.")

            cursor.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_database AS database
                    CROSS JOIN LATERAL aclexplode(
                        COALESCE(database.datacl, acldefault('d', database.datdba))
                    ) AS acl
                    WHERE database.datname = current_database()
                      AND acl.grantee = 0
                      AND acl.privilege_type = 'CREATE'
                    UNION ALL
                    SELECT 1
                    FROM pg_namespace AS namespace
                    CROSS JOIN LATERAL aclexplode(
                        COALESCE(namespace.nspacl, acldefault('n', namespace.nspowner))
                    ) AS acl
                    WHERE namespace.nspname NOT IN ('pg_catalog', 'information_schema')
                      AND namespace.nspname NOT LIKE 'pg_toast%%'
                      AND namespace.nspname NOT LIKE 'pg_temp_%%'
                      AND acl.grantee = 0
                      AND (namespace.nspname <> 'public' OR acl.privilege_type <> 'USAGE')
                    UNION ALL
                    SELECT 1
                    FROM pg_class AS relation
                    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
                    CROSS JOIN LATERAL aclexplode(
                        COALESCE(
                            relation.relacl,
                            acldefault(CASE WHEN relation.relkind = 'S' THEN 's'::"char" ELSE 'r'::"char" END,
                                       relation.relowner)
                        )
                    ) AS acl
                    WHERE namespace.nspname NOT IN ('pg_catalog', 'information_schema')
                      AND namespace.nspname NOT LIKE 'pg_toast%%'
                      AND namespace.nspname NOT LIKE 'pg_temp_%%'
                      AND relation.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
                      AND acl.grantee = 0
                    UNION ALL
                    SELECT 1
                    FROM pg_attribute AS attribute
                    JOIN pg_class AS relation ON relation.oid = attribute.attrelid
                    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
                    CROSS JOIN LATERAL aclexplode(attribute.attacl) AS acl
                    WHERE namespace.nspname NOT IN ('pg_catalog', 'information_schema')
                      AND namespace.nspname NOT LIKE 'pg_toast%%'
                      AND namespace.nspname NOT LIKE 'pg_temp_%%'
                      AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
                      AND attribute.attnum > 0
                      AND NOT attribute.attisdropped
                      AND acl.grantee = 0
                    UNION ALL
                    SELECT 1
                    FROM pg_proc AS routine
                    JOIN pg_namespace AS namespace ON namespace.oid = routine.pronamespace
                    CROSS JOIN LATERAL aclexplode(
                        COALESCE(routine.proacl, acldefault('f', routine.proowner))
                    ) AS acl
                    WHERE namespace.nspname NOT IN ('pg_catalog', 'information_schema')
                      AND namespace.nspname NOT LIKE 'pg_toast%%'
                      AND namespace.nspname NOT LIKE 'pg_temp_%%'
                      AND acl.grantee = 0
                      AND acl.privilege_type = 'EXECUTE'
                )
                """
            )
            if cursor.fetchone()[0]:
                raise CommandError("PUBLIC grants exceed the publisher least-privilege boundary.")

            for role in PUBLISHER_ROLES:
                cursor.execute(
                    """
                    SELECT granted_role.rolname
                    FROM pg_auth_members AS membership
                    JOIN pg_roles AS granted_role ON granted_role.oid = membership.roleid
                    JOIN pg_roles AS member_role ON member_role.oid = membership.member
                    WHERE member_role.rolname = %s
                    """,
                    [role],
                )
                for (granted_role,) in cursor.fetchall():
                    cursor.execute(
                        sql.SQL("REVOKE {} FROM {}").format(
                            sql.Identifier(granted_role),
                            sql.Identifier(role),
                        )
                    )
                cursor.execute(
                    """
                    SELECT member_role.rolname
                    FROM pg_auth_members AS membership
                    JOIN pg_roles AS granted_role ON granted_role.oid = membership.roleid
                    JOIN pg_roles AS member_role ON member_role.oid = membership.member
                    WHERE granted_role.rolname = %s
                    """,
                    [role],
                )
                for (member_role,) in cursor.fetchall():
                    cursor.execute(
                        sql.SQL("REVOKE {} FROM {}").format(
                            sql.Identifier(role),
                            sql.Identifier(member_role),
                        )
                    )
                cursor.execute(
                    sql.SQL("REVOKE ALL PRIVILEGES ON DATABASE {} FROM {}").format(
                        sql.Identifier(database_name), sql.Identifier(role)
                    )
                )
                cursor.execute(
                    """
                    SELECT nspname
                    FROM pg_namespace
                    WHERE nspname NOT IN ('pg_catalog', 'information_schema')
                      AND nspname NOT LIKE 'pg_toast%%'
                      AND nspname NOT LIKE 'pg_temp_%%'
                    """
                )
                for (schema_name,) in cursor.fetchall():
                    cursor.execute(
                        sql.SQL("REVOKE ALL ON SCHEMA {} FROM {}").format(
                            sql.Identifier(schema_name), sql.Identifier(role)
                        )
                    )
                    cursor.execute(
                        sql.SQL("REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA {} FROM {}").format(
                            sql.Identifier(schema_name), sql.Identifier(role)
                        )
                    )
                    cursor.execute(
                        sql.SQL("REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA {} FROM {}").format(
                            sql.Identifier(schema_name), sql.Identifier(role)
                        )
                    )
                    cursor.execute(
                        sql.SQL("REVOKE ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA {} FROM {}").format(
                            sql.Identifier(schema_name), sql.Identifier(role)
                        )
                    )
                cursor.execute(
                    """
                    SELECT namespace.nspname, table_class.relname, attribute.attname, acl.privilege_type
                    FROM pg_attribute AS attribute
                    JOIN pg_class AS table_class ON table_class.oid = attribute.attrelid
                    JOIN pg_namespace AS namespace ON namespace.oid = table_class.relnamespace
                    CROSS JOIN LATERAL aclexplode(attribute.attacl) AS acl
                    JOIN pg_roles AS grantee ON grantee.oid = acl.grantee
                    WHERE grantee.rolname = %s
                      AND namespace.nspname NOT IN ('pg_catalog', 'information_schema')
                      AND namespace.nspname NOT LIKE 'pg_toast%%'
                      AND namespace.nspname NOT LIKE 'pg_temp_%%'
                      AND attribute.attnum > 0
                      AND NOT attribute.attisdropped
                    """,
                    [role],
                )
                for table_schema, table_name, column_name, privilege_type in cursor.fetchall():
                    if privilege_type not in COLUMN_PRIVILEGES:
                        raise CommandError(f"Unsupported publisher column privilege: {privilege_type}")
                    cursor.execute(
                        sql.SQL("REVOKE {} ({}) ON TABLE {}.{} FROM {}").format(
                            sql.SQL(privilege_type),
                            sql.Identifier(column_name),
                            sql.Identifier(table_schema),
                            sql.Identifier(table_name),
                            sql.Identifier(role),
                        )
                    )
                cursor.execute(
                    sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(
                        sql.Identifier(database_name), sql.Identifier(role)
                    )
                )
                cursor.execute(sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(sql.Identifier(role)))

            cursor.execute(
                sql.SQL("GRANT SELECT ON webpages_webpage, webpages_pageversion, webpages_pagetheme TO {}").format(
                    sql.Identifier(READ_ROLE)
                )
            )
            cursor.execute(
                sql.SQL(
                    "GRANT SELECT (tenant_id, page_id, widget_id, submitted_at) "
                    "ON webpages_publicformsubmission TO {}"
                ).format(sql.Identifier(FORM_ROLE))
            )
            cursor.execute(
                sql.SQL(
                    "GRANT INSERT (id, tenant_id, page_id, page_version_id, widget_id, form_title, data, submitted_at) "
                    "ON webpages_publicformsubmission TO {}"
                ).format(sql.Identifier(FORM_ROLE))
            )

        self.stdout.write(self.style.SUCCESS("Publisher database roles provisioned with least-privilege grants."))
