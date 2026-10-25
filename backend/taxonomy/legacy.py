"""Compatibility writes use the same governance service as the classification UI.

Legacy identifiers and rows are retained. Structure writers must reconcile first;
ordinary editors submit a proposal through taxonomy instead of silently creating
an approved term through an old endpoint.
"""

from django.db import transaction
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from content.models import Namespace

from .models import ClassificationType, LegacyTagMapping, Tag
from .services import is_member, mutate, require


@transaction.atomic
def definition_for(namespace, user):
    if not is_member(user, namespace.tenant):
        raise PermissionDenied("Tenant membership is required for classification.")
    Namespace.objects.select_for_update().get(pk=namespace.pk)
    definition = ClassificationType.objects.filter(namespace=namespace, tenant=namespace.tenant, key="general").first()
    if definition is None:
        if not (user.is_superuser or namespace.tenant.created_by_id == user.pk):
            raise PermissionDenied("Submit a classification proposal; only an owner may initialize the register.")
        from object_storage.models import ObjectTypeDefinition

        if ClassificationType.objects.filter(
            namespace=namespace, tenant=namespace.tenant, name__iexact="Allmänt"
        ).exists():
            raise ValidationError({"name": "A tag type with this name already exists in this namespace."})
        definition = ClassificationType.objects.create(
            namespace=namespace,
            tenant=namespace.tenant,
            key="general",
            name="Allmänt",
            allowed_uses=[
                "pages",
                "media_files",
                "media_collections",
                *[f"object:{pk}" for pk in ObjectTypeDefinition.objects.values_list("pk", flat=True)],
            ],
        )
    return definition


def source_kind(source):
    return "content" if source._meta.label_lower == "content.tag" else "media"


def canonical_for(source, user):
    mapping = (
        LegacyTagMapping.objects.filter(source_kind=source_kind(source), source_id=str(source.pk))
        .select_related("canonical_tag")
        .first()
    )
    namespace = source.namespace or Namespace.get_default(tenant=source.tenant)
    definition = definition_for(namespace, user)
    existing = (
        mapping.canonical_tag
        if mapping
        else Tag.objects.filter(
            tenant=namespace.tenant, namespace=namespace, tag_type="general", slug=source.slug
        ).first()
    )
    if existing is not None:
        if existing.namespace_id != namespace.pk or existing.tenant_id != namespace.tenant_id:
            raise ValidationError("Legacy mapping crosses a classification scope boundary.")
        if existing.classification_type_id is None:
            existing.classification_type = definition
            existing.save(update_fields=["classification_type"])
        if mapping:
            return existing
        if existing.name.casefold() != source.name.casefold():
            raise ValidationError(
                "Legacy tag slug conflicts with another classification name. Reconcile it explicitly."
            )
    if existing is None:
        operation = mutate(
            user,
            definition,
            "create",
            payload={
                "name": source.name,
                "slug": source.slug,
                "description": getattr(source, "description", ""),
                "color": getattr(source, "color", "#3B82F6"),
            },
        )
        existing = Tag.objects.get(pk=next(iter(operation.after)))
    LegacyTagMapping.objects.create(
        source_kind=source_kind(source), source_id=str(source.pk), canonical_tag=existing, source_name=source.name
    )
    return existing


def create_legacy(serializer, user, **kwargs):
    tenant = kwargs.get("tenant") or getattr(serializer.context.get("request"), "tenant", None)
    namespace = serializer.validated_data.get("namespace")
    if isinstance(namespace, dict):
        namespace = Namespace.objects.get(tenant=tenant, slug=namespace["slug"])
    namespace = namespace or Namespace.get_default(tenant=tenant)
    definition = definition_for(namespace, user)
    require(user, definition, "create")
    with transaction.atomic():
        source = serializer.save(**kwargs)
        canonical_for(source, user)
        return source


def update_legacy(serializer, user):
    with transaction.atomic():
        source = serializer.instance
        term = canonical_for(source, user)
        if "namespace" in serializer.validated_data:
            namespace = serializer.validated_data["namespace"]
            unchanged = (
                namespace.get("slug") == source.namespace.slug
                if isinstance(namespace, dict)
                else namespace == source.namespace
            )
            if not unchanged:
                raise ValidationError(
                    "Move terms through the classification tree; namespace changes are not supported."
                )
            serializer.validated_data.pop("namespace")
        payload = {
            key: value
            for key, value in serializer.validated_data.items()
            if key in {"name", "slug", "description", "color"}
        }
        if payload:
            mutate(user, term.classification_type, "edit", term=term, revision=term.revision, payload=payload)
        else:
            require(user, term.classification_type, "edit")
        return serializer.save()


def archive_legacy(source, user):
    term = canonical_for(source, user)
    if term.status == "archived":
        require(user, term.classification_type, "archive")
        return
    mutate(user, term.classification_type, "archive", term=term, revision=term.revision)


def merge_legacy(view, request):
    target_id = request.data.get("target_tag_id")
    ids = request.data.get("source_tag_ids", [])
    if not target_id or not isinstance(ids, list) or not ids:
        raise ValidationError("Choose a target and at least one source tag.")
    queryset = view.get_queryset()
    try:
        target = queryset.get(pk=target_id)
    except queryset.model.DoesNotExist as exc:
        raise NotFound("Target is unavailable.") from exc
    sources = list(queryset.filter(pk__in=ids))
    if len(sources) != len(set(ids)):
        raise ValidationError("One or more sources are unavailable.")
    with transaction.atomic():
        canonical_target = canonical_for(target, request.user)
        for source in sources:
            term = canonical_for(source, request.user)
            mutate(
                request.user,
                term.classification_type,
                "merge",
                term=term,
                revision=term.revision,
                payload={"target_id": str(canonical_target.pk), "target_revision": canonical_target.revision},
            )
            canonical_target.refresh_from_db()
    return Response(
        {
            "target_tag": view.get_serializer(target).data,
            "files_transferred": 0,
            "tags_deleted": 0,
            "message": "Tags merged; source identities and historical assignments retained.",
        }
    )


def bulk_archive_legacy(view, request):
    ids = request.data.get("tag_ids", [])
    if not isinstance(ids, list) or not ids:
        raise ValidationError("Choose at least one tag.")
    sources = list(view.get_queryset().filter(pk__in=ids))
    if len(sources) != len(set(ids)):
        raise ValidationError("One or more tags are unavailable.")
    with transaction.atomic():
        for source in sources:
            archive_legacy(source, request.user)
    return Response(
        {
            "deleted_count": 0,
            "archived_count": len(sources),
            "message": "Tags archived; historical assignments retained.",
        }
    )


def validate_media_tag_ids(ids, namespace, user, *, existing_ids=()):
    """Legacy assignment paths cannot reactivate archived or proposed terms."""

    definition = definition_for(namespace, user)
    require(user, definition, "use")
    from types import SimpleNamespace

    from .context import projection_context
    from .projections import legacy_media_ids, media_alias
    from .services import resolve_term

    canonical_ids = legacy_media_ids(SimpleNamespace(namespace=namespace), ids, user)
    sources = []
    existing = {str(pk) for pk in existing_ids}
    for term in Tag.objects.filter(pk__in=canonical_ids):
        with projection_context():
            source = media_alias(term, user)
        resolved = resolve_term(term)
        if resolved.status != "approved" and not (resolved.status == "archived" and str(source.pk) in existing):
            raise ValidationError(
                f"{resolved.name} is unavailable for new assignments. Choose an approved classification."
            )
        sources.append(source)
    return sources
