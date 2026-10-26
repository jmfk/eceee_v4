"""Narrow lifecycle operations for views in the dedicated diagnostic schema."""

from django.core.management.base import CommandError
from psycopg2 import sql

from core.diagnostics.database import OWNER_ROLE, SCHEMA


def drop_diagnostic_views(cursor):
    """Remove only views owned by the diagnostic role, without cascading dependencies."""
    cursor.execute("SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname=%s", [SCHEMA])
    owner = cursor.fetchone()
    if not owner or owner[0] != OWNER_ROLE:
        raise CommandError("Diagnostic schema is missing or has an unexpected owner.")

    cursor.execute(
        """SELECT c.relname, c.relkind, pg_get_userbyid(c.relowner)
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname=%s ORDER BY c.relname""",
        [SCHEMA],
    )
    objects = cursor.fetchall()
    if any(kind != "v" or owner != OWNER_ROLE for _, kind, owner in objects):
        raise CommandError("Diagnostic schema contains an unexpected object; refusing to remove views.")
    for name, _, _ in objects:
        cursor.execute(sql.SQL("DROP VIEW {}.{}").format(sql.Identifier(SCHEMA), sql.Identifier(name)))
    return len(objects)
