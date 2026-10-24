"""Run with the backend Python dependencies; uses only migrated in-memory SQLite."""

import contextlib
import importlib.util
import io
import json
import os
import unittest
from pathlib import Path
from unittest import mock

django = None
if os.environ.get("RUN_SUPPORT_RECIPIENT_DB_TESTS") == "1":
    import django

if django:
    from tenant_support import test_settings

    test_settings.INSTALLED_APPS = test_settings.INSTALLED_APPS + [
        "django.contrib.sites",
        "allauth",
        "allauth.account",
    ]
    test_settings.MIDDLEWARE = ["allauth.account.middleware.AccountMiddleware"]
    test_settings.SITE_ID = 1
    test_settings.SUPPORT_EMAIL_ENABLED = False
    django.setup()
    from django.contrib.auth import get_user_model
    from django.core.management import call_command
    from django.test import TestCase
    from allauth.account.models import EmailAddress
    from core.models import Tenant, TenantRole
    from core.roles import permissions_for
    from tenant_support.access import support_users
else:
    TestCase = unittest.TestCase

SPEC = importlib.util.spec_from_file_location(
    "support_recipient_database",
    Path(__file__).resolve().parents[1] / "provision-support-recipient.py",
)
subject = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(subject)


@unittest.skipUnless(django, "set RUN_SUPPORT_RECIPIENT_DB_TESTS=1 with backend dependencies")
class RecipientDatabaseTests(TestCase):
    @classmethod
    def setUpClass(cls):
        call_command("migrate", verbosity=0, interactive=False)
        super().setUpClass()

    def setUp(self):
        self.owner = get_user_model().objects.create_user(username="owner", password="fixture-owner")
        self.tenant = Tenant.objects.create(name="Workspace", identifier="test", created_by=self.owner)
        self.email = "support@example.invalid"
        self.password = "fixture-bootstrap-only"

    def provision(self):
        payload = {"SUPPORT_LOGIN_EMAIL": self.email, "SUPPORT_BOOTSTRAP_PASSWORD": self.password}
        with mock.patch("sys.stdin", io.StringIO(json.dumps(payload))), contextlib.redirect_stdout(io.StringIO()):
            exec(subject.ACCOUNT_CODE, {})

    def test_new_account_is_support_only_and_routable(self):
        self.provision()
        user = get_user_model().objects.get(email=self.email)
        self.assertFalse(user.is_staff or user.is_superuser)
        self.assertTrue(user.check_password(self.password))
        self.assertEqual(permissions_for(user, self.tenant), {"support.read"})
        self.assertIn(user, support_users(self.tenant))
        self.assertFalse(EmailAddress.objects.get(user=user).verified)

    def test_existing_unrelated_login_is_not_reset(self):
        user = get_user_model().objects.create_user(username=self.email, email=self.email, password="existing-fixture")
        with self.assertRaises(AssertionError):
            self.provision()
        user.refresh_from_db()
        self.assertTrue(user.check_password("existing-fixture"))
        self.assertFalse(self.tenant.members.filter(pk=user.pk).exists())

    def test_privileged_role_collision_rolls_back_account_creation(self):
        TenantRole.objects.create(tenant=self.tenant, name="Support inbox only", permissions=["tenant.admin"])
        with self.assertRaises(AssertionError):
            self.provision()
        self.assertFalse(get_user_model().objects.filter(email=self.email).exists())

    def test_retry_reuses_bootstrap_account_and_preserves_email_verification(self):
        self.provision()
        user = get_user_model().objects.get(email=self.email)
        address = EmailAddress.objects.get(user=user)
        address.verified = True
        address.save(update_fields=["verified"])
        self.provision()
        self.assertEqual(get_user_model().objects.filter(email=self.email).count(), 1)
        address.refresh_from_db()
        self.assertTrue(address.verified)
        self.assertEqual(permissions_for(user, self.tenant), {"support.read"})


if __name__ == "__main__":
    unittest.main()
