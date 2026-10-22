"""Portable term snapshots and destination-owned, permission-checked import."""

from uuid import UUID, uuid5

from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import ClassificationType, LegacyTagMapping, Tag
from .services import mutate, require

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
    tag = Tag.objects.filter(pk=tag_id).first()
    if tag is None:
        existing = Tag.objects.filter(
            tenant=namespace.tenant, namespace=namespace, tag_type=key, slug=data["slug"]
        ).first()
        if existing:
            if existing.name != data["name"] or (parent and existing.parent_id != parent.pk):
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
    for data in reversed(terms):
        term = import_term(data, namespace, user)
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
