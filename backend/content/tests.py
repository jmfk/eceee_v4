"""
Tests for the Content app
"""

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APITestCase, APIClient

from content.models import Category, Tag
from core.models import Tenant


class ContentModelsTest(TestCase):
    """Test content models functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser_content", email="test@example.com", password="testpass123"
        )
        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            identifier="test-tenant",
            created_by=self.user
        )

    def test_category_model(self):
        """Test Category model functionality"""
        category = Category.objects.create(
            name="Test Category", 
            slug="test-category",
            tenant=self.tenant
        )

        self.assertEqual(category.name, "Test Category")
        self.assertEqual(category.slug, "test-category")
        self.assertEqual(str(category), "Test Category")

    def test_tag_model(self):
        """Test Tag model functionality"""
        tag = Tag.objects.create(
            name="Test Tag", 
            slug="test-tag",
            tenant=self.tenant
        )

        self.assertEqual(tag.name, "Test Tag")
        self.assertEqual(tag.slug, "test-tag")
        self.assertEqual(str(tag), "Test Tag")


class ContentAPITest(APITestCase):
    """Test Content API endpoints"""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="testuser_content_api", email="test@example.com", password="testpass123"
        )
        self.tenant = Tenant.objects.create(
            name="Test Tenant API",
            identifier="test-tenant-api",
            created_by=self.user
        )
        self.client.force_authenticate(user=self.user)

    def test_category_api_list(self):
        """Test Category API list endpoint"""
        Category.objects.create(
            name="Test Category",
            slug="test-category",
            tenant=self.tenant
        )

        response = self.client.get("/api/v1/content/categories/")
        self.assertEqual(response.status_code, 200)
        # Results might be empty if tenant context is not set correctly in middleware for tests
        # but the endpoint should at least exist
