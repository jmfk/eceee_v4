import os

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from content.models import Namespace
from core.models import Tenant


def pytest_configure():
    """Override settings for tests."""
    from django.conf import settings

    # Keep fast SQLite as the local default, but honor the repository's
    # PostgreSQL test target for migrations that use PostgreSQL-native fields.
    if os.environ.get("DJANGO_TEST_DATABASE", "sqlite").lower() != "postgres":
        settings.DATABASES["default"] = {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": os.path.join(settings.BASE_DIR, "db.sqlite3"),
        }

    # Speed up tests with faster password hashing
    settings.PASSWORD_HASHERS = [
        "django.contrib.auth.hashers.MD5PasswordHasher",
    ]


User = get_user_model()


@pytest.fixture
def api_client():
    """Return a DRF API client."""
    return APIClient()


@pytest.fixture
def admin_user(db):
    """Return a superuser."""
    user, _created = User.objects.get_or_create(
        username="admin",
        defaults={"email": "admin@example.com", "is_staff": True, "is_superuser": True},
    )
    user.email = "admin@example.com"
    user.is_staff = True
    user.is_superuser = True
    user.set_password("password")
    user.save(update_fields=["email", "is_staff", "is_superuser", "password"])
    return user


@pytest.fixture
def auth_client(api_client, admin_user):
    """Return an authenticated API client."""
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.fixture
def test_namespace(db, admin_user):
    """Return a test namespace."""
    tenant = Tenant.objects.create(name="Test Tenant", identifier="test-tenant", created_by=admin_user)
    tenant.members.add(admin_user)
    return Namespace.objects.create(
        name="Test Namespace",
        slug="test-namespace",
        is_active=True,
        created_by=admin_user,
        tenant=tenant,
    )
