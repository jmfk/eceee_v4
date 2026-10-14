import io

import psycopg2
from django.core.management.base import CommandError
from rest_framework import status

from content.models import Namespace
from content_migration.legacy_news.database import LegacyNewsDatabase
from content_migration.legacy_news.locking import LegacyNewsImportAlreadyRunning, legacy_news_import_lock
from content_migration.legacy_news.repository import LegacyNewsDefinitionError, LegacyNewsRepository
from content_migration.management.commands.migrate_legacy_news import Command as LegacyNewsCommand
from data_connections.credentials import resolved_connection_config


def _database_config(connection):
    config = resolved_connection_config(connection)
    return {
        "host": config.get("host", "127.0.0.1"),
        "port": int(config.get("port", 10110)),
        "dbname": config.get("databaseName") or config.get("dbname") or "",
        "user": config.get("username") or config.get("user") or "",
        "password": config.get("password") or "",
        "sslmode": config.get("sslmode", "prefer"),
    }


def _missing_fields(config):
    return [name for name in ("dbname", "user", "password") if not config.get(name)]


def _connection_failure(exc, connection):
    config = connection.config or {}
    host = config.get("host", "127.0.0.1")
    port = config.get("port", 10110)
    if host in {"127.0.0.1", "localhost"}:
        instruction = (
            f"The legacy database tunnel is not reachable at {host}:{port}. "
            "Start the server-managed legacy SSH tunnel and test the connection again."
        )
    else:
        instruction = "Verify the database network allowlist, TLS mode, and read-only credentials."
    return {
        "status": "unavailable",
        "error": "The legacy PostgreSQL connection could not be established.",
        "instruction": instruction,
        "category": exc.__class__.__name__,
    }


def test_legacy_postgres_connection(connection):
    try:
        config = _database_config(connection)
    except Exception as exc:
        return {
            "status": "misconfigured",
            "error": str(exc),
            "instruction": "Replace the saved database credential and test again.",
        }, status.HTTP_503_SERVICE_UNAVAILABLE
    missing = _missing_fields(config)
    if missing:
        return {
            "status": "misconfigured",
            "error": "Required connection settings are missing.",
            "missing": missing,
            "instruction": "Enter the database name, read-only username, and password.",
        }, status.HTTP_400_BAD_REQUEST
    database = None
    try:
        database = LegacyNewsDatabase(**config)
        return {"status": "ready", "summary": database.summary()}, status.HTTP_200_OK
    except (psycopg2.Error, ValueError, TypeError) as exc:
        return _connection_failure(exc, connection), status.HTTP_400_BAD_REQUEST
    finally:
        if database:
            database.close()


class LegacyNewsImporter:
    @staticmethod
    def validate_options(tenant, options):
        namespace_slug = str(options.get("namespace") or "").strip()
        namespace = Namespace.objects.filter(tenant=tenant, slug=namespace_slug, is_active=True).first()
        if not namespace:
            raise CommandError("Select an active namespace from the current workspace.")
        try:
            limit = int(options.get("limit", 100))
        except (TypeError, ValueError) as exc:
            raise CommandError("Limit must be a number between 1 and 500.") from exc
        if not 1 <= limit <= 500:
            raise CommandError("Limit must be between 1 and 500.")
        return {
            "namespace": namespace.slug,
            "limit": limit,
            "newest_first": bool(options.get("newestFirst", options.get("newest_first", True))),
            "resume": bool(options.get("resume", True)),
        }

    @classmethod
    def preflight(cls, *, tenant, user, connection, options):
        validated = cls.validate_options(tenant, options)
        namespace = Namespace.objects.get(tenant=tenant, slug=validated["namespace"], is_active=True)
        try:
            LegacyNewsRepository(tenant=tenant, namespace=namespace, user=user)
        except LegacyNewsDefinitionError as exc:
            raise CommandError(str(exc)) from exc
        command = LegacyNewsCommand()
        command._require_sample_acceptance(tenant)
        result, _response_status = test_legacy_postgres_connection(connection)
        if result["status"] != "ready":
            raise CommandError(result.get("instruction") or result.get("error"))
        return {
            "status": "ready",
            "sourceSummary": result["summary"],
            "selection": {
                "limit": validated["limit"],
                "newestFirst": validated["newest_first"],
            },
            "target": {"namespace": namespace.slug, "objectType": "news"},
            "includesMedia": True,
            "rewritesLinks": True,
            "resumable": True,
        }

    @classmethod
    def run(cls, job):
        validated = cls.validate_options(job.tenant, job.options)
        namespace = Namespace.objects.get(
            tenant=job.tenant,
            slug=validated["namespace"],
            is_active=True,
        )
        command_output = io.StringIO()
        command = LegacyNewsCommand(stdout=command_output)
        command._require_sample_acceptance(job.tenant)
        user = job.created_by
        if not job.tenant.user_has_access(user):
            raise CommandError("The import operator no longer has access to this workspace.")
        try:
            with legacy_news_import_lock():
                result = command._import_database(
                    job.tenant,
                    namespace,
                    user,
                    {
                        "dry_run": False,
                        "limit": validated["limit"],
                        "newest_first": validated["newest_first"],
                        "resume": validated["resume"],
                        "database_config": _database_config(job.connection),
                    },
                )
        except LegacyNewsImportAlreadyRunning as exc:
            raise CommandError(str(exc)) from exc
        return {
            "counts": result or {},
            "includesMedia": True,
            "rewritesLinks": True,
        }
