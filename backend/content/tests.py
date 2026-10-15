"""
Tests for the Content app
"""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient, APITestCase

from content.models import Category, Namespace, Tag
from core.models import Tenant


class ContentModelsTest(TestCase):
    """Test content models functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser_content", email="test@example.com", password="testpass123"
        )
        self.tenant = Tenant.objects.create(name="Test Tenant", identifier="test-tenant", created_by=self.user)

    def test_category_model(self):
        """Test Category model functionality"""
        category = Category.objects.create(name="Test Category", slug="test-category", tenant=self.tenant)

        self.assertEqual(category.name, "Test Category")
        self.assertEqual(category.slug, "test-category")
        self.assertEqual(str(category), "Test Category")

    def test_tag_model(self):
        """Test Tag model functionality"""
        tag = Tag.objects.create(name="Test Tag", slug="test-tag", tenant=self.tenant)

        self.assertEqual(tag.name, "Test Tag")
        self.assertEqual(tag.slug, "test-tag")
        self.assertEqual(str(tag), "Test Tag")

    def test_tenant_default_does_not_fall_back_to_an_import_namespace(self):
        imported = Namespace.objects.create(
            name="ECEEE Production Copy",
            slug="eceee-production-copy",
            tenant=self.tenant,
            created_by=self.user,
        )

        default = Namespace.get_default(tenant=self.tenant)

        self.assertEqual(default.name, "Default")
        self.assertEqual(default.slug, "default")
        self.assertTrue(default.is_default)
        imported.refresh_from_db()
        self.assertFalse(imported.is_default)


class ContentAPITest(APITestCase):
    """Test Content API endpoints"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser_content_api", email="test@example.com", password="testpass123"
        )
        self.tenant = Tenant.objects.create(name="Test Tenant API", identifier="test-tenant-api", created_by=self.user)
        self.client.force_authenticate(user=self.user)

    def test_category_api_list(self):
        """Test Category API list endpoint"""
        Category.objects.create(name="Test Category", slug="test-category", tenant=self.tenant)

        response = self.client.get("/api/v1/content/categories/")
        self.assertEqual(response.status_code, 200)
        # Results might be empty if tenant context is not set correctly in middleware for tests
        # but the endpoint should at least exist


class NamespaceAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(
            username="namespace_admin",
            email="namespace@example.com",
            password="testpass123",
        )
        self.tenant = Tenant.objects.create(
            name="Namespace Tenant",
            identifier="namespace-tenant",
            created_by=self.user,
        )
        self.other_tenant = Tenant.objects.create(
            name="Other Namespace Tenant",
            identifier="other-namespace-tenant",
            created_by=self.user,
        )
        self.client.force_authenticate(user=self.user)
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)

    def test_settings_can_create_a_non_default_namespace(self):
        response = self.client.post(
            "/api/v1/namespaces/",
            {
                "name": "Imported media",
                "slug": "imported-media",
                "description": "Media kept separate for this import",
                "isActive": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        namespace = Namespace.objects.get(slug="imported-media")
        self.assertEqual(namespace.tenant, self.tenant)
        self.assertTrue(namespace.is_active)
        self.assertFalse(namespace.is_default)

    def test_setting_a_default_does_not_replace_another_tenants_default(self):
        current_default = Namespace.objects.create(
            name="Current Default",
            slug="current-default",
            tenant=self.tenant,
            is_default=True,
            created_by=self.user,
        )
        replacement = Namespace.objects.create(
            name="Replacement",
            slug="replacement",
            tenant=self.tenant,
            created_by=self.user,
        )
        other_default = Namespace.objects.create(
            name="Other Default",
            slug="other-default",
            tenant=self.other_tenant,
            is_default=True,
            created_by=self.user,
        )

        response = self.client.post(f"/api/v1/namespaces/{replacement.id}/set_as_default/")

        self.assertEqual(response.status_code, 200)
        current_default.refresh_from_db()
        replacement.refresh_from_db()
        other_default.refresh_from_db()
        self.assertFalse(current_default.is_default)
        self.assertTrue(replacement.is_default)
        self.assertTrue(other_default.is_default)

    def test_tag_actions_use_the_request_tenants_default_namespace(self):
        current_default = Namespace.objects.create(
            name="Tag Default",
            slug="tag-default",
            tenant=self.tenant,
            is_default=True,
            created_by=self.user,
        )
        other_default = Namespace.objects.create(
            name="Other Tag Default",
            slug="other-tag-default",
            tenant=self.other_tenant,
            is_default=True,
            created_by=self.user,
        )
        Tag.objects.create(
            name="Current Shared",
            slug="current-shared",
            namespace=current_default,
            tenant=self.tenant,
            usage_count=3,
        )
        Tag.objects.create(
            name="Other Shared",
            slug="other-shared",
            namespace=other_default,
            tenant=self.other_tenant,
            usage_count=5,
        )

        popular = self.client.get("/api/v1/content/tags/popular/")
        search = self.client.get("/api/v1/content/tags/search_tags/?q=Shared")

        self.assertEqual(popular.status_code, 200)
        self.assertEqual([tag["name"] for tag in popular.data], ["Current Shared"])
        self.assertEqual(search.status_code, 200)
        self.assertEqual([tag["name"] for tag in search.data], ["Current Shared"])
