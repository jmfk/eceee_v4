"""Import legacy News from the approved sample manifest or read-only database."""

from __future__ import annotations

import json
import stat
from dataclasses import replace
from html import escape
from pathlib import Path

from bs4 import BeautifulSoup
from decouple import Config, RepositoryEnv, UndefinedValueError
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from content.models import Namespace
from content_migration.legacy_news.database import LegacyNewsDatabase
from content_migration.legacy_news.extractor import extract_news_html
from content_migration.legacy_news.fetcher import ManifestFetcher
from content_migration.legacy_news.media import LegacyMediaImporter
from content_migration.legacy_news.preview import ensure_news_preview_page
from content_migration.legacy_news.repository import (
    LegacyNewsDefinitionError,
    LegacyNewsRepository,
)
from content_migration.legacy_news.transformer import build_payload
from core.models import Tenant
from object_storage.models import ObjectTypeDefinition

DEFAULT_MANIFEST = Path(__file__).parents[2] / "legacy_news" / "samples" / "manifest.json"


class Command(BaseCommand):
    help = "Idempotently migrate legacy News using the golden sample or read-only legacy PostgreSQL"

    def add_arguments(self, parser):
        source = parser.add_mutually_exclusive_group(required=True)
        source.add_argument("--sample-manifest", nargs="?", const=str(DEFAULT_MANIFEST))
        source.add_argument("--database", action="store_true")
        parser.add_argument("--tenant", required=True, help="Target Tenant identifier")
        parser.add_argument(
            "--namespace",
            help="Target Namespace slug; defaults to the tenant's first active namespace",
        )
        parser.add_argument("--user", help="Creator username; defaults to the tenant creator")
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument(
            "--resume",
            action="store_true",
            help="Retry placeholder media and continue idempotently",
        )
        parser.add_argument("--limit", type=int)
        parser.add_argument("--env-file", default=".env.local")
        parser.add_argument(
            "--accept-golden-sample",
            action="store_true",
            help="Record explicit sample acceptance after visual review (sample mode only)",
        )

    def handle(self, *args, **options):
        if options["dry_run"]:
            if options["accept_golden_sample"]:
                raise CommandError("Cannot accept the golden sample during a dry run")
            if options["sample_manifest"]:
                return self._import_manifest(Path(options["sample_manifest"]), None, None, None, options)
            return self._import_database(None, None, None, options)
        tenant = self._tenant(options["tenant"])
        namespace = self._namespace(tenant, options.get("namespace"))
        user = self._user(tenant, options.get("user"))
        if not tenant.user_has_access(user):
            raise CommandError("User is not authorized for the target tenant")
        if options["sample_manifest"]:
            return self._import_manifest(Path(options["sample_manifest"]), tenant, namespace, user, options)
        if options["accept_golden_sample"]:
            raise CommandError("--accept-golden-sample is only valid with --sample-manifest")
        self._require_sample_acceptance(tenant)
        return self._import_database(tenant, namespace, user, options)

    def _import_manifest(self, manifest_path, tenant, namespace, user, options):
        manifest_path = manifest_path.resolve()
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise CommandError(f"Cannot load sample manifest: {exc}") from exc
        entries = manifest.get("samples", [])
        if options.get("limit"):
            entries = entries[: options["limit"]]
        fetcher = ManifestFetcher(crawl_delay=float(manifest.get("crawlDelaySeconds", 10)))
        repository = None if options["dry_run"] else self._repository(tenant=tenant, namespace=namespace, user=user)
        counts = {"created": 0, "updated": 0, "unchanged": 0, "validated": 0}
        fingerprints = []

        for entry in entries:
            source_url = entry.get("url") or entry.get("sourceUrl")
            html = fetcher.fetch(
                url=entry.get("url", ""),
                fixture=entry.get("fixture", ""),
                manifest_dir=manifest_path.parent,
            )
            article = extract_news_html(html, source_url, entry["slug"])
            self._check_expected(article, entry.get("expected", {}))
            fingerprints.append(
                {
                    "id": entry["id"],
                    "slug": article.slug,
                    "content_checksum": article.content_checksum,
                }
            )
            counts["validated"] += 1
            if options["dry_run"]:
                self.stdout.write(f"VALID {article.slug}: {article.title} ({len(article.image_urls)} images)")
                continue

            local_assets = {}
            if entry.get("fixture"):
                for image_url in article.image_urls:
                    candidate = manifest_path.parent / Path(image_url.split("?", 1)[0]).name
                    if candidate.exists():
                        local_assets[image_url] = candidate
            media_importer = LegacyMediaImporter(
                namespace=namespace, tenant=tenant, user=user, local_assets=local_assets
            )
            media_by_url = {
                image_url: media_importer.import_image(
                    image_url, article_identity=article.slug, resume=options["resume"]
                )
                for image_url in article.image_urls
            }
            taxonomy = {"sources": [article.source_name] if article.source_name else []}
            payload = build_payload(article, media_by_url=media_by_url, taxonomy=taxonomy)
            payload = replace(
                payload,
                metadata={
                    **payload.metadata,
                    "legacy_sample_id": entry["id"],
                    "synthetic": bool(entry.get("synthetic")),
                },
            )
            _, created, changed = repository.upsert(payload)
            counts["created" if created else "updated" if changed else "unchanged"] += 1
            self.stdout.write(
                f"IMPORTED {article.slug}: {'created' if created else 'updated' if changed else 'unchanged'}"
            )

        if repository:
            ensure_news_preview_page(
                tenant=tenant,
                user=user,
                news_object_type_id=repository.object_types["news"].id,
            )
            self.stdout.write("Preview route: /migration-preview/news/<slug>/")
            news_type = repository.object_types["news"]
            metadata = dict(news_type.metadata or {})
            if options["accept_golden_sample"]:
                metadata["legacy_news_golden_sample"] = {
                    "status": "accepted",
                    "accepted_at": timezone.now().isoformat(),
                    "accepted_by": user.username,
                    "fingerprints": fingerprints,
                }
                self.stdout.write(self.style.SUCCESS("Golden sample acceptance recorded"))
            elif counts["created"] or counts["updated"]:
                metadata["legacy_news_golden_sample"] = {
                    "status": "pending-review",
                    "fingerprints": fingerprints,
                }
            news_type.metadata = metadata
            news_type.save(update_fields=["metadata", "updated_at"])
        self.stdout.write(self.style.SUCCESS("Golden sample result: " + json.dumps(counts, sort_keys=True)))

    def _import_database(self, tenant, namespace, user, options):
        config = self._legacy_config(Path(options["env_file"]))
        database = LegacyNewsDatabase(**config)
        try:
            summary = database.summary()
            self.stdout.write("Legacy read-only summary: " + json.dumps(summary, default=str, sort_keys=True))
            if options["dry_run"]:
                return self._reconcile_database_rows(database, summary, limit=options.get("limit"))
            repository = self._repository(tenant=tenant, namespace=namespace, user=user)
            counts = {"created": 0, "updated": 0, "unchanged": 0}
            for row in database.iter_published(limit=options.get("limit")):
                article = self._article_from_database_row(row)
                media_importer = LegacyMediaImporter(namespace=namespace, tenant=tenant, user=user)
                media_by_url = {
                    image_url: media_importer.import_image(
                        image_url,
                        article_identity=str(row.legacy_id),
                        resume=options["resume"],
                    )
                    for image_url in article.image_urls
                }
                payload = build_payload(article, media_by_url=media_by_url, taxonomy=row.taxonomy)
                data = self._database_payload_data(payload, row)
                payload = replace(
                    payload,
                    data=data,
                    metadata={**payload.metadata, "legacy_id": row.legacy_id},
                )
                _, created, changed = repository.upsert(
                    payload,
                    published_at=row.publish_date or row.presentational_publishing_date,
                    expires_at=row.expiry_date,
                    featured=row.featured,
                )
                counts["created" if created else "updated" if changed else "unchanged"] += 1
            self.stdout.write(self.style.SUCCESS("Database import result: " + json.dumps(counts, sort_keys=True)))
        finally:
            database.close()

    def _reconcile_database_rows(self, database, summary, *, limit=None):
        taxonomy_counts = {field_name: 0 for field_name in ("types", "categories", "sources", "topics", "keywords")}
        observed = {
            "eligible": 0,
            "transformed": 0,
            "with_expiry": 0,
            "featured": 0,
            "with_images": 0,
            "with_source_date": 0,
            "with_external_url": 0,
            "media_references": 0,
            "unique_media_references": 0,
            "taxonomy_assignments": taxonomy_counts,
            "errors": [],
        }
        media_urls = set()
        for row in database.iter_published(limit=limit):
            observed["eligible"] += 1
            observed["with_expiry"] += int(row.expiry_date is not None)
            observed["featured"] += int(row.featured)
            observed["with_source_date"] += int(row.source_date is not None)
            observed["with_external_url"] += int(bool(row.external_url))
            for field_name in taxonomy_counts:
                taxonomy_counts[field_name] += len(row.taxonomy.get(field_name, []))
            try:
                article = self._article_from_database_row(row)
                payload = build_payload(article, media_by_url={}, taxonomy=row.taxonomy)
                self._database_payload_data(payload, row)
                observed["transformed"] += 1
                observed["with_images"] += int(bool(article.image_urls))
                observed["media_references"] += len(article.image_urls)
                media_urls.update(article.image_urls)
            except Exception as exc:
                observed["errors"].append(
                    {"legacy_id": row.legacy_id, "slug": row.slug, "error": exc.__class__.__name__}
                )
        observed["unique_media_references"] = len(media_urls)

        mismatches = []
        if limit is None:
            expected_counts = {
                "eligible": summary["published"],
                "with_expiry": summary["with_expiry"],
                "featured": summary["featured"],
                "with_images": summary["with_images"],
                "with_source_date": summary["with_source_date"],
                "with_external_url": summary["with_external_url"],
            }
            for field_name, expected in expected_counts.items():
                if observed[field_name] != expected:
                    mismatches.append({"field": field_name, "expected": expected, "observed": observed[field_name]})
            assignment_summary_fields = {
                "types": "type_assignments",
                "categories": "category_assignments",
                "sources": "source_assignments",
                "topics": "topic_assignments",
                "keywords": "keyword_assignments",
            }
            for field_name, summary_field in assignment_summary_fields.items():
                expected = summary[summary_field]
                if taxonomy_counts[field_name] != expected:
                    mismatches.append(
                        {
                            "field": f"{field_name}_assignments",
                            "expected": expected,
                            "observed": taxonomy_counts[field_name],
                        }
                    )

        result = {"bounded_by_limit": limit, "observed": observed, "mismatches": mismatches}
        self.stdout.write("Legacy dry-run reconciliation: " + json.dumps(result, default=str, sort_keys=True))
        if observed["errors"] or mismatches:
            raise CommandError("Legacy database dry-run found transformation errors or count mismatches")
        self.stdout.write(self.style.SUCCESS("Legacy database dry-run passed without writes"))

    @staticmethod
    def _database_payload_data(payload, row):
        return {
            **payload.data,
            "presentationalPublishingDate": (
                row.presentational_publishing_date.isoformat() if row.presentational_publishing_date else None
            ),
            "sourceDate": row.source_date.date().isoformat() if row.source_date else None,
        }

    def _article_from_database_row(self, row):
        source_url = self._legacy_source_url(row.slug, row.presentational_publishing_date)
        source_names = row.taxonomy.get("sources", [])
        date_value = row.source_date or row.presentational_publishing_date
        date_text = date_value.strftime("%d %b %Y") if date_value else ""
        source_text = ", ".join(source_names)
        html = (
            '<div class="mainContentColumn">'
            f"<h1>{escape(row.title)}</h1>"
            f'<p class="news_intro">({escape(source_text)}, {escape(date_text)}) {escape(row.summary)}</p>'
            f"{row.content}"
            + (
                '<h3>External link</h3><p><a href="' f'{escape(row.external_url, quote=True)}">Original source</a></p>'
                if row.external_url
                else ""
            )
            + "</div>"
        )
        return extract_news_html(html, source_url, row.slug)

    @staticmethod
    def _check_expected(article, expected):
        body = BeautifulSoup(article.body_html, "html.parser")
        if expected.get("hasExternalUrl") is True and not article.external_url:
            raise CommandError(f"Sample {article.slug} expected an external URL")
        if expected.get("hasExternalUrl") is False and article.external_url:
            raise CommandError(f"Sample {article.slug} unexpectedly has an external URL")
        if expected.get("hasSourceDate") and not article.source_date:
            raise CommandError(f"Sample {article.slug} expected a source date")
        if expected.get("source") and article.source_name != expected["source"]:
            raise CommandError(f"Sample {article.slug} source mismatch: {article.source_name!r}")
        if expected.get("minimumBodyCharacters") and len(article.body_html) < expected["minimumBodyCharacters"]:
            raise CommandError(f"Sample {article.slug} body is unexpectedly short")
        if expected.get("imageCount") is not None and len(article.image_urls) != expected["imageCount"]:
            raise CommandError(f"Sample {article.slug} image count mismatch")
        if expected.get("hasLinks") and not body.find("a", href=True):
            raise CommandError(f"Sample {article.slug} expected body links")
        if expected.get("hasHeadings") and not body.find(["h2", "h3", "h4", "h5", "h6"]):
            raise CommandError(f"Sample {article.slug} expected body headings")
        if expected.get("hasLists") and not body.find(["ul", "ol"]):
            raise CommandError(f"Sample {article.slug} expected a list")
        if expected.get("hasTable") and not body.find("table"):
            raise CommandError(f"Sample {article.slug} expected a table")
        for forbidden in expected.get("forbiddenAttributes", []):
            if body.find(attrs={forbidden: True}):
                raise CommandError(f"Sample {article.slug} retained forbidden {forbidden!r} attributes")

    @staticmethod
    def _legacy_config(env_path: Path):
        if not env_path.exists():
            raise CommandError(f"Legacy database environment file is missing: {env_path}")
        if stat.S_IMODE(env_path.stat().st_mode) & 0o077:
            raise CommandError(f"Legacy database environment file must have mode 600: {env_path}")
        config = Config(RepositoryEnv(str(env_path)))
        try:
            return {
                "host": config("LEGACY_DB_HOST", default="127.0.0.1"),
                "port": config("LEGACY_DB_PORT", cast=int, default=10110),
                "dbname": config("LEGACY_DB_NAME"),
                "user": config("LEGACY_DB_USER"),
                "password": config("LEGACY_DB_PASSWORD"),
                "sslmode": config("LEGACY_DB_SSLMODE", default="prefer"),
            }
        except UndefinedValueError as exc:
            raise CommandError("Required LEGACY_DB_* configuration is missing") from exc

    @staticmethod
    def _legacy_source_url(slug, publishing_date):
        year = publishing_date.strftime("%Y") if publishing_date else "unknown"
        return f"https://www.eceee.org/all-news/news/news-{year}/{slug}/"

    @staticmethod
    def _repository(*, tenant, namespace, user):
        try:
            return LegacyNewsRepository(tenant=tenant, namespace=namespace, user=user)
        except LegacyNewsDefinitionError as exc:
            raise CommandError(
                "Legacy News definition preflight failed. Configure the object types "
                f"in the React application before importing: {exc}"
            ) from exc

    @staticmethod
    def _require_sample_acceptance(tenant):
        object_type = ObjectTypeDefinition.objects.filter(name="news").select_related("namespace__tenant").first()
        if not object_type or not object_type.namespace_id or object_type.namespace.tenant_id != tenant.id:
            raise CommandError("The target tenant has no canonical News definition or golden sample")
        gate = (object_type.metadata or {}).get("legacy_news_golden_sample", {})
        if gate.get("status") != "accepted":
            raise CommandError(
                "Golden sample is not accepted; complete visual review and rerun sample mode with "
                "--accept-golden-sample"
            )

    @staticmethod
    def _tenant(identifier):
        try:
            return Tenant.objects.get(identifier=identifier, is_active=True)
        except Tenant.DoesNotExist as exc:
            raise CommandError(f"Active tenant not found: {identifier}") from exc

    @staticmethod
    def _namespace(tenant, slug):
        query = Namespace.objects.filter(tenant=tenant, is_active=True)
        namespace = query.filter(slug=slug).first() if slug else query.first()
        if not namespace:
            raise CommandError("Target tenant has no matching active namespace")
        return namespace

    @staticmethod
    def _user(tenant, username):
        User = get_user_model()
        if username:
            try:
                return User.objects.get(username=username)
            except User.DoesNotExist as exc:
                raise CommandError(f"User not found: {username}") from exc
        return tenant.created_by
