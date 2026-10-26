"""Explicitly remove diagnostic views before an incompatible application migration."""

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

from core.diagnostics.view_lifecycle import drop_diagnostic_views


class Command(BaseCommand):
    help = "Remove only dedicated diagnostic views before a reviewed schema change; never run automatically"

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            raise CommandError("PostgreSQL required.")
        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute("SET LOCAL lock_timeout = '5s'")
            cursor.execute("SELECT pg_advisory_xact_lock(52932521)")
            count = drop_diagnostic_views(cursor)
        self.stdout.write(f"diagnostics_views=removed count={count}")
