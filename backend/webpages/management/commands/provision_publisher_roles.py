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
                cursor.execute(sql.SQL("REVOKE ALL ON SCHEMA public FROM {}").format(sql.Identifier(role)))
                cursor.execute(
                    sql.SQL("REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM {}").format(sql.Identifier(role))
                )
                cursor.execute(
                    sql.SQL("REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM {}").format(
                        sql.Identifier(role)
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
                      AND namespace.nspname = 'public'
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
