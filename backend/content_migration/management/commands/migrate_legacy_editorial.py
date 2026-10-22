"""Stage immutable manifests and import only drafts; no implicit production publication."""

import json
from pathlib import Path
from urllib.parse import urlsplit

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from content.models import Namespace
from content_migration.legacy_content.service import apply_run, preflight, stage
from content_migration.legacy_content.source import DEV_LIMITS, RESOURCES, EditorialSource
from content_migration.legacy_content.transform import checksum
from content_migration.legacy_news.api import LegacyMigrationApiError, LegacyNewsApi
from content_migration.management.commands.migrate_legacy_news import Command as NewsCommand
from content_migration.models import EditorialImportRun
from core.models import Tenant


class Command(BaseCommand):
    help = __doc__

    def add_arguments(self, parser):
        parser.add_argument("action", choices=["preflight", "stage", "apply", "report", "accept-sample"])
        parser.add_argument("--tenant", required=True)
        parser.add_argument("--namespace", default="default")
        parser.add_argument("--user", default="codex-content-import")
        parser.add_argument("--source-env", type=Path, default=Path(".env.legacy"))
        parser.add_argument("--resources", default=",".join(RESOURCES))
        parser.add_argument("--preset", choices=["dev", "all"], default="dev")
        parser.add_argument("--limit", type=int, help="Bound each resource for a smaller dev sample")
        parser.add_argument("--run")
        parser.add_argument("--accepted-sample-run")
        parser.add_argument("--inventory", action="store_true", help="Include read-only source counts in preflight")
        parser.add_argument(
            "--mapping", type=Path, help="Reviewed term mappings and explicit source exclusions; no credentials"
        )
        parser.add_argument(
            "--legacy-news-compatible",
            action="store_true",
            help="Dev-only old News API subset; never a full production manifest",
        )
        parser.add_argument("--confirm-manifest", help="Exact run hash for accepting a visually reviewed sample")

    def handle(self, *args, **options):
        try:
            self.execute_action(options)
        except (
            ValueError,
            LegacyMigrationApiError,
            Tenant.DoesNotExist,
            Namespace.DoesNotExist,
            get_user_model().DoesNotExist,
        ) as error:
            raise CommandError(str(error)) from None

    def execute_action(self, o):
        tenant = Tenant.objects.get(identifier=o["tenant"], is_active=True)
        namespace = Namespace.objects.get(tenant=tenant, slug=o["namespace"], is_active=True)
        user = get_user_model().objects.get(username=o["user"], is_active=True)
        definitions, facets, fingerprint = preflight(tenant, namespace, user)
        if o["action"] in {"apply", "report", "accept-sample"}:
            if not o["run"]:
                raise CommandError("--run is required")
            run = EditorialImportRun.objects.get(pk=o["run"], tenant=tenant, namespace=namespace)
            if o["action"] == "apply":
                report = apply_run(run, user)
            elif o["action"] == "accept-sample":
                if run.preset != "dev" or run.status != "complete" or not run.items.exists():
                    raise CommandError("Only a completed non-empty dev sample can be accepted")
                if run.configuration.get("compatibility") or run.configuration.get("sourceScopeVerified") is False:
                    raise CommandError("The old News compatibility sample cannot approve a full editorial import")
                if o["confirm_manifest"] != run.manifest_hash:
                    raise CommandError("Confirm the exact visually reviewed manifest hash")
                run.reviewed_at = timezone.now()
                run.reviewed_by = user
                run.save(update_fields=["reviewed_at", "reviewed_by", "updated_at"])
                report = {"sample": "accepted"}
            else:
                report = {
                    "items": list(
                        run.items.values("resource", "source_id", "status", "error_category", "object_instance_id")
                    )
                }
            self.stdout.write(
                json.dumps(
                    {"runId": str(run.pk), "status": run.status, "manifestHash": run.manifest_hash, "report": report}
                )
            )
            return
        config = NewsCommand._legacy_api_config(o["source_env"])
        source = EditorialSource(**config)
        health = source.health()
        available = source.available(health)
        if o["action"] == "preflight":
            inventory = (
                {resource: source.content_summary(resource) for resource in sorted(available)}
                if o["inventory"]
                else None
            )
            if inventory and len({row["sourceSite"] for row in inventory.values()}) > 1:
                raise CommandError("Editorial inventory has mixed source site scopes")
            self.stdout.write(
                json.dumps(
                    {
                        "definitions": "ready",
                        "definitionHash": fingerprint,
                        "availableResources": sorted(available),
                        "missingResources": sorted(set(RESOURCES) - available),
                        "legacyNewsAvailable": "news" in health.get("resources", []),
                        **({"inventory": inventory} if inventory is not None else {}),
                    }
                )
            )
            return
        resources = o["resources"].split(",")
        if len(resources) != len(set(resources)) or any(r not in RESOURCES for r in resources):
            raise CommandError("Choose explicit supported resources")
        if o["preset"] == "all" and o["limit"] is not None:
            raise CommandError("--limit cannot restrict an all preset")
        if o["limit"] is not None and not 1 <= o["limit"] <= 100:
            raise CommandError("--limit must be between 1 and 100")
        mapping = json.loads(o["mapping"].read_text()) if o["mapping"] else {}
        if o["preset"] == "all" and (not o["accepted_sample_run"] or not o["mapping"]):
            raise CommandError("Full import requires a reviewed sample run and explicit reviewed mapping file")
        records = []
        if o["legacy_news_compatible"]:
            if not settings.DEBUG or o["preset"] != "dev" or resources != ["news"]:
                raise CommandError("Old News compatibility is restricted to a dev-only News subset")
            old = LegacyNewsApi(**config)
            for row in old.iter_published(limit=o["limit"] or 100, newest_first=True):
                source_url = NewsCommand._legacy_source_url(row.slug, row.presentational_publishing_date)
                record = {
                    "legacyId": row.legacy_id,
                    "sourceModel": "eceeenews.eceeenews",
                    "sourceSite": 0,
                    "sourceUrl": source_url,
                    "title": row.title,
                    "slug": row.slug,
                    "summary": row.summary,
                    "content": row.content,
                    "status": 2,
                    "isPublic": True,
                    "publishDate": row.publish_date.isoformat() if row.publish_date else None,
                    "expiryDate": row.expiry_date.isoformat() if row.expiry_date else None,
                    "presentationalPublishingDate": (
                        row.presentational_publishing_date.isoformat() if row.presentational_publishing_date else None
                    ),
                    "featured": row.featured,
                    "data": {
                        "sourceDate": row.source_date.isoformat() if row.source_date else None,
                        "externalUrl": row.external_url,
                    },
                    "taxonomy": {
                        key: [
                            {
                                "model": "legacy-news-v1." + key,
                                "id": checksum(value)[:24],
                                "name": value,
                                "parentId": None,
                            }
                            for value in values
                        ]
                        for key, values in row.taxonomy.items()
                    },
                    "attachments": [],
                }
                records.append(("news", record))
            mapping = {
                **mapping,
                "compatibility": "legacy-news-v1",
                "sourceScopeVerified": False,
                "warnings": [
                    "Old API omits source site and original taxonomy IDs; these bindings are dev-only "
                    "and must not be promoted as a full production manifest."
                ],
            }
        else:
            if set(resources) - available:
                raise CommandError(
                    "Legacy API requires deployed content resources: " + ",".join(sorted(set(resources) - available))
                )
            for resource in resources:
                limit = None if o["preset"] == "all" else o["limit"] or DEV_LIMITS[resource]
                records.extend((resource, row) for row in source.iter_content(resource, limit=limit))
            known = {str(row["legacyId"]) for resource, row in records if resource == "columnists"}
            required = {
                str(pk) for resource, row in records if resource == "columns" for pk in row["data"].get("authorIds", [])
            }
            missing = sorted(required - known, key=int)
            if missing and "columnists" not in available:
                raise CommandError("Columnist dependency resource is unavailable")
            for offset in range(0, len(missing), 100):
                records.extend(
                    ("columnists", row) for row in source.iter_content("columnists", ids=missing[offset : offset + 100])
                )
        source_sites = {row["sourceSite"] for _, row in records}
        if len(source_sites) > 1:
            raise CommandError("Mixed legacy site scopes are not accepted")
        scope = urlsplit(config["base_url"]).hostname + ":site:" + str(next(iter(source_sites), "empty"))
        configuration = {
            **mapping,
            "mappingHash": checksum(mapping),
            "resources": resources,
            "limits": None if o["preset"] == "all" else o["limit"] or DEV_LIMITS,
            "acceptedSampleRun": o["accepted_sample_run"],
        }
        if not records:
            raise CommandError("The selected source manifest is empty")
        run = stage(
            tenant=tenant,
            namespace=namespace,
            user=user,
            source_scope=scope,
            records=records,
            preset=o["preset"],
            configuration=configuration,
        )
        self.stdout.write(
            json.dumps(
                {
                    "runId": str(run.pk),
                    "status": run.status,
                    "manifestHash": run.manifest_hash,
                    "counts": {resource: sum(r == resource for r, _ in records) for resource in resources},
                    "compatibility": mapping.get("compatibility"),
                }
            )
        )
