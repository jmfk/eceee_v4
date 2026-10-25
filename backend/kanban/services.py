"""Atomic workflow boundary. Call mutations inside locked_tenant()."""

import logging
import re
from contextlib import contextmanager
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import F, Max, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from core.models import Tenant

from .models import Activity, Board, Card, Column, Label, Notification

logger = logging.getLogger(__name__)


class Conflict(APIException):
    status_code = 409
    default_detail = "This item changed. Reload before saving; your unsaved text is still available."


def members(tenant):
    return User.objects.filter(Q(member_tenants=tenant) | Q(pk=tenant.created_by_id), is_active=True).distinct()


def board_members(board):
    return User.objects.filter(
        Q(member_tenants=board.tenant) | Q(pk=board.tenant.created_by_id) | Q(kanban_boards=board), is_active=True
    ).distinct()


def can_access(user, tenant):
    if not (user and user.is_authenticated and user.is_active and tenant.is_active):
        return False
    from core.roles import permissions_for

    allowed = permissions_for(user, tenant)
    return "kanban.read" in allowed or "kanban.write" in allowed or "tenant.admin" in allowed


@contextmanager
def locked_tenant(request):
    with transaction.atomic():
        tenant = get_object_or_404(Tenant.objects.select_for_update(), pk=request.tenant.pk)
        if not can_access(request.user, tenant):
            raise PermissionDenied("Kanban access is required.")
        yield tenant


def check_revision(obj, revision):
    if obj.revision != revision:
        raise Conflict()


def get_record(model, tenant, pk):
    return get_object_or_404(model.objects.filter(tenant=tenant), pk=pk)


def broadcast(tenant_id):
    try:
        layer = get_channel_layer()
        if layer:
            async_to_sync(layer.group_send)(f"kanban_{tenant_id}", {"type": "kanban.changed"})
    except Exception:
        logger.warning("Kanban refresh broadcast unavailable")


def event(tenant, actor, obj, kind, message, changes=None, undo=None):
    board = obj.column.board if isinstance(obj, Card) else obj.board if isinstance(obj, Column) else obj
    item = Activity.objects.create(
        tenant=tenant,
        actor=actor,
        board=board,
        card=obj if isinstance(obj, Card) else None,
        kind=kind,
        message=message,
        changes=changes or {},
        undo=undo or {},
    )
    transaction.on_commit(lambda: broadcast(str(tenant.pk)))
    return item


def bump(obj):
    obj.revision += 1
    obj.save()


def notify(tenant, card, user_ids, key, message, actor=None):
    allowed = board_members(card.column.board).filter(pk__in=user_ids)
    if actor:
        allowed = allowed.exclude(pk=actor.pk)
    for user in allowed:
        Notification.objects.get_or_create(
            tenant=tenant,
            user=user,
            dedupe_key=key,
            defaults={"card": card, "message": message[:500]},
        )


def mentions(tenant, actor, card, text, key):
    ids = [int(value) for value in re.findall(r"\]\(#member-(\d+)\)", text)]
    notify(tenant, card, ids, key, f"{actor.username} mentioned you in {card.short_id}", actor)


def deadline_notifications(card):
    if (
        not card.mirror_of_id
        and card.deadline
        and not card.archived
        and not card.column.archived
        and not card.column.board.archived
        and timezone.now() <= card.deadline <= timezone.now() + timedelta(days=1)
    ):
        notify(
            card.tenant,
            card,
            card.assignees.values_list("pk", flat=True),
            f"deadline:{card.pk}:{card.deadline.isoformat()}",
            f"{card.short_id} is due {card.deadline.isoformat()}",
        )


def enqueue_index(card):
    def enqueue():
        from .tasks import index_card

        try:
            index_card.apply_async(args=[str(card.pk)], retry=False)
        except Exception:
            logger.warning("Kanban index enqueue unavailable; periodic repair will retry")

    transaction.on_commit(enqueue)


def normalize_positions(model, tenant, **scope):
    for index, item in enumerate(model.objects.filter(tenant=tenant, **scope).order_by("position", "created_at", "id")):
        if item.position != index:
            model.objects.filter(pk=item.pk).update(position=index, revision=F("revision") + 1)


def place_card(card, column, position):
    previous_column = card.column_id
    others = list(
        Card.objects.filter(tenant=card.tenant, column=column)
        .exclude(pk=card.pk)
        .order_by("position", "created_at", "id")
    )
    others.insert(min(position, len(others)), card)
    card.column = column
    for index, item in enumerate(others):
        if item.pk != card.pk and item.position != index:
            Card.objects.filter(pk=item.pk).update(position=index, revision=F("revision") + 1)
        if item.pk == card.pk:
            card.position = index
    if previous_column != column.pk:
        Card.objects.filter(pk=card.pk).update(column=column, position=card.position)
        normalize_positions(Card, card.tenant, column_id=previous_column)


SHARED_CARD_FIELDS = (
    "title",
    "description",
    "checklist",
    "external_references",
    "deadline",
    "cover_color",
    "cover_attachment_id",
)


def duplicate_card(tenant, actor, source, column, mirror=False):
    """Caller holds the tenant lock; copies and mirrors cannot cross tenants."""
    if source.mirror_of_id:
        source = get_record(Card, tenant, source.mirror_of_id)
    if column.archived or column.board.archived:
        raise ValidationError("Restore the destination before creating cards there.")
    number = (Card.objects.filter(tenant=tenant).aggregate(number=Max("number"))["number"] or 0) + 1
    card = Card.objects.create(
        tenant=tenant,
        column=column,
        number=number,
        position=column.cards.count(),
        mirror_of=source if mirror else None,
        **{field: getattr(source, field) for field in SHARED_CARD_FIELDS},
    )
    card.assignees.set(source.assignees.all())
    card.labels.set(source.labels.all())
    kind = "mirrored" if mirror else "copied"
    event(
        tenant,
        actor,
        card,
        f"card.{kind}",
        f"{source.short_id} {kind} as {card.short_id}",
        undo={"model": "card", "id": str(card.pk), "revision": card.revision, "archived": True},
    )
    enqueue_index(card)
    return card


def sync_mirrors(card):
    for mirror in card.mirrors.filter(tenant=card.tenant):
        for field in SHARED_CARD_FIELDS:
            setattr(mirror, field, getattr(card, field))
        mirror.assignees.set(card.assignees.all())
        mirror.labels.set(card.labels.all())
        bump(mirror)
        enqueue_index(mirror)


def update_card(tenant, actor, card, data):
    check_revision(card, data.pop("revision"))
    if card.mirror_of_id and set(data) - {"column", "position", "archived"}:
        raise ValidationError("Edit shared content through the original card.")
    if "cover_attachment" in data:
        attachment_id = data.pop("cover_attachment")
        if attachment_id is not None:
            from .models import Attachment

            attachment = get_object_or_404(Attachment, pk=attachment_id, tenant=tenant, card=card)
            if (
                attachment.content_type not in {"image/jpeg", "image/png", "image/gif", "image/webp"}
                or attachment.size > 10 * 1024 * 1024
            ):
                raise ValidationError(
                    "The cover must be a JPEG, PNG, GIF or WebP attachment smaller than 10 MB on this card."
                )
        data["cover_attachment_id"] = attachment_id
    undo = {}
    changes = {}
    if "column" in data or "position" in data:
        column = get_record(Column, tenant, data.pop("column", card.column_id))
        if column.archived or column.board.archived:
            raise ValidationError("Restore the destination column and board before moving cards there.")
        undo.update(column=str(card.column_id), position=card.position)
        place_card(card, column, data.pop("position", card.position))
        changes["move"] = {"board": column.board.title, "column": column.title}
    if "assignees" in data:
        ids = set(data.pop("assignees"))
        if set(board_members(card.column.board).filter(pk__in=ids).values_list("pk", flat=True)) != ids:
            raise ValidationError("Assignees must have access to this board.")
        added = ids - set(card.assignees.values_list("pk", flat=True))
        card.assignees.set(ids)
        notify(
            tenant,
            card,
            added,
            f"assignment:{card.pk}:{card.revision + 1}",
            f"You were assigned to {card.short_id}",
            actor,
        )
        changes["assignees"] = sorted(ids)
    if "labels" in data:
        ids = set(data.pop("labels"))
        labels = Label.objects.filter(tenant=tenant, pk__in=ids)
        if set(labels.values_list("pk", flat=True)) != ids:
            raise ValidationError("Labels must belong to this tenant.")
        card.labels.set(labels)
        changes["labels"] = [str(value) for value in ids]
    for field, value in data.items():
        old = getattr(card, field)
        if old != value:
            if field == "archived":
                undo[field] = old
            before = str(old) if old is not None and field in {"deadline", "cover_attachment_id"} else old
            after = str(value) if value is not None and field in {"deadline", "cover_attachment_id"} else value
            changes[field] = {
                "before": before,
                "after": after,
            }
            setattr(card, field, value)
    bump(card)
    if undo and set(changes) <= {"move", "archived"}:
        undo.update(model="card", id=str(card.pk), revision=card.revision)
    else:
        undo = {}
    message = f"Updated {card.short_id}"
    if "move" in changes:
        message = f"Moved {card.short_id} to {card.column.board.title} / {card.column.title}"
    elif "archived" in changes:
        message = f"{'Archived' if card.archived else 'Restored'} {card.short_id}"
    entry = event(tenant, actor, card, "card.updated", message, changes, undo)
    if "description" in changes:
        mentions(tenant, actor, card, card.description, f"mention:{entry.pk}")
    deadline_notifications(card)
    enqueue_index(card)
    if not card.mirror_of_id and set(changes) - {"move", "archived"}:
        sync_mirrors(card)
    return card


def ensure_required_columns(board):
    for role, title in [("inbox", "Inbox"), ("done", "Done"), ("archive", "Archive")]:
        if not board.columns.filter(role=role).exists():
            column = board.columns.filter(role="", title__iexact=title).first()
            if column:
                column.role, column.archived = role, False
                column.save(update_fields=["role", "archived"])
            else:
                Column.objects.create(
                    tenant=board.tenant, board=board, role=role, title=title, position=board.columns.count()
                )


def update_named(tenant, actor, obj, data):
    if isinstance(obj, Column) and obj.role and data.get("archived"):
        raise ValidationError("Inbox, Done and Archive are required lists and cannot be archived.")
    check_revision(obj, data.pop("revision"))
    undo = {}
    changes = {}
    for field, value in data.items():
        if field == "archived":
            undo[field] = obj.archived
        changes[field] = {"before": getattr(obj, field), "after": value}
        setattr(obj, field, value)
    bump(obj)
    if undo and set(changes) == {"archived"}:
        undo.update(model="column" if isinstance(obj, Column) else "board", id=str(obj.pk), revision=obj.revision)
    else:
        undo = {}
    event(tenant, actor, obj, "container.updated", f"Updated {obj.title}", changes, undo)
    return obj


def undo_event(tenant, actor, entry):
    data = entry.undo
    if not data:
        raise Conflict("This activity cannot be undone.")
    model = {"card": Card, "board": Board, "column": Column}[data["model"]]
    obj = get_record(model, tenant, data["id"])
    check_revision(obj, data["revision"])
    if "column" in data:
        column = get_record(Column, tenant, data["column"])
        if column.archived or column.board.archived:
            raise Conflict("Restore the original board/column first.")
        place_card(obj, column, data["position"])
    if isinstance(obj, Column) and obj.role and data.get("archived"):
        raise Conflict("Required lists cannot be archived.")
    if "archived" in data:
        obj.archived = data["archived"]
    bump(obj)
    # Original event stays immutable; advancing the resource revision invalidates it.
    event(tenant, actor, obj, "action.undone", f"Undid: {entry.message}", {"activity_id": str(entry.pk)})
    if isinstance(obj, Card):
        enqueue_index(obj)
    return obj
