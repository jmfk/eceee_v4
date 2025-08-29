"""
Tests for Object Storage System
"""

from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from .models import ObjectTypeDefinition, ObjectInstance, ObjectVersion


class ObjectTypeDefinitionModelTest(TestCase):
    """Test ObjectTypeDefinition model"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_create_object_type(self):
        """Test creating an object type definition"""
        obj_type = ObjectTypeDefinition.objects.create(
            name="news",
            label="News Article",
            plural_label="News Articles",
            description="News articles and announcements",
            schema={
                "fields": [
                    {"name": "title", "type": "text", "required": True},
                    {"name": "content", "type": "rich_text", "required": True},
                    {"name": "publish_date", "type": "datetime", "required": False},
                ]
            },
            slot_configuration={
                "slots": [
                    {"name": "main_content", "label": "Main Content", "required": True},
                    {"name": "sidebar", "label": "Sidebar", "required": False},
                ]
            },
            created_by=self.user,
        )

        self.assertEqual(obj_type.name, "news")
        self.assertEqual(obj_type.label, "News Article")
        self.assertTrue(obj_type.is_active)
        self.assertEqual(len(obj_type.get_schema_fields()), 3)
        self.assertEqual(len(obj_type.get_slots()), 2)

    def test_schema_validation(self):
        """Test schema validation"""
        # Valid schema should work
        obj_type = ObjectTypeDefinition(
            name="test",
            label="Test",
            plural_label="Tests",
            schema={"fields": [{"name": "title", "type": "text", "required": True}]},
            slot_configuration={},  # Provide empty dict to satisfy field requirement
            metadata={},  # Provide empty dict to satisfy field requirement
            created_by=self.user,
        )
        obj_type.full_clean()  # Should not raise ValidationError

        # Invalid schema should raise ValidationError
        obj_type.schema = {"invalid": "schema"}
        with self.assertRaises(Exception):
            obj_type.full_clean()


class ObjectInstanceModelTest(TestCase):
    """Test ObjectInstance model"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        self.obj_type = ObjectTypeDefinition.objects.create(
            name="news",
            label="News Article",
            plural_label="News Articles",
            schema={
                "fields": [
                    {"name": "title", "type": "text", "required": True},
                    {"name": "content", "type": "rich_text", "required": True},
                ]
            },
            created_by=self.user,
        )

    def test_create_object_instance(self):
        """Test creating an object instance"""
        instance = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Test News Article",
            data={
                "title": "Test News Article",
                "content": "This is a test news article content.",
            },
            status="draft",
            created_by=self.user,
        )

        self.assertEqual(instance.title, "Test News Article")
        self.assertEqual(instance.status, "draft")
        self.assertEqual(instance.version, 1)
        self.assertFalse(instance.is_published())
        self.assertTrue(instance.slug)  # Slug should be auto-generated

    def test_slug_generation(self):
        """Test automatic slug generation"""
        instance = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Test News Article with Spaces",
            data={"title": "Test", "content": "Content"},
            created_by=self.user,
        )

        self.assertEqual(instance.slug, "test-news-article-with-spaces")

    def test_unique_slug_per_type(self):
        """Test that slugs are unique within object type"""
        # Create first instance
        instance1 = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Test Article",
            data={"title": "Test", "content": "Content"},
            created_by=self.user,
        )

        # Create second instance with same title
        instance2 = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Test Article",
            data={"title": "Test 2", "content": "Content 2"},
            created_by=self.user,
        )

        self.assertEqual(instance1.slug, "test-article")
        self.assertEqual(instance2.slug, "test-article-1")

    def test_version_creation(self):
        """Test version creation"""
        instance = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Test Article",
            data={"title": "Test", "content": "Content"},
            created_by=self.user,
        )

        # Create a version
        version = instance.create_version(self.user, "Initial version")

        self.assertEqual(version.object, instance)
        self.assertEqual(version.version_number, 1)
        self.assertEqual(version.data, instance.data)


@override_settings(
    SKIP_HOST_VALIDATION_IN_DEBUG=True,
    ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1"],
)
class ObjectStorageAPITest(APITestCase):
    """Test Object Storage API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client.force_authenticate(user=self.user)

    def test_create_object_type(self):
        """Test creating object type via API"""
        url = "/api/objects/api/object-types/"
        data = {
            "name": "blog",
            "label": "Blog Post",
            "plural_label": "Blog Posts",
            "description": "Blog posts and articles",
            "schema": {
                "fields": [
                    {"name": "title", "type": "text", "required": True},
                    {"name": "content", "type": "rich_text", "required": True},
                ]
            },
            "slot_configuration": {
                "slots": [{"name": "main", "label": "Main Content", "required": True}]
            },
        }

        response = self.client.post(url, data, format="json")
        if response.status_code != status.HTTP_201_CREATED:
            print(f"Error response: {response.content}")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "blog")
        self.assertEqual(response.data["label"], "Blog Post")

    def test_list_object_types(self):
        """Test listing object types via API"""
        # Create test object type
        ObjectTypeDefinition.objects.create(
            name="news", label="News", plural_label="News", created_by=self.user
        )

        url = "/api/objects/api/object-types/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["name"], "news")

    def test_create_object_instance(self):
        """Test creating object instance via API"""
        # Create object type first
        obj_type = ObjectTypeDefinition.objects.create(
            name="news",
            label="News",
            plural_label="News",
            schema={"fields": [{"name": "title", "type": "text", "required": True}]},
            created_by=self.user,
        )

        url = "/api/objects/api/objects/"
        data = {
            "object_type_id": obj_type.id,
            "title": "Test News",
            "data": {"title": "Test News Article"},
            "status": "draft",
        }

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Test News")
        self.assertEqual(response.data["status"], "draft")

    def test_publish_object_instance(self):
        """Test publishing object instance via API"""
        # Create object type and instance
        obj_type = ObjectTypeDefinition.objects.create(
            name="news", label="News", plural_label="News", created_by=self.user
        )

        instance = ObjectInstance.objects.create(
            object_type=obj_type,
            title="Test News",
            data={"title": "Test"},
            status="draft",
            created_by=self.user,
        )

        url = f"/api/objects/api/objects/{instance.id}/publish/"
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "published")

        # Verify instance was updated
        instance.refresh_from_db()
        self.assertEqual(instance.status, "published")
