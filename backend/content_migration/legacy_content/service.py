"""One-item transactions, stable source bindings and draft-only editorial import."""

import hashlib
from collections import Counter
from contextlib import contextmanager
from copy import deepcopy

from django.db import connection, transaction
from django.utils.text import slugify
from rest_framework.exceptions import PermissionDenied

from content_migration.legacy_news.media import LegacyMediaImporter
from content_migration.models import EditorialImportBinding, EditorialImportItem, EditorialImportRun
from object_storage.models import ObjectInstance, ObjectTypeDefinition, ObjectVersion
from taxonomy.assignments import links_for, replace_assignments, validate_media_selection
from taxonomy.context import actor_context
from taxonomy.models import ClassificationRollout, ClassificationType, Tag
from taxonomy.services import require

from .profile import OBJECT_TYPES, PROFILE
from .source import DEFAULT_RESOURCES, validate_record
from .term_plan import RESOURCE_TARGETS, compile_plan
from .term_plan import identity as term_identity
from .term_plan import source_names
from .transform import BlockedRecord, checksum, normalize

PIPELINE_VERSION = "2"
TAXONOMY = {
    "types": "news_type",
    "categories": "news_category",
    "sources": "news_source",
    "topics": "news_topic",
    "keywords": "news_keyword",
    "eceeeCategories": "general",
    "publicationCategories": "publication_category",
    "organizationCategories": "organization_category",
    "affiliations": "organization_affiliation",
}


def _reviewed_term_state(config, facets):
    """Resolve the portable map and reject changed or unprepared target terms."""

    expected = compile_plan()
    for key in ("format", "version", "sourceSite", "inventoryDigest", "decisionsDigest", "termRefs"):
        if config.get(key) != expected["mapping"][key]:
            raise BlockedRecord("reviewed_term_map_mismatch")
    terms = {
        (term.classification_type.key, term.slug): term
        for term in Tag.objects.filter(
            namespace=facets["article_kind"].namespace,
            tenant=facets["article_kind"].tenant,
            classification_type__key__in={item["type"] for item in expected["bundle"]["terms"]},
        ).select_related("classification_type", "parent")
    }
    resolved = {}
    for term in expected["bundle"]["terms"]:
        key = (term["type"], term["slug"])
        actual = terms.get(key)
        parent = actual.parent.slug if actual and actual.parent else None
        if (
            not actual
            or actual.status != "approved"
            or actual.name != term["name"]
            or parent != term["parent"]
            or (actual.parent and actual.parent.classification_type_id != actual.classification_type_id)
            or sorted(actual.alternative_names or []) != sorted(term.get("alternative_names") or [])
        ):
            raise BlockedRecord("unprepared_or_changed_reviewed_term")
    for source_key, ref in expected["mapping"]["termRefs"].items():
        resolved[source_key] = str(terms[(ref["type"], ref["slug"])].pk)
    fingerprint = checksum(
        [
            (item["type"], item["slug"], resolved_key, terms[(item["type"], item["slug"])].revision)
            for resolved_key, item in sorted(expected["mapping"]["termRefs"].items())
        ]
    )
    return resolved, fingerprint


def _reviewed_keys(row, resource):
    site = row["sourceSite"]
    for source_key, values in row.get("taxonomy", {}).items():
        if source_key not in TAXONOMY or (resource != "publications" and source_key == "publicationCategories"):
            raise BlockedRecord("unmapped_taxonomy_dimension")
        for value in values:
            if not isinstance(value, dict) or not value.get("model") or not value.get("id"):
                raise BlockedRecord("taxonomy_source_identity_missing")
            yield term_identity(site, source_key, value["model"], value["id"])
    if resource == "events":
        event_type = row["data"].get("eventType")
        if event_type:
            yield term_identity(site, "eventType", "choice", event_type)
        for value in row["data"].get("eventCategories", []):
            yield term_identity(site, "eventCategories", "choice", value)


def preflight(tenant, namespace, user):
    if namespace.tenant_id != tenant.pk or not tenant.user_has_access(user):
        raise PermissionDenied("Import scope is not authorized")
    types = {
        d.name: d
        for d in ObjectTypeDefinition.objects.filter(name__in=OBJECT_TYPES, namespace=namespace, is_active=True)
    }
    if set(types) != set(OBJECT_TYPES):
        raise BlockedRecord("missing_editorial_definitions")
    for definition in types.values():
        if definition.metadata.get("content_profile", {}).get("id") != PROFILE:
            raise BlockedRecord("definition_profile_mismatch")
        if not any(s.get("name") == "main" for s in definition.get_slots()):
            raise BlockedRecord("definition_main_slot_missing")
    facets = {d.key: d for d in ClassificationType.objects.filter(namespace=namespace, tenant=tenant)}
    if "article_kind" not in facets:
        raise BlockedRecord("article_kind_missing")
    for d in facets.values():
        require(user, d, "use")
    fingerprint = checksum(
        {
            name: {"schema": d.schema, "slots": d.slot_configuration, "profile": d.metadata.get("content_profile")}
            for name, d in types.items()
        }
    )
    return types, facets, fingerprint


def stage(*, tenant, namespace, user, source_scope, records, preset="dev", configuration=None):
    types, facets, definition_hash = preflight(tenant, namespace, user)
    config = {**(configuration or {}), "pipeline": PIPELINE_VERSION, "definitionHash": definition_hash}
    if config.get("format") == "eceee-reviewed-legacy-term-map":
        resolved, fingerprint = _reviewed_term_state(config, facets)
        config["resolvedTermMap"] = resolved
        config["termPlanFingerprint"] = fingerprint
        reviewed_names = source_names()
    elif preset == "all":
        raise BlockedRecord("reviewed_term_map_required")
    prepared = []
    identities = set()
    for resource, row in records:
        if resource not in DEFAULT_RESOURCES:
            raise BlockedRecord("resource_not_in_editorial_import")
        validate_record(row, resource)
        if "resolvedTermMap" in config:
            if row["sourceSite"] != config["sourceSite"]:
                raise BlockedRecord("reviewed_term_map_wrong_site")
            for key in _reviewed_keys(row, resource):
                if key not in config["resolvedTermMap"]:
                    raise BlockedRecord("new_or_unmapped_source_term")
            for source_key, values in row.get("taxonomy", {}).items():
                for value in values:
                    key = term_identity(row["sourceSite"], source_key, value["model"], value["id"])
                    if value.get("name") != reviewed_names[key]:
                        raise BlockedRecord("source_term_name_changed")
                    if value.get("parentId") is not None:
                        raise BlockedRecord("source_term_hierarchy_changed")
        identity = (resource, str(row["legacyId"]))
        if identity in identities:
            raise BlockedRecord("duplicate_source_identity")
        identities.add(identity)
        prepared.append((resource, deepcopy(row)))
    manifest_hash = checksum({"scope": source_scope, "configuration": config, "records": prepared})
    with transaction.atomic():
        run = EditorialImportRun.objects.create(
            tenant=tenant,
            namespace=namespace,
            source_scope=source_scope,
            preset=preset,
            configuration=config,
            manifest_hash=manifest_hash,
            created_by=user,
        )
        EditorialImportItem.objects.bulk_create(
            [
                EditorialImportItem(
                    run=run, resource=resource, source_id=str(row["legacyId"]), record=row, source_hash=checksum(row)
                )
                for resource, row in prepared
            ]
        )
    return run


def snapshot_hash(obj):
    version = obj.current_version
    return checksum(
        {
            "title": version.content_title if version else obj.title,
            "data": version.data if version else {},
            "widgets": version.widgets if version else {},
            # Redirect resolution is a read projection; a taxonomy merge does not
            # change the version's stored assignments or editorial content.
            "classifications": [str(link.tag_id) for link in links_for(version)] if version else [],
            "version": version.pk if version else None,
            "revision": version.edit_revision if version else None,
            "parent": obj.parent_id,
            "relationships": obj.relationships,
            "metadata": obj.metadata,
            "slug": obj.slug,
        }
    )


@contextmanager
def import_lock(run):
    key = int.from_bytes(
        hashlib.sha256(f"editorial:{run.tenant_id}:{run.namespace_id}".encode()).digest()[:8], "big", signed=True
    )
    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_try_advisory_lock(%s)", [key])
            if not cursor.fetchone()[0]:
                raise BlockedRecord("another_import_is_running")
    try:
        yield
    finally:
        if connection.vendor == "postgresql":
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_unlock(%s)", [key])


def _term(user, definition, name, slug=None, parent=None):
    slug = slug or slugify(name)
    term = Tag.objects.filter(
        tenant=definition.tenant, namespace=definition.namespace, classification_type=definition, slug=slug
    ).first()
    if term:
        if term.name != name or (parent is not None and term.parent_id != parent.pk):
            raise BlockedRecord("taxonomy_identity_conflict")
        if term.status != "approved":
            raise BlockedRecord("taxonomy_not_approved")
        return term
    # Taxonomy preparation is a separate, reviewed operation, never an import side effect.
    raise BlockedRecord("unprepared_taxonomy_term")


def terms_for(row, resource, types, facets, user, config):
    result = []
    reviewed = config.get("format") == "eceee-reviewed-legacy-term-map"
    target_use = f"object:{types[RESOURCE_TARGETS[resource]].pk}" if reviewed else None
    if resource in {"news", "columns"}:
        if reviewed and target_use not in facets["article_kind"].allowed_uses:
            raise BlockedRecord("taxonomy_mapping_wrong_use")
        kind = "column" if resource == "columns" else "news"
        if (
            resource == "news"
            and any(
                isinstance(term, dict)
                and term_identity(row["sourceSite"], "types", term.get("model"), term.get("id"))
                == term_identity(2, "types", "eceeenews.eceeenewstype", "4")
                for term in row.get("taxonomy", {}).get("types", [])
            )
            and config.get("format") == "eceee-reviewed-legacy-term-map"
        ):
            kind = "press-release"
        elif (
            resource == "news"
            and config.get("format") != "eceee-reviewed-legacy-term-map"
            and set(config.get("pressReleaseSourceTerms", []))
            & {str(t.get("id")) for t in row.get("taxonomy", {}).get("types", []) if isinstance(t, dict)}
        ):
            kind = "press-release"
        result.append(Tag.objects.get(classification_type=facets["article_kind"], slug=kind, status="approved"))
    if config.get("format") == "eceee-reviewed-legacy-term-map":
        resolved = config["resolvedTermMap"]
        for source_key in _reviewed_keys(row, resource):
            pk = resolved.get(source_key)
            if not pk:
                raise BlockedRecord("new_or_unmapped_source_term")
            dimension = source_key.split(":", 2)[1]
            facet_key = TAXONOMY.get(dimension) or {"eventType": "event_type", "eventCategories": "event_category"}.get(
                dimension
            )
            if not facet_key:
                raise BlockedRecord("unmapped_taxonomy_dimension")
            facet = facets.get(facet_key)
            if facet is None or target_use not in facet.allowed_uses:
                raise BlockedRecord("taxonomy_mapping_wrong_use")
            term = Tag.objects.filter(
                pk=pk,
                classification_type=facet,
                namespace=facet.namespace,
                tenant=facet.tenant,
                status="approved",
            ).first()
            if term is None:
                raise BlockedRecord("taxonomy_mapping_wrong_facet_or_unavailable")
            result.append(term)
        return list(dict.fromkeys(str(t.pk) for t in result))
    approved = config.get("approvedTermMap", {})
    for source_key, values in row.get("taxonomy", {}).items():
        key = TAXONOMY.get(source_key)
        if source_key == "categories" and resource != "news":
            key = "general"
        if not key or key not in facets:
            raise BlockedRecord("unmapped_taxonomy_dimension")
        for value in values:
            if not isinstance(value, dict) or not value.get("model") or not value.get("id") or not value.get("name"):
                raise BlockedRecord("taxonomy_source_identity_missing")
            identity = f"{value['model']}:{value['id']}"
            if identity in approved:
                term = Tag.objects.filter(
                    pk=approved[identity],
                    classification_type=facets[key],
                    namespace=facets[key].namespace,
                    tenant=facets[key].tenant,
                    status="approved",
                ).first()
                if term is None:
                    raise BlockedRecord("taxonomy_mapping_wrong_facet_or_unavailable")
            else:
                if value.get("parentId"):
                    raise BlockedRecord("hierarchical_source_requires_term_map")
                # Legacy dimensions retain their identity rather than being merged by label.
                suffix = hashlib.sha256(identity.encode()).hexdigest()[:10]
                term = _term(user, facets[key], value["name"], slug=f"{slugify(value['name'])[:220]}-{suffix}")
            result.append(term)
    if resource == "events":
        if row["data"].get("eventType"):
            result.append(_term(user, facets["event_type"], row["data"]["eventType"]))
        for value in row["data"].get("eventCategories", []):
            result.append(_term(user, facets["event_category"], value))
    return list(dict.fromkeys(str(t.pk) for t in result))


def _slug(definition, row, resource, tenant):
    preferred = slugify(row["slug"].split("/")[-1]) or f'{resource}-{row["legacyId"]}'
    if not ObjectInstance.objects.filter(tenant=tenant, object_type=definition, slug=preferred).exists():
        return preferred
    fallback = f'{preferred[:260]}-{resource}-{row["legacyId"]}'
    if ObjectInstance.objects.filter(tenant=tenant, object_type=definition, slug=fallback).exists():
        raise BlockedRecord("destination_slug_conflict")
    return fallback


def _attachments(row, media_importer):
    # Public URLs only, fetched through the same pinned/bounded transport as images.
    from pathlib import PurePosixPath

    from django.core.files.uploadedfile import SimpleUploadedFile

    from content_migration.legacy_news.remote import get_public_url
    from file_manager.models import MediaFile
    from file_manager.storage import storage

    results = []
    for attachment in row.get("attachments", []):
        if not attachment.get("url"):
            results.append(dict(attachment))
            continue
        url = attachment["url"]
        existing = MediaFile.objects.filter(
            tenant=media_importer.tenant, namespace=media_importer.namespace, metadata__legacy_attachment_url=url
        ).first()
        if not existing:
            response = get_public_url(url, max_bytes=50 * 1024 * 1024)
            if response.status_code != 200:
                raise BlockedRecord("attachment_download_failed")
            content = response.content
            content_type = response.headers.get("content-type", "application/octet-stream").split(";")[0]
            if not content or content_type in {"text/html", "application/xhtml+xml"}:
                raise BlockedRecord("attachment_response_is_not_file")
            filename = PurePosixPath(url.split("?")[0]).name or "document"
            if filename.lower().endswith(".pdf") and not content.startswith(b"%PDF-"):
                raise BlockedRecord("attachment_pdf_invalid")
            content_hash = hashlib.sha256(content).hexdigest()
            existing = MediaFile.objects.filter(file_hash=content_hash).first()
            if existing and (
                existing.tenant_id != media_importer.tenant.pk or existing.namespace_id != media_importer.namespace.pk
            ):
                raise BlockedRecord("attachment_scope_conflict")
            if not existing:
                path = (
                    f"legacy-content/{media_importer.tenant.pk}/{media_importer.namespace.pk}/"
                    f"{hashlib.sha256(url.encode()).hexdigest()}/{filename}"
                )
                uploaded = storage.overwrite_file(
                    path, SimpleUploadedFile(filename, content, content_type=content_type)
                )
                existing = MediaFile.objects.create(
                    tenant=media_importer.tenant,
                    namespace=media_importer.namespace,
                    title=attachment.get("title") or filename,
                    slug=f"legacy-file-{hashlib.sha256(url.encode()).hexdigest()[:24]}",
                    file_path=uploaded["file_path"],
                    file_url=storage.get_public_url(uploaded["file_path"]),
                    original_filename=filename,
                    file_size=uploaded["file_size"],
                    content_type=uploaded["content_type"],
                    file_hash=content_hash,
                    file_type="document",
                    access_level="public",
                    created_by=media_importer.user,
                    uploaded_by=media_importer.user,
                    last_modified_by=media_importer.user,
                    metadata={"legacy_attachment_url": url},
                )
        if media_importer.classification_ids is not None:
            media_importer._apply_tags(existing, placeholder=False)
        results.append({**attachment, "sourceUrl": url, "url": existing.file_url, "mediaId": str(existing.pk)})
    return results


@transaction.atomic
def apply_item(run, item, user, types, facets):
    item = EditorialImportItem.objects.select_for_update().get(pk=item.pk)
    if item.resource not in DEFAULT_RESOURCES:
        raise BlockedRecord("resource_not_in_editorial_import")
    if item.status in {"imported", "unchanged", "excluded"}:
        return item.status
    row = item.record
    if checksum(row) != item.source_hash:
        raise BlockedRecord("manifest_entry_changed")
    config = run.configuration
    if f"{item.resource}:{item.source_id}" in config.get("excludedSources", []):
        item.status = "excluded"
        item.error_category = "reviewed_exclusion"
        item.save(update_fields=["status", "error_category", "updated_at"])
        return item.status
    author_ids = {}
    if item.resource == "columns":
        originals = row["data"].get("authorIds", [])
        author_ids = {
            source_id: object_id
            for source_id, object_id in run.items.filter(
                resource="columnists",
                source_id__in=[str(pk) for pk in originals],
                status__in=["imported", "unchanged"],
                object_instance__tenant_id=run.tenant_id,
                object_instance__object_type=types["columnist"],
            ).values_list("source_id", "object_instance_id")
        }
        if not originals or any(str(pk) not in author_ids for pk in originals):
            raise BlockedRecord("missing_columnist_dependency")
    identity = {
        "tenant": run.tenant,
        "namespace": run.namespace,
        "source_scope": run.source_scope,
        "resource": item.resource,
        "source_id": item.source_id,
    }
    binding = (
        EditorialImportBinding.objects.select_for_update(of=("self",))
        .filter(**identity)
        .select_related("object_instance__current_version")
        .first()
    )
    # Refetch only after acquiring the same tenant/Object locks as authoring.
    # A previously selected version can become stale while waiting for an editor.
    obj = None
    if binding:
        from core.models import Tenant

        Tenant.objects.select_for_update().get(pk=run.tenant_id)
        obj = (
            ObjectInstance.objects.select_for_update(of=("self",))
            .select_related("current_version")
            .get(pk=binding.object_instance_id, tenant_id=run.tenant_id)
        )
    if binding and snapshot_hash(obj) != binding.target_hash:
        item.status = "conflict"
        item.error_category = "destination_changed"
        item.save()
        return item.status
    # Raw source equality is insufficient when a reviewed mapping or profile changes.
    mapping_keys = (
        "approvedTermMap",
        "decisionsDigest",
        "inventoryDigest",
        "termPlanFingerprint",
        "pressReleaseSourceTerms",
        "mediaClassificationIds",
        "pipeline",
        "definitionHash",
    )
    mapping = {key: config.get(key) for key in mapping_keys}
    previous_mapping = {key: binding.last_run.configuration.get(key) for key in mapping_keys} if binding else None
    source_unchanged = binding and binding.source_hash == item.source_hash and mapping == previous_mapping
    previous_placeholders = (
        obj.current_version.workflow_metadata.get("legacy_editorial", {}).get("placeholder_images", [])
        if source_unchanged and obj.current_version
        else []
    )
    if source_unchanged and not previous_placeholders:
        item.status = "unchanged"
        item.object_instance = obj
        item.error_category = ""
        item.save()
        return item.status
    payload = normalize(row, item.resource, author_ids=author_ids)
    tags = terms_for(row, item.resource, types, facets, user, config)
    media_ids = config.get("mediaClassificationIds")
    has_media = payload["images"] or any(a.get("url") for a in row.get("attachments", []))
    if has_media:
        if (
            media_ids is None
            and ClassificationRollout.objects.filter(namespace=run.namespace, phase="canonical").exists()
        ):
            raise BlockedRecord("media_classification_required")
        if media_ids is not None:
            if not isinstance(media_ids, list):
                raise BlockedRecord("media_classification_must_be_list")
            media_ids = validate_media_selection(run.namespace, user, media_ids)
    importer = LegacyMediaImporter(namespace=run.namespace, tenant=run.tenant, user=user, classification_ids=media_ids)
    media = {
        url: importer.import_image(url, article_identity=f"{item.resource}:{item.source_id}", resume=True)
        for url in payload["images"]
    }
    if previous_placeholders and all(
        url in media and media[url].metadata.get("migration_placeholder") for url in previous_placeholders
    ):
        # Retrying unavailable images is useful; another identical draft version is not.
        item.status = "unchanged"
        item.object_instance = obj
        item.error_category = ""
        item.save()
        return item.status
    working_row = deepcopy(row)
    working_row["attachments"] = _attachments(row, importer)
    payload = normalize(working_row, item.resource, author_ids=author_ids, media_by_url=media)
    media_warnings = [url for url, m in media.items() if m.metadata.get("migration_placeholder")]
    data = {k: v for k, v in payload["data"].items() if v is not None}
    # Serialized payload fields are camelCase; ObjectVersion data remains Python-owned snake_case.
    from object_storage.serializers import ObjectTypeDefinitionSerializer

    data = {ObjectTypeDefinitionSerializer()._camel_to_snake(k): v for k, v in data.items()}
    if obj is None:
        obj = ObjectInstance.objects.create(
            tenant=run.tenant,
            object_type=types[payload["target"]],
            title=payload["title"],
            slug=_slug(types[payload["target"]], row, item.resource, run.tenant),
            created_by=user,
            metadata={
                "legacy_editorial": {
                    "scope": run.source_scope,
                    "resource": item.resource,
                    "id": item.source_id,
                    "source_url": row["sourceUrl"],
                }
            },
        )
    latest = obj.versions.order_by("-version_number").first()
    version = ObjectVersion.objects.create(
        object_instance=obj,
        version_number=(latest.version_number + 1 if latest else 1),
        title=payload["title"],
        data=data,
        widgets=payload["widgets"],
        is_featured=bool(row.get("featured")),
        created_by=user,
        change_description="Legacy editorial import (draft)",
        workflow_metadata={
            "legacy_editorial": {
                "run_id": str(run.pk),
                "source_hash": item.source_hash,
                "source_publish_date": row.get("publishDate"),
                "source_expiry_date": row.get("expiryDate"),
                "attachments": payload["attachments"],
                "placeholder_images": media_warnings,
            }
        },
    )
    replace_assignments(version, tags, user)
    obj.current_version = version
    obj.version = version.version_number
    obj.save(update_fields=["current_version", "version", "updated_at"])
    if binding:
        binding.source_hash = item.source_hash
        binding.target_hash = snapshot_hash(obj)
        binding.last_run = run
        binding.source_url = row["sourceUrl"]
        binding.save()
    else:
        EditorialImportBinding.objects.create(
            **identity,
            object_instance=obj,
            source_hash=item.source_hash,
            target_hash=snapshot_hash(obj),
            source_url=row["sourceUrl"],
            last_run=run,
        )
    item.object_instance = obj
    item.status = "imported"
    item.error_category = ""
    item.save()
    return item.status


def apply_run(run, user):
    if run.items.exclude(resource__in=DEFAULT_RESOURCES).exists():
        raise BlockedRecord("resource_not_in_editorial_import")
    types, facets, definition_hash = preflight(run.tenant, run.namespace, user)
    if definition_hash != run.configuration["definitionHash"]:
        raise BlockedRecord("definitions_changed_since_staging")
    if run.configuration.get("format") == "eceee-reviewed-legacy-term-map":
        resolved, fingerprint = _reviewed_term_state(run.configuration, facets)
        if resolved != run.configuration.get("resolvedTermMap") or fingerprint != run.configuration.get(
            "termPlanFingerprint"
        ):
            raise BlockedRecord("reviewed_terms_changed_since_staging")
    records = [(i.resource, i.record) for i in run.items.order_by("pk")]
    if (
        checksum({"scope": run.source_scope, "configuration": run.configuration, "records": records})
        != run.manifest_hash
    ):
        raise BlockedRecord("manifest_changed")
    if run.preset == "all":
        sample = EditorialImportRun.objects.filter(
            pk=run.configuration.get("acceptedSampleRun"),
            tenant=run.tenant,
            namespace=run.namespace,
            source_scope=run.source_scope,
            reviewed_at__isnull=False,
            preset="dev",
            status="complete",
        ).first()
        if (
            not sample
            or sample.configuration.get("compatibility")
            or sample.configuration.get("sourceScopeVerified") is False
            or sample.configuration.get("definitionHash") != definition_hash
            or sample.configuration.get("pipeline") != PIPELINE_VERSION
            or sample.configuration.get("mappingHash") != run.configuration.get("mappingHash")
            or sample.configuration.get("inventoryDigest") != run.configuration.get("inventoryDigest")
            or sample.configuration.get("decisionsDigest") != run.configuration.get("decisionsDigest")
            or sample.configuration.get("termPlanFingerprint") != run.configuration.get("termPlanFingerprint")
            or set(sample.configuration.get("resources", [])) != set(run.configuration.get("resources", []))
        ):
            raise BlockedRecord("reviewed_sample_required_before_full_import")
    with import_lock(run), actor_context(user):
        run.status = "running"
        run.save(update_fields=["status", "updated_at"])
        # Dependencies always precede referencing articles, independent of manifest order.
        for resource in DEFAULT_RESOURCES:
            for item in run.items.filter(resource=resource).order_by("pk").iterator():
                try:
                    apply_item(run, item, user, types, facets)
                except BlockedRecord as error:
                    item.status = "blocked"
                    item.error_category = str(error)
                    item.save(update_fields=["status", "error_category", "updated_at"])
                except Exception as error:
                    item.status = "failed"
                    item.error_category = error.__class__.__name__
                    item.save(update_fields=["status", "error_category", "updated_at"])
        run.report = dict(Counter(run.items.values_list("status", flat=True)))
        run.status = (
            "needs_attention"
            if any(run.report.get(k) for k in ("failed", "blocked", "conflict", "pending"))
            else "complete"
        )
        run.save(update_fields=["report", "status", "updated_at"])
    return run.report
