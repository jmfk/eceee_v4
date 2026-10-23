"""Portable term snapshots and destination-owned, permission-checked import."""

from uuid import UUID, uuid5

from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import ClassificationType, LegacyTagMapping, Tag
from .services import mutate, require, resolve_term

IDENTITY_NAMESPACE = UUID("f09e4a29-32aa-4ed8-a046-d65f8abf0298")


def export_term(term, seen=None):
    seen = set() if seen is None else seen
    if term.pk in seen or len(seen) > 100:
        raise ValidationError("Classification dependency cycle or excessive depth.")
    seen = seen | {term.pk}
    return {
        "source_id": str(term.pk),
        "name": term.name,
        "slug": term.slug,
        "tag_type": term.tag_type,
        "color": term.color,
        "description": term.description,
        "alternative_names": term.alternative_names,
        "status": term.status,
        "revision": term.revision,
        "definition": {
            "key": term.tag_type,
            "name": term.classification_type.name if term.classification_type_id else term.tag_type,
            "description": term.classification_type.description if term.classification_type_id else "",
        },
        "parent_term": export_term(term.parent, seen) if term.parent_id else None,
        "redirect_term": export_term(term.merged_into, seen) if term.merged_into_id else None,
    }


def import_definition(namespace, key, name, user):
    definition = ClassificationType.objects.filter(namespace=namespace, tenant=namespace.tenant, key=key).first()
    if not definition:
        from .services import is_member

        if not is_member(user, namespace.tenant) or not (
            user.is_superuser or namespace.tenant.created_by_id == user.pk
        ):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("An owner must initialize the destination classification type before import.")
        from object_storage.models import ObjectTypeDefinition

        definition = ClassificationType.objects.create(
            tenant=namespace.tenant,
            namespace=namespace,
            key=key,
            name=name,
            allowed_uses=[
                "pages",
                "media_files",
                "media_collections",
                *[f"object:{pk}" for pk in ObjectTypeDefinition.objects.values_list("pk", flat=True)],
            ],
        )
    require(user, definition, "use")
    return definition


@transaction.atomic
def import_term(data, namespace, user, *, seen=None):
    seen = set() if seen is None else seen
    identity = data.get("source_id") or f"{data.get('tag_type', 'general')}:{data.get('slug')}"
    if identity in seen or len(seen) > 100:
        raise ValidationError("Classification import contains a cycle or excessive depth.")
    seen = seen | {identity}
    if data.get("status", "approved") not in {"approved", "archived", "merged"}:
        raise ValidationError("Approve or remove proposed/rejected classifications before transfer.")
    key = data.get("tag_type", "general")
    definition = import_definition(namespace, key, data.get("definition", {}).get("name", key), user)
    parent = import_term(data["parent_term"], namespace, user, seen=seen) if data.get("parent_term") else None
    redirect = import_term(data["redirect_term"], namespace, user, seen=seen) if data.get("redirect_term") else None
    # Stable destination identity, scoped to the destination tenant/namespace.
    tag_id = uuid5(IDENTITY_NAMESPACE, f"transfer:{namespace.tenant_id}:{namespace.pk}:{identity}")
    source_key = str(uuid5(IDENTITY_NAMESPACE, f"{namespace.tenant_id}:{namespace.pk}:{identity}"))
    prior = (
        LegacyTagMapping.objects.filter(source_kind="transfer", source_id=source_key)
        .select_related("canonical_tag")
        .first()
    )
    tag = prior.canonical_tag if prior else Tag.objects.filter(pk=tag_id).first()
    if tag is None and parent and parent.status == "archived":
        mutate(user, parent.classification_type, "reactivate", term=parent, revision=parent.revision)
        parent.refresh_from_db()
    if tag is None:
        existing = Tag.objects.filter(
            tenant=namespace.tenant, namespace=namespace, tag_type=key, slug=data["slug"]
        ).first()
        if existing:
            if (
                existing.name != data["name"]
                or existing.parent_id != (parent.pk if parent else None)
                or existing.status != data.get("status", "approved")
                or (existing.status == "merged" and existing.merged_into_id != (redirect.pk if redirect else None))
            ):
                raise ValidationError(
                    "Destination classification conflicts with the transferred identity; review the mapping."
                )
            tag = existing
        else:
            operation = mutate(
                user,
                definition,
                "create",
                payload={
                    "name": data["name"],
                    "slug": data["slug"],
                    "color": data.get("color", "#3B82F6"),
                    "description": data.get("description", ""),
                    "alternative_names": data.get("alternative_names", []),
                    "parent_id": str(parent.pk) if parent else None,
                },
            )
            tag = Tag.objects.get(pk=next(iter(operation.after)))
            # Operation history owns the generated UUID. Durable source-to-target
            # identity uses a mapping rather than rewriting that UUID after creation.
    if tag.tenant_id != namespace.tenant_id or tag.namespace_id != namespace.pk or tag.tag_type != definition.key:
        raise ValidationError("Destination classification mapping crosses its scope boundary.")
    if tag.classification_type_id is None:
        tag.classification_type = definition
        tag.save(update_fields=["classification_type"])
    if data.get("status") == "archived" and tag.status == "archived":
        mutate(user, definition, "reactivate", term=tag, revision=tag.revision)
        tag.refresh_from_db()
    mapping, _ = LegacyTagMapping.objects.get_or_create(
        source_kind="transfer",
        source_id=str(uuid5(IDENTITY_NAMESPACE, f"{namespace.tenant_id}:{namespace.pk}:{identity}")),
        defaults={"canonical_tag": tag, "source_name": data["name"]},
    )
    if mapping.canonical_tag_id != tag.pk:
        tag = mapping.canonical_tag
    if redirect and tag.status == "approved":
        require(user, definition, "merge")
        operation = mutate(
            user,
            definition,
            "merge",
            term=tag,
            revision=tag.revision,
            payload={"target_id": str(redirect.pk), "target_revision": redirect.revision},
        )
        tag.refresh_from_db()
    # Archived source identities remain approved at the destination until the
    # enclosing import has attached their historical assignments; finalize below.
    if data.get("status") == "archived":
        require(user, definition, "archive")
    return tag


def finalize_imported_terms(payloads, namespace, user):
    """Archive leaves before their ancestors, after assignments are attached."""
    terms = []

    def collect(data):
        if data.get("parent_term"):
            collect(data["parent_term"])
        if data.get("redirect_term"):
            collect(data["redirect_term"])
        if data.get("status") == "archived":
            terms.append(data)

    for data in payloads:
        collect(data)
    candidates = {import_term(data, namespace, user).pk for data in terms}

    def depth(term):
        count, parent = 0, term.parent
        while parent:
            count += 1
            parent = parent.parent
        return count

    for term in sorted(Tag.objects.filter(pk__in=candidates), key=depth, reverse=True):
        term.refresh_from_db()
        if term.status == "approved":
            mutate(user, term.classification_type, "archive", term=term, revision=term.revision)


def import_legacy_news_term(source, user):
    from content.models import Namespace

    mapping = LegacyTagMapping.objects.filter(source_kind="object", source_id=str(source.pk)).first()
    if mapping:
        return mapping.canonical_tag
    namespace = source.object_type.namespace
    if namespace is None or namespace.tenant_id != source.tenant_id:
        namespace = Namespace.get_default(tenant=source.tenant)
    definition = import_definition(namespace, source.object_type.name, source.object_type.label, user)
    operation = mutate(user, definition, "create", payload={"name": source.title, "slug": source.slug})
    tag = Tag.objects.get(pk=next(iter(operation.after)))
    LegacyTagMapping.objects.create(
        source_kind="object", source_id=str(source.pk), canonical_tag=tag, source_name=source.title
    )
    return tag


def export_assignments(instance):
    from .assignments import links_for

    links = list(links_for(instance))
    terms = [link.tag for link in links]
    label = instance._meta.label_lower
    if label in {"file_manager.mediafile", "file_manager.mediacollection"}:
        from .signals import canonical_phase

        if not canonical_phase(instance.namespace_id):
            terms += [term for term in instance.canonical_tags.all() if term.pk not in {item.pk for item in terms}]
    payloads = [dict(export_term(term), position=index) for index, term in enumerate(terms)]
    if label == "webpages.pageversion":
        from .assignments import assignment_context
        from .projections import historical_page_labels

        namespace = assignment_context(instance)[2]
        historical = historical_page_labels(instance)
        for name in instance.tags or []:
            if name in historical or any(item["tag_type"] == "general" and item["name"] == name for item in payloads):
                continue
            from django.utils.text import slugify

            term = Tag.objects.filter(namespace=namespace, tag_type="general", name=name).first()
            data = (
                export_term(term)
                if term
                else {
                    "source_id": f"page-name:{namespace.tenant_id}:{namespace.pk}:{name}",
                    "name": name,
                    "slug": slugify(name),
                    "tag_type": "general",
                    "status": "approved",
                }
            )
            payloads.append(dict(data, position=len(payloads)))
    if label in {"file_manager.mediafile", "file_manager.mediacollection"}:
        from .signals import canonical_phase

        if not canonical_phase(instance.namespace_id):
            # Preserve both historical stores in expansion-phase packages.
            represented = {str(term.pk) for term in terms}
            for source in instance.tags.all():
                mapping = LegacyTagMapping.objects.filter(source_kind="media", source_id=str(source.pk)).first()
                if mapping and str(mapping.canonical_tag_id) in represented:
                    continue
                if any(item["tag_type"] == "general" and item["name"] == source.name for item in payloads):
                    continue
                data = (
                    export_term(mapping.canonical_tag)
                    if mapping
                    else {
                        "source_id": f"media:{source.pk}",
                        "name": source.name,
                        "slug": source.slug,
                        "tag_type": "general",
                        "color": source.color,
                        "description": source.description,
                        "status": "approved",
                        "alternative_names": [],
                    }
                )
                payloads.append(dict(data, position=len(payloads)))
    return payloads


@transaction.atomic
def import_assignments(importer, instance, payloads, namespace):
    from content.models import Namespace

    from .assignments import classification_ids, replace_assignments
    from .projections import legacy_media_ids

    # Keep the destination snapshot and union serialized with ordinary media edits.
    Namespace.objects.select_for_update().get(pk=namespace.pk)
    ids = []
    for payload in sorted(payloads, key=lambda item: item.get("position", 0)):
        tag = import_term(payload, namespace, importer.job.created_by)
        ids.append(str(tag.pk))
        imports = getattr(importer, "_classification_imports", [])
        imports.append((namespace, payload))
        importer._classification_imports = imports
    if not ids and hasattr(instance, "tags") and hasattr(instance.tags, "all"):
        ids = legacy_media_ids(instance, list(instance.tags.values_list("pk", flat=True)), importer.job.created_by)
    if instance._meta.label_lower in {"file_manager.mediafile", "file_manager.mediacollection"}:
        # Hash/slug deduplication reuses destination-owned resources. Imported
        # terms supplement their editorial selections, while versions stay exact.
        ids = list(dict.fromkeys([*classification_ids(instance), *ids]))
    replace_assignments(instance, ids, importer.job.created_by)


def finish_transfer(importer):
    grouped = {}
    for namespace, data in getattr(importer, "_classification_imports", []):
        grouped.setdefault(namespace.pk, (namespace, []))[1].append(data)
    for namespace, payloads in grouped.values():
        finalize_imported_terms(payloads, namespace, importer.job.created_by)
    importer._classification_imports = []


def assignment_payload_matches(instance, payloads, namespace, user):
    from .assignments import classification_ids

    # Matching an existing version must not create/reactivate terms. Only the
    # actual import path may mutate them and queue their final archived status.
    expected = []
    for payload in sorted(payloads, key=lambda item: item.get("position", 0)):
        identity = payload.get("source_id") or f"{payload.get('tag_type', 'general')}:{payload.get('slug')}"
        source_key = str(uuid5(IDENTITY_NAMESPACE, f"{namespace.tenant_id}:{namespace.pk}:{identity}"))
        mapping = (
            LegacyTagMapping.objects.filter(source_kind="transfer", source_id=source_key)
            .select_related("canonical_tag__classification_type")
            .first()
        )
        if not mapping:
            return False
        term = mapping.canonical_tag
        if term.namespace_id != namespace.pk or term.tenant_id != namespace.tenant_id:
            return False
        require(user, term.classification_type, "use")
        expected.append(str(resolve_term(term).pk))
    return classification_ids(instance) == list(dict.fromkeys(expected))
