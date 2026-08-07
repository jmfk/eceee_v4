"""
Tests for Object Storage System
"""

from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from .models import ObjectTypeDefinition, ObjectInstance, ObjectVersion
from core.models import Tenant


class ObjectStorageModelTestBase(TestCase):
    """Base class for Object Storage model tests with tenant setup"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser_obj", email="test@example.com", password="testpass123"
        )
        self.tenant = Tenant.objects.create(
            name="Test Tenant",
            identifier="test-tenant",
            created_by=self.user
        )


class ObjectTypeDefinitionModelTest(ObjectStorageModelTestBase):
    """Test ObjectTypeDefinition model"""

    def test_create_object_type(self):
        """Test creating an object type definition"""
        obj_type = ObjectTypeDefinition.objects.create(
            name="news",
            label="News Article",
            plural_label="News Articles",
            description="News articles and announcements",
            schema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "field_type": "text", "title": "Title"},
                    "content": {
                        "type": "string",
                        "field_type": "rich_text",
                        "title": "Content",
                    },
                },
                "required": ["title", "content"],
            },
            slot_configuration={"slots": []},
            created_by=self.user,
        )

        self.assertEqual(obj_type.name, "news")
        self.assertEqual(obj_type.label, "News Article")


class ObjectInstanceModelTest(ObjectStorageModelTestBase):
    """Test ObjectInstance model"""

    def setUp(self):
        super().setUp()
        self.obj_type = ObjectTypeDefinition.objects.create(
            name="news",
            label="News Article",
            plural_label="News Articles",
            schema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "field_type": "text", "title": "Title"},
                },
            },
            slot_configuration={"slots": []},
            created_by=self.user,
        )

    def test_create_object_instance(self):
        """Test creating an object instance"""
        instance = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Test News Article",
            status="draft",
            created_by=self.user,
            tenant=self.tenant
        )

        self.assertEqual(instance.title, "Test News Article")
        self.assertEqual(instance.tenant, self.tenant)


@override_settings(
    SKIP_HOST_VALIDATION_IN_DEBUG=True,
    ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1"],
)
class ObjectStorageAPITest(APITestCase):
    """Test Object Storage API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser_obj_api", email="test@example.com", password="testpass123"
        )
        self.tenant = Tenant.objects.create(
            name="Test Tenant API",
            identifier="test-tenant-api",
            created_by=self.user
        )
        self.client.force_authenticate(user=self.user)

    def test_list_object_types(self):
        """Test listing object types via API"""
        ObjectTypeDefinition.objects.create(
            name="news", label="News", plural_label="News", created_by=self.user
        )

        url = reverse("api:object_storage:objecttypedefinition-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Might be empty if tenant filtering is active
