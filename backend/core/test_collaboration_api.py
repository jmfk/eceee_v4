"""Real ApiKey requests preserve existing tenant, role and personal ownership rules."""

import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.machine_api_keys import generate_machine_api_key
from core.models import MachineAPIKey, Tenant
from tenant_support.models import InboxEntry, Instruction, PrivateVideo, SupportRole, SupportThread


@override_settings(
    DEPLOYMENT_ENVIRONMENT="test",
    DEV_AUTO_LOGIN=False,
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    SUPPORT_EMAIL_ENABLED=False,
    SUPPORT_STORAGE_BUCKET_NAME="private-collaboration-tests",
)
class CollaborationMachineAPITests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_superuser(
            "collaboration-owner", email="owner@example.invalid", password="test"
        )
        self.principal = User.objects.create_user("collaboration-agent")
        self.human = User.objects.create_user("collaboration-human")
        self.tenant = Tenant.objects.create(identifier="collaboration", name="Collaboration", created_by=self.admin)
        self.other = Tenant.objects.create(identifier="collaboration-other", name="Other", created_by=self.admin)
        self.tenant.members.add(self.principal, self.human)
        self.other.members.add(self.principal)
        self.client = APIClient()

    def authorize(self, scopes):
        raw, digest, prefix = generate_machine_api_key()
        self.key = MachineAPIKey.objects.create(
            name=str(uuid.uuid4()),
            principal=self.principal,
            created_by=self.admin,
            environment="test",
            key_hash=digest,
            key_prefix=prefix,
            scopes=scopes,
        )
        self.key.tenants.add(self.tenant)
        self.raw = raw
        self.client.credentials(HTTP_AUTHORIZATION="ApiKey " + raw, HTTP_X_TENANT_ID=self.tenant.identifier)
        return self.key

    def video(self, owner=None):
        return PrivateVideo.objects.create(
            tenant=self.tenant,
            owner=owner or self.principal,
            purpose="instruction",
            storage_key=str(uuid.uuid4()),
            content_type="video/mp4",
            byte_size=100,
            duration=10,
        )

    def publish_payload(self, video=None):
        return {
            "title": "Guide",
            "description": "Instructions",
            "helpGuideId": "pages-create",
            "language": "sv",
            "transcript": "Open Pages",
            "videoId": str((video or self.video()).pk),
            "requestId": str(uuid.uuid4()),
        }

    def test_read_scope_and_key_tenant_are_both_required(self):
        self.authorize(["support.read"])
        self.assertEqual(self.client.get("/api/v1/support/instructions/").status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION="ApiKey " + self.raw, HTTP_X_TENANT_ID=self.other.identifier)
        self.assertEqual(self.client.get("/api/v1/support/instructions/").status_code, 403)
        self.authorize(["page.read"])
        self.assertEqual(self.client.get("/api/v1/support/instructions/").status_code, 403)

    def test_instruction_publication_requires_scope_and_existing_publisher_role(self):
        self.authorize(["support.publish"])
        payload = self.publish_payload()
        self.assertEqual(self.client.post("/api/v1/support/instructions/", payload, format="json").status_code, 403)
        SupportRole.objects.create(tenant=self.tenant, user=self.principal, can_publish=True)
        self.authorize(["support.write"])
        self.assertEqual(self.client.post("/api/v1/support/instructions/", payload, format="json").status_code, 403)
        self.authorize(["support.publish"])
        first = self.client.post("/api/v1/support/instructions/", payload, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        again = self.client.post("/api/v1/support/instructions/", payload, format="json")
        self.assertEqual(again.status_code, 200, again.data)
        self.assertEqual(first.data["id"], again.data["id"])
        self.assertEqual(Instruction.objects.count(), 1)
        self.assertEqual(Instruction.objects.get().author_id, self.principal.pk)

    def test_instruction_cannot_reuse_another_persons_video(self):
        self.authorize(["support.publish"])
        SupportRole.objects.create(tenant=self.tenant, user=self.principal, can_publish=True)
        payload = self.publish_payload(self.video(owner=self.human))
        self.assertEqual(self.client.post("/api/v1/support/instructions/", payload, format="json").status_code, 404)

    def test_upload_of_instruction_needs_publication_scope_before_storage_write(self):
        SupportRole.objects.create(tenant=self.tenant, user=self.principal, can_publish=True)
        self.authorize(["support.write"])
        with patch("tenant_support.views.storage.save_video") as save:
            response = self.client.post(
                "/api/v1/support/videos/",
                {"purpose": "instruction", "file": SimpleUploadedFile("guide.mp4", b"video")},
                format="multipart",
            )
        self.assertEqual(response.status_code, 403)
        save.assert_not_called()

    @patch("tenant_support.views.inspect_video", return_value=(10, "video/mp4", "mp4"))
    @patch("tenant_support.views.storage.save_video")
    def test_authorized_upload_uses_private_video_storage(self, save, inspect):
        SupportRole.objects.create(tenant=self.tenant, user=self.principal, can_publish=True)
        self.authorize(["support.write", "support.publish"])
        response = self.client.post(
            "/api/v1/support/videos/",
            {"purpose": "instruction", "file": SimpleUploadedFile("guide.mp4", b"video")},
            format="multipart",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(PrivateVideo.objects.get(pk=response.data["id"]).owner_id, self.principal.pk)
        save.assert_called_once()

    def test_private_inbox_and_thread_ownership_do_not_become_tenant_wide(self):
        self.authorize(["support.read", "support.write"])
        foreign = SupportThread.objects.create(
            tenant=self.tenant, creator=self.human, title="Private human report", kind="bug", request_id=uuid.uuid4()
        )
        own = SupportThread.objects.create(
            tenant=self.tenant, creator=self.principal, title="Agent report", kind="bug", request_id=uuid.uuid4()
        )
        InboxEntry.objects.create(tenant=self.tenant, user=self.human, thread=foreign, activity_at=timezone.now())
        entry = InboxEntry.objects.create(
            tenant=self.tenant, user=self.principal, thread=own, activity_at=timezone.now()
        )
        response = self.client.get("/api/v1/support/inbox/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([str(x["id"]) for x in response.data["results"]], [str(entry.pk)])
        self.assertEqual(self.client.get(f"/api/v1/support/threads/{foreign.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/v1/support/threads/{own.pk}/").status_code, 200)

    def test_bug_report_uses_machine_principal_and_existing_deduplication(self):
        self.authorize(["support.write"])
        SupportRole.objects.create(tenant=self.tenant, user=self.admin, can_support=True)
        payload = {
            "title": "Reproduction",
            "body": "Steps",
            "kind": "bug",
            "location": "https://cms.example.invalid/pages/1",
            "requestId": str(uuid.uuid4()),
        }
        response = self.client.post("/api/v1/support/threads/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        again = self.client.post("/api/v1/support/threads/", payload, format="json")
        self.assertEqual(again.status_code, 200, again.data)
        self.assertEqual(SupportThread.objects.get().creator_id, self.principal.pk)

    def test_keys_cannot_assign_support_roles_or_labels(self):
        self.authorize(["server.full_access"])
        for path in ["context/", "labels/"]:
            self.assertEqual(self.client.post("/api/v1/support/" + path, {}, format="json").status_code, 403)

    def test_kanban_read_key_cannot_create_board_and_write_key_can(self):
        self.authorize(["kanban.read"])
        self.assertEqual(self.client.get("/api/v1/kanban/boards/").status_code, 200)
        self.assertEqual(
            self.client.post("/api/v1/kanban/boards/", {"title": "Agent work"}, format="json").status_code, 403
        )
        self.authorize(["kanban.write"])
        response = self.client.post("/api/v1/kanban/boards/", {"title": "Agent work"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)

    def test_self_profile_is_bound_to_key_tenant_and_language_write_scope(self):
        self.authorize(["profile.read"])
        response = self.client.get("/api/v1/utils/current-user/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["id"], self.principal.pk)
        self.assertEqual(response.data["current_workspace"]["identifier"], self.tenant.identifier)
        self.assertNotIn("designer_tenants", response.data)
        self.assertEqual(
            self.client.patch("/api/v1/utils/current-user/", {"preferredLanguage": "sv-se"}, format="json").status_code,
            403,
        )
        self.authorize(["profile.write"])
        response = self.client.patch("/api/v1/utils/current-user/", {"preferredLanguage": "sv-se"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)

    def test_machine_profile_photo_cannot_target_another_human(self):
        self.authorize(["profile.read", "profile.write"])
        self.assertEqual(self.client.get(f"/api/v1/utils/profile-photos/{self.human.pk}/").status_code, 403)
        self.assertEqual(self.client.delete(f"/api/v1/utils/profile-photos/{self.human.pk}/").status_code, 403)
        self.assertEqual(self.client.get(f"/api/v1/utils/profile-photos/{self.principal.pk}/").status_code, 404)

    def test_revoked_membership_blocks_self_profile_and_photo_writes(self):
        self.authorize(["profile.read", "profile.write"])
        self.tenant.members.remove(self.principal)
        self.assertEqual(self.client.get("/api/v1/utils/current-user/").status_code, 403)
        self.assertEqual(
            self.client.patch("/api/v1/utils/current-user/", {"preferredLanguage": "sv-se"}, format="json").status_code,
            403,
        )
        self.assertEqual(self.client.delete(f"/api/v1/utils/profile-photos/{self.principal.pk}/").status_code, 403)

    def test_scope_grants_preserve_secret_identity_and_existing_scopes(self):
        key = self.authorize(["page.read"])
        original = (key.key_hash, key.key_prefix, key.principal_id, list(key.tenants.values_list("pk", flat=True)))
        endpoint = f"/api/v1/core/machine-api-keys/{key.pk}/grant-scopes/"
        self.assertEqual(self.client.post(endpoint, {"scopes": ["support.read"]}, format="json").status_code, 403)
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)
        self.client.force_authenticate(self.admin)
        for _ in range(2):
            response = self.client.post(endpoint, {"scopes": ["support.read", "kanban.read"]}, format="json")
            self.assertEqual(response.status_code, 200, response.data)
            self.assertNotIn("secret", response.data)
        key.refresh_from_db()
        self.assertEqual(set(key.scopes), {"page.read", "support.read", "kanban.read"})
        self.assertEqual(
            (key.key_hash, key.key_prefix, key.principal_id, list(key.tenants.values_list("pk", flat=True))), original
        )
        self.assertEqual(self.client.post(endpoint, {"scopes": ["unknown.permission"]}, format="json").status_code, 400)
