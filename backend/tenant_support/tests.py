import json
import subprocess
import tempfile
import uuid
from decimal import Decimal
from pathlib import Path
from unittest.mock import Mock, patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import TestCase, TransactionTestCase, override_settings, skipUnlessDBFeature
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from core.models import Tenant

from . import storage, views
from .models import EmailDelivery, InboxEntry, Instruction, Message, PrivateVideo, SupportRole, SupportThread
from .tasks import deliver_one, deliver_pending
from .video import inspect_video


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="noreply@example.invalid",
    SUPPORT_APP_URL="https://cms.example.invalid",
    SUPPORT_EMAIL_ENABLED=True,
    SUPPORT_STORAGE_BUCKET_NAME="support-private-tests",
    AWS_STORAGE_BUCKET_NAME="public-tests",
    AWS_CHECKPOINT_STORAGE_BUCKET_NAME="checkpoints-tests",
)
class SupportAPITests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.owner = User.objects.create_user("owner", email="owner@example.invalid", is_superuser=True)
        self.anna = User.objects.create_user("anna", email="anna@example.invalid")
        self.bob = User.objects.create_user("bob", email="bob@example.invalid")
        self.support = User.objects.create_user("support", email="support@example.invalid")
        self.tenant = Tenant.objects.create(name="A", identifier="a", created_by=self.owner)
        self.tenant.members.add(self.anna, self.bob, self.support)
        self.other = Tenant.objects.create(name="B", identifier="b", created_by=self.owner)
        SupportRole.objects.create(tenant=self.tenant, user=self.support, can_support=True, can_publish=True)
        self.factory = APIRequestFactory()

    def call(self, view, method="get", data=None, user=None, tenant=None, pk=None, query=""):
        request = getattr(self.factory, method)("/" + query, data=data, format="json")
        request.tenant = tenant or self.tenant
        force_authenticate(request, user=user or self.anna)
        return view.as_view()(request, **({"pk": pk} if pk else {}))

    def video(self, purpose="instruction", tenant=None, owner=None):
        return PrivateVideo.objects.create(
            tenant=tenant or self.tenant,
            owner=owner or self.support,
            purpose=purpose,
            storage_key=str(uuid.uuid4()),
            content_type="video/mp4",
            byte_size=100,
            duration=10 if purpose == "instruction" else 5,
        )

    def publish(self, **kwargs):
        data = {
            "title": "Instruktion",
            "description": "Gör så här",
            "videoId": str(self.video().pk),
            "requestId": str(uuid.uuid4()),
        }
        data.update(kwargs)
        return self.call(views.InstructionsView, "post", data, user=self.support), data

    def create_thread(self, **kwargs):
        data = {
            "title": "Spara fungerar inte",
            "body": "Rubriken återställs",
            "kind": "bug",
            "location": "https://cms.example.invalid/pages/42",
            "requestId": str(uuid.uuid4()),
        }
        data.update(kwargs)
        return self.call(views.ThreadsView, "post", data), data

    def test_publication_snapshots_recipients_and_retries_without_duplicate_events(self):
        result, data = self.publish()
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(InboxEntry.objects.count(), 3)
        self.assertEqual(EmailDelivery.objects.count(), 3)
        again = self.call(views.InstructionsView, "post", data, user=self.support)
        self.assertEqual(result.data["id"], again.data["id"])
        self.assertEqual(Instruction.objects.count(), 1)
        self.assertEqual(EmailDelivery.objects.count(), 3)
        # A newly joined member sees the library, without a retrospective inbox/email.
        newcomer = get_user_model().objects.create_user("new")
        self.tenant.members.add(newcomer)
        library = self.call(views.InstructionsView, user=newcomer)
        self.assertEqual(library.data["count"], 1)
        self.assertFalse(InboxEntry.objects.filter(user=newcomer).exists())
        self.assertEqual(
            self.call(views.InstructionView, pk=result.data["id"], tenant=self.other, user=self.owner).status_code, 404
        )

    def test_tenant_creator_and_staff_do_not_implicitly_gain_support_or_publish_roles(self):
        self.assertEqual(self.call(views.InstructionsView, "post", {}, user=self.owner).status_code, 403)
        self.bob.is_staff = True
        self.bob.save()
        self.assertFalse(self.call(views.ContextView, user=self.bob).data["can_support"])
        self.assertEqual(self.call(views.ContextView, user=self.bob, tenant=self.other).status_code, 403)

    def test_personal_archive_and_read_do_not_change_instruction(self):
        result, _ = self.publish()
        entry = InboxEntry.objects.get(user=self.anna)
        self.call(views.InstructionView, pk=result.data["id"])
        entry.refresh_from_db()
        self.assertIsNotNone(entry.read_at)
        self.assertIsNone(InboxEntry.objects.get(user=self.bob).read_at)
        self.assertEqual(self.call(views.EntryView, "patch", {"archived": True}, pk=entry.pk).status_code, 200)
        self.assertEqual(self.call(views.InboxView).data["count"], 0)
        self.assertFalse(Instruction.objects.get().archived)
        self.assertEqual(self.call(views.InstructionsView).data["count"], 1)
        self.assertEqual(
            self.call(views.EntryView, "patch", {"archived": False}, user=self.bob, pk=entry.pk).status_code, 404
        )

    def test_private_thread_reply_and_reopen_with_idempotency(self):
        result, data = self.create_thread()
        self.assertEqual(result.status_code, 201, result.data)
        tid = result.data["id"]
        self.assertEqual(self.call(views.ThreadsView, "post", data).data["id"], tid)
        self.assertEqual(Message.objects.count(), 1)
        self.assertEqual(self.call(views.ThreadView, pk=tid, user=self.bob).status_code, 404)
        self.assertEqual(self.call(views.ThreadView, pk=tid, user=self.owner).status_code, 404)
        self.assertEqual(self.call(views.ThreadView, pk=tid, user=self.support).status_code, 200)
        InboxEntry.objects.filter(user=self.anna).update(archived=True, read_at=timezone.now())
        reply = {"body": "Prova igen", "requestId": str(uuid.uuid4())}
        answered = self.call(views.ThreadView, "post", reply, pk=tid, user=self.support)
        self.assertEqual(answered.data["status"], "waiting")
        self.call(views.ThreadView, "post", reply, pk=tid, user=self.support)
        self.assertEqual(Message.objects.count(), 2)
        entry = InboxEntry.objects.get(user=self.anna)
        self.assertFalse(entry.archived)
        self.assertIsNone(entry.read_at)
        self.assertEqual(EmailDelivery.objects.filter(entry__user=self.anna).count(), 1)
        self.assertEqual(EmailDelivery.objects.filter(entry__user=self.support).count(), 1)
        self.call(views.ThreadView, "patch", {"status": "resolved"}, pk=tid, user=self.support)
        reopened = self.call(
            views.ThreadView, "post", {"body": "Det finns kvar", "requestId": str(uuid.uuid4())}, pk=tid
        )
        self.assertEqual(reopened.data["status"], "open")

    def test_video_attachment_is_tenant_owner_and_purpose_scoped(self):
        for video in [
            self.video("bug", tenant=self.other, owner=self.anna),
            self.video("bug", owner=self.bob),
            self.video(owner=self.anna),
        ]:
            result, _ = self.create_thread(videoId=str(video.pk))
            self.assertEqual(result.status_code, 404)
        asset = self.video("bug", owner=self.anna)
        result, _ = self.create_thread(videoId=str(asset.pk))
        self.assertEqual(result.status_code, 201)
        again, _ = self.create_thread(videoId=str(asset.pk))
        self.assertEqual(again.status_code, 400)
        self.assertEqual(self.call(views.VideoPlaybackView, user=self.bob, pk=asset.pk).status_code, 403)
        with patch("tenant_support.storage.playback_url", return_value="https://private.example.invalid/signed"):
            self.assertEqual(self.call(views.VideoPlaybackView, pk=asset.pk).status_code, 200)
            self.assertEqual(self.call(views.VideoPlaybackView, pk=asset.pk, user=self.support).status_code, 200)
            self.tenant.members.remove(self.support)
            self.assertEqual(self.call(views.VideoPlaybackView, pk=asset.pk, user=self.support).status_code, 403)

    def test_withdrawn_instruction_has_no_inbox_or_playback_access(self):
        result, _ = self.publish()
        video_id = Instruction.objects.get().video_id
        self.call(views.InstructionView, "patch", {"withdrawn": True}, pk=result.data["id"], user=self.support)
        self.assertEqual(self.call(views.InstructionView, pk=result.data["id"]).status_code, 404)
        self.assertEqual(self.call(views.InboxView).data["count"], 0)
        self.assertEqual(self.call(views.VideoPlaybackView, pk=video_id).status_code, 403)

    def test_input_validation_and_role_management(self):
        self.assertEqual(self.create_thread(location="")[0].status_code, 400)
        self.assertEqual(self.create_thread(location="javascript:alert(1)")[0].status_code, 400)
        self.assertEqual(
            self.call(
                views.ContextView, "post", {"userId": self.bob.pk, "canSupport": True, "canPublish": False}
            ).status_code,
            403,
        )
        response = self.call(
            views.ContextView, "post", {"userId": self.bob.pk, "canSupport": True, "canPublish": False}, user=self.owner
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(self.call(views.ContextView, user=self.bob).data["can_support"])

    def test_email_contains_only_generic_summary_and_tenant_link_and_is_deduplicated(self):
        self.create_thread()
        job = EmailDelivery.objects.get()
        deliver_one(job.pk)
        deliver_one(job.pk)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertIn("?tenant=a", message.body)
        self.assertIn("/inbox/threads/", message.body)
        self.assertNotIn("Rubriken återställs", message.body)
        self.assertNotIn("pages/42", message.body)
        self.assertEqual(message.to, [self.support.email])
        self.assertIn("Message-ID", message.extra_headers)

    def test_email_is_skipped_after_role_revocation(self):
        self.create_thread()
        job = EmailDelivery.objects.get()
        SupportRole.objects.filter(user=self.support).update(can_support=False)
        deliver_one(job.pk)
        job.refresh_from_db()
        self.assertEqual(job.state, "skipped")
        self.assertEqual(len(mail.outbox), 0)

    @patch("tenant_support.tasks.EmailMessage.send", side_effect=TimeoutError)
    def test_ambiguous_email_result_is_not_blindly_resent(self, send):
        self.create_thread()
        job = EmailDelivery.objects.get()
        deliver_one(job.pk)
        deliver_one(job.pk)
        job.refresh_from_db()
        self.assertEqual(job.state, "uncertain")
        self.assertEqual(send.call_count, 1)

    @patch("tenant_support.tasks.get_connection", side_effect=ConnectionError)
    def test_safe_pre_send_failure_is_scheduled_for_retry(self, connection):
        self.create_thread()
        job = EmailDelivery.objects.get()
        deliver_one(job.pk)
        job.refresh_from_db()
        self.assertEqual(job.state, "pending")
        self.assertEqual(job.attempts, 1)
        self.assertEqual(job.error_code, "backend_unavailable")

    def test_inbox_target_constraint(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            InboxEntry.objects.create(tenant=self.tenant, user=self.anna, activity_at=timezone.now())

    def upload(self, purpose="bug", content=b"test-video", user=None):
        request = self.factory.post(
            "/videos/",
            {"purpose": purpose, "file": SimpleUploadedFile("clip.mp4", content, content_type="video/mp4")},
            format="multipart",
        )
        request.tenant = self.tenant
        force_authenticate(request, user=user or self.anna)
        return views.VideoUploadView.as_view()(request)

    @patch("tenant_support.views.storage.save_video")
    @patch("tenant_support.views.inspect_video", return_value=(Decimal("5"), "video/mp4", "mp4"))
    def test_upload_is_validated_and_quota_and_purpose_are_enforced(self, inspect, save):
        response = self.upload()
        self.assertEqual(response.status_code, 201, response.data)
        video = PrivateVideo.objects.get()
        self.assertEqual(video.owner_id, self.anna.pk)
        self.assertEqual(video.tenant_id, self.tenant.pk)
        self.assertTrue(video.storage_key.startswith(str(self.tenant.pk) + "/"))
        self.assertEqual(save.call_count, 1)
        self.assertEqual(self.upload(purpose="instruction").status_code, 403)
        with override_settings(SUPPORT_BUG_MAX_BYTES=1):
            self.assertEqual(self.upload().status_code, 400)
        with override_settings(SUPPORT_DAILY_MAX_BYTES=1):
            self.assertEqual(self.upload().status_code, 400)
        self.assertEqual(save.call_count, 1)

    @patch("tenant_support.views.storage.save_video", side_effect=RuntimeError("provider detail must not escape"))
    @patch("tenant_support.views.inspect_video", return_value=(Decimal("5"), "video/mp4", "mp4"))
    def test_upload_failure_is_redacted_and_has_no_ready_video(self, inspect, save):
        response = self.upload()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("provider detail", str(response.data))
        self.assertFalse(PrivateVideo.objects.exists())

    def test_search_never_exposes_another_members_thread(self):
        self.create_thread()
        result = self.call(views.InboxView, query="?search=Rubriken", user=self.bob)
        self.assertEqual(result.data["count"], 0)
        self.assertEqual(self.call(views.InboxView, query="?search=Rubriken", user=self.support).data["count"], 1)

    def test_new_support_role_sees_existing_threads_without_historical_email(self):
        self.create_thread()
        response = self.call(
            views.ContextView, "post", {"userId": self.bob.pk, "canSupport": True, "canPublish": False}, user=self.owner
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.call(views.InboxView, user=self.bob).data["count"], 1)
        self.assertEqual(EmailDelivery.objects.count(), 1)

    @override_settings(SUPPORT_EMAIL_ENABLED=False)
    def test_disabled_email_preserves_pending_jobs(self):
        self.create_thread()
        deliver_pending()
        self.assertEqual(EmailDelivery.objects.get().state, "pending")
        self.assertEqual(len(mail.outbox), 0)

    def test_json_contract_uses_camel_case(self):
        response = self.call(views.ContextView)
        response.render()
        data = json.loads(response.content)
        self.assertIn("canSupport", data)
        self.assertNotIn("can_support", data)


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="noreply@example.invalid",
    SUPPORT_APP_URL="https://cms.example.invalid",
    SUPPORT_EMAIL_ENABLED=True,
    SUPPORT_STORAGE_BUCKET_NAME="support-private-tests",
    AWS_STORAGE_BUCKET_NAME="public-tests",
    AWS_CHECKPOINT_STORAGE_BUCKET_NAME="checkpoints-tests",
)
class VideoTests(TestCase):
    def make_video(self, path, duration):
        subprocess.run(
            [
                "ffmpeg",
                "-v",
                "error",
                "-f",
                "lavfi",
                "-i",
                "color=size=32x32:rate=100",
                "-t",
                str(duration),
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-y",
                str(path),
            ],
            check=True,
            timeout=20,
        )

    def test_real_boundary_and_instruction_exception(self):
        with tempfile.TemporaryDirectory() as folder:
            exact = Path(folder) / "five.mp4"
            long = Path(folder) / "long.mp4"
            self.make_video(exact, 5)
            self.make_video(long, 5.01)
            self.assertEqual(inspect_video(str(exact), "bug")[0], Decimal("5"))
            from rest_framework.exceptions import ValidationError

            with self.assertRaises(ValidationError):
                inspect_video(str(long), "bug")
            self.assertGreater(inspect_video(str(long), "instruction")[0], 5)

    @patch("tenant_support.video.run")
    def test_decoded_duration_overrides_understated_metadata(self, run):
        from rest_framework.exceptions import ValidationError

        run.side_effect = [
            json.dumps(
                {
                    "format": {"duration": "4", "format_name": "mov,mp4"},
                    "streams": [{"codec_type": "video", "codec_name": "h264", "width": 32, "height": 32}],
                }
            ),
            "out_time_us=6000000\n",
        ]
        with self.assertRaises(ValidationError):
            inspect_video("/unused.mp4", "bug")

    def test_invalid_file_is_rejected(self):
        from rest_framework.exceptions import ValidationError

        with tempfile.NamedTemporaryFile() as f:
            f.write(b"not a video")
            f.flush()
            with self.assertRaises(ValidationError):
                inspect_video(f.name, "bug")

    def test_public_storage_policy_and_bucket_reuse_fail_closed(self):
        s3 = Mock()
        s3.get_bucket_acl.return_value = {"Grants": []}
        s3.get_bucket_policy.return_value = {
            "Policy": json.dumps({"Statement": [{"Effect": "Allow", "Principal": "*", "Action": "s3:GetObject"}]})
        }
        from django.core.exceptions import ImproperlyConfigured

        with self.assertRaises(ImproperlyConfigured):
            storage.assert_private(s3)
        with override_settings(SUPPORT_STORAGE_BUCKET_NAME="public-tests"), self.assertRaises(ImproperlyConfigured):
            storage.bucket_name()


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="noreply@example.invalid",
    SUPPORT_APP_URL="https://cms.example.invalid",
    SUPPORT_EMAIL_ENABLED=True,
    SUPPORT_STORAGE_BUCKET_NAME="support-private-tests",
    AWS_STORAGE_BUCKET_NAME="public-tests",
    AWS_CHECKPOINT_STORAGE_BUCKET_NAME="checkpoints-tests",
)
class DeliveryConcurrencyTests(TransactionTestCase):
    @skipUnlessDBFeature("has_select_for_update")
    def test_two_workers_submit_a_claimed_delivery_only_once(self):
        import threading

        from django.db import connections

        User = get_user_model()
        owner = User.objects.create_user("thread-owner", email="owner@example.invalid")
        support = User.objects.create_user("thread-support", email="support@example.invalid")
        tenant = Tenant.objects.create(name="Concurrent", identifier="concurrent", created_by=owner)
        tenant.members.add(support)
        SupportRole.objects.create(tenant=tenant, user=support, can_support=True)
        thread = SupportThread.objects.create(
            tenant=tenant, creator=owner, title="Test", kind="question", request_id=uuid.uuid4()
        )
        entry = InboxEntry.objects.create(tenant=tenant, user=support, thread=thread, activity_at=timezone.now())
        job = EmailDelivery.objects.create(
            entry=entry, event_key="concurrent", summary="Nytt svar", next_attempt_at=timezone.now()
        )
        entered, release = threading.Event(), threading.Event()
        failures = []

        def send(*args, **kwargs):
            entered.set()
            if not release.wait(5):
                raise TimeoutError
            return 1

        def worker():
            try:
                deliver_one(job.pk)
            except Exception as exc:
                failures.append(type(exc).__name__)
            finally:
                connections.close_all()

        with patch("tenant_support.tasks.EmailMessage.send", side_effect=send) as mocked:
            first = threading.Thread(target=worker)
            first.start()
            try:
                self.assertTrue(entered.wait(5))
                deliver_one(job.pk)
            finally:
                release.set()
                first.join(10)
            self.assertFalse(first.is_alive())
            self.assertEqual(failures, [])
            self.assertEqual(mocked.call_count, 1)
        job.refresh_from_db()
        self.assertEqual(job.state, "sent")
