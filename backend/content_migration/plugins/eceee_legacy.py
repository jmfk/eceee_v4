import io

from django.core.management.base import CommandError
from rest_framework import status

from content.models import Namespace
from content_migration.legacy_news.api import LegacyMigrationApiError, LegacyNewsApi
from content_migration.legacy_news.locking import LegacyNewsImportAlreadyRunning, legacy_news_import_lock
from content_migration.legacy_news.repository import LegacyNewsDefinitionError, LegacyNewsRepository
from content_migration.management.commands.migrate_legacy_news import Command as LegacyNewsCommand
from data_connections.credentials import resolved_connection_config


def _api_config(connection):
    config = resolved_connection_config(connection)
    return {
        "base_url": config.get("baseUrl") or config.get("base_url") or "",
        "token": config.get("token") or "",
    }


def _missing_fields(config):
    return [name for name in ("base_url", "token") if not config.get(name)]


def _connection_failure(exc):
    return {
        "status": "unavailable",
        "error": "The legacy migration API could not be reached or authenticated.",
        "instruction": "Verify the HTTPS base URL and replace the saved access key if it has expired.",
        "category": exc.__class__.__name__,
    }


def test_legacy_api_connection(connection):
    try:
        config = _api_config(connection)
    except Exception as exc:
        return {
            "status": "misconfigured",
            "error": str(exc),
            "instruction": "Replace the saved migration API access key and test again.",
        }, status.HTTP_503_SERVICE_UNAVAILABLE
    missing = _missing_fields(config)
    if missing:
        return {
            "status": "misconfigured",
            "error": "Required connection settings are missing.",
            "missing": missing,
            "instruction": "Enter the legacy migration API base URL and access key.",
        }, status.HTTP_400_BAD_REQUEST
    api = None
    try:
        api = LegacyNewsApi(**config)
        health = api.health()
        if "news" not in health.get("resources", []):
            raise LegacyMigrationApiError("The legacy API does not expose News.")
        return {"status": "ready", "summary": api.summary()}, status.HTTP_200_OK
    except (LegacyMigrationApiError, ValueError, TypeError) as exc:
        return _connection_failure(exc), status.HTTP_400_BAD_REQUEST
    finally:
        if api:
            api.close()


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
        result, _response_status = test_legacy_api_connection(connection)
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
                source = LegacyNewsApi(**_api_config(job.connection))
                result = command._import_source(
                    job.tenant,
                    namespace,
                    user,
                    {
                        "dry_run": False,
                        "limit": validated["limit"],
                        "newest_first": validated["newest_first"],
                        "resume": validated["resume"],
                        "source": source,
                    },
                )
        except LegacyNewsImportAlreadyRunning as exc:
            raise CommandError(str(exc)) from exc
        return {
            "counts": result or {},
            "includesMedia": True,
            "rewritesLinks": True,
        }
