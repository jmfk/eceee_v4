"""One transactional boundary for classification governance.

Definition row locks serialize tree operations, including sibling moves and merges.
Historical assignments retain their term IDs; readers resolve merge redirects.
"""

from django.core.exceptions import ValidationError as ModelValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from .models import (
    ClassificationGrant,
    ClassificationOperation,
    ClassificationProposal,
    ClassificationType,
    Tag,
)

PERMISSIONS = frozenset(
    {
        "use",
        "propose",
        "create",
        "edit",
        "move",
        "merge",
        "archive",
        "restore",
        "approve",
        "administer",
    }
)
ROLE_TEMPLATES = {
    "user": ["use"],
    "proposer": ["use", "propose"],
    "steward": sorted(PERMISSIONS - {"administer"}),
    "administrator": sorted(PERMISSIONS),
}
ACTIONS = {"create", "edit", "move", "merge", "archive", "reactivate"}
TERM_FIELDS = ("name", "slug", "description", "color", "alternative_names", "parent_id", "status", "merged_into_id")


class ClassificationConflict(APIException):
    status_code = 409
    default_detail = "Classification changed. Reload and review the change again."
    default_code = "classification_conflict"


def is_member(user, tenant):
    # Do not inherit the development workspace-switcher bypass for structure rights.
    return bool(
        user
        and user.is_authenticated
        and (user.is_superuser or tenant.created_by_id == user.pk or tenant.members.filter(pk=user.pk).exists())
    )


def permissions_for(user, definition):
    if not is_member(user, definition.tenant):
        return set()
    if user.is_superuser or definition.tenant.created_by_id == user.pk:
        return set(PERMISSIONS)
    grant = ClassificationGrant.objects.filter(classification_type=definition, user=user).first()
    granted = set(grant.permissions) if grant else set()
    return set(PERMISSIONS) if "administer" in granted else {"use", "propose"} | granted


def require(user, definition, permission):
    if permission not in permissions_for(user, definition):
        raise PermissionDenied(f"Classification permission required: {permission}.")


def snapshot(term):
    return {
        field: str(value) if field.endswith("_id") and value is not None else value
        for field in TERM_FIELDS
        for value in [getattr(term, field)]
    } | {"revision": term.revision}


def resolve_term(term):
    seen = set()
    while term.status == "merged":
        if term.pk in seen or not term.merged_into_id:
            raise ValidationError("Invalid classification redirect.")
        seen.add(term.pk)
        term = term.merged_into
    return term


def resolved_terms(terms):
    result = {}
    for term in terms:
        canonical = resolve_term(term)
        result.setdefault(canonical.pk, canonical)
    return list(result.values())


def descendants(term, *, include_self=True):
    ids = {term.pk} if include_self else set()
    frontier = {term.pk}
    while frontier:
        frontier = (
            set(
                Tag.objects.filter(
                    tenant_id=term.tenant_id,
                    namespace_id=term.namespace_id,
                    tag_type=term.tag_type,
                    parent_id__in=frontier,
                ).values_list("id", flat=True)
            )
            - ids
        )
        ids.update(frontier)
    return ids


def validate_and_save(term):
    from django.utils.text import slugify

    term.name = term.name.strip()
    term.slug = slugify(term.slug or term.name)
    try:
        term.full_clean()
        term.save()
    except ModelValidationError as exc:
        raise ValidationError(getattr(exc, "message_dict", exc.messages)) from exc
    except IntegrityError as exc:
        raise ClassificationConflict("A term with this slug already exists in this classification type.") from exc


def locked_definition(definition):
    from content.models import Namespace

    # Assignment writes take namespace -> media -> definition locks. Taxonomy
    # edits must enter through the same namespace gate before locking the type.
    Namespace.objects.select_for_update().get(pk=definition.namespace_id)
    return ClassificationType.objects.select_for_update().get(pk=definition.pk)


def _terms(definition):
    return Tag.objects.filter(
        tenant_id=definition.tenant_id, namespace_id=definition.namespace_id, tag_type=definition.key
    )


def _review(term, revision):
    if revision is None or term.revision != revision:
        raise ClassificationConflict({"message": "The term changed. Review it again.", "revision": term.revision})


def _related(definition, term_id):
    try:
        return _terms(definition).get(pk=term_id)
    except (Tag.DoesNotExist, ModelValidationError, ValueError, TypeError) as exc:
        raise ValidationError("Related term must belong to the same classification type and namespace.") from exc


def _validate_payload(action, payload):
    fields = {
        "create": {"name", "slug", "description", "alternative_names", "parent_id", "color"},
        "edit": {"name", "slug", "description", "alternative_names", "color"},
        "move": {"parent_id"},
        "merge": {"target_id", "target_revision"},
        "archive": set(),
        "reactivate": set(),
    }
    if (
        not isinstance(action, str)
        or action not in fields
        or not isinstance(payload, dict)
        or set(payload) - fields[action]
    ):
        raise ValidationError("Invalid classification action or fields.")
    for field in {"name", "slug", "description", "color"} & set(payload):
        if not isinstance(payload[field], str):
            raise ValidationError({field: "Use text."})
    if action == "create" and not payload.get("name", "").strip():
        raise ValidationError({"name": "Name is required."})
    if action == "move" and "parent_id" not in payload:
        raise ValidationError({"parent_id": "Choose a parent or null for the root."})
    if action == "merge" and not payload.get("target_id"):
        raise ValidationError({"target_id": "Choose a merge target."})


def _apply(user, definition, action, term, payload, *, proposal=None):
    require(user, definition, "restore" if action == "reactivate" else action)
    _validate_payload(action, payload)
    before = {} if action == "create" else {str(term.pk): snapshot(term)}
    changed = [term]
    if action == "reactivate" and term.status != "archived":
        raise ValidationError("Only archived terms may be restored.")
    if action not in {"create", "reactivate"} and term.status != "approved":
        raise ValidationError("Only approved terms may be changed.")
    if action in {"create", "edit"}:
        for key, value in payload.items():
            setattr(term, key, value)
        if term.parent_id:
            term.parent = _related(definition, term.parent_id)
        term.status = "approved"
    elif action == "move":
        term.parent = _related(definition, payload["parent_id"]) if payload["parent_id"] else None
    elif action == "reactivate":
        term.status = "approved"
    elif action == "archive":
        if term.children.exclude(status__in=["archived", "rejected", "merged"]).exists():
            raise ValidationError("Move or archive active children before archiving this term.")
        term.status = "archived"
    elif action == "merge":
        target = _related(definition, payload["target_id"])
        _review(target, payload.get("target_revision"))
        if target.status != "approved" or target.pk in descendants(term):
            raise ValidationError("Choose an approved target outside the source subtree.")
        changed += [target, *term.children.all()]
        for item in changed[1:]:
            before[str(item.pk)] = snapshot(item)
        target.alternative_names = list(
            dict.fromkeys(
                [
                    *target.alternative_names,
                    term.name,
                    *term.alternative_names,
                ]
            )
        )
        term.status, term.merged_into = "merged", target
        for child in changed[2:]:
            child.parent = target
    for item in changed:
        item.revision += 1
        validate_and_save(item)
        if action == "create":
            from .context import record_creation

            record_creation("taxonomy_tag_ids", item)
    definition.revision += 1
    definition.save(update_fields=["revision"])
    return ClassificationOperation.objects.create(
        classification_type=definition,
        action=action,
        actor=user,
        proposal=proposal,
        before=before,
        after={str(item.pk): snapshot(item) for item in changed},
        type_revision=definition.revision,
    )


@transaction.atomic
def mutate(user, definition, action, *, term=None, revision=None, payload=None):
    definition = locked_definition(definition)
    if not isinstance(action, str) or action not in ACTIONS:
        raise ValidationError("Unknown classification action.")
    if term:
        term = _related(definition, term.pk)
        _review(term, revision)
    elif action == "create":
        term = Tag(
            tenant=definition.tenant,
            namespace=definition.namespace,
            classification_type=definition,
            tag_type=definition.key,
            created_by=user,
        )
    else:
        raise ValidationError("Choose a term.")
    return _apply(user, definition, action, term, payload or {})


@transaction.atomic
def change_type(user, term, target_id, *, revision=None, payload=None):
    """Move an unused leaf to another type in its namespace without changing its ID."""
    from content.models import Namespace

    if not term.classification_type_id:
        raise ValidationError("Reconcile this legacy tag before changing its type.")
    Namespace.objects.select_for_update().get(pk=term.namespace_id)
    try:
        target = ClassificationType.objects.get(pk=target_id, tenant_id=term.tenant_id, namespace_id=term.namespace_id)
    except (ClassificationType.DoesNotExist, ModelValidationError, ValueError, TypeError) as exc:
        raise ValidationError({"classification_type": "Choose a tag type in the same namespace."}) from exc
    if target.pk == term.classification_type_id:
        raise ValidationError({"classification_type": "Choose a different tag type."})
    definitions = {
        item.pk: item
        for item in ClassificationType.objects.select_for_update()
        .filter(pk__in=[term.classification_type_id, target.pk])
        .order_by("pk")
    }
    source = definitions[term.classification_type_id]
    target = definitions[target.pk]
    require(user, source, "edit")
    require(user, target, "create")
    term = _related(source, term.pk)
    _review(term, revision)
    if term.status != "approved":
        raise ValidationError("Only approved tags may change type.")
    _validate_payload("edit", payload or {})
    if term.children.exists():
        raise ValidationError("Move or archive child tags before changing this tag's type.")
    if (
        term.page_version_links.exists()
        or term.object_version_links.exists()
        or term.media_file_classification_links.exists()
        or term.collection_classification_links.exists()
        or term.legacy_mappings.exists()
    ):
        raise ValidationError("A tag with assignments or legacy links cannot change type.")
    if ClassificationProposal.objects.filter(classification_type=source, status="pending").exists():
        raise ValidationError("Resolve pending proposals for this type before changing the tag's type.")
    before = {**snapshot(term), "classification_type_id": str(source.pk), "tag_type": source.key}
    for key, value in (payload or {}).items():
        setattr(term, key, value)
    term.classification_type = target
    term.tag_type = target.key
    term.parent = None
    term.revision += 1
    validate_and_save(term)
    source.revision += 1
    source.save(update_fields=["revision"])
    target.revision += 1
    target.save(update_fields=["revision"])
    return ClassificationOperation.objects.create(
        classification_type=source,
        action="change_type",
        actor=user,
        before={str(term.pk): before},
        after={str(term.pk): {**snapshot(term), "classification_type_id": str(target.pk), "tag_type": target.key}},
        type_revision=source.revision,
    )


@transaction.atomic
def propose(user, definition, action, *, term=None, revision=None, payload=None):
    definition = locked_definition(definition)
    require(user, definition, "propose")
    payload = payload or {}
    if action == "reactivate":
        raise ValidationError("Restoration requires a direct restore operation.")
    _validate_payload(action, payload)
    revisions = {}
    if action == "create":
        term = Tag(
            tenant=definition.tenant,
            namespace=definition.namespace,
            classification_type=definition,
            tag_type=definition.key,
            created_by=user,
            status="proposed",
            **payload,
        )
        if term.parent_id:
            term.parent = _related(definition, term.parent_id)
        validate_and_save(term)
    else:
        if not term:
            raise ValidationError("Choose a term.")
        term = _related(definition, term.pk)
        _review(term, revision)
        if term.status != "approved":
            raise ValidationError("Only approved terms may be proposed for change.")
    revisions[str(term.pk)] = term.revision
    if action == "merge":
        target = _related(definition, payload["target_id"])
        _review(target, payload.get("target_revision"))
        revisions[str(target.pk)] = target.revision
    if payload.get("parent_id"):
        parent = _related(definition, payload["parent_id"])
        revisions[str(parent.pk)] = parent.revision
    definition.revision += 1
    definition.save(update_fields=["revision"])
    return ClassificationProposal.objects.create(
        classification_type=definition,
        term=term,
        action=action,
        payload=payload,
        base_revisions=revisions,
        proposed_by=user,
    )


@transaction.atomic
def decide(user, proposal, decision, reason=""):
    definition = locked_definition(proposal.classification_type)
    proposal = ClassificationProposal.objects.select_for_update().get(pk=proposal.pk)
    if proposal.status != "pending":
        raise ClassificationConflict("This proposal has already been decided.")
    if decision == "withdrawn":
        if user.pk != proposal.proposed_by_id or not is_member(user, definition.tenant):
            raise PermissionDenied("Only the proposer may withdraw this proposal.")
    elif decision in {"approved", "rejected"}:
        require(user, definition, "approve")
        require(user, definition, proposal.action)
    else:
        raise ValidationError("Choose approved, rejected or withdrawn.")
    if decision == "approved":
        for term_id, revision in proposal.base_revisions.items():
            _review(_related(definition, term_id), revision)
        _apply(
            user,
            definition,
            proposal.action,
            _related(definition, proposal.term_id),
            proposal.payload,
            proposal=proposal,
        )
    else:
        term = _related(definition, proposal.term_id)
        before = snapshot(term)
        if proposal.action == "create":
            term.status, term.revision = "rejected", term.revision + 1
            term.save(update_fields=["status", "revision"])
        definition.revision += 1
        definition.save(update_fields=["revision"])
        ClassificationOperation.objects.create(
            classification_type=definition,
            actor=user,
            proposal=proposal,
            action="reject" if decision == "rejected" else "withdraw",
            before={str(term.pk): before},
            after={str(term.pk): snapshot(term)},
            type_revision=definition.revision,
        )
    proposal.status, proposal.decided_by, proposal.decided_at, proposal.reason = decision, user, timezone.now(), reason
    proposal.save(update_fields=["status", "decided_by", "decided_at", "reason"])
    return proposal


@transaction.atomic
def restore(user, operation):
    definition = locked_definition(operation.classification_type)
    require(user, definition, "restore")
    if (
        operation.action not in ACTIONS
        or definition.revision != operation.type_revision
        or hasattr(operation, "restoration")
    ):
        raise ClassificationConflict("Later changes prevent undo. Review the current classification.")
    current = {str(term.pk): term for term in _terms(definition).filter(pk__in=operation.after)}
    if {key: snapshot(term) for key, term in current.items()} != operation.after:
        raise ClassificationConflict("Affected terms changed after this operation.")
    for key, term in current.items():
        state = operation.before.get(key)
        if state:
            for field in TERM_FIELDS:
                setattr(term, field, state[field])
        else:
            # New identities remain traceable. Undoing create never deletes a term.
            term.status = "archived"
        term.revision += 1
        term.save()
    definition.revision += 1
    definition.save(update_fields=["revision"])
    return ClassificationOperation.objects.create(
        classification_type=definition,
        actor=user,
        action="restore",
        restores=operation,
        before=operation.after,
        after={key: snapshot(term) for key, term in current.items()},
        type_revision=definition.revision,
    )


def matching_term_ids(term_ids, *, tenant, include_descendants=True):
    terms = Tag.objects.filter(tenant=tenant, pk__in=term_ids)
    selected = set()
    for term in terms:
        target = resolve_term(term)
        selected.update(descendants(target) if include_descendants else {target.pk})
    frontier = selected.copy()
    while frontier:
        frontier = (
            set(Tag.objects.filter(tenant=tenant, merged_into_id__in=frontier).values_list("pk", flat=True)) - selected
        )
        selected.update(frontier)
    return selected


def filter_classifications(queryset, relation, term_ids, *, tenant, include_descendants=True):
    selected = matching_term_ids(term_ids, tenant=tenant, include_descendants=include_descendants)
    return queryset.filter(**{f"{relation}__in": selected}).distinct()


def requested_classifications(request, queryset, relation):
    raw = request.query_params.getlist("classification_ids")
    if not raw:
        return queryset
    from rest_framework import serializers

    ids = [serializers.UUIDField().run_validation(value) for group in raw for value in group.split(",")]
    return filter_classifications(
        queryset,
        relation,
        ids,
        tenant=request.tenant,
        include_descendants=request.query_params.get("include_descendants", "true").lower() != "false",
    )
