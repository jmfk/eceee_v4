"""Expand existing canonical storage without changing authoritative legacy readers."""

import hashlib
from pathlib import Path
from uuid import UUID, uuid5

from django.core.management.base import CommandError
from django.utils.text import slugify

from content.models import Namespace
from file_manager.models import MediaCollection, MediaFile
from object_storage.models import ObjectInstance, ObjectTypeDefinition, ObjectVersion
from taxonomy.management.commands.backfill_typed_tags import Command as BackfillCommand
from taxonomy.management.commands.backfill_typed_tags import _canonical_json, _sha256
from taxonomy.models import (
    ClassificationType,
    LegacyTagMapping,
    MediaCollectionClassification,
    MediaFileClassification,
    ObjectVersionTag,
    Tag,
    TagBackfillUnit,
)

NEWS_TYPES = {
    "news_type": ("Type", "types"),
    "news_category": ("Category", "categories"),
    "news_source": ("Source", "sources"),
    "news_topic": ("Topic", "topics"),
    "news_keyword": ("Keyword", "keywords"),
}
IDENTITY_NAMESPACE = UUID("f09e4a29-32aa-4ed8-a046-d65f8abf0298")


class Command(BackfillCommand):
    help = "Reconcile canonical tag definitions, ordered media assignments and five distinct News classifications."

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.set_defaults(run_id="classification-expansion-v1")

    def _config_fingerprint(self):
        return _sha256(
            Path(__file__).read_bytes()
            + Path(__import__(BackfillCommand.__module__, fromlist=["__file__"]).__file__).read_bytes()
        )

    def _namespace(self, obj):
        namespace = obj.object_type.namespace
        if namespace is None or namespace.tenant_id != obj.tenant_id:
            namespace = self._namespace_for_tenant(obj.tenant)
        return namespace

    def _existing_tags(self):
        # Migrated news terms are outputs, not new source units on resume.
        return Tag.objects.exclude(legacy_mappings__source_kind="object").select_related("namespace").order_by("pk")

    def _work_units(self):
        for namespace in Namespace.objects.filter(kind="content").select_related("tenant").order_by("pk"):
            yield f"definition:{namespace.pk}", self._definitions, namespace
        for tag in self._existing_tags().iterator(chunk_size=self.batch_size):
            yield f"term:{tag.pk}", self._term, tag
        for kind, model, processor in [
            ("file", MediaFile, self._file),
            ("collection", MediaCollection, self._collection),
        ]:
            queryset = model.objects.with_deleted() if kind == "file" else model.objects.all()
            for obj in (
                queryset.filter(canonical_tags__isnull=False)
                .distinct()
                .order_by("pk")
                .iterator(chunk_size=self.batch_size)
            ):
                yield f"{kind}:{obj.pk}", processor, obj
        for obj in (
            ObjectInstance.objects.filter(object_type__name__in=NEWS_TYPES)
            .select_related("object_type__namespace", "tenant")
            .order_by("pk")
            .iterator(chunk_size=self.batch_size)
        ):
            yield f"news-term:{obj.pk}", self._news_term, obj
        for version in (
            ObjectVersion.objects.filter(object_instance__object_type__name="news")
            .select_related("object_instance__object_type__namespace", "object_instance__tenant")
            .order_by("pk")
            .iterator(chunk_size=self.batch_size)
        ):
            yield f"news-version:{version.pk}", self._news_version, version

    def _source_record(self, unit_id, source):
        kind = unit_id.split(":", 1)[0]
        if kind == "definition":
            return [
                source.tenant_id,
                source.kind,
                list(ObjectTypeDefinition.objects.values_list("pk", flat=True).order_by("pk")),
            ]
        if kind == "term":
            return [source.tenant_id, source.namespace_id, source.tag_type, source.name, source.slug]
        if kind in {"file", "collection"}:
            return [source.namespace_id, sorted(str(pk) for pk in source.canonical_tags.values_list("pk", flat=True))]
        if kind == "news-term":
            return [source.tenant_id, source.object_type_id, source.title, source.slug, self._namespace(source).pk]
        return [
            source.object_instance.tenant_id,
            source.object_instance_id,
            {field: source.data.get(field, []) for _, field in NEWS_TYPES.values()},
        ]

    def _source_fingerprint(self):
        digest, total = hashlib.sha256(), 0
        for unit_id, _, source in self._work_units():
            digest.update(_canonical_json([unit_id, self._source_record(unit_id, source)]).encode())
            digest.update(b"\n")
            total += 1
        return _sha256(digest.digest()), total

    def _preflight(self):
        fingerprint, total = self._source_fingerprint()
        self.stdout.write(f"Classification preflight: {total} work units. Legacy backfill must be verified first.")

    def _definitions(self, namespace):
        object_uses = [f"object:{pk}" for pk in ObjectTypeDefinition.objects.values_list("pk", flat=True)]
        definitions = []
        for key, name in [("general", "Allmänt"), *[(key, value[0]) for key, value in NEWS_TYPES.items()]]:
            definition, _ = ClassificationType.objects.get_or_create(
                tenant_id=namespace.tenant_id,
                namespace=namespace,
                key=key,
                defaults={"name": name, "allowed_uses": ["pages", "media_files", "media_collections", *object_uses]},
            )
            definitions.append(str(definition.pk))
        return {"definition_ids": definitions}

    def _definition(self, namespace, key):
        definition, _ = ClassificationType.objects.get_or_create(
            tenant_id=namespace.tenant_id,
            namespace=namespace,
            key=key,
            defaults={
                "name": "Allmänt" if key == "general" else NEWS_TYPES.get(key, (key,))[0],
                "allowed_uses": [
                    "pages",
                    "media_files",
                    "media_collections",
                    *[f"object:{pk}" for pk in ObjectTypeDefinition.objects.values_list("pk", flat=True)],
                ],
            },
        )
        return definition

    def _term(self, tag):
        definition = self._definition(tag.namespace, tag.tag_type)
        if tag.classification_type_id and tag.classification_type_id != definition.pk:
            raise ValueError("Existing term has a conflicting definition")
        Tag.objects.filter(pk=tag.pk).update(classification_type=definition)
        return {"term_id": str(tag.pk), "definition_id": str(definition.pk)}

    def _media(self, obj, model, field):
        ids = list(obj.canonical_tags.order_by("pk").values_list("pk", flat=True))
        if any(tag.namespace_id != obj.namespace_id for tag in obj.canonical_tags.all()):
            raise ValueError("Canonical media assignment crosses a namespace boundary")
        existing = list(model.objects.filter(**{field: obj}).values_list("tag_id", flat=True))
        if existing and existing != ids:
            raise ValueError("Classification assignments changed; do not overwrite editorial work")
        for position, tag_id in enumerate(ids):
            model.objects.get_or_create(**{field: obj, "tag_id": tag_id}, defaults={"position": position})
        return {"ids": [str(pk) for pk in ids]}

    def _file(self, obj):
        return self._media(obj, MediaFileClassification, "media_file")

    def _collection(self, obj):
        return self._media(obj, MediaCollectionClassification, "collection")

    def _news_term(self, obj):
        mapping = LegacyTagMapping.objects.filter(source_kind="object", source_id=str(obj.pk)).first()
        if mapping:
            return {"term_id": str(mapping.canonical_tag_id)}
        namespace = self._namespace(obj)
        definition = self._definition(namespace, obj.object_type.name)
        tag = Tag(
            id=uuid5(IDENTITY_NAMESPACE, f"{obj.tenant_id}:{namespace.pk}:{obj.pk}"),
            tenant_id=obj.tenant_id,
            namespace=namespace,
            classification_type=definition,
            tag_type=definition.key,
            name=obj.title,
            slug=slugify(obj.slug or obj.title),
            created_by=obj.created_by,
        )
        tag.full_clean()
        tag.save(force_insert=True)
        LegacyTagMapping.objects.create(
            source_kind="object", source_id=str(obj.pk), source_name=obj.title, canonical_tag=tag
        )
        return {"term_id": str(tag.pk)}

    def _news_version(self, version):
        obj = version.object_instance
        ids = []
        for key, (_, field) in NEWS_TYPES.items():
            references = version.data.get(field) or []
            references = references if isinstance(references, list) else [references]
            for reference in references:
                source = ObjectInstance.objects.get(pk=reference, tenant_id=obj.tenant_id, object_type__name=key)
                term_id = self._news_term(source)["term_id"]
                tag = Tag.objects.get(pk=term_id)
                if tag.namespace_id != self._namespace(obj).pk:
                    raise ValueError("News classification crosses a namespace boundary")
                if term_id not in ids:
                    ids.append(term_id)
        existing = [
            str(pk) for pk in ObjectVersionTag.objects.filter(object_version=version).values_list("tag_id", flat=True)
        ]
        if existing and existing != ids:
            raise ValueError("Object classifications changed; do not overwrite editorial work")
        for position, term_id in enumerate(ids):
            ObjectVersionTag.objects.get_or_create(
                object_version=version, tag_id=term_id, defaults={"position": position}
            )
        return {"ids": ids}

    def _verify(self, run, total_work_units):
        self._reconcile_run(run)
        errors = []
        if run.completed_work_units != total_work_units or run.failed_work_units:
            errors.append("not all source work units completed")
        for unit in run.units.filter(status=TagBackfillUnit.Status.COMPLETE).iterator(chunk_size=self.batch_size):
            kind, raw_pk = unit.work_unit_id.split(":", 1)
            payload = unit.payload
            if kind == "definition":
                ok = ClassificationType.objects.filter(pk__in=payload["definition_ids"]).count() == len(
                    payload["definition_ids"]
                )
            elif kind == "term":
                ok = Tag.objects.filter(pk=raw_pk, classification_type_id=payload["definition_id"]).exists()
            elif kind == "news-term":
                ok = LegacyTagMapping.objects.filter(
                    source_kind="object", source_id=raw_pk, canonical_tag_id=payload["term_id"]
                ).exists()
            else:
                model, field = {
                    "file": (MediaFileClassification, "media_file_id"),
                    "collection": (MediaCollectionClassification, "collection_id"),
                    "news-version": (ObjectVersionTag, "object_version_id"),
                }[kind]
                ok = [
                    str(pk) for pk in model.objects.filter(**{field: raw_pk}).values_list("tag_id", flat=True)
                ] == payload["ids"]
            if not ok:
                errors.append(f"assignment mismatch: {unit.work_unit_id}")
        if errors:
            raise CommandError("Classification reconciliation failed: " + "; ".join(errors[:20]))
