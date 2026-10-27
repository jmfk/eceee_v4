import importlib
import uuid
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.apps import apps
from django.db import connection
from django.test import TestCase, override_settings
from rest_framework.test import force_authenticate

from core.models import TenantRole
from kanban.models import Board, Card
from kanban.services import ensure_required_columns

from . import views
from .models import EmailDelivery, InboxEntry, MessageAttachment, MessageLabel, PrivateVideo, SupportThread
from .recipients import directory
from .tests import SupportAPITests


class MessagingTests(TestCase):
    setUp = SupportAPITests.setUp
    call = SupportAPITests.call

    def send(self, recipients=None, **kwargs):
        data = {
            "title": "Meddelande",
            "body": "Hej",
            "requestId": str(uuid.uuid4()),
            "recipients": recipients or [f"user:{self.bob.pk}"],
        }
        data.update(kwargs)
        return self.call(views.ThreadsView, "post", data), data

    def test_question_default_optional_location_and_private_direct_replies(self):
        response, data = self.send()
        self.assertEqual(response.status_code, 201, response.data)
        tid = response.data["id"]
        self.assertEqual(response.data["kind"], "question")
        self.assertEqual([label["name"] for label in response.data["labels"]], ["Question"])
        self.assertEqual(response.data["location"], "")
        self.assertFalse(response.data["support_target"])
        self.assertEqual(self.call(views.ThreadView, pk=tid, user=self.support).status_code, 404)
        self.assertEqual(self.call(views.ThreadView, pk=tid, user=self.bob).status_code, 200)
        reply = self.call(
            views.ThreadView, "post", {"body": "Svar", "requestId": str(uuid.uuid4())}, pk=tid, user=self.bob
        )
        self.assertEqual(reply.status_code, 200, reply.data)
        self.assertEqual(self.call(views.InboxView, user=self.bob).data["count"], 1)
        self.assertEqual(self.call(views.InboxView, user=self.support).data["count"], 0)
        retry = self.call(views.ThreadsView, "post", data)
        self.assertEqual(retry.status_code, 200, retry.data)
        self.assertEqual(SupportThread.objects.count(), 1)
        self.tenant.members.remove(self.bob)
        self.assertEqual(self.call(views.ThreadView, pk=tid, user=self.bob).status_code, 403)

    def test_workspace_message_labels_are_editable_and_scoped(self):
        defaults = self.call(views.ContextView).data["message_labels"]
        self.assertEqual([label["name"] for label in defaults], ["Question", "Suggestion", "Content", "Bug Report"])
        self.assertEqual(self.call(views.MessageLabelsView, "post", {"name": "Urgent"}).status_code, 403)
        added = self.call(views.MessageLabelsView, "post", {"name": "Urgent"}, user=self.owner)
        self.assertEqual(added.status_code, 201, added.data)
        label_id = added.data["id"]
        self.assertEqual(
            self.call(views.MessageLabelsView, "post", {"name": "urgent"}, user=self.owner).status_code, 400
        )
        renamed = self.call(views.MessageLabelView, "patch", {"name": "Priority"}, user=self.owner, pk=label_id)
        self.assertEqual(renamed.status_code, 200, renamed.data)
        self.assertEqual(
            self.call(
                views.MessageLabelView, "patch", {"name": "Foreign"}, user=self.owner, tenant=self.other, pk=label_id
            ).status_code,
            404,
        )
        self.assertEqual(self.call(views.MessageLabelView, "delete", user=self.owner, pk=label_id).status_code, 204)
        self.assertNotIn(label_id, [label["id"] for label in self.call(views.ContextView).data["message_labels"]])

    def test_message_can_have_multiple_labels_and_rejects_foreign_or_archived_labels(self):
        labels = self.call(views.ContextView).data["message_labels"]
        question = next(label for label in labels if label["key"] == "question")
        bug = next(label for label in labels if label["key"] == "bug")
        response, data = self.send(labelIds=[question["id"], bug["id"]])
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["kind"], "bug")
        self.assertEqual({label["id"] for label in response.data["labels"]}, {question["id"], bug["id"]})
        self.assertEqual(self.call(views.ThreadsView, "post", data).status_code, 200)
        self.assertEqual(self.call(views.ThreadsView, "post", {**data, "labelIds": [question["id"]]}).status_code, 409)
        foreign = MessageLabel.objects.create(tenant=self.other, name="Foreign")
        self.assertEqual(self.send(labelIds=[str(foreign.pk)])[0].status_code, 400)
        self.call(views.MessageLabelView, "delete", user=self.owner, pk=bug["id"])
        self.assertEqual(self.call(views.ThreadsView, "post", data).status_code, 200)
        self.assertEqual(self.send(labelIds=[bug["id"]])[0].status_code, 400)
        self.assertIn(
            "Bug Report",
            [label["name"] for label in self.call(views.ThreadView, pk=response.data["id"]).data["labels"]],
        )

    def test_label_backfill_preserves_existing_thread_types_and_can_resume(self):
        question = SupportThread.objects.create(
            tenant=self.other, creator=self.owner, title="Old question", kind="question", request_id=uuid.uuid4()
        )
        bug = SupportThread.objects.create(
            tenant=self.other, creator=self.owner, title="Old bug", kind="bug", request_id=uuid.uuid4()
        )
        migration = importlib.import_module("tenant_support.migrations.0005_message_labels")
        editor = SimpleNamespace(connection=connection)
        migration.seed_labels(apps, editor)
        migration.seed_labels(apps, editor)
        self.assertEqual(list(question.labels.values_list("name", flat=True)), ["Question"])
        self.assertEqual(list(bug.labels.values_list("name", flat=True)), ["Bug Report"])
        self.assertEqual(MessageLabel.objects.filter(tenant=self.other).count(), 4)

    def test_group_recipients_are_a_snapshot_and_foreign_recipients_rejected(self):
        group = TenantRole.objects.create(tenant=self.tenant, name="Redaktionen", permissions=[])
        group.users.add(self.bob)
        response, _ = self.send([f"role:{group.pk}"])
        self.assertEqual(response.status_code, 201, response.data)
        group.users.add(self.support)
        self.assertEqual(self.call(views.ThreadView, pk=response.data["id"], user=self.support).status_code, 404)
        self.assertEqual(self.send(["user:99999999"])[0].status_code, 400)
        self.assertEqual(self.send(["group:99999999"])[0].status_code, 400)

    def test_global_and_foreign_groups_are_not_workspace_recipients(self):
        global_group = Group.objects.create(name="Private cross-workspace group")
        global_group.user_set.add(self.bob)
        foreign_role = TenantRole.objects.create(tenant=self.other, name="Private foreign role", permissions=[])
        foreign_role.users.add(self.bob)
        options = directory(self.tenant, self.anna)
        self.assertNotIn(global_group.name, [item["name"] for item in options])
        self.assertNotIn(f"role:{foreign_role.pk}", [item["id"] for item in options])
        self.assertEqual(self.send([f"group:{global_group.pk}"])[0].status_code, 400)
        self.assertEqual(self.send([f"role:{foreign_role.pk}"])[0].status_code, 400)

    @patch("kanban.services.enqueue_index")
    def test_board_inbox_delivery_is_atomic_and_idempotent(self, index):
        board = Board.objects.create(tenant=self.tenant, title="Redaktion")
        board.members.add(self.bob)
        ensure_required_columns(board)
        response, data = self.send([f"board:{board.pk}"])
        self.assertEqual(response.status_code, 201, response.data)
        card = Card.objects.get()
        self.assertEqual(card.column.role, "inbox")
        self.assertIn(str(response.data["id"]), card.description)
        self.assertEqual(self.call(views.ThreadsView, "post", data).status_code, 200)
        self.assertEqual(Card.objects.count(), 1)
        self.assertTrue(InboxEntry.objects.filter(user=self.bob).exists())
        self.assertEqual(self.call(views.ThreadsView, "post", {**data, "title": "Changed"}).status_code, 409)

    def attachment(self, owner=None, message=None):
        return MessageAttachment.objects.create(
            tenant=self.tenant,
            owner=owner or self.anna,
            message=message,
            filename="photo.png",
            storage_key=str(uuid.uuid4()),
            content_type="image/png",
            byte_size=100,
        )

    @patch("tenant_support.storage.download_url", return_value="https://private.example.invalid/file")
    def test_attachments_are_owned_single_use_and_participant_scoped(self, download):
        file = self.attachment()
        response, data = self.send(attachmentIds=[str(file.pk)])
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(self.call(views.ThreadsView, "post", data).status_code, 200)
        self.assertEqual(self.call(views.AttachmentDownloadView, pk=file.pk, user=self.bob).status_code, 200)
        self.assertEqual(self.call(views.AttachmentDownloadView, pk=file.pk, user=self.support).status_code, 403)
        self.assertEqual(self.send(attachmentIds=[str(file.pk)])[0].status_code, 400)
        self.assertEqual(self.send(attachmentIds=[str(self.attachment(owner=self.bob).pk)])[0].status_code, 400)
        self.tenant.members.remove(self.bob)
        self.assertEqual(self.call(views.AttachmentDownloadView, pk=file.pk, user=self.bob).status_code, 403)

    def test_diagnostics_are_bounded_and_redacted_and_retry_safe(self):
        response, data = self.send(
            diagnostics={
                "errors": [
                    {"name": "Error", "message": "token=never-print-this https://example.invalid/?private=value"}
                ],
                "cookies": "do not include",
            }
        )
        self.assertEqual(response.status_code, 201, response.data)
        file = MessageAttachment.objects.get()
        self.assertNotIn("never-print-this", file.inline_text)
        self.assertNotIn("private=value", file.inline_text)
        self.assertNotIn("cookies", file.inline_text)
        self.assertEqual(self.call(views.ThreadsView, "post", data).status_code, 200)
        self.assertEqual(MessageAttachment.objects.count(), 1)

    @patch("tenant_support.storage.save_video")
    def test_generic_attachments_accept_images_and_reject_invalid_files(self, save):
        from io import BytesIO

        from PIL import Image

        output = BytesIO()
        Image.new("RGB", (20, 20)).save(output, "PNG")
        request = self.factory.post(
            "/",
            {"file": SimpleUploadedFile("image.png", output.getvalue(), content_type="image/png")},
            format="multipart",
        )
        request.tenant = self.tenant
        force_authenticate(request, self.anna)
        response = views.AttachmentsView.as_view()(request)
        self.assertEqual(response.status_code, 201, response.data)
        request = self.factory.post(
            "/", {"file": SimpleUploadedFile("fake.png", b"not an image", content_type="image/png")}, format="multipart"
        )
        request.tenant = self.tenant
        force_authenticate(request, self.anna)
        self.assertEqual(views.AttachmentsView.as_view()(request).status_code, 400)

    @patch("tenant_support.storage.save_video")
    @patch("tenant_support.views.inspect_video", return_value=(5, "video/mp4", "mp4"))
    @patch(
        "kanban.upload_validation.KanbanUploadValidator.validate_file",
        return_value={
            "is_valid": True,
            "metadata": {"actual_mime_type": "video/mp4"},
        },
    )
    def test_both_upload_paths_share_count_and_byte_quotas(self, validate, inspect, save):
        # Unattached uploads from both models consume the same rolling tenant quota.
        for _ in range(49):
            self.attachment()
        PrivateVideo.objects.create(
            tenant=self.tenant,
            owner=self.anna,
            purpose="bug",
            storage_key=str(uuid.uuid4()),
            content_type="video/mp4",
            byte_size=100,
            duration=5,
        )

        def upload(view):
            request = self.factory.post(
                "/",
                {
                    "purpose": "bug",
                    "file": SimpleUploadedFile("clip.mp4", b"video", content_type="video/mp4"),
                },
                format="multipart",
            )
            request.tenant = self.tenant
            force_authenticate(request, self.anna)
            return view.as_view()(request)

        for view in (views.AttachmentsView, views.VideoUploadView):
            self.assertEqual(upload(view).status_code, 400)
        # Keep one attachment and one video: each fits alone, but their combined bytes do not.
        retained = MessageAttachment.objects.first()
        MessageAttachment.objects.exclude(pk=retained.pk).update(created_at="2020-01-01T00:00:00Z")
        with override_settings(SUPPORT_DAILY_MAX_BYTES=202):
            for view in (views.AttachmentsView, views.VideoUploadView):
                self.assertEqual(upload(view).status_code, 400)
        save.assert_not_called()

    @patch("tenant_support.views.inspect_video", side_effect=ValueError("must validate"))
    def test_video_policy_runs_for_generic_uploads(self, inspect):
        # The shared MIME policy runs before the duration decoder; mock that boundary only.
        from rest_framework.exceptions import ValidationError

        inspect.side_effect = ValidationError("Video must be at most five seconds")
        with patch(
            "kanban.upload_validation.KanbanUploadValidator.validate_file",
            return_value={"is_valid": True, "metadata": {"actual_mime_type": "video/mp4"}},
        ):
            request = self.factory.post(
                "/", {"file": SimpleUploadedFile("clip.mp4", b"mp4", content_type="video/mp4")}, format="multipart"
            )
            request.tenant = self.tenant
            force_authenticate(request, self.anna)
            self.assertEqual(views.AttachmentsView.as_view()(request).status_code, 400)
            inspect.assert_called_once()

    def test_board_delivery_respects_the_senders_cms_role(self):
        from core.models import TenantRole

        board = Board.objects.create(tenant=self.tenant, title="Read only")
        board.members.add(self.bob)
        role = TenantRole.objects.create(tenant=self.tenant, name="Reader", permissions=["kanban.read"])
        role.users.add(self.anna)
        self.assertEqual(self.send([f"board:{board.pk}"])[0].status_code, 400)
        self.assertEqual(self.send([f"board-members:{board.pk}"])[0].status_code, 201)

    def test_server_diagnostics_are_per_tenant_and_user(self):
        from django.http import HttpResponse

        from .system_diagnostics import recent, record

        request = self.factory.get("/")
        request.tenant, request.user = self.tenant, self.anna
        record(request, HttpResponse(status=500))
        self.assertEqual(len(recent(request)), 1)
        request.user = self.bob
        self.assertEqual(recent(request), [])
        request.user, request.tenant = self.anna, self.other
        self.assertEqual(recent(request), [])

    def test_mixed_support_and_person_recipients_both_receive_the_message(self):
        response, _ = self.send(["support", f"user:{self.bob.pk}"])
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(InboxEntry.objects.filter(user=self.support).exists())
        self.assertTrue(InboxEntry.objects.filter(user=self.bob).exists())

    def test_support_grant_through_cms_role_catches_up_without_historical_email(self):
        from core.role_views import RolesView

        response, _ = self.send(["support"])
        self.assertEqual(response.status_code, 201)
        before = EmailDelivery.objects.count()
        grant = self.call(
            RolesView,
            "post",
            {"name": "Support group", "permissions": ["support.read"], "users": [self.bob.pk]},
            user=self.owner,
        )
        self.assertEqual(grant.status_code, 200, grant.data)
        self.assertEqual(self.call(views.InboxView, user=self.bob).data["count"], 1)
        self.assertEqual(EmailDelivery.objects.count(), before)

    @patch("kanban.services.enqueue_index")
    def test_board_card_does_not_expose_private_message_content(self, index):
        from kanban.views import CardViewSet

        board = Board.objects.create(tenant=self.tenant, title="Shared board")
        board.members.add(self.bob)
        response, _ = self.send([f"board:{board.pk}"], title="Private subject", body="Private message body")
        self.assertEqual(response.status_code, 201, response.data)
        request = self.factory.get("/")
        request.tenant = self.tenant
        force_authenticate(request, self.support)
        public = CardViewSet.as_view({"get": "list"})(request)
        self.assertEqual(public.status_code, 200)
        self.assertNotIn("Private subject", str(public.data))
        self.assertNotIn("Private message body", str(public.data))
        self.assertEqual(self.call(views.ThreadView, pk=response.data["id"], user=self.support).status_code, 404)
        self.assertEqual(
            self.call(views.ThreadView, pk=response.data["id"], user=self.bob).data["title"], "Private subject"
        )
