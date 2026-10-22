import re
from pathlib import PurePath

from asgiref.sync import sync_to_async
from django.core.handlers.asgi import ASGIRequest
from django.db.models import Max, Q
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.http import content_disposition_header
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.settings import api_settings

from . import files
from .access import AttachmentTicketAuthentication, issue_ticket
from .models import Activity, Attachment, Board, Card, Column, Comment, Label, Notification
from .search import search_cards
from .serializers import (
    ActivitySerializer,
    AttachmentSerializer,
    BoardSerializer,
    CardInput,
    CardSerializer,
    ColumnSerializer,
    CommentInput,
    CommentSerializer,
    ImportInput,
    ImportSerializer,
    LabelSerializer,
    MemberSerializer,
    NamedInput,
    NotificationSerializer,
    RevisionInput,
)
from .services import (
    bump,
    can_access,
    check_revision,
    enqueue_index,
    event,
    get_record,
    locked_tenant,
    members,
    mentions,
    undo_event,
    update_card,
    update_named,
)


def validated(schema, data):
    instance = schema(data=data)
    instance.is_valid(raise_exception=True)
    return instance.validated_data


class TenantPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        tenant = getattr(request, "tenant", None)
        return bool(tenant and can_access(request.user, tenant))


class BaseViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated, TenantPermission]

    def scoped(self, model):
        return model.objects.filter(tenant=self.request.tenant)


class BoardViewSet(BaseViewSet):
    serializer_class = BoardSerializer

    def list(self, request):
        return Response(BoardSerializer(self.scoped(Board), many=True).data)

    def create(self, request):
        title = serializers.CharField(max_length=200).run_validation(request.data.get("title"))
        with locked_tenant(request) as tenant:
            board = Board.objects.create(tenant=tenant, title=title)
            for index, name in enumerate(["To do", "In progress", "Done"]):
                Column.objects.create(tenant=tenant, board=board, title=name, position=index)
            event(tenant, request.user, board, "board.created", f"Created board {title}")
        return Response(BoardSerializer(board).data, status=201)

    def retrieve(self, request, pk=None):
        board = get_record(Board, request.tenant, pk)
        return Response(
            {
                **BoardSerializer(board).data,
                "columns": ColumnSerializer(self.scoped(Column).filter(board=board), many=True).data,
            }
        )

    def partial_update(self, request, pk=None):
        data = validated(NamedInput, request.data)
        with locked_tenant(request) as tenant:
            board = update_named(tenant, request.user, get_record(Board, tenant, pk), data)
        return Response(BoardSerializer(board).data)

    @action(detail=True, methods=["post"])
    def columns(self, request, pk=None):
        title = serializers.CharField(max_length=200).run_validation(request.data.get("title"))
        revision = validated(RevisionInput, request.data)["revision"]
        with locked_tenant(request) as tenant:
            board = get_record(Board, tenant, pk)
            check_revision(board, revision)
            column = Column.objects.create(tenant=tenant, board=board, title=title, position=board.columns.count())
            bump(board)
            event(tenant, request.user, column, "column.created", f"Created column {title}")
        return Response(ColumnSerializer(column).data, status=201)

    @action(detail=True, methods=["post"], url_path="reorder-columns")
    def reorder_columns(self, request, pk=None):
        revision = validated(RevisionInput, request.data)["revision"]
        ids = serializers.ListField(child=serializers.UUIDField()).run_validation(request.data.get("column_ids"))
        with locked_tenant(request) as tenant:
            board = get_record(Board, tenant, pk)
            check_revision(board, revision)
            current = set(board.columns.values_list("pk", flat=True))
            if len(ids) != len(current) or set(ids) != current:
                raise ValidationError("Include each board column exactly once.")
            previous = [str(value) for value in board.columns.values_list("pk", flat=True)]
            for position, column_id in enumerate(ids):
                Column.objects.filter(pk=column_id, tenant=tenant).update(position=position)
            bump(board)
            event(
                tenant,
                request.user,
                board,
                "columns.reordered",
                "Reordered columns",
                {"before": previous, "after": [str(value) for value in ids]},
            )
        return Response(BoardSerializer(board).data)


class ColumnViewSet(BaseViewSet):
    serializer_class = ColumnSerializer

    def partial_update(self, request, pk=None):
        data = validated(NamedInput, request.data)
        with locked_tenant(request) as tenant:
            column = get_record(Column, tenant, pk)
            update_named(tenant, request.user, column, data)
            bump(column.board)
        return Response(ColumnSerializer(column).data)


class CardPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = "page_size"
    max_page_size = 500


class CardViewSet(BaseViewSet):
    serializer_class = CardSerializer

    def list(self, request):
        cards = self.scoped(Card).select_related("column__board").prefetch_related("assignees", "labels")
        params = request.query_params
        for key, lookup in [
            ("board", "column__board_id"),
            ("column", "column_id"),
            ("assignee", "assignees__id"),
            ("label", "labels__id"),
        ]:
            if params.get(key):
                value = params[key]
                if key == "assignee":
                    value = serializers.IntegerField(min_value=1).run_validation(value)
                else:
                    value = serializers.UUIDField().run_validation(value)
                cards = cards.filter(**{lookup: value})
        if params.get("mine") == "true":
            cards = cards.filter(assignees=request.user)
        if params.get("archived") != "all":
            archived = params.get("archived") == "true"
            cards = cards.filter(archived=archived)
            if not archived:
                cards = cards.filter(column__archived=False, column__board__archived=False)
        if params.get("deadline") == "overdue":
            cards = cards.filter(deadline__lt=timezone.now())
        elif params.get("deadline") == "upcoming":
            from datetime import timedelta

            cards = cards.filter(deadline__gte=timezone.now(), deadline__lte=timezone.now() + timedelta(days=7))
        elif params.get("deadline") == "none":
            cards = cards.filter(deadline__isnull=True)
        query = params.get("q", "").strip()[:500]
        semantic_available = False
        if query:
            cards, semantic_available = search_cards(cards.distinct(), query, params.get("semantic") != "false")
        else:
            cards = cards.distinct()
        paginator = CardPagination()
        page = paginator.paginate_queryset(cards, request, view=self)
        response = paginator.get_paginated_response(CardSerializer(page, many=True).data)
        response.data["semantic_available"] = semantic_available
        return response

    def create(self, request):
        data = validated(CardInput, {**request.data, "revision": 1})
        if not data.get("title") or not data.get("column"):
            raise ValidationError("Title and column are required.")
        with locked_tenant(request) as tenant:
            column = get_record(Column, tenant, data.pop("column"))
            if column.archived or column.board.archived:
                raise ValidationError("Restore the board and column before creating a card.")
            number = (self.scoped(Card).aggregate(number=Max("number"))["number"] or 0) + 1
            card = Card.objects.create(
                tenant=tenant, column=column, title=data.pop("title"), number=number, position=column.cards.count()
            )
            event(tenant, request.user, card, "card.created", f"Created {card.short_id}")
            if set(data) - {"revision"}:
                update_card(tenant, request.user, card, data)
            else:
                enqueue_index(card)
        return Response(CardSerializer(card).data, status=201)

    def retrieve(self, request, pk=None):
        card = get_record(Card, request.tenant, pk)
        return Response(
            {
                **CardSerializer(card).data,
                "comments": CommentSerializer(card.comments.all(), many=True).data,
                "activity": ActivitySerializer(card.activity.select_related("actor"), many=True).data,
                "attachments": AttachmentSerializer(card.attachments.prefetch_related("imports"), many=True).data,
            }
        )

    def partial_update(self, request, pk=None):
        data = validated(CardInput, request.data)
        with locked_tenant(request) as tenant:
            card = update_card(tenant, request.user, get_record(Card, tenant, pk), data)
        return Response(CardSerializer(card).data)

    @action(detail=True, methods=["post"])
    def comments(self, request, pk=None):
        data = validated(CommentInput, request.data)
        with locked_tenant(request) as tenant:
            card = get_record(Card, tenant, pk)
            check_revision(card, data["revision"])
            comment = Comment.objects.create(tenant=tenant, card=card, author=request.user, body=data["body"])
            bump(card)
            entry = event(
                tenant,
                request.user,
                card,
                "comment.created",
                f"Commented on {card.short_id}",
                {"comment_id": str(comment.pk)},
            )
            mentions(tenant, request.user, card, comment.body, f"mention:{entry.pk}")
            enqueue_index(card)
        return Response(CommentSerializer(comment).data, status=201)

    @action(detail=True, methods=["post"])
    def attachments(self, request, pk=None):
        revision = validated(RevisionInput, request.data)["revision"]
        card = get_record(Card, request.tenant, pk)
        upload = request.FILES.get("file")
        if not upload:
            raise ValidationError("Choose a file to upload.")
        comment = None
        if request.data.get("comment"):
            comment_id = serializers.UUIDField().run_validation(request.data["comment"])
            comment = get_object_or_404(Comment, tenant=request.tenant, card=card, pk=comment_id)
        # Validate/upload before taking the tenant write lock.
        path = files.save_upload(request.tenant, upload)
        try:
            with locked_tenant(request) as tenant:
                card = get_record(Card, tenant, pk)
                check_revision(card, revision)
                attachment = Attachment.objects.create(
                    tenant=tenant,
                    card=card,
                    comment=comment,
                    filename=PurePath(upload.name).name,
                    path=path,
                    content_type=upload.content_type,
                    size=upload.size,
                    uploaded_by=request.user,
                )
                bump(card)
                event(
                    tenant,
                    request.user,
                    card,
                    "attachment.uploaded",
                    f"Uploaded {attachment.filename}",
                    {"attachment_id": str(attachment.pk)},
                )
                enqueue_index(card)
        except Exception:
            files.attachment_storage.delete(path)
            raise
        return Response(AttachmentSerializer(attachment).data, status=201)


class CommentViewSet(BaseViewSet):
    serializer_class = CommentSerializer

    def partial_update(self, request, pk=None):
        data = validated(CommentInput, request.data)
        with locked_tenant(request) as tenant:
            comment = get_record(Comment, tenant, pk)
            check_revision(comment, data["revision"])
            before = comment.body
            comment.body = data["body"]
            comment.edited_at = timezone.now()
            bump(comment)
            bump(comment.card)
            entry = event(
                tenant,
                request.user,
                comment.card,
                "comment.edited",
                "Edited comment",
                {"comment_id": str(comment.pk), "before": before, "after": comment.body},
            )
            mentions(tenant, request.user, comment.card, comment.body, f"mention:{entry.pk}")
            enqueue_index(comment.card)
        return Response(CommentSerializer(comment).data)


class AttachmentViewSet(BaseViewSet):
    authentication_classes = [AttachmentTicketAuthentication, *api_settings.DEFAULT_AUTHENTICATION_CLASSES]
    serializer_class = AttachmentSerializer

    def list(self, request):
        attachments = self.scoped(Attachment).select_related("card__column__board").prefetch_related("imports")
        if request.query_params.get("approved") == "true":
            attachments = attachments.filter(approved_at__isnull=False)
        query = request.query_params.get("q", "").strip()[:500]
        if query:
            cards, _ = search_cards(Card.objects.filter(tenant=request.tenant), query)
            attachments = attachments.filter(Q(filename__icontains=query) | Q(card_id__in=[card.pk for card in cards]))
        return Response(
            [
                {**AttachmentSerializer(item).data, "card_title": item.card.title, "short_id": item.card.short_id}
                for item in attachments.order_by("-created_at")[:100]
            ]
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        revision = validated(RevisionInput, request.data)["revision"]
        with locked_tenant(request) as tenant:
            attachment = get_record(Attachment, tenant, pk)
            check_revision(attachment.card, revision)
            if not attachment.approved_at:
                attachment.approved_at = timezone.now()
                attachment.approved_by = request.user
                attachment.save()
                bump(attachment.card)
                event(
                    tenant,
                    request.user,
                    attachment.card,
                    "attachment.approved",
                    f"Approved {attachment.filename}",
                    {"attachment_id": str(attachment.pk)},
                )
                enqueue_index(attachment.card)
        return Response(AttachmentSerializer(attachment).data)

    @action(detail=True, methods=["post"], url_path="import")
    def import_file(self, request, pk=None):
        data = validated(ImportInput, request.data)
        from core.machine_api_keys import MEDIA_WRITE, SERVER_FULL_ACCESS, THEME_WRITE
        from core.models import MachineAPIKey

        if isinstance(request.auth, MachineAPIKey):
            required = MEDIA_WRITE if data["destination"] == "media" else THEME_WRITE
            if required not in request.auth.scopes and SERVER_FULL_ACCESS not in request.auth.scopes:
                raise PermissionDenied("This integration also needs destination write access.")
        attachment = get_record(Attachment, request.tenant, pk)
        check_revision(attachment.card, data["revision"])
        with files.prepared_attachment(attachment) as prepared:
            with locked_tenant(request) as tenant:
                attachment = get_record(Attachment, tenant, pk)
                check_revision(attachment.card, data["revision"])
                record = files.import_attachment(tenant, request.user, attachment, data, prepared=prepared)
                bump(attachment.card)
                enqueue_index(attachment.card)
        return Response(ImportSerializer(record).data, status=201)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        attachment = get_record(Attachment, request.tenant, pk)
        start, end = 0, attachment.size - 1
        range_header = request.headers.get("Range")
        if range_header:
            match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header)
            if not match or not any(match.groups()):
                return Response(status=416, headers={"Content-Range": f"bytes */{attachment.size}"})
            if match[1]:
                start = int(match[1])
                end = min(int(match[2]), end) if match[2] else end
            else:
                start = max(0, attachment.size - int(match[2]))
            if start > end or start >= attachment.size:
                return Response(status=416, headers={"Content-Range": f"bytes */{attachment.size}"})
        # S3 range streaming avoids buffering an entire instruction video in RAM.
        result = files.attachment_storage.client.get_object(
            Bucket=files.attachment_storage.bucket_name,
            Key=files.attachment_storage._get_key(attachment.path),
            Range=f"bytes={start}-{end}",
        )
        body = result["Body"]

        def chunks():
            try:
                yield from body.iter_chunks(chunk_size=65536)
            finally:
                body.close()

        async def async_chunks():
            try:
                while chunk := await sync_to_async(body.read, thread_sensitive=False)(65536):
                    yield chunk
            finally:
                await sync_to_async(body.close, thread_sensitive=False)()

        inline = attachment.content_type in {
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "video/mp4",
            "video/webm",
        }
        response = StreamingHttpResponse(
            async_chunks() if isinstance(request._request, ASGIRequest) else chunks(),
            status=206 if range_header else 200,
            content_type=attachment.content_type if inline else "application/octet-stream",
        )
        # Close the S3 body even for HEAD or a disconnect before iteration starts.
        response._resource_closers.append(body.close)
        response["Content-Disposition"] = content_disposition_header(not inline, attachment.filename)
        response["Content-Length"] = end - start + 1
        response["Accept-Ranges"] = "bytes"
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        if range_header:
            response["Content-Range"] = f"bytes {start}-{end}/{attachment.size}"
        return response


class WorkspaceViewSet(BaseViewSet):
    serializer_class = BoardSerializer

    def list(self, request):
        return Response(
            {
                "tenant_id": str(request.tenant.pk),
                "members": MemberSerializer(members(request.tenant), many=True).data,
                "boards": BoardSerializer(self.scoped(Board), many=True).data,
                "columns": ColumnSerializer(self.scoped(Column), many=True).data,
                "labels": LabelSerializer(self.scoped(Label), many=True).data,
                "notifications": NotificationSerializer(
                    self.scoped(Notification).filter(user=request.user)[:100], many=True
                ).data,
                "file_types": files.ALLOWED_TYPES,
                "file_limits": files.FileUploadValidator.MAX_FILE_SIZES,
            }
        )

    @action(detail=False, methods=["get"])
    def access(self, request):
        return Response(
            {"ticket": issue_ticket(request.user, request.tenant)}, headers={"Cache-Control": "private, no-store"}
        )

    @action(detail=False, methods=["post"])
    def labels(self, request):
        name = serializers.CharField(max_length=80).run_validation(request.data.get("name"))
        with locked_tenant(request) as tenant:
            label, _ = Label.objects.get_or_create(tenant=tenant, name=name)
        return Response(LabelSerializer(label).data, status=201)

    @action(detail=False, methods=["post"], url_path="read-notification")
    def read_notification(self, request):
        notification_id = serializers.UUIDField().run_validation(request.data.get("id"))
        item = get_object_or_404(self.scoped(Notification), user=request.user, pk=notification_id)
        item.read = True
        item.save(update_fields=["read"])
        return Response({"read": True})

    @action(detail=False, methods=["post"])
    def undo(self, request):
        activity_id = serializers.UUIDField().run_validation(request.data.get("activity_id"))
        with locked_tenant(request) as tenant:
            entry = get_record(Activity, tenant, activity_id)
            undo_event(tenant, request.user, entry)
        return Response({"undone": True})

    @action(detail=False, methods=["get"])
    def activity(self, request):
        events = self.scoped(Activity).select_related("actor")
        if request.query_params.get("board"):
            board_id = serializers.UUIDField().run_validation(request.query_params["board"])
            events = events.filter(board_id=board_id)
        return Response(ActivitySerializer(events.order_by("-created_at")[:100], many=True).data)
