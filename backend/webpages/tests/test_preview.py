"""
Tests for webpage preview functionality.
"""

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from core.models import Tenant
from webpages.models import PageVersion, WebPage


@override_settings(INTERNAL_IPS=[])
class WebPagePreviewTest(TestCase):
    """Test webpage preview view and authentication."""

    def setUp(self):
        """Set up test data."""
        from django.db import connection

        if connection.vendor == "sqlite":
            self.skipTest("ArrayField not supported on SQLite")
        from easy_layouts.layouts.main_layout import MainLayoutLayout
        from webpages.layout_registry import layout_registry

        if not layout_registry.is_registered("main_layout"):
            layout_registry.register(MainLayoutLayout)

        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")
        self.tenant = Tenant.objects.create(name="Test Tenant", identifier="test", created_by=self.user)

        # Create a root page
        self.root_page = WebPage.objects.create(
            title="Root Page",
            slug="root",
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
            hostnames=["summerstudy"],
        )

        # Create a version
        self.version = PageVersion.objects.create(
            page=self.root_page,
            version_number=1,
            version_title="Initial Version",
            created_by=self.user,
            page_data={"title": "Root Page"},
            widgets={},
            code_layout="main_layout",
        )

        self.preview_url = reverse(
            "api:page-version-preview", kwargs={"page_id": self.root_page.id, "version_id": self.version.id}
        )

    def test_preview_unauthenticated_fails(self):
        """Test that preview fails without authentication."""
        response = self.client.get(self.preview_url)
        self.assertEqual(response.status_code, 401)
        self.assertIn(b"Authentication credentials were not provided", response.content)

    def test_preview_header_auth_succeeds(self):
        """Test that preview succeeds with Authorization header."""
        token = str(AccessToken.for_user(self.user))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.get(self.preview_url)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"<!DOCTYPE html>", response.content)
        self.assertIn(b"eceee-preview-nav-link-menu", response.content)
        self.assertIn(b"overflow: hidden !important", response.content)

    def test_preview_scoped_grant_auth_succeeds(self):
        """A short-lived grant opens only the requested standalone preview."""
        token = str(AccessToken.for_user(self.user))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        grant_url = reverse(
            "api:page-version-preview-grant",
            kwargs={"page_id": self.root_page.id, "version_id": self.version.id},
        )
        grant_response = self.client.post(grant_url)
        self.assertEqual(grant_response.status_code, 200)
        grant = grant_response.data["preview_token"]

        self.client.credentials()
        url = f"{self.preview_url}?preview_token={grant}&standalone=1"

        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"<!DOCTYPE html>", response.content)
        self.assertIn(b'<meta name="referrer" content="no-referrer">', response.content)
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertEqual(response["Referrer-Policy"], "no-referrer")
        self.assertIn(b"overflow: auto !important", response.content)

    def test_preview_grant_cannot_open_another_version(self):
        other = PageVersion.objects.create(
            page=self.root_page,
            version_number=2,
            version_title="Other Version",
            created_by=self.user,
            code_layout="main_layout",
        )
        self.client.force_authenticate(self.user)
        grant_response = self.client.post(
            reverse(
                "api:page-version-preview-grant",
                kwargs={"page_id": self.root_page.id, "version_id": self.version.id},
            )
        )
        self.client.force_authenticate(None)

        response = self.client.get(
            reverse("api:page-version-preview", kwargs={"page_id": self.root_page.id, "version_id": other.id}),
            {"preview_token": grant_response.data["preview_token"]},
        )

        self.assertEqual(response.status_code, 401)

    def test_preview_renders_selected_snapshot_instead_of_current_page(self):
        self.version.page_data = {"page_attributes": {"title": "Historical title"}}
        self.version.widgets = {
            "main": [
                {
                    "id": "historical-content",
                    "type": "easy_widgets.ContentWidget",
                    "config": {"content": "Historical body"},
                }
            ]
        }
        self.version.page_custom_css = ".historical-only { color: purple; }"
        self.version.save(update_fields=["page_data", "widgets", "page_custom_css"])
        PageVersion.objects.create(
            page=self.root_page,
            version_number=2,
            version_title="Current Version",
            created_by=self.user,
            page_data={"page_attributes": {"title": "Current title"}},
            widgets={
                "main": [
                    {
                        "id": "current-content",
                        "type": "easy_widgets.ContentWidget",
                        "config": {"content": "Current body"},
                    }
                ]
            },
            page_custom_css=".current-only { color: orange; }",
            code_layout="main_layout",
            effective_date=timezone.now(),
        )
        self.root_page.title = "Current title"
        self.root_page.save(update_fields=["title"])
        self.client.force_authenticate(self.user)

        response = self.client.get(self.preview_url)

        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Historical body", response.content)
        self.assertIn(b"Historical title", response.content)
        self.assertIn(b"historical-only", response.content)
        self.assertNotIn(b"Current body", response.content)
        self.assertNotIn(b"current-only", response.content)

    @override_settings(DEBUG=True)
    def test_preview_dev_hostname_port_resolution(self):
        """Test that dev preview resolves bare hostnames with current request port."""
        token = str(AccessToken.for_user(self.user))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # Mock request with a specific port
        response = self.client.get(self.preview_url, HTTP_HOST="localhost:8000")
        self.assertEqual(response.status_code, 200)

        # Root page hostname is "summerstudy".
        # In DEBUG mode, it should be resolved to "summerstudy:8000"
        # because the request came from "localhost:8000".
        self.assertIn(b'<base href="https://summerstudy:8000/">', response.content)
        self.assertIn(b'href="https://summerstudy:8000/static/css/tailwind.output.css"', response.content)

    @override_settings(DEBUG=False)
    def test_preview_prod_hostname_strict(self):
        """Test that prod preview uses configured hostname strictly."""
        token = str(AccessToken.for_user(self.user))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.get(self.preview_url, HTTP_HOST="summerstudy")
        self.assertEqual(response.status_code, 200)

        # In production, it should use the configured hostname "summerstudy" exactly.
        # Note: it will use https by default in prod logic.
        self.assertIn(b'<base href="https://summerstudy/">', response.content)
