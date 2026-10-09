from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Tenant
from webpages.models import WebPage


class PageLookupTest(TestCase):
    def setUp(self):
        if connection.vendor == "sqlite":
            self.skipTest("ArrayField is not supported on SQLite")
        self.user = User.objects.create_user("page-lookup-user", password="test")
        self.tenant = Tenant.objects.create(
            name="Lookup tenant",
            identifier="lookup-tenant",
            created_by=self.user,
        )
        self.site = self.create_page(
            title="Main site",
            slug="main",
            hostnames=["main.example.test"],
        )
        self.page = self.create_page(
            title="About",
            slug="about",
            parent=self.site,
            is_currently_published=True,
        )
        self.other_site = self.create_page(
            title="Other site",
            slug="other",
            hostnames=["other.example.test"],
        )
        self.other_page = self.create_page(
            title="Contact",
            slug="contact",
            parent=self.other_site,
        )
        self.deleted_page = self.create_page(
            title="Deleted",
            slug="deleted",
            parent=self.site,
            is_deleted=True,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)
        self.url = reverse("api:page-lookup")

    def create_page(self, **values):
        return WebPage.objects.create(
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
            **values,
        )

    def test_batch_lookup_deduplicates_ids_and_omits_missing_or_deleted_pages(self):
        response = self.client.post(
            self.url,
            {
                "ids": [self.page.id, self.page.id, 999999, self.deleted_page.id],
                "currentSiteId": self.site.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["id"], self.page.id)
        self.assertEqual(response.data["results"][0]["path"], "/about/")
        self.assertTrue(response.data["results"][0]["is_published"])
        self.assertEqual(response.data["results"][0]["site_id"], self.site.id)

    def test_batch_lookup_includes_cross_site_metadata(self):
        response = self.client.post(
            self.url,
            {"ids": [self.other_page.id], "currentSiteId": self.site.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.data["results"][0]
        self.assertEqual(result["site_id"], self.other_site.id)
        self.assertEqual(result["site"]["title"], "Other site")

    def test_batch_lookup_is_tenant_scoped(self):
        other_tenant = Tenant.objects.create(
            name="Other tenant",
            identifier="other-lookup-tenant",
            created_by=self.user,
        )
        other_page = WebPage.objects.create(
            title="Private page",
            slug="private",
            tenant=other_tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )

        response = self.client.post(self.url, {"ids": [other_page.id]}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["results"], [])

    def test_batch_lookup_rejects_invalid_ids(self):
        response = self.client.post(self.url, {"ids": [self.page.id, "nope"]}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_batch_lookup_requires_authentication(self):
        client = APIClient()

        response = client.post(
            self.url,
            {"ids": [self.page.id]},
            format="json",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )

        self.assertIn(response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_single_lookup_get_remains_compatible(self):
        response = self.client.get(
            self.url,
            {"id": self.page.id, "currentSiteId": self.site.id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.page.id)
        self.assertEqual(response.data["path"], "/about/")
        self.assertEqual(response.data["parent_id"], self.site.id)
