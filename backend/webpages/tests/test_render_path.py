from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Tenant
from webpages.models import WebPage


class RenderPathResolutionTest(TestCase):
    def setUp(self):
        if connection.vendor == "sqlite":
            self.skipTest("ArrayField is not supported on SQLite")
        self.user = User.objects.create_user("render-path-user", password="test")
        self.tenant = Tenant.objects.create(
            name="Render tenant",
            identifier="render-tenant",
            created_by=self.user,
        )
        self.site = WebPage.objects.create(
            title="Site",
            slug="site",
            hostnames=["render.example.test"],
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.section = WebPage.objects.create(
            title="For authors",
            slug="for-authors",
            parent=self.site,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.page = WebPage.objects.create(
            title="Review process",
            slug="review-process",
            parent=self.section,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.version = self.page.create_version(self.user, "Render version")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)
        self.url = reverse("api:webpage-resolve-render-path")

    def test_resolves_nested_path_within_site(self):
        response = self.client.get(
            self.url,
            {"site_id": self.site.id, "path": "for-authors/review-process"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["page_id"], self.page.id)
        self.assertEqual(response.data["version_id"], self.version.id)
        self.assertEqual(response.data["tenant_identifier"], self.tenant.identifier)
        self.assertEqual(
            response.data["render_path"],
            f"/_render/{self.site.id}/for-authors/review-process",
        )

    def test_resolves_site_root(self):
        version = self.site.create_version(self.user, "Root render version")

        response = self.client.get(self.url, {"site_id": self.site.id, "path": ""})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["page_id"], self.site.id)
        self.assertEqual(response.data["version_id"], version.id)
        self.assertEqual(response.data["slug_path"], "")

    def test_explicit_site_id_can_bootstrap_an_accessible_tenant(self):
        other_tenant = Tenant.objects.create(
            name="Other accessible tenant",
            identifier="other-accessible-tenant",
            created_by=self.user,
        )
        other_site = WebPage.objects.create(
            title="Other site",
            slug="other-site",
            hostnames=["other.example.test"],
            tenant=other_tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        version = other_site.create_version(self.user, "Other site render version")

        response = self.client.get(self.url, {"site_id": other_site.id, "path": ""})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tenant_identifier"], other_tenant.identifier)
        self.assertEqual(response.data["version_id"], version.id)

    def test_does_not_bootstrap_an_inaccessible_tenant(self):
        other_user = User.objects.create_user("other-render-user", password="test")
        other_tenant = Tenant.objects.create(
            name="Inaccessible tenant",
            identifier="inaccessible-tenant",
            created_by=other_user,
        )
        other_site = WebPage.objects.create(
            title="Private site",
            slug="private-site",
            hostnames=["private.example.test"],
            tenant=other_tenant,
            created_by=other_user,
            last_modified_by=other_user,
        )
        other_site.create_version(other_user, "Private version")

        response = self.client.get(self.url, {"site_id": other_site.id, "path": ""})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_rejects_anonymous_preview_resolution(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(
            self.url,
            {"site_id": self.site.id, "path": "for-authors/review-process"},
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_does_not_resolve_path_outside_selected_site(self):
        other_site = WebPage.objects.create(
            title="Other",
            slug="other",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        WebPage.objects.create(
            title="Review process",
            slug="review-process",
            parent=other_site,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )

        response = self.client.get(
            self.url,
            {"site_id": self.site.id, "path": "review-process"},
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
