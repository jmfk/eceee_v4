from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.test import TestCase
from django.test.utils import override_settings
from rest_framework.test import APIClient

from core.hostname_policy import hostname_allowed
from core.models import Tenant, TenantRole
from webpages.models import WebPage


class TenantManagementTests(TestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_superuser("system-owner", "owner@example.test", "test")
        self.member = get_user_model().objects.create_user("member", "member@example.test", "test")
        self.client = APIClient()

    def test_only_superuser_can_create_and_new_tenant_denies_hostnames(self):
        self.client.force_authenticate(self.member)
        url = "/api/v1/utils/tenants/"
        self.assertEqual(self.client.post(url, {"name": "New", "identifier": "new"}).status_code, 403)
        self.client.force_authenticate(self.owner)
        response = self.client.post(url, {"name": "New", "identifier": "new"})
        self.assertEqual(response.status_code, 201)
        tenant = Tenant.objects.get(identifier="new")
        self.assertFalse(hostname_allowed(tenant, "new.example.test"))
        self.assertTrue(TenantRole.objects.filter(tenant=tenant, name="Administratör").exists())

    def test_domain_grant_respects_label_boundary_and_wildcards(self):
        tenant = Tenant.objects.create(
            name="Domain",
            identifier="domain",
            created_by=self.owner,
            settings={"hostname_policy": {"mode": "domains", "values": ["example.test"]}},
        )
        self.assertTrue(hostname_allowed(tenant, "news.example.test"))
        self.assertTrue(hostname_allowed(tenant, "*.example.test"))
        self.assertFalse(hostname_allowed(tenant, "evil-example.test"))
        self.assertFalse(hostname_allowed(tenant, "*"))

    def test_deactivation_is_reversible(self):
        tenant = Tenant.objects.create(name="A", identifier="a", created_by=self.owner)
        self.client.force_authenticate(self.owner)
        url = f"/api/v1/utils/tenants/{tenant.pk}/"
        self.assertEqual(self.client.patch(url, {"is_active": False}, format="json").status_code, 200)
        tenant.refresh_from_db()
        self.assertFalse(tenant.is_active)
        self.assertEqual(self.client.patch(url, {"is_active": True}, format="json").status_code, 200)
        tenant.refresh_from_db()
        self.assertTrue(tenant.is_active)

    @override_settings(DEFAULT_TENANT_ID=None, REQUIRE_TENANT=True)
    def test_owner_can_reactivate_selected_last_tenant(self):
        tenant = Tenant.objects.create(name="Last", identifier="last", created_by=self.owner)
        Tenant.objects.exclude(pk=tenant.pk).update(is_active=False)
        self.client.force_login(self.owner)
        session = self.client.session
        session["selected_tenant_identifier"] = tenant.identifier
        session.save()
        url = f"/api/v1/utils/tenants/{tenant.pk}/"

        self.assertEqual(self.client.patch(url, {"is_active": False}, format="json").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/utils/tenants/", HTTP_X_TENANT_ID=tenant.identifier).status_code, 200)
        current_user = self.client.get("/api/v1/utils/current-user/")
        self.assertEqual(current_user.status_code, 200)
        self.assertIsNone(current_user.data["current_workspace"])
        self.assertEqual(self.client.patch(url, {"is_active": True}, format="json").status_code, 200)
        tenant.refresh_from_db()
        self.assertTrue(tenant.is_active)

    def test_page_save_uses_current_hostname_grant(self):
        tenant = Tenant.objects.create(name="Grant", identifier="grant", created_by=self.owner)
        page = WebPage(tenant=tenant, title="Root", hostnames=["unapproved.example.test"])
        Tenant.objects.filter(pk=tenant.pk).update(settings={"hostname_policy": {"mode": "exact", "values": []}})

        with self.assertRaises(DjangoValidationError):
            page.save()
        self.assertFalse(WebPage.objects.filter(title="Root", tenant=tenant).exists())
