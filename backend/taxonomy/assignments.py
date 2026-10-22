"""Ordered classification assignments. Call only after the content's edit gate."""

from django.core.exceptions import ValidationError as ModelValidationError
from django.db import transaction
from rest_framework.exceptions import ValidationError

from content.models import Namespace

from .models import MediaCollectionClassification, MediaFileClassification, ObjectVersionTag, Tag
from .services import require, resolve_term


def assignment_context(instance):
    label = instance._meta.label_lower
    if label == "webpages.pageversion":
        from webpages.models import PageVersionTag

        namespace = Namespace.get_default(tenant=instance.page.tenant)
        return PageVersionTag, "page_version", namespace, "pages", True
    if label == "object_storage.objectversion":
        obj = instance.object_instance
        namespace = obj.object_type.namespace
        if namespace is None or namespace.tenant_id != obj.tenant_id:
            namespace = Namespace.get_default(tenant=obj.tenant)
        return ObjectVersionTag, "object_version", namespace, f"object:{obj.object_type_id}", True
    if label == "file_manager.mediafile":
        return MediaFileClassification, "media_file", instance.namespace, "media_files", False
    if label == "file_manager.mediacollection":
        return MediaCollectionClassification, "collection", instance.namespace, "media_collections", False
    raise ValueError("Unsupported classification owner")


def links_for(instance):
    model, field, *_ = assignment_context(instance)
    return model.objects.filter(**{field: instance}).select_related("tag", "tag__merged_into").order_by("position")


def classification_ids(instance):
    return list(dict.fromkeys(str(resolve_term(link.tag).pk) for link in links_for(instance)))


@transaction.atomic
def replace_assignments(instance, ids, user, *, allow_empty_transition=False):
    if not isinstance(ids, list):
        raise ValidationError({"classification_ids": "Use an ordered list of term IDs."})
    # Serialize assignment writes against the content's publication/copy lock.
    type(instance).objects.select_for_update().get(pk=instance.pk)
    model, field, namespace, use, versioned = assignment_context(instance)
    if not versioned and not ids and not allow_empty_transition:
        raise ValidationError({"classification_ids": "At least one approved classification is required for media."})
    previous_links = list(links_for(instance))
    try:
        terms = {
            str(term.pk): term
            for term in Tag.objects.filter(
                pk__in=ids,
                tenant_id=namespace.tenant_id,
                namespace=namespace,
            ).select_related("classification_type", "merged_into")
        }
    except (ModelValidationError, ValueError, TypeError) as exc:
        raise ValidationError({"classification_ids": "Invalid classification IDs."}) from exc
    # Deterministic lock order prevents opposite multi-type assignment edits deadlocking.
    definitions = {term.classification_type_id for term in terms.values() if term.classification_type_id}
    for link in previous_links:
        if link.tag.classification_type_id:
            definitions.add(link.tag.classification_type_id)
    from .models import ClassificationType

    locked = {
        definition.pk: definition
        for definition in ClassificationType.objects.select_for_update().filter(pk__in=definitions).order_by("pk")
    }
    previous_by_resolved = {}
    for link in previous_links:
        link.tag.refresh_from_db()
        previous_by_resolved.setdefault(str(resolve_term(link.tag).pk), []).append(link.tag)
    normalized, seen = [], set()
    for raw_id in ids:
        term = terms.get(str(raw_id))
        if term is None or not term.classification_type_id:
            raise ValidationError({"classification_ids": "Term is unavailable in this namespace."})
        definition = locked[term.classification_type_id]
        require(user, definition, "use")
        term.refresh_from_db()
        term = resolve_term(term)
        resolved_id = str(term.pk)
        unchanged = resolved_id in previous_by_resolved
        if use not in definition.allowed_uses and not unchanged:
            raise ValidationError({"classification_ids": f"{definition.name} is unavailable for this content type."})
        if term.status == "archived" and not unchanged:
            raise ValidationError({"classification_ids": f"{term.name} is archived; choose an active term."})
        if term.status == "proposed" and versioned:
            require(user, definition, "propose")
        elif term.status not in {"approved", "archived"}:
            raise ValidationError({"classification_ids": f"{term.name} must be approved before assigning it here."})
        if resolved_id not in seen:
            # A round-trip through resolved IDs retains every historical link behind that ID.
            normalized.extend(previous_by_resolved[resolved_id] if unchanged else [term])
            seen.add(resolved_id)
    # Check permissions for removals as well as additions.
    retained_ids = {str(term.pk) for term in normalized}
    for link in previous_links:
        if str(link.tag_id) not in retained_ids:
            if not link.tag.classification_type_id:
                raise ValidationError(
                    {"classification_ids": "Reconcile existing legacy classifications before editing them."}
                )
            require(user, locked[link.tag.classification_type_id], "use")
    model.objects.filter(**{field: instance}).delete()
    model.objects.bulk_create(
        [model(**{field: instance, "tag": term, "position": index}) for index, term in enumerate(normalized)]
    )

    from .projections import mirror_assignments

    mirror_assignments(instance, normalized, user)


def assert_publishable(instance):
    invalid = [
        term.name
        for link in links_for(instance)
        for term in [resolve_term(link.tag)]
        if term.status not in {"approved", "archived"}
    ]
    if invalid:
        raise ValidationError(
            {"classification_ids": "Approve or remove these classifications before publishing: " + ", ".join(invalid)}
        )


def copy_assignments(source, destination):
    model, field, *_ = assignment_context(destination)
    model.objects.filter(**{field: destination}).delete()
    model.objects.bulk_create(
        [model(**{field: destination, "tag_id": link.tag_id, "position": link.position}) for link in links_for(source)]
    )


def validate_media_selection(namespace, user, ids, *, use="media_files"):
    """Validate before approving an upload or creating a collection."""
    if not ids:
        raise ValidationError({"classification_ids": "At least one approved taxonomy term is required."})
    try:
        from uuid import UUID

        ordered_ids = list(dict.fromkeys(str(UUID(str(pk))) for pk in ids))
        terms = list(
            Tag.objects.filter(tenant=namespace.tenant, namespace=namespace, pk__in=ordered_ids).select_related(
                "classification_type"
            )
        )
    except (ModelValidationError, ValueError, TypeError) as exc:
        raise ValidationError({"classification_ids": "Invalid taxonomy IDs."}) from exc
    if len(terms) != len(ordered_ids):
        raise ValidationError({"classification_ids": "A selected term is unavailable in this namespace."})
    for term in terms:
        term = resolve_term(term)
        if term.status != "approved" or not term.classification_type_id:
            raise ValidationError({"classification_ids": "Only approved taxonomy terms can classify new media."})
        require(user, term.classification_type, "use")
        if use not in term.classification_type.allowed_uses:
            raise ValidationError({"classification_ids": f"{term.name} cannot be used for this media kind."})
    by_id = {str(term.pk): term for term in terms}
    return list(dict.fromkeys(str(resolve_term(by_id[pk]).pk) for pk in ordered_ids))


def collection_upload_ids(collection, user):
    """Reuse the collection's ordered classifications only when valid for files too."""
    ids = classification_ids(collection)
    if not ids:
        from .projections import legacy_media_ids

        ids = legacy_media_ids(collection, list(collection.tags.values_list("pk", flat=True)), user)
    ids = validate_media_selection(collection.namespace, user, ids, use="media_collections")
    return validate_media_selection(collection.namespace, user, ids, use="media_files")
