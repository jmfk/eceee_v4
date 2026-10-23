from datetime import timedelta
from unittest.mock import MagicMock, patch

from asgiref.sync import async_to_sync
from django.contrib.auth.models import AnonymousUser, User
from django.test import SimpleTestCase, TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from core.models import Tenant

from .consumers import KanbanConsumer
from .models import Activity, Attachment, Board, Card, Column, Comment, Label, Notification
from .search import search_cards
from .services import deadline_notifications
from .tasks import index_card
from .views import AttachmentViewSet, BoardViewSet, CardViewSet, ColumnViewSet, CommentViewSet, WorkspaceViewSet


class BoundedVideoStream:
    """Generate a large video-shaped stream without allocating its whole size."""

    mode = "rb"

    def __init__(self, size, on_read=None):
        self.size = size
        self.position = 0
        self.closed = False
        self.read_sizes = []
        self.on_read = on_read

    def read(self, size=-1):
        if not 0 <= size <= 1024 * 1024:
            raise AssertionError("Large file reads must be explicitly bounded")
        if self.on_read:
            self.on_read()
        self.read_sizes.append(size)
        count = min(size, self.size - self.position)
        header = b"\x00\x00\x00\x18ftypisom"
        value = header[self.position : self.position + count] if self.position < len(header) else b""
        value += bytes(count - len(value))
        self.position += count
        return value

    def seek(self, offset, whence=0):
        self.position = offset if whence == 0 else self.position + offset if whence == 1 else self.size + offset
        return self.position

    def tell(self):
        return self.position

    def close(self):
        self.closed = True


class KanbanTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner")
        self.other = User.objects.create_user(username="other")
        self.tenant = Tenant.objects.create(name="Tenant", identifier="tenant", created_by=self.user)
        self.foreign = Tenant.objects.create(name="Other", identifier="other", created_by=self.other)
        self.board = Board.objects.create(tenant=self.tenant, title="Work")
        self.column = Column.objects.create(tenant=self.tenant, board=self.board, title="To do")
        self.target = Column.objects.create(tenant=self.tenant, board=self.board, title="Done", position=1)
        self.card = Card.objects.create(tenant=self.tenant, column=self.column, number=1, title="Fix header")
        self.foreign_board = Board.objects.create(tenant=self.foreign, title="Secret")
        self.foreign_column = Column.objects.create(tenant=self.foreign, board=self.foreign_board, title="Secret")
        self.secret = Card.objects.create(
            tenant=self.foreign, column=self.foreign_column, number=1, title="Secret header"
        )
        self.factory = APIRequestFactory()

    def call(self, cls, action, data=None, pk=None, method="post", user=None, tenant=None, **headers):
        request = getattr(self.factory, method)("/", data=data or {}, format="json", **headers)
        force_authenticate(request, user=user or self.user)
        request.tenant = tenant or self.tenant
        kwargs = {"pk": str(pk)} if pk is not None else {}
        return cls.as_view({method: action})(request, **kwargs)

    def test_member_boundary_even_for_superusers(self):
        self.user.is_superuser = True
        self.user.save()
        response = self.call(CardViewSet, "list", method="get", tenant=self.foreign)
        self.assertEqual(response.status_code, 403)
        self.tenant.members.add(self.other)
        self.assertEqual(self.call(CardViewSet, "list", method="get", user=self.other).status_code, 200)

    def test_foreign_resources_are_not_found(self):
        for cls, pk in [(CardViewSet, self.secret.pk), (BoardViewSet, self.foreign_board.pk)]:
            self.assertEqual(self.call(cls, "retrieve", pk=pk, method="get").status_code, 404)
        attachment = Attachment.objects.create(
            tenant=self.foreign,
            card=self.secret,
            filename="secret.txt",
            path="secret",
            content_type="text/plain",
            size=4,
            uploaded_by=self.other,
        )
        with patch("kanban.files.attachment_storage") as storage:
            self.assertEqual(self.call(AttachmentViewSet, "download", pk=attachment.pk, method="get").status_code, 404)
            storage.client.get_object.assert_not_called()

    def test_board_creation_and_column_reorder(self):
        response = self.call(BoardViewSet, "create", {"title": "New board"})
        self.assertEqual(response.status_code, 201)
        board = Board.objects.get(pk=response.data["id"])
        self.assertEqual(board.columns.count(), 3)
        ids = list(reversed([str(value) for value in board.columns.values_list("pk", flat=True)]))
        response = self.call(BoardViewSet, "reorder_columns", {"revision": 1, "column_ids": ids}, pk=board.pk)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([str(value) for value in board.columns.values_list("pk", flat=True)], ids)
        self.assertEqual(
            self.call(BoardViewSet, "reorder_columns", {"revision": 1, "column_ids": ids}, pk=board.pk).status_code, 409
        )

    def test_card_ids_survive_cross_board_move_and_undo(self):
        neighbor = Card.objects.create(tenant=self.tenant, column=self.column, number=2, title="Next", position=1)
        other_board = Board.objects.create(tenant=self.tenant, title="Review")
        destination = Column.objects.create(tenant=self.tenant, board=other_board, title="Approved")
        response = self.call(
            CardViewSet,
            "partial_update",
            {"revision": 1, "column": str(destination.pk), "position": 0},
            pk=self.card.pk,
            method="patch",
        )
        self.assertEqual(response.status_code, 200)
        self.card.refresh_from_db()
        self.assertEqual(self.card.short_id, "TASK-1")
        neighbor.refresh_from_db()
        self.assertEqual(neighbor.position, 0)
        self.assertEqual(neighbor.revision, 2)
        entry = self.card.activity.latest("created_at")
        self.assertIn("Review / Approved", entry.message)
        response = self.call(WorkspaceViewSet, "undo", {"activity_id": str(entry.pk)})
        self.assertEqual(response.status_code, 200)
        self.card.refresh_from_db()
        self.assertEqual(self.card.column_id, self.column.pk)
        self.assertEqual(self.call(WorkspaceViewSet, "undo", {"activity_id": str(entry.pk)}).status_code, 409)
        entry.refresh_from_db()
        self.assertTrue(entry.undo)  # history is immutable

    def test_stale_edits_do_not_write_state_or_history(self):
        response = self.call(
            CardViewSet, "partial_update", {"revision": 99, "title": "Overwrite"}, pk=self.card.pk, method="patch"
        )
        self.assertEqual(response.status_code, 409)
        self.card.refresh_from_db()
        self.assertEqual(self.card.title, "Fix header")
        self.assertEqual(Activity.objects.count(), 0)

    def test_move_and_assignee_cannot_cross_tenant(self):
        for update in [{"column": str(self.foreign_column.pk)}, {"assignees": [self.other.pk]}]:
            response = self.call(
                CardViewSet, "partial_update", {"revision": 1, **update}, pk=self.card.pk, method="patch"
            )
            self.assertIn(response.status_code, [400, 404])
        self.assertEqual(Activity.objects.count(), 0)

    def test_labels_checklists_and_external_references(self):
        label = Label.objects.create(tenant=self.tenant, name="Bug")
        response = self.call(
            CardViewSet,
            "partial_update",
            {
                "revision": 1,
                "labels": [str(label.pk)],
                "checklist": [{"id": "a", "text": "Check", "done": False}],
                "external_references": [{"system": "GitHub", "issue_id": "12", "url": "https://example.org/issues/12"}],
            },
            pk=self.card.pk,
            method="patch",
        )
        self.assertEqual(response.status_code, 200)
        self.card.refresh_from_db()
        self.assertEqual(self.card.checklist[0]["id"], "a")
        self.assertEqual(self.card.labels.count(), 1)

    def test_invalid_checklist_is_rejected(self):
        response = self.call(
            CardViewSet,
            "partial_update",
            {
                "revision": 1,
                "checklist": [{"id": "a", "text": "A", "done": False}, {"id": "a", "text": "B", "done": True}],
            },
            pk=self.card.pk,
            method="patch",
        )
        self.assertEqual(response.status_code, 400)

    def test_archive_containers_preserves_descendants_and_files(self):
        attachment = Attachment.objects.create(
            tenant=self.tenant,
            card=self.card,
            filename="note.txt",
            path="kept",
            content_type="text/plain",
            size=4,
            uploaded_by=self.user,
        )
        for cls, obj in [(ColumnViewSet, self.column), (BoardViewSet, self.board)]:
            obj.refresh_from_db()
            response = self.call(
                cls, "partial_update", {"revision": obj.revision, "archived": True}, pk=obj.pk, method="patch"
            )
            self.assertEqual(response.status_code, 200)
        self.assertEqual(self.call(CardViewSet, "list", method="get").data["results"], [])
        self.assertTrue(Attachment.objects.filter(pk=attachment.pk).exists())
        self.assertEqual(len(self.call(CardViewSet, "list", {"archived": "all"}, method="get").data["results"]), 1)

    def test_comments_mentions_edit_and_activity_are_atomic(self):
        self.tenant.members.add(self.other)
        response = self.call(
            CardViewSet,
            "comments",
            {"revision": 1, "body": f"Please [@Other](#member-{self.other.pk})"},
            pk=self.card.pk,
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Notification.objects.filter(user=self.other, tenant=self.tenant).count(), 1)
        comment = Comment.objects.get(pk=response.data["id"])
        response = self.call(
            CommentViewSet, "partial_update", {"revision": 1, "body": "Changed"}, pk=comment.pk, method="patch"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.card.activity.count(), 2)
        self.assertEqual(
            self.call(
                CommentViewSet, "partial_update", {"revision": 1, "body": "Stale"}, pk=comment.pk, method="patch"
            ).status_code,
            409,
        )

    def test_due_notifications_are_idempotent(self):
        self.card.deadline = timezone.now() + timedelta(hours=3)
        self.card.save()
        self.card.assignees.add(self.user)
        deadline_notifications(self.card)
        deadline_notifications(self.card)
        self.assertEqual(Notification.objects.count(), 1)
        self.board.archived = True
        self.board.save()
        self.card.deadline = timezone.now() + timedelta(hours=4)
        self.card.save()
        deadline_notifications(self.card)
        self.assertEqual(Notification.objects.count(), 1)

    def test_notification_cannot_be_read_by_other_member(self):
        self.tenant.members.add(self.other)
        notice = Notification.objects.create(
            tenant=self.tenant, user=self.other, card=self.card, message="Private", dedupe_key="one"
        )
        self.assertEqual(self.call(WorkspaceViewSet, "read_notification", {"id": str(notice.pk)}).status_code, 404)
        self.assertEqual(self.call(WorkspaceViewSet, "list", method="get").data["notifications"], [])

    @patch("kanban.search.embed", return_value=None)
    def test_lexical_fallback_is_tenant_scoped(self, embed):
        cards, available = search_cards(Card.objects.filter(tenant=self.tenant), "header")
        self.assertEqual([item.pk for item in cards], [self.card.pk])
        self.assertFalse(available)
        cards, _ = search_cards(Card.objects.filter(tenant=self.tenant), "TASK-1")
        self.assertEqual(cards[0].pk, self.card.pk)

    @patch("kanban.search.embed", return_value=[1.0, 0.0])
    def test_semantic_search_excludes_stale_vectors(self, embed):
        self.card.embedding = [1.0, 0.0]
        self.card.embedding_revision = 1
        self.card.embedding_model = "text-embedding-3-small"
        self.card.save()
        cards, available = search_cards(Card.objects.filter(tenant=self.tenant), "layout")
        self.assertEqual(len(cards), 1)
        self.assertTrue(available)
        self.card.revision = 2
        self.card.save()
        cards, _ = search_cards(Card.objects.filter(tenant=self.tenant), "layout")
        self.assertEqual(cards, [])

    @patch("kanban.tasks.embed", return_value=[1.0, 0.0])
    def test_indexing_stores_revision_and_comment_filename_text(self, embed):
        Comment.objects.create(tenant=self.tenant, card=self.card, author=self.user, body="Instructions")
        index_card(str(self.card.pk))
        self.card.refresh_from_db()
        self.assertEqual(self.card.embedding_revision, 1)
        self.assertIn("Instructions", embed.call_args.args[0])

    def test_index_write_does_not_overwrite_newer_revision(self):
        def change(_):
            Card.objects.filter(pk=self.card.pk).update(revision=2)
            return [1.0, 0.0]

        with patch("kanban.tasks.embed", side_effect=change):
            index_card(str(self.card.pk))
        self.card.refresh_from_db()
        self.assertEqual(self.card.embedding_revision, 0)

    def attachment(self):
        return Attachment.objects.create(
            tenant=self.tenant,
            card=self.card,
            filename="guide.mp4",
            path="private/guide",
            content_type="video/mp4",
            size=100,
            uploaded_by=self.user,
        )

    def test_private_download_supports_ranges_and_invalid_ranges(self):
        attachment = self.attachment()
        with patch("kanban.files.attachment_storage") as storage:
            storage.client.get_object.return_value = {"Body": MagicMock()}
            response = self.call(
                AttachmentViewSet, "download", pk=attachment.pk, method="get", HTTP_RANGE="bytes=10-19"
            )
            self.assertEqual(response.status_code, 206)
            self.assertEqual(response["Content-Range"], "bytes 10-19/100")
            self.assertEqual(response["Cache-Control"], "private, no-store")
            self.assertEqual(storage.client.get_object.call_args.kwargs["Range"], "bytes=10-19")
            self.assertEqual(
                self.call(
                    AttachmentViewSet, "download", pk=attachment.pk, method="get", HTTP_RANGE="bytes=100-200"
                ).status_code,
                416,
            )

    def test_unapproved_import_is_rejected(self):
        attachment = self.attachment()
        response = self.call(
            AttachmentViewSet,
            "import_file",
            {"revision": 1, "destination": "designer", "theme_id": 1, "asset_key": "hero", "draft_version": 1},
            pk=attachment.pk,
        )
        self.assertEqual(response.status_code, 400)

    def test_upload_validation_rejects_unsupported_video(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from rest_framework.exceptions import ValidationError

        from .files import validate_upload

        with self.assertRaises(ValidationError):
            validate_upload(SimpleUploadedFile("movie.mov", b"video", content_type="video/quicktime"))

    def test_approval_is_attachment_specific_and_audited(self):
        attachment = self.attachment()
        response = self.call(AttachmentViewSet, "approve", {"revision": 1}, pk=attachment.pk)
        self.assertEqual(response.status_code, 200)
        attachment.refresh_from_db()
        self.assertEqual(attachment.approved_by, self.user)
        self.assertEqual(self.card.activity.get().kind, "attachment.approved")

    def test_browser_ticket_is_read_only_tenant_bound_and_revocable(self):
        from rest_framework.exceptions import AuthenticationFailed
        from rest_framework.request import Request

        from .access import AttachmentTicketAuthentication, issue_ticket, resolve_ticket

        self.tenant.members.add(self.other)
        ticket = issue_ticket(self.other, self.tenant)
        self.assertNotIn(":", ticket)  # WebSocket subprotocols must be RFC token strings.
        self.assertEqual(resolve_ticket(ticket)[0], self.other)
        request = Request(self.factory.post("/attachments/a/approve/?ticket=" + ticket, {}))
        with self.assertRaises(AuthenticationFailed):
            AttachmentTicketAuthentication().authenticate(request)
        self.tenant.members.remove(self.other)
        with self.assertRaises(AuthenticationFailed):
            resolve_ticket(ticket)

    def test_tampered_and_expired_tickets_fail(self):
        from django.core import signing
        from rest_framework.exceptions import AuthenticationFailed

        from .access import issue_ticket, resolve_ticket

        ticket = issue_ticket(self.user, self.tenant)
        with self.assertRaises(AuthenticationFailed):
            resolve_ticket(ticket + "bad")
        with patch("kanban.access.signing.TimestampSigner.unsign_object", side_effect=signing.SignatureExpired):
            with self.assertRaises(AuthenticationFailed):
                resolve_ticket(ticket)

    def test_reordering_another_card_invalidates_stale_edit(self):
        other = Card.objects.create(tenant=self.tenant, column=self.column, number=2, title="Second", position=1)
        response = self.call(CardViewSet, "partial_update", {"revision": 1, "position": 0}, pk=other.pk, method="patch")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self.call(
                CardViewSet, "partial_update", {"revision": 1, "title": "Stale"}, pk=self.card.pk, method="patch"
            ).status_code,
            409,
        )

    def test_import_copy_keeps_original_and_provenance_after_archive(self):
        import io

        from django.db import transaction

        from content.models import Namespace
        from file_manager.models import MediaFile

        from .files import import_attachment
        from .models import AttachmentImport

        namespace = Namespace.objects.create(tenant=self.tenant, name="Content", slug="content", created_by=self.user)
        attachment = self.attachment()
        attachment.size = len(b"instructions")
        attachment.filename = "guide.txt"
        attachment.content_type = "text/plain"
        attachment.approved_at = timezone.now()
        attachment.save()
        with (
            patch("kanban.files.attachment_storage") as source,
            patch("kanban.files.storage") as target,
            patch("kanban.files.validate_upload", return_value={}),
        ):
            source.client.get_object.return_value = {"Body": io.BytesIO(b"instructions")}
            target.save.side_effect = lambda path, content: path
            target.url.return_value = "https://media.example.org/guide.txt"
            target.get_file_type.return_value = "document"
            with transaction.atomic():
                record = import_attachment(
                    self.tenant,
                    self.user,
                    attachment,
                    {"destination": "media", "namespace": namespace.pk, "tag_ids": ["Reviewed"]},
                )
            self.assertEqual(record.attachment_id, attachment.pk)
            copied = MediaFile.objects.get(pk=record.destination_id)
            self.assertNotEqual(copied.file_path, attachment.path)
            self.assertEqual(copied.metadata["kanban"]["card_id"], str(self.card.pk))
            self.assertEqual(copied.tags.count(), 1)
            source.delete.assert_not_called()
        self.card.archived = True
        self.card.save()
        self.assertTrue(MediaFile.objects.filter(pk=copied.pk).exists())
        self.assertTrue(AttachmentImport.objects.filter(pk=record.pk).exists())

    def test_media_import_rejects_inaccessible_duplicate_and_namespace(self):
        import hashlib
        import io

        from content.models import Namespace
        from file_manager.models import MediaFile
        from taxonomy.models import ClassificationType
        from taxonomy.services import mutate

        from .models import AttachmentImport

        self.tenant.members.add(self.other)
        namespace = Namespace.objects.create(tenant=self.tenant, name="Content", slug="content", created_by=self.user)
        definition = ClassificationType.objects.create(
            tenant=self.tenant, namespace=namespace, key="topic", name="Topic", allowed_uses=["media_files"]
        )
        operation = mutate(self.user, definition, "create", payload={"name": "Reviewed"})
        term_id = next(iter(operation.after))
        content = b"instructions"
        attachment = self.attachment()
        attachment.size = len(content)
        attachment.filename = "guide.txt"
        attachment.content_type = "text/plain"
        attachment.approved_at = timezone.now()
        attachment.save()
        media = MediaFile.objects.create(
            tenant=self.tenant,
            namespace=namespace,
            title="Confidential destination",
            slug="private",
            file_path="private/destination",
            original_filename="guide.txt",
            file_size=len(content),
            content_type="text/plain",
            file_type="document",
            file_hash=hashlib.sha256(content).hexdigest(),
            access_level="private",
            uploaded_by=self.user,
            created_by=self.user,
            last_modified_by=self.user,
        )
        data = {"revision": 1, "destination": "media", "namespace": namespace.pk, "classification_ids": [term_id]}
        with patch("kanban.files.attachment_storage") as source:
            for level in ["private", "staff"]:
                with self.subTest(access_level=level):
                    media.access_level = level
                    media.save()
                    source.client.get_object.return_value = {"Body": io.BytesIO(content)}
                    response = self.call(AttachmentViewSet, "import_file", data, pk=attachment.pk, user=self.other)
                    self.assertEqual(response.status_code, 409, response.data)
                    self.assertNotIn(media.title, str(response.data))
                    self.assertNotIn(str(media.pk), str(response.data))
            namespace.is_active = False
            namespace.save()
            media.access_level = "members"
            media.save()
            source.client.get_object.return_value = {"Body": io.BytesIO(content)}
            response = self.call(AttachmentViewSet, "import_file", data, pk=attachment.pk, user=self.other)
            self.assertEqual(response.status_code, 403, response.data)
        self.assertFalse(AttachmentImport.objects.exists())
        self.card.refresh_from_db()
        self.assertEqual(self.card.revision, 1)

        # Accessible deduplication applies the selected classification and its legacy projection.
        namespace.is_active = True
        namespace.save()
        with patch("kanban.files.attachment_storage") as source:
            source.client.get_object.return_value = {"Body": io.BytesIO(content)}
            response = self.call(AttachmentViewSet, "import_file", data, pk=attachment.pk, user=self.other)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["destination_id"], str(media.pk))
        from taxonomy.assignments import classification_ids

        self.assertEqual(classification_ids(media), [term_id])
        self.assertEqual(media.tags.count(), 1)

    def test_foreign_designer_import_is_not_found(self):
        attachment = self.attachment()
        attachment.size = len(b"image")
        attachment.approved_at = timezone.now()
        attachment.save()
        import io

        with patch("kanban.files.attachment_storage") as source, patch("kanban.files.validate_upload", return_value={}):
            source.client.get_object.return_value = {"Body": io.BytesIO(b"image")}
            response = self.call(
                AttachmentViewSet,
                "import_file",
                {"revision": 1, "destination": "designer", "theme_id": 999999, "asset_key": "hero", "draft_version": 1},
                pk=attachment.pk,
            )
        self.assertEqual(response.status_code, 404)

    def test_empty_and_unsafe_uploads_are_rejected(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from rest_framework.exceptions import ValidationError

        from .files import validate_upload

        for name, content, mime in [("empty.txt", b"", "text/plain"), ("bad.js", b"alert(1)", "text/plain")]:
            with self.assertRaises(ValidationError):
                validate_upload(SimpleUploadedFile(name, content, content_type=mime))

    def test_kanban_machine_scope_mapping(self):
        from core.machine_api_keys import KANBAN_READ, KANBAN_WRITE, _required_scope

        self.assertEqual(_required_scope(self.factory.get("/api/v1/kanban/cards/")), KANBAN_READ)
        self.assertEqual(_required_scope(self.factory.post("/api/v1/kanban/cards/")), KANBAN_WRITE)

    def test_comment_image_upload_is_private_and_stale_upload_is_cleaned_up(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        from webpages.services.designer_theme import generate_placeholder_png

        comment = Comment.objects.create(tenant=self.tenant, card=self.card, author=self.user, body="Screenshot")
        content = generate_placeholder_png("sample", "preview", 16, 16)
        with patch("kanban.files.attachment_storage") as storage:
            request = self.factory.post(
                "/",
                {
                    "revision": 1,
                    "comment": str(comment.pk),
                    "file": SimpleUploadedFile("sample.png", content, content_type="image/png"),
                },
                format="multipart",
            )
            force_authenticate(request, user=self.user)
            request.tenant = self.tenant
            response = CardViewSet.as_view({"post": "attachments"})(request, pk=str(self.card.pk))
            self.assertEqual(response.status_code, 201, response.data)
            attachment = Attachment.objects.get(pk=response.data["id"])
            self.assertEqual(attachment.comment_id, comment.pk)
            self.assertTrue(attachment.path.startswith(f"tenants/{self.tenant.pk}/kanban/"))
            storage.save_private.assert_called_once()
            request = self.factory.post(
                "/",
                {"revision": 1, "file": SimpleUploadedFile("second.png", content, content_type="image/png")},
                format="multipart",
            )
            force_authenticate(request, user=self.user)
            request.tenant = self.tenant
            response = CardViewSet.as_view({"post": "attachments"})(request, pk=str(self.card.pk))
            self.assertEqual(response.status_code, 409)
            storage.delete.assert_called_once()
            self.assertEqual(Attachment.objects.filter(card=self.card).count(), 1)

    def test_designer_import_updates_draft_and_preserves_source(self):
        import io

        from webpages.models import PageTheme
        from webpages.services.designer_theme import generate_placeholder_png, get_or_create_designer_draft

        from .files import import_attachment

        theme = PageTheme.objects.create(tenant=self.tenant, created_by=self.user, name="Design")
        draft = get_or_create_designer_draft(theme, self.user)
        content = generate_placeholder_png("preview", "preview", 64, 64)
        attachment = Attachment.objects.create(
            tenant=self.tenant,
            card=self.card,
            filename="preview.png",
            path="private/preview.png",
            content_type="image/png",
            size=len(content),
            uploaded_by=self.user,
            approved_at=timezone.now(),
        )
        with (
            patch("kanban.files.attachment_storage") as source,
            patch(
                "webpages.services.designer_theme.system_storage.save",
                return_value=f"theme_images/{theme.pk}/designer_drafts/preview.png",
            ),
            patch(
                "webpages.services.designer_theme.system_storage.url",
                return_value="https://images.example.org/preview.png",
            ),
            patch("webpages.services.designer_theme._field_dimensions", return_value=(64, 64)),
            patch("webpages.services.designer_theme.system_storage.listdir", return_value=([], [])),
        ):
            source.client.get_object.return_value = {"Body": io.BytesIO(content)}
            result = import_attachment(
                self.tenant,
                self.user,
                attachment,
                {
                    "destination": "designer",
                    "theme_id": theme.pk,
                    "draft_version": draft.version,
                    "asset_key": "preview",
                },
            )
            self.assertEqual(result.destination_id, str(theme.pk))
            draft.refresh_from_db()
            self.assertTrue(draft.has_changes)
            self.assertIn("preview.png", draft.snapshot["image"])
            source.delete.assert_not_called()

    def test_maximum_video_validation_never_uses_unbounded_reads(self):
        from django.core.files.uploadedfile import UploadedFile

        from .files import validate_upload

        size = 500 * 1024 * 1024
        stream = BoundedVideoStream(size)
        upload = UploadedFile(file=stream, name="guide.mp4", content_type="video/mp4", size=size)
        with patch("file_manager.security.magic.from_buffer", return_value="video/mp4"):
            result = validate_upload(upload)
        self.assertTrue(result["is_valid"])
        self.assertTrue(result["metadata"]["file_hash"])
        self.assertEqual(stream.position, 0)
        self.assertGreater(len(stream.read_sizes), 500)

    def test_stream_validation_detects_script_markers_across_chunk_boundaries(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from rest_framework.exceptions import ValidationError

        from .files import validate_upload
        from .upload_validation import CHUNK_SIZE

        upload = SimpleUploadedFile(
            "note.txt", b"a" * (CHUNK_SIZE - 4) + b"<script>bad</script>", content_type="text/plain"
        )
        with patch("file_manager.security.magic.from_buffer", return_value="text/plain"):
            with self.assertRaises(ValidationError):
                validate_upload(upload)

    def test_import_spools_source_before_acquiring_tenant_write_lock(self):
        from content.models import Namespace

        from .services import locked_tenant

        namespace = Namespace.objects.create(tenant=self.tenant, name="Content", slug="content", created_by=self.user)
        attachment = self.attachment()
        attachment.size = 2 * 1024 * 1024
        attachment.approved_at = timezone.now()
        attachment.save()
        with (
            patch("kanban.views.locked_tenant", wraps=locked_tenant) as lock,
            patch("kanban.files.attachment_storage") as source,
            patch("kanban.files.storage") as target,
            patch("file_manager.security.magic.from_buffer", return_value="video/mp4"),
        ):
            stream = BoundedVideoStream(attachment.size, on_read=lambda: self.assertFalse(lock.called))
            source.client.get_object.return_value = {"Body": stream}
            target.save.return_value = "uploads/copy.mp4"
            target.url.return_value = "https://media.example.org/copy.mp4"
            target.get_file_type.return_value = "video"
            response = self.call(
                AttachmentViewSet,
                "import_file",
                {"revision": 1, "destination": "media", "namespace": namespace.pk, "tag_ids": ["Reviewed"]},
                pk=attachment.pk,
            )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(stream.closed)
        self.assertTrue(lock.called)

    def test_media_import_uses_typed_classifications_and_preserves_duplicate_tags(self):
        import io

        from content.models import Namespace
        from file_manager.models import MediaFile
        from taxonomy.assignments import classification_ids
        from taxonomy.models import ClassificationRollout, ClassificationType, Tag
        from taxonomy.services import mutate

        namespace = Namespace.objects.create(tenant=self.tenant, name="Content", slug="content", created_by=self.user)
        self.tenant.members.add(self.other)
        terms = []
        for key in ["topic", "location"]:
            definition = ClassificationType.objects.create(
                tenant=self.tenant, namespace=namespace, key=key, name=key, allowed_uses=["media_files"]
            )
            operation = mutate(self.user, definition, "create", payload={"name": "Same name"})
            terms.append(Tag.objects.get(pk=next(iter(operation.after))))
        ClassificationRollout.objects.create(namespace=namespace, phase="canonical")
        attachment = self.attachment()
        content = b"approved attachment"
        attachment.size = len(content)
        attachment.approved_at = timezone.now()
        attachment.save()
        with (
            patch("kanban.files.attachment_storage") as source,
            patch("kanban.files.storage") as target,
            patch("kanban.files.validate_upload", return_value={"metadata": {}}),
        ):
            source.client.get_object.side_effect = lambda **kwargs: {"Body": io.BytesIO(content)}
            target.save.return_value = "uploads/copy.png"
            target.url.return_value = "https://media.example.org/copy.png"
            target.get_file_type.return_value = "image"
            for term in terms:
                self.card.refresh_from_db()
                response = self.call(
                    AttachmentViewSet,
                    "import_file",
                    {
                        "revision": self.card.revision,
                        "destination": "media",
                        "namespace": namespace.pk,
                        "classification_ids": [str(term.pk)],
                    },
                    pk=attachment.pk,
                    user=self.other,
                )
                self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(target.save.call_count, 1)
        self.assertEqual(MediaFile.objects.count(), 1)
        self.assertEqual(classification_ids(MediaFile.objects.get()), [str(term.pk) for term in terms])

    def test_media_import_rejects_empty_and_unapproved_classification(self):
        import io

        from content.models import Namespace
        from file_manager.models import MediaFile
        from taxonomy.models import ClassificationType
        from taxonomy.services import propose

        namespace = Namespace.objects.create(tenant=self.tenant, name="Content", slug="content", created_by=self.user)
        self.tenant.members.add(self.other)
        definition = ClassificationType.objects.create(
            tenant=self.tenant, namespace=namespace, key="topic", name="Topic", allowed_uses=["media_files"]
        )
        proposal = propose(self.other, definition, "create", payload={"name": "Pending"})
        attachment = self.attachment()
        content = b"pending classification"
        attachment.size = len(content)
        attachment.approved_at = timezone.now()
        attachment.save()
        for ids in [[], [str(proposal.term_id)]]:
            with (
                patch("kanban.files.attachment_storage") as source,
                patch("kanban.files.storage") as target,
                patch("kanban.files.validate_upload", return_value={"metadata": {}}),
            ):
                source.client.get_object.return_value = {"Body": io.BytesIO(content)}
                response = self.call(
                    AttachmentViewSet,
                    "import_file",
                    {"revision": 1, "destination": "media", "namespace": namespace.pk, "classification_ids": ids},
                    pk=attachment.pk,
                    user=self.other,
                )
                self.assertEqual(response.status_code, 400, response.data)
                target.save.assert_not_called()
        self.assertFalse(MediaFile.objects.exists())

    def test_asgi_video_download_yields_first_chunk_without_buffering_the_rest(self):
        import io

        from django.test import AsyncRequestFactory

        attachment = self.attachment()
        attachment.size = 2 * 65536
        attachment.save()
        body = io.BytesIO(bytes(attachment.size))
        request = AsyncRequestFactory().get("/")
        force_authenticate(request, user=self.user)
        request.tenant = self.tenant
        with patch("kanban.files.attachment_storage") as storage:
            storage.client.get_object.return_value = {"Body": body}
            response = AttachmentViewSet.as_view({"get": "download"})(request, pk=str(attachment.pk))
        self.assertTrue(response.is_async)

        async def consume_one():
            stream = response.streaming_content
            chunk = await anext(stream)
            self.assertEqual(len(chunk), 65536)
            self.assertEqual(body.tell(), 65536)
            await stream.aclose()

        async_to_sync(consume_one)()
        # request_finished normally runs outside TestCase's enclosing atomic block.
        with patch("django.http.response.signals.request_finished.send"):
            response.close()
        self.assertTrue(body.closed)


class SocketAuthenticationTests(SimpleTestCase):
    def test_unauthenticated_socket_cannot_join(self):
        async def check():
            consumer = KanbanConsumer()
            consumer.tenant_id = "00000000-0000-0000-0000-000000000000"
            consumer.scope = {"user": AnonymousUser()}
            return await consumer.authorized()

        self.assertFalse(async_to_sync(check)())


class KanbanSocketTests(TransactionTestCase):
    def test_ticket_socket_rejects_wrong_tenant_and_revoked_membership(self):
        from channels.db import database_sync_to_async
        from channels.testing import WebsocketCommunicator

        from .access import issue_ticket

        owner = User.objects.create_user(username="socket-owner")
        member = User.objects.create_user(username="socket-member")
        tenant = Tenant.objects.create(name="Socket", identifier="socket", created_by=owner)
        foreign = Tenant.objects.create(name="Foreign", identifier="foreign", created_by=owner)
        tenant.members.add(member)
        ticket = issue_ticket(member, tenant)

        async def check():
            def connection(tenant_id):
                app = KanbanConsumer.as_asgi()
                communicator = WebsocketCommunicator(app, "/ws/kanban/", subprotocols=["kanban", ticket])
                communicator.scope["url_route"] = {"kwargs": {"tenant_id": tenant_id}}
                communicator.scope["user"] = AnonymousUser()
                return communicator

            denied = connection(foreign.pk)
            accepted, _ = await denied.connect()
            self.assertFalse(accepted)
            await denied.disconnect()
            allowed = connection(tenant.pk)
            accepted, protocol = await allowed.connect()
            self.assertTrue(accepted)
            self.assertEqual(protocol, "kanban")
            await database_sync_to_async(tenant.members.remove)(member)
            from channels.layers import get_channel_layer

            await get_channel_layer().group_send(f"kanban_{tenant.pk}", {"type": "kanban.changed"})
            message = await allowed.receive_output()
            self.assertEqual(message["type"], "websocket.close")
            self.assertEqual(message["code"], 4403)
            await allowed.disconnect()

        async_to_sync(check)()

    def test_parallel_creates_allocate_unique_numbers_and_stale_writes_conflict(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier

        from django.db import close_old_connections

        owner = User.objects.create_user(username="parallel-owner")
        tenant = Tenant.objects.create(name="Parallel", identifier="parallel", created_by=owner)
        board = Board.objects.create(tenant=tenant, title="Parallel")
        column = Column.objects.create(tenant=tenant, board=board, title="To do")
        barrier = Barrier(2)

        def create(index):
            close_old_connections()
            try:
                request = APIRequestFactory().post(
                    "/", {"title": f"Card {index}", "column": str(column.pk)}, format="json"
                )
                force_authenticate(request, user=owner)
                request.tenant = tenant
                barrier.wait(timeout=10)
                return CardViewSet.as_view({"post": "create"})(request).status_code
            finally:
                close_old_connections()

        with patch("kanban.services.enqueue_index"), patch("kanban.services.broadcast"):
            with ThreadPoolExecutor(max_workers=2) as pool:
                self.assertEqual(list(pool.map(create, [1, 2])), [201, 201])
        self.assertEqual(set(Card.objects.filter(tenant=tenant).values_list("number", flat=True)), {1, 2})
        card = Card.objects.filter(tenant=tenant).first()
        barrier = Barrier(2)

        def edit(index):
            close_old_connections()
            try:
                request = APIRequestFactory().patch("/", {"title": f"Edit {index}", "revision": 1}, format="json")
                force_authenticate(request, user=owner)
                request.tenant = tenant
                barrier.wait(timeout=10)
                return CardViewSet.as_view({"patch": "partial_update"})(request, pk=str(card.pk)).status_code
            finally:
                close_old_connections()

        with patch("kanban.services.enqueue_index"), patch("kanban.services.broadcast"):
            with ThreadPoolExecutor(max_workers=2) as pool:
                self.assertEqual(sorted(pool.map(edit, [1, 2])), [200, 409])

    def test_additive_migration_preserves_existing_tenant_data(self):
        from django.db import connection
        from django.db.migrations.executor import MigrationExecutor

        executor = MigrationExecutor(connection)
        executor.migrate([("kanban", None)])
        try:
            owner = User.objects.create_user(username="preexisting-owner")
            tenant = Tenant.objects.create(name="Existing", identifier="existing", created_by=owner)
            tenant_id = tenant.pk
        finally:
            restorer = MigrationExecutor(connection)
            restorer.migrate(restorer.loader.graph.leaf_nodes())
        self.assertTrue(Tenant.objects.filter(pk=tenant_id, identifier="existing").exists())
        board = Board.objects.create(tenant_id=tenant_id, title="After upgrade")
        self.assertEqual(board.revision, 1)
