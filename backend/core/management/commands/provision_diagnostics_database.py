"""Explicit, repeatable provisioning; never invoked automatically by migrations or deploy."""

import os
import re

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from psycopg2 import sql

from core.diagnostics.catalog import projections
from core.diagnostics.database import OWNER_ROLE, READ_ROLE, SCHEMA


class Command(BaseCommand):
    help = "Provision restricted diagnostic views/roles; credentials are read internally from DIAGNOSTICS_DB_PASSWORD"

    def handle(self, *args, **options):
        password = os.environ.get("DIAGNOSTICS_DB_PASSWORD", "")
        if not re.fullmatch(r"[A-Za-z0-9._~-]{32,128}", password):
            raise CommandError("DIAGNOSTICS_DB_PASSWORD=missing_or_invalid")
        if connection.vendor != "postgresql":
            raise CommandError("PostgreSQL required.")
        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute("SET LOCAL lock_timeout = '5s'")
            cursor.execute("SELECT pg_advisory_xact_lock(52932521)")
            for role in (OWNER_ROLE, READ_ROLE):
                cursor.execute("SELECT oid FROM pg_roles WHERE rolname = %s", [role])
                exists = cursor.fetchone()
                if exists:
                    cursor.execute(
                        "SELECT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=%s OR roleid=%s)",
                        [exists[0], exists[0]],
                    )
                    if cursor.fetchone()[0]:
                        raise CommandError("Diagnostic roles must have no role memberships.")
                    cursor.execute(
                        """SELECT EXISTS(SELECT 1 FROM pg_database WHERE datdba=%s)
                        OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspowner=%s AND NOT (%s AND nspname=%s))
                        OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                            WHERE relowner=%s AND NOT (%s AND n.nspname=%s AND c.relkind='v'))
                        OR EXISTS(SELECT 1 FROM pg_proc WHERE proowner=%s)""",
                        [
                            exists[0],
                            exists[0],
                            role == OWNER_ROLE,
                            SCHEMA,
                            exists[0],
                            role == OWNER_ROLE,
                            SCHEMA,
                            exists[0],
                        ],
                    )
                    if cursor.fetchone()[0]:
                        raise CommandError("Diagnostic role owns persistent data; refusing provisioning.")
                else:
                    cursor.execute(sql.SQL("CREATE ROLE {} NOLOGIN").format(sql.Identifier(role)))
                cursor.execute(
                    sql.SQL(
                        "ALTER ROLE {} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT"
                    ).format(sql.Identifier(role))
                )
            cursor.execute(sql.SQL("ALTER ROLE {} LOGIN PASSWORD %s").format(sql.Identifier(READ_ROLE)), [password])
            cursor.execute(sql.SQL("ALTER ROLE {} NOLOGIN").format(sql.Identifier(OWNER_ROLE)))
            cursor.execute(
                sql.SQL("ALTER ROLE {} SET default_transaction_read_only = on").format(sql.Identifier(READ_ROLE))
            )
            cursor.execute(sql.SQL("ALTER ROLE {} SET statement_timeout = '5s'").format(sql.Identifier(READ_ROLE)))
            cursor.execute(
                sql.SQL("ALTER ROLE {} SET search_path = pg_catalog, {}").format(
                    sql.Identifier(READ_ROLE), sql.Identifier(SCHEMA)
                )
            )
            cursor.execute(
                sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(
                    sql.Identifier(connection.settings_dict["NAME"]), sql.Identifier(READ_ROLE)
                )
            )
            cursor.execute(
                sql.SQL("CREATE SCHEMA IF NOT EXISTS {} AUTHORIZATION {}").format(
                    sql.Identifier(SCHEMA), sql.Identifier(OWNER_ROLE)
                )
            )
            cursor.execute("SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname=%s", [SCHEMA])
            if cursor.fetchone()[0] != OWNER_ROLE:
                raise CommandError("Diagnostic schema has an unexpected owner.")
            for role in (READ_ROLE, OWNER_ROLE):
                cursor.execute(
                    sql.SQL("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {}").format(sql.Identifier(role))
                )
                # REVOKE table grants does not revoke prior column grants.
                cursor.execute(
                    "SELECT table_name, column_name, privilege_type FROM information_schema.column_privileges "
                    "WHERE grantee=%s AND table_schema='public'",
                    [role],
                )
                for table, column, privilege in cursor.fetchall():
                    if privilege not in {"SELECT", "INSERT", "UPDATE", "REFERENCES"}:
                        raise CommandError("Unexpected diagnostic privilege.")
                    cursor.execute(
                        sql.SQL("REVOKE {} ({}) ON public.{} FROM {}").format(
                            sql.SQL(privilege), sql.Identifier(column), sql.Identifier(table), sql.Identifier(role)
                        )
                    )
            cursor.execute(
                sql.SQL("REVOKE ALL ON SCHEMA {} FROM PUBLIC, {}").format(
                    sql.Identifier(SCHEMA), sql.Identifier(READ_ROLE)
                )
            )
            cursor.execute(
                sql.SQL("REVOKE ALL ON ALL TABLES IN SCHEMA {} FROM PUBLIC, {}").format(
                    sql.Identifier(SCHEMA), sql.Identifier(READ_ROLE)
                )
            )
            cursor.execute(
                sql.SQL("GRANT USAGE ON SCHEMA {} TO {}").format(sql.Identifier(SCHEMA), sql.Identifier(READ_ROLE))
            )
            cursor.execute(sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(sql.Identifier(OWNER_ROLE)))
            reviewed = projections()
            for table, projection in reviewed.items():
                model = projection["model"]
                fields = projection["fields"]
                expressions = []
                grants = {table: set()}
                for column, classification in projection["columns"].items():
                    if column not in fields:
                        continue  # Synthetic tenant_id is projected from the reviewed ownership path below.
                    if classification == "masked":
                        expressions.append(sql.SQL("'[masked]'::text AS {}").format(sql.Identifier(column)))
                    else:
                        grants[table].add(column)
                        expressions.append(sql.SQL("t.{} AS {}").format(sql.Identifier(column), sql.Identifier(column)))
                joins = sql.SQL("")
                tenant_path = projection["tenant_path"]
                if tenant_path is None:
                    condition = sql.SQL("current_setting('eceee_diagnostics.global_access', true) = 'on'")
                else:
                    if "." in tenant_path:
                        relation, tenant_column = tenant_path.split(".")
                        field = model._meta.get_field(relation)
                        related = field.related_model._meta.db_table
                        grants[table].add(field.column)
                        grants.setdefault(related, set()).update({field.target_field.column, tenant_column})
                        joins = sql.SQL(" JOIN public.{} AS parent ON t.{} = parent.{}").format(
                            sql.Identifier(related),
                            sql.Identifier(field.column),
                            sql.Identifier(field.target_field.column),
                        )
                        tenant = sql.SQL("parent.{}").format(sql.Identifier(tenant_column))
                    else:
                        grants[table].add(tenant_path)
                        tenant = sql.SQL("t.{}").format(sql.Identifier(tenant_path))
                    condition = sql.SQL(
                        "{} = ANY(string_to_array(NULLIF(current_setting('eceee_diagnostics.tenant_ids', true), ''), "
                        "',')::uuid[])"
                    ).format(tenant)
                    # Include normalized ownership even on indirectly tenant-owned tables.
                    if "tenant_id" not in fields:
                        expressions.append(sql.SQL("{} AS tenant_id").format(tenant))
                for source, columns in grants.items():
                    cursor.execute(
                        sql.SQL("GRANT SELECT ({}) ON public.{} TO {}").format(
                            sql.SQL(",").join(map(sql.Identifier, sorted(columns))),
                            sql.Identifier(source),
                            sql.Identifier(OWNER_ROLE),
                        )
                    )
                cursor.execute(sql.SQL("SET LOCAL ROLE {}").format(sql.Identifier(OWNER_ROLE)))
                cursor.execute(
                    sql.SQL(
                        "CREATE OR REPLACE VIEW {}.{} WITH (security_barrier=true) "
                        "AS SELECT {} FROM public.{} t {} WHERE {}"
                    ).format(
                        sql.Identifier(SCHEMA),
                        sql.Identifier(table),
                        sql.SQL(",").join(expressions),
                        sql.Identifier(table),
                        joins,
                        condition,
                    )
                )
                cursor.execute("RESET ROLE")
                cursor.execute(
                    sql.SQL("GRANT SELECT ON {}.{} TO {}").format(
                        sql.Identifier(SCHEMA), sql.Identifier(table), sql.Identifier(READ_ROLE)
                    )
                )
            # Inherited PUBLIC grants must not make raw application tables readable/writable.
            cursor.execute(
                """SELECT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                WHERE n.nspname NOT IN ('pg_catalog','information_schema',%s)
                AND n.nspname NOT LIKE 'pg_toast%%' AND n.nspname NOT LIKE 'pg_temp_%%'
                AND c.relkind IN ('r','p','v','m','f')
                AND (has_table_privilege(%s,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
                     OR has_any_column_privilege(%s,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))""",
                [SCHEMA, READ_ROLE, READ_ROLE],
            )
            if cursor.fetchone()[0]:
                raise CommandError("Inherited privileges expose raw tables; provisioning refused.")
            cursor.execute(
                """SELECT has_database_privilege(%s,current_database(),'CREATE') OR EXISTS (
                    SELECT 1 FROM pg_namespace WHERE nspname NOT LIKE 'pg_%%'
                    AND nspname <> 'information_schema' AND has_schema_privilege(%s,oid,'CREATE'))""",
                [READ_ROLE, READ_ROLE],
            )
            if cursor.fetchone()[0]:
                raise CommandError("Inherited privileges allow persistent schema changes; provisioning refused.")
            cursor.execute(
                """SELECT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                WHERE p.prosecdef AND n.nspname NOT IN ('pg_catalog','information_schema')
                AND has_function_privilege(%s,p.oid,'EXECUTE'))""",
                [READ_ROLE],
            )
            if cursor.fetchone()[0]:
                raise CommandError("Executable security-definer routines defeat the diagnostic boundary.")
        self.stdout.write("diagnostics_database=provisioned")
