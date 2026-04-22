"""
Tests for webpage preview functionality.
"""

import json
from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from webpages.models import WebPage, PageVersion
from core.models import Tenant


class WebPagePreviewTest(TestCase):
    """Test webpage preview view and authentication."""

    def setUp(self):
        """Set up test data."""
        from django.db import connection
        if connection.vendor == 'sqlite':
            self.skipTest("ArrayField not supported on SQLite")
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.tenant = Tenant.objects.create(
            name="Test Tenant", identifier="test", created_by=self.user
        )
        
        # Create a root page
        self.root_page = WebPage.objects.create(
            title="Root Page",
            slug="root",
            created_by=self.user,
            last_modified_by=self.user,
            tenant=self.tenant,
            hostnames=["summerstudy"]
        )
        
        # Create a version
        self.version = PageVersion.objects.create(
            page=self.root_page,
            version_number=1,
            version_title="Initial Version",
            created_by=self.user,
            page_data={"title": "Root Page"},
            widgets={}
        )
        
        self.preview_url = reverse(
            "page-version-preview", 
            kwargs={"page_id": self.root_page.id, "version_id": self.version.id}
        )

    def test_preview_unauthenticated_fails(self):
        """Test that preview fails without authentication."""
        response = self.client.get(self.preview_url)
        self.assertEqual(response.status_code, 401)
        # Should return our custom HTML 401
        self.assertIn(b"You must be logged in to preview pages", response.content)

    def test_preview_header_auth_succeeds(self):
        """Test that preview succeeds with Authorization header."""
        token = str(AccessToken.for_user(self.user))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        
        response = self.client.get(self.preview_url)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"<!DOCTYPE html>", response.content)

    def test_preview_query_token_auth_succeeds(self):
        """Test that preview succeeds with token in query parameter."""
        token = str(AccessToken.for_user(self.user))
        url = f"{self.preview_url}?token={token}"
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"<!DOCTYPE html>", response.content)

    @override_settings(DEBUG=True)
    def test_preview_dev_hostname_port_resolution(self):
        """Test that dev preview resolves bare hostnames with current request port."""
        token = str(AccessToken.for_user(self.user))
        url = f"{self.preview_url}?token={token}"
        
        # Mock request with a specific port
        response = self.client.get(url, HTTP_HOST="localhost:8000")
        self.assertEqual(response.status_code, 200)
        
        # Root page hostname is "summerstudy". 
        # In DEBUG mode, it should be resolved to "summerstudy:8000" 
        # because the request came from "localhost:8000".
        self.assertIn(b'<base href="http://summerstudy:8000/">', response.content)
        self.assertIn(b'href="http://summerstudy:8000/static/css/tailwind.output.css"', response.content)

    @override_settings(DEBUG=False)
    def test_preview_prod_hostname_strict(self):
        """Test that prod preview uses configured hostname strictly."""
        token = str(AccessToken.for_user(self.user))
        url = f"{self.preview_url}?token={token}"
        
        response = self.client.get(url, HTTP_HOST="some-other-domain.com")
        self.assertEqual(response.status_code, 200)
        
        # In production, it should use the configured hostname "summerstudy" exactly.
        # Note: it will use https by default in prod logic.
        self.assertIn(b'<base href="https://summerstudy/">', response.content)
