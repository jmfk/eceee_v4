from django.contrib.auth import get_user_model
from django.test import TestCase


class AccountExportTests(TestCase):
    def test_export_requires_browser_session_and_excludes_credentials(self):
        self.assertEqual(self.client.get("/api/v1/auth/privacy/export/").status_code, 401)
        user = get_user_model().objects.create_user(
            username="export-owner", email="owner@example.org", password="test-password"
        )
        self.client.force_login(user)
        response = self.client.get("/api/v1/auth/privacy/export/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["account"]["email"], user.email)
        self.assertNotIn("password", response.json()["account"])
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertEqual(
            self.client.get("/api/v1/auth/privacy/export/", HTTP_AUTHORIZATION="Bearer ignored").status_code, 401
        )
