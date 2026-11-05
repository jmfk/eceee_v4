from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from content.models import Namespace
from core.models import Tenant, TenantRole


@override_settings(DEBUG=False, DEV_AUTO_LOGIN=False)
class UserPerspectiveTenantTests(TestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_superuser("perspective-owner", password="test")
        self.target = get_user_model().objects.create_user("perspective-member", password="test")
        self.tenant = Tenant.objects.create(
            name="Member workspace", identifier="perspective-member", created_by=self.admin
        )
        self.tenant.members.add(self.target)
        self.other = Tenant.objects.create(
            name="Other workspace", identifier="perspective-other", created_by=self.admin
        )
        role = TenantRole.objects.create(tenant=self.tenant, name="Reader", permissions=["page.read"])
        role.users.add(self.target)
        self.client = APIClient()
        self.client.force_login(self.admin, backend="django.contrib.auth.backends.ModelBackend")

    def test_target_permissions_tenant_identity_and_mutation_authorship(self):
        response = self.client.post("/api/v1/utils/user-perspective/", {"userId": self.target.pk}, format="json")
        self.assertEqual(response.status_code, 200)
        current = self.client.get("/api/v1/utils/current-user/")
        self.assertEqual(current.status_code, 200)
        self.assertEqual(current.data["id"], self.target.pk)
        self.assertFalse(current.data["is_superuser"])
        self.assertEqual(current.data["permissions"], ["page.read"])
        self.assertEqual(current.data["current_workspace"]["identifier"], self.tenant.identifier)
        self.assertEqual(current.json()["userPerspective"]["username"], self.target.username)
        self.assertEqual(self.client.get("/api/v1/utils/users/").status_code, 403)
        self.assertEqual(
            self.client.get("/api/v1/utils/current-user/", HTTP_X_TENANT_ID=self.other.identifier).status_code, 403
        )
        self.assertEqual(
            self.client.post(
                "/api/v1/utils/roles/", {"name": "Escalated", "permissions": ["tenant.admin"]}, format="json"
            ).status_code,
            403,
        )
        payload = {"name": "Delegated namespace", "slug": "delegated-namespace"}
        self.assertEqual(self.client.post("/api/v1/namespaces/", payload, format="json").status_code, 403)
        role = TenantRole.objects.get(tenant=self.tenant, users=self.target)
        role.permissions = ["page.read", "settings.write"]
        role.save()
        created = self.client.post("/api/v1/namespaces/", payload, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        namespace = Namespace.objects.get(pk=created.data["id"])
        self.assertEqual(namespace.created_by_id, self.target.pk)
        self.assertEqual(namespace.tenant_id, self.tenant.pk)
        returned = self.client.delete("/api/v1/utils/user-perspective/")
        self.assertEqual(returned.status_code, 200)
        self.assertEqual(self.client.get("/api/v1/utils/current-user/").data["id"], self.admin.pk)

    @override_settings(SUPPORT_EMAIL_ENABLED=False)
    def test_member_with_no_cms_permissions_can_request_access_from_admin(self):
        import uuid

        from tenant_support.models import InboxEntry, SupportThread

        role = TenantRole.objects.get(tenant=self.tenant, users=self.target)
        role.permissions = []
        role.save()
        self.client.force_login(self.target, backend="django.contrib.auth.backends.ModelBackend")
        self.assertEqual(self.client.get("/api/v1/utils/current-user/").data["permissions"], [])
        context = self.client.get("/api/v1/support/context/", HTTP_X_TENANT_ID=self.tenant.identifier)
        self.assertEqual(context.status_code, 200)
        recipients = context.json()["accessRequestRecipients"]
        self.assertEqual(recipients, [f"user:{self.admin.pk}"])
        created = self.client.post(
            "/api/v1/support/threads/",
            {
                "title": "Request for access",
                "body": "Please enable Pages",
                "recipients": recipients,
                "requestId": str(uuid.uuid4()),
            },
            format="json",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )
        self.assertEqual(created.status_code, 201, created.data)
        thread = SupportThread.objects.get(pk=created.data["id"])
        self.assertEqual(thread.creator_id, self.target.pk)
        self.assertTrue(InboxEntry.objects.filter(thread=thread, user=self.admin).exists())
        self.assertEqual(
            self.client.get("/api/v1/support/context/", HTTP_X_TENANT_ID=self.other.identifier).status_code, 403
        )
