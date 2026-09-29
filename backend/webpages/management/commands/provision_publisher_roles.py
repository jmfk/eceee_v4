"""Provision the standalone publisher's least-privilege PostgreSQL roles."""

import os
import re

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from psycopg2 import sql

READ_ROLE = "eceee_publisher"
FORM_ROLE = "eceee_publisher_forms"
PASSWORD_PATTERN = re.compile(r"^[A-Za-z0-9._~-]{24,128}$")


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
                        "NOREPLICATION NOINHERIT"
                    ).format(sql.Identifier(role)),
                    [password],
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
