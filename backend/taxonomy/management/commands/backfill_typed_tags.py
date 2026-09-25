import hashlib
import json
import os
import signal
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from content.models import Namespace
from content.models import Tag as ContentTag
from file_manager.models import MediaCollection, MediaFile, MediaTag
from taxonomy.models import LegacyTagMapping, Tag, TagBackfillRun, TagBackfillUnit
from webpages.models import PageVersion, PageVersionTag

SCHEMA_VERSION = 1
DEFAULT_TAG_TYPE = "general"
SOURCE_KINDS = ("content-tag", "media-tag", "page-version", "media-file", "media-collection")


def _canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def _sha256(value):
    return f"sha256:{hashlib.sha256(value).hexdigest()}"


class Command(BaseCommand):
    help = "Backfill legacy page and media tags into the canonical typed taxonomy."

    def add_arguments(self, parser):
        parser.add_argument("--run-id", default="typed-tags-v1")
        parser.add_argument("--batch-size", type=int, default=500)
        parser.add_argument("--verify-only", action="store_true")
        parser.add_argument("--stop-after", type=int, help="Testing/operational canary limit")

    def handle(self, *args, **options):
        self.batch_size = max(1, options["batch_size"])
        self.stop_requested = False
        self._install_signal_handlers()

        run_id = options["run_id"]
        source_fingerprint, total_work_units = self._source_fingerprint()
        config_fingerprint = self._config_fingerprint()
        code_revision = os.environ.get("APP_VERSION") or os.environ.get("GIT_COMMIT_HASH") or "unknown"

        if options["verify_only"]:
            run = self._load_matching_run(run_id, source_fingerprint, config_fingerprint, code_revision)
            self._verify(run, total_work_units)
            self.stdout.write(self.style.SUCCESS(f"Verified typed-tag backfill run {run_id}"))
            return

        run, created = TagBackfillRun.objects.get_or_create(
            run_id=run_id,
            defaults={
                "schema_version": SCHEMA_VERSION,
                "source_fingerprint": source_fingerprint,
                "config_fingerprint": config_fingerprint,
                "code_revision": code_revision,
                "total_work_units": total_work_units,
                "status": TagBackfillRun.Status.PENDING,
            },
        )
        if not created:
            self._assert_run_identity(run, source_fingerprint, config_fingerprint, code_revision)

        run.status = TagBackfillRun.Status.RUNNING
        run.total_work_units = total_work_units
        run.started_at = run.started_at or timezone.now()
        run.completed_at = None
        run.save(update_fields=["status", "total_work_units", "started_at", "completed_at", "updated_at"])

        processed = 0
        for work_unit_id, processor, source in self._work_units():
            if self.stop_requested or (options["stop_after"] is not None and processed >= options["stop_after"]):
                self._finish_run(run, TagBackfillRun.Status.INTERRUPTED)
                self.stdout.write(self.style.WARNING(f"Interrupted typed-tag backfill run {run_id}"))
                return

            existing = TagBackfillUnit.objects.filter(
                run=run, work_unit_id=work_unit_id, status=TagBackfillUnit.Status.COMPLETE
            ).exists()
            if existing:
                continue

            try:
                with transaction.atomic():
                    payload = processor(source)
                    TagBackfillUnit.objects.update_or_create(
                        run=run,
                        work_unit_id=work_unit_id,
                        defaults={
                            "status": TagBackfillUnit.Status.COMPLETE,
                            "payload": payload,
                            "error": "",
                        },
                    )
            except Exception as exc:
                TagBackfillUnit.objects.update_or_create(
                    run=run,
                    work_unit_id=work_unit_id,
                    defaults={
                        "status": TagBackfillUnit.Status.FAILED,
                        "payload": {},
                        "error": f"{type(exc).__name__}: {exc}",
                    },
                )
            processed += 1
            if processed % self.batch_size == 0:
                self._reconcile_run(run)
                self.stdout.write(self._progress_line(run))

        final_fingerprint, final_total = self._source_fingerprint()
        if final_fingerprint != source_fingerprint or final_total != total_work_units:
            self._finish_run(run, TagBackfillRun.Status.FAILED)
            raise CommandError(
                "Legacy tag sources changed during the backfill; start a new run ID for the new source snapshot."
            )

        self._reconcile_run(run)
        if run.failed_work_units:
            self._finish_run(run, TagBackfillRun.Status.FAILED)
            raise CommandError(
                f"Backfill recorded {run.failed_work_units} failed work unit(s); "
                "correct the cause and resume the same run."
            )
        if run.completed_work_units != total_work_units:
            self._finish_run(run, TagBackfillRun.Status.FAILED)
            raise CommandError("Backfill did not durably account for every work unit.")

        self._verify(run, total_work_units)
        self._finish_run(run, TagBackfillRun.Status.COMPLETE)
        self.stdout.write(self.style.SUCCESS(self._progress_line(run)))

    def _install_signal_handlers(self):
        def request_stop(signum, frame):
            self.stop_requested = True

        signal.signal(signal.SIGINT, request_stop)
        signal.signal(signal.SIGTERM, request_stop)

    def _config_fingerprint(self):
        command_bytes = Path(__file__).read_bytes()
        config = _canonical_json(
            {
                "schema_version": SCHEMA_VERSION,
                "default_tag_type": DEFAULT_TAG_TYPE,
                "source_kinds": SOURCE_KINDS,
                "command_sha256": hashlib.sha256(command_bytes).hexdigest(),
            }
        ).encode()
        return _sha256(config)

    def _source_fingerprint(self):
        digest = hashlib.sha256()
        total = 0

        def record(kind, values):
            nonlocal total
            digest.update(_canonical_json([kind, *values]).encode())
            digest.update(b"\n")
            total += 1

        for row in (
            ContentTag.objects.order_by("pk")
            .values_list("pk", "tenant_id", "namespace_id", "name", "slug")
            .iterator(chunk_size=self.batch_size)
        ):
            record("content-tag", row)
        for row in (
            MediaTag.objects.order_by("pk")
            .values_list("pk", "namespace_id", "name", "slug", "color", "description", "created_by_id")
            .iterator(chunk_size=self.batch_size)
        ):
            record("media-tag", row)
        for version in (
            PageVersion.objects.select_related("page")
            .order_by("pk")
            .only("pk", "tags", "page__tenant_id")
            .iterator(chunk_size=self.batch_size)
        ):
            if not version.tags:
                continue
            record("page-version", (version.pk, version.page.tenant_id, version.tags))
        for media_file in (
            MediaFile.objects.with_deleted()
            .filter(tags__isnull=False)
            .distinct()
            .order_by("pk")
            .iterator(chunk_size=self.batch_size)
        ):
            tag_ids = list(media_file.tags.order_by("pk").values_list("pk", flat=True))
            record(
                "media-file",
                (media_file.pk, media_file.tenant_id, media_file.namespace_id, tag_ids),
            )
        for collection in (
            MediaCollection.objects.filter(tags__isnull=False)
            .distinct()
            .order_by("pk")
            .iterator(chunk_size=self.batch_size)
        ):
            tag_ids = list(collection.tags.order_by("pk").values_list("pk", flat=True))
            record("media-collection", (collection.pk, collection.namespace_id, tag_ids))
        return _sha256(digest.digest()), total

    def _work_units(self):
        for obj in (
            ContentTag.objects.select_related("namespace", "tenant").order_by("pk").iterator(chunk_size=self.batch_size)
        ):
            yield f"content-tag:{obj.pk}", self._backfill_content_tag, obj
        for obj in (
            MediaTag.objects.select_related("namespace__tenant", "created_by")
            .order_by("pk")
            .iterator(chunk_size=self.batch_size)
        ):
            yield f"media-tag:{obj.pk}", self._backfill_media_tag, obj
        for obj in (
            PageVersion.objects.select_related("page__tenant").order_by("pk").iterator(chunk_size=self.batch_size)
        ):
            if not obj.tags:
                continue
            yield f"page-version:{obj.pk}", self._backfill_page_version, obj
        for obj in (
            MediaFile.objects.with_deleted()
            .filter(tags__isnull=False)
            .distinct()
            .select_related("tenant", "namespace__tenant")
            .prefetch_related("tags")
            .order_by("pk")
            .iterator(chunk_size=self.batch_size)
        ):
            yield f"media-file:{obj.pk}", self._backfill_media_file, obj
        for obj in (
            MediaCollection.objects.filter(tags__isnull=False)
            .distinct()
            .select_related("namespace__tenant")
            .prefetch_related("tags")
            .order_by("pk")
            .iterator(chunk_size=self.batch_size)
        ):
            yield f"media-collection:{obj.pk}", self._backfill_media_collection, obj

    def _namespace_for_tenant(self, tenant):
        namespace = Namespace.objects.filter(tenant=tenant, is_default=True).first()
        namespace = namespace or Namespace.objects.filter(tenant=tenant, is_active=True).order_by("pk").first()
        if not namespace:
            raise ValueError(f"Tenant {tenant.pk} has no active namespace")
        return namespace

    def _canonical_tag(self, *, name, namespace, color="#3B82F6", description="", created_by=None):
        if namespace.tenant_id is None:
            raise ValueError(f"Namespace {namespace.pk} has no tenant")
        slug = slugify(name)
        if not slug:
            raise ValueError(f"Tag name {name!r} has no usable slug")
        tag, created = Tag.objects.get_or_create(
            tenant_id=namespace.tenant_id,
            namespace=namespace,
            tag_type=DEFAULT_TAG_TYPE,
            slug=slug,
            defaults={
                "name": name.strip(),
                "color": color or "#3B82F6",
                "description": description or "",
                "created_by": created_by,
            },
        )
        if not created:
            update_fields = []
            if tag.color == "#3B82F6" and color and color != tag.color:
                tag.color = color
                update_fields.append("color")
            if not tag.description and description:
                tag.description = description
                update_fields.append("description")
            if tag.created_by_id is None and created_by is not None:
                tag.created_by = created_by
                update_fields.append("created_by")
            if update_fields:
                tag.save(update_fields=[*update_fields, "updated_at"])
        return tag

    def _map_legacy(self, source_kind, source, canonical_tag):
        mapping, created = LegacyTagMapping.objects.get_or_create(
            source_kind=source_kind,
            source_id=str(source.pk),
            defaults={"canonical_tag": canonical_tag, "source_name": source.name},
        )
        if not created and mapping.canonical_tag_id != canonical_tag.pk:
            raise ValueError(f"Legacy {source_kind} tag {source.pk} maps to a different canonical tag")
        return mapping

    def _backfill_content_tag(self, source):
        namespace = source.namespace or self._namespace_for_tenant(source.tenant)
        if namespace.tenant_id != source.tenant_id:
            raise ValueError("Content tag tenant does not match namespace tenant")
        tag = self._canonical_tag(name=source.name, namespace=namespace)
        self._map_legacy(LegacyTagMapping.SourceKind.CONTENT, source, tag)
        return {"canonical_tag_id": str(tag.pk)}

    def _backfill_media_tag(self, source):
        tag = self._canonical_tag(
            name=source.name,
            namespace=source.namespace,
            color=source.color,
            description=source.description,
            created_by=source.created_by,
        )
        self._map_legacy(LegacyTagMapping.SourceKind.MEDIA, source, tag)
        return {"canonical_tag_id": str(tag.pk)}

    def _canonical_for_page_name(self, version, name):
        legacy = ContentTag.objects.filter(tenant=version.page.tenant, name__iexact=name.strip()).order_by("pk").first()
        if legacy:
            mapping = (
                LegacyTagMapping.objects.filter(
                    source_kind=LegacyTagMapping.SourceKind.CONTENT, source_id=str(legacy.pk)
                )
                .select_related("canonical_tag")
                .first()
            )
            if mapping:
                return mapping.canonical_tag
            self._backfill_content_tag(legacy)
            return LegacyTagMapping.objects.get(
                source_kind=LegacyTagMapping.SourceKind.CONTENT, source_id=str(legacy.pk)
            ).canonical_tag
        namespace = self._namespace_for_tenant(version.page.tenant)
        return self._canonical_tag(name=name, namespace=namespace)

    def _backfill_page_version(self, version):
        canonical_ids = [str(self._canonical_for_page_name(version, name).pk) for name in version.tags]
        PageVersionTag.objects.filter(page_version=version).delete()
        PageVersionTag.objects.bulk_create(
            [
                PageVersionTag(page_version=version, tag_id=tag_id, position=position)
                for position, tag_id in enumerate(canonical_ids)
            ]
        )
        return {"canonical_tag_ids": canonical_ids}

    def _canonical_for_media_tag(self, media_tag):
        mapping = (
            LegacyTagMapping.objects.filter(source_kind=LegacyTagMapping.SourceKind.MEDIA, source_id=str(media_tag.pk))
            .select_related("canonical_tag")
            .first()
        )
        if mapping:
            return mapping.canonical_tag
        self._backfill_media_tag(media_tag)
        return LegacyTagMapping.objects.get(
            source_kind=LegacyTagMapping.SourceKind.MEDIA, source_id=str(media_tag.pk)
        ).canonical_tag

    def _backfill_media_file(self, media_file):
        if media_file.tenant_id != media_file.namespace.tenant_id:
            raise ValueError("Media file tenant does not match namespace tenant")
        canonical_ids = [str(self._canonical_for_media_tag(tag).pk) for tag in media_file.tags.all()]
        media_file.canonical_tags.set(canonical_ids)
        return {"canonical_tag_ids": sorted(canonical_ids)}

    def _backfill_media_collection(self, collection):
        canonical_ids = [str(self._canonical_for_media_tag(tag).pk) for tag in collection.tags.all()]
        collection.canonical_tags.set(canonical_ids)
        return {"canonical_tag_ids": sorted(canonical_ids)}

    def _load_matching_run(self, run_id, source_fingerprint, config_fingerprint, code_revision):
        try:
            run = TagBackfillRun.objects.get(pk=run_id)
        except TagBackfillRun.DoesNotExist as exc:
            raise CommandError(f"Backfill run {run_id!r} does not exist") from exc
        self._assert_run_identity(run, source_fingerprint, config_fingerprint, code_revision)
        return run

    def _assert_run_identity(self, run, source_fingerprint, config_fingerprint, code_revision):
        expected = (SCHEMA_VERSION, source_fingerprint, config_fingerprint, code_revision)
        actual = (run.schema_version, run.source_fingerprint, run.config_fingerprint, run.code_revision)
        if actual != expected:
            raise CommandError("Run identity does not match the current source/configuration/code; use a new run ID.")

    def _reconcile_run(self, run):
        run.completed_work_units = run.units.filter(status=TagBackfillUnit.Status.COMPLETE).count()
        run.failed_work_units = run.units.filter(status=TagBackfillUnit.Status.FAILED).count()
        run.save(update_fields=["completed_work_units", "failed_work_units", "updated_at"])
        run.refresh_from_db()

    def _finish_run(self, run, status):
        self._reconcile_run(run)
        run.status = status
        run.completed_at = timezone.now() if status == TagBackfillRun.Status.COMPLETE else None
        run.save(update_fields=["status", "completed_at", "updated_at"])

    def _progress_line(self, run):
        total = run.total_work_units
        percent = (run.completed_work_units / total * 100) if total else 100
        return (
            f"run={run.run_id} status={run.status} completed={run.completed_work_units}/{total} "
            f"({percent:.1f}%) failed={run.failed_work_units}"
        )

    def _verify(self, run, total_work_units):
        self._reconcile_run(run)
        errors = []
        if run.total_work_units != total_work_units:
            errors.append("stored total does not match current source total")
        if run.completed_work_units != total_work_units:
            errors.append("not every source work unit is complete")
        if run.failed_work_units:
            errors.append(f"{run.failed_work_units} work unit(s) are failed")

        for unit in run.units.filter(status=TagBackfillUnit.Status.COMPLETE).iterator(chunk_size=self.batch_size):
            kind, raw_pk = unit.work_unit_id.split(":", 1)
            payload = unit.payload
            if kind == "content-tag":
                ok = LegacyTagMapping.objects.filter(
                    source_kind=LegacyTagMapping.SourceKind.CONTENT,
                    source_id=raw_pk,
                    canonical_tag_id=payload.get("canonical_tag_id"),
                ).exists()
            elif kind == "media-tag":
                ok = LegacyTagMapping.objects.filter(
                    source_kind=LegacyTagMapping.SourceKind.MEDIA,
                    source_id=raw_pk,
                    canonical_tag_id=payload.get("canonical_tag_id"),
                ).exists()
            elif kind == "page-version":
                actual = [
                    str(value)
                    for value in PageVersionTag.objects.filter(page_version_id=raw_pk)
                    .order_by("position")
                    .values_list("tag_id", flat=True)
                ]
                ok = actual == payload.get("canonical_tag_ids", [])
            elif kind == "media-file":
                actual = sorted(
                    str(value)
                    for value in MediaFile.objects.with_deleted()
                    .get(pk=raw_pk)
                    .canonical_tags.values_list("pk", flat=True)
                )
                ok = actual == payload.get("canonical_tag_ids", [])
            elif kind == "media-collection":
                actual = sorted(
                    str(value)
                    for value in MediaCollection.objects.get(pk=raw_pk).canonical_tags.values_list("pk", flat=True)
                )
                ok = actual == payload.get("canonical_tag_ids", [])
            else:
                ok = False
            if not ok:
                errors.append(f"relation mismatch for {unit.work_unit_id}")
                if len(errors) >= 20:
                    break

        if errors:
            raise CommandError("Backfill verification failed: " + "; ".join(errors))
