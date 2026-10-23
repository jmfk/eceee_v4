import importlib
import uuid
from decimal import Decimal
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIRequestFactory, force_authenticate
from .tests import SupportAPITests
from . import views
from .models import Message, SupportThread, MessageAttachment, InboxEntry, EmailDelivery
from kanban.models import Board, Column, Card
from kanban.views import BoardViewSet, ColumnViewSet
from kanban.services import ensure_required_columns


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

    def test_group_recipients_are_a_snapshot_and_foreign_recipients_rejected(self):
        group = Group.objects.create(name="Redaktionen")
        group.user_set.add(self.bob)
        response, _ = self.send([f"group:{group.pk}"])
        self.assertEqual(response.status_code, 201, response.data)
        group.user_set.add(self.support)
        self.assertEqual(self.call(views.ThreadView, pk=response.data["id"], user=self.support).status_code, 404)
        self.assertEqual(self.send(["user:99999999"])[0].status_code, 400)
        self.assertEqual(self.send(["group:99999999"])[0].status_code, 400)

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
        from PIL import Image
        from io import BytesIO

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
        board = Board.objects.create(tenant=self.tenant, title='Read only')
        board.members.add(self.bob)
        role = TenantRole.objects.create(tenant=self.tenant, name='Reader', permissions=['kanban.read'])
        role.users.add(self.anna)
        self.assertEqual(self.send([f'board:{board.pk}'])[0].status_code, 400)
        self.assertEqual(self.send([f'board-members:{board.pk}'])[0].status_code, 201)

    def test_server_diagnostics_are_per_tenant_and_user(self):
        from .system_diagnostics import record, recent
        from django.http import HttpResponse
        request = self.factory.get('/')
        request.tenant, request.user = self.tenant, self.anna
        record(request, HttpResponse(status=500))
        self.assertEqual(len(recent(request)), 1)
        request.user = self.bob
        self.assertEqual(recent(request), [])
        request.user, request.tenant = self.anna, self.other
        self.assertEqual(recent(request), [])


    def test_mixed_support_and_person_recipients_both_receive_the_message(self):
        response, _ = self.send(['support', f'user:{self.bob.pk}'])
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(InboxEntry.objects.filter(user=self.support).exists())
        self.assertTrue(InboxEntry.objects.filter(user=self.bob).exists())


    def test_support_grant_through_cms_role_catches_up_without_historical_email(self):
        from core.role_views import RolesView
        response, _ = self.send(['support'])
        self.assertEqual(response.status_code, 201)
        before = EmailDelivery.objects.count()
        grant = self.call(RolesView, 'post', {'name': 'Support group', 'permissions': ['support.read'], 'users': [self.bob.pk]}, user=self.owner)
        self.assertEqual(grant.status_code, 200, grant.data)
        self.assertEqual(self.call(views.InboxView, user=self.bob).data['count'], 1)
        self.assertEqual(EmailDelivery.objects.count(), before)
