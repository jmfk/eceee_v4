"""
Tests for the NamespaceAccessService class.
"""

import pytest
from unittest.mock import patch
from django.contrib.auth import get_user_model
from rest_framework.response import Response

from ...services import NamespaceAccessService
from content.models import Namespace

User = get_user_model()


@pytest.fixture
def user():
    return User.objects.create_user(username="testuser", password="testpass")


@pytest.fixture
def staff_user():
    return User.objects.create_user(
        username="staffuser",
        password="staffpass",
        is_staff=True
    )


@pytest.fixture
def active_namespace():
    return Namespace.objects.create(
        name="Active Namespace",
        slug="active-namespace",
        is_active=True
    )


@pytest.fixture
def inactive_namespace():
    return Namespace.objects.create(
        name="Inactive Namespace",
        slug="inactive-namespace",
        is_active=False
    )


@pytest.mark.django_db
class TestNamespaceAccessService:
    """Test cases for NamespaceAccessService."""

    def test_resolve_default_namespace(self, user):
        """Test resolving the default namespace."""
        service = NamespaceAccessService()
        namespace = service._resolve_namespace("default")

        assert namespace is not None
        assert namespace == Namespace.get_default()

    def test_resolve_existing_namespace(self, active_namespace):
        """Test resolving an existing namespace."""
        service = NamespaceAccessService()
        namespace = service._resolve_namespace(active_namespace.slug)

        assert namespace is not None
        assert namespace == active_namespace

    def test_resolve_nonexistent_namespace(self):
        """Test resolving a nonexistent namespace."""
        service = NamespaceAccessService()
        namespace = service._resolve_namespace("nonexistent")

        assert namespace is None

    def test_staff_access(self, staff_user, active_namespace, inactive_namespace):
        """Test staff access to namespaces."""
        service = NamespaceAccessService()

        # Staff should have access to all namespaces
        assert service._has_namespace_access(staff_user, active_namespace)
        assert service._has_namespace_access(staff_user, inactive_namespace)

    def test_creator_access(self, user, active_namespace):
        """Test namespace creator access."""
        active_namespace.created_by = user
        active_namespace.save()

        service = NamespaceAccessService()
        assert service._has_namespace_access(user, active_namespace)

    def test_active_namespace_access(self, user, active_namespace):
        """Test access to active namespaces."""
        service = NamespaceAccessService()
        assert service._has_namespace_access(user, active_namespace)

    def test_inactive_namespace_access(self, user, inactive_namespace):
        """Test access to inactive namespaces."""
        service = NamespaceAccessService()
        assert not service._has_namespace_access(user, inactive_namespace)

    def test_get_and_validate_namespace_success(self, user, active_namespace):
        """Test successful namespace validation."""
        service = NamespaceAccessService()
        result = service.get_and_validate_namespace(user, active_namespace.slug)

        assert isinstance(result, Namespace)
        assert result == active_namespace

    def test_get_and_validate_namespace_not_found(self, user):
        """Test namespace not found case."""
        service = NamespaceAccessService()
        result = service.get_and_validate_namespace(user, "nonexistent")

        assert isinstance(result, Response)
        assert result.status_code == 404
        assert "not found" in result.data["error"]

    def test_get_and_validate_namespace_access_denied(self, user, inactive_namespace):
        """Test namespace access denied case."""
        service = NamespaceAccessService()
        result = service.get_and_validate_namespace(user, inactive_namespace.slug)

        assert isinstance(result, Response)
        assert result.status_code == 403
        assert "Access denied" in result.data["error"]

    def test_validate_namespace_access_success(self, user, active_namespace):
        """Test successful namespace access validation."""
        service = NamespaceAccessService()
        result = service.validate_namespace_access(user, active_namespace)

        assert result.namespace == active_namespace
        assert result.error_response is None
        assert result.has_access is True

    def test_validate_namespace_access_denied(self, user, inactive_namespace):
        """Test namespace access validation failure."""
        service = NamespaceAccessService()
        result = service.validate_namespace_access(user, inactive_namespace)

        assert result.namespace is None
        assert isinstance(result.error_response, Response)
        assert result.error_response.status_code == 403
        assert result.has_access is False

    def test_error_handling(self, user):
        """Test error handling during namespace operations."""
        with patch("content.models.Namespace.objects.get") as mock_get:
            mock_get.side_effect = Exception("Database error")
            
            service = NamespaceAccessService()
            result = service.get_and_validate_namespace(user, "test")

            assert isinstance(result, Response)
            assert result.status_code == 500
            assert "Error validating namespace access" in result.data["error"]
