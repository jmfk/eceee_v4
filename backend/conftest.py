import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from content.models import Namespace

User = get_user_model()

@pytest.fixture
def api_client():
    """Return a DRF API client."""
    return APIClient()

@pytest.fixture
def admin_user(db):
    """Return a superuser."""
    return User.objects.create_superuser(
        username="admin",
        email="admin@example.com",
        password="password"
    )

@pytest.fixture
def auth_client(api_client, admin_user):
    """Return an authenticated API client."""
    api_client.force_authenticate(user=admin_user)
    return api_client

@pytest.fixture
def test_namespace(db):
    """Return a test namespace."""
    return Namespace.objects.create(
        name="Test Namespace",
        slug="test-namespace",
        is_active=True
    )
