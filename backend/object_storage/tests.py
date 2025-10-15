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
                "type": "object",
                "properties": {
                    "title": {"type": "string", "field_type": "text", "title": "Title"},
                    "content": {
                        "type": "string",
                        "field_type": "rich_text",
                        "title": "Content",
                    },
                    "publish_date": {
                        "type": "string",
                        "field_type": "datetime",
                        "title": "Publish Date",
                    },
                },
                "required": ["title", "content"],
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
            schema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "field_type": "text", "title": "Title"}
                },
            },
            slot_configuration={"slots": []},  # Provide valid empty slot configuration
            metadata={"version": "1.0"},  # Provide valid metadata
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
            created_by=self.user,
        )

    def test_create_object_instance(self):
        """Test creating an object instance"""
        instance = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Test News Article",
            status="draft",
            created_by=self.user,
        )

        # Create initial version with data
        instance.create_version(
            user=self.user,
            data={
                "title": "Test News Article",
                "content": "This is a test news article content.",
            },
            change_description="Initial version",
        )

        self.assertEqual(instance.title, "Test News Article")
        self.assertEqual(instance.status, "draft")
        self.assertEqual(instance.version, 1)
        self.assertFalse(instance.is_published())
        self.assertTrue(instance.slug)  # Slug should be auto-generated
        self.assertEqual(instance.data["title"], "Test News Article")

    def test_slug_generation(self):
        """Test automatic slug generation"""
        instance = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Test News Article with Spaces",
            created_by=self.user,
        )

        self.assertEqual(instance.slug, "test-news-article-with-spaces")

    def test_unique_slug_per_type(self):
        """Test that slugs are unique within object type"""
        # Create first instance
        instance1 = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Test Article",
            created_by=self.user,
        )

        # Create second instance with same title
        instance2 = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Test Article",
            created_by=self.user,
        )

        self.assertEqual(instance1.slug, "test-article")
        self.assertEqual(instance2.slug, "test-article-1")

    def test_mptt_hierarchy(self):
        """Test MPTT hierarchy functionality"""
        # Create parent instance
        parent = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Parent Article",
            created_by=self.user,
        )

        # Create child instance
        child = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Child Article",
            parent=parent,
            created_by=self.user,
        )

        # Test hierarchy
        self.assertEqual(child.parent, parent)
        self.assertEqual(child.level, 1)
        self.assertEqual(parent.level, 0)
        self.assertIn(child, parent.get_children())
        self.assertIn(parent, child.get_ancestors())

    def test_version_creation(self):
        """Test version creation"""
        instance = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Test Article",
            created_by=self.user,
        )

        # Create a version with data
        version = instance.create_version(
            user=self.user,
            data={"title": "Test", "content": "Content"},
            change_description="Initial version",
        )

        self.assertEqual(version.object_instance, instance)
        self.assertEqual(version.version_number, 1)
        self.assertEqual(version.data, {"title": "Test", "content": "Content"})
        self.assertEqual(instance.data, {"title": "Test", "content": "Content"})


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


class ObjectInstanceRelationshipTestCase(TestCase):
    """Test many-to-many relationship functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        # Create object types for testing
        self.column_type = ObjectTypeDefinition.objects.create(
            name="column", label="Column", plural_label="Columns", created_by=self.user
        )

        self.columnist_type = ObjectTypeDefinition.objects.create(
            name="columnist",
            label="Columnist",
            plural_label="Columnists",
            created_by=self.user,
        )

        # Create test instances
        self.column = ObjectInstance.objects.create(
            object_type=self.column_type, title="Test Column", created_by=self.user
        )

        self.columnist1 = ObjectInstance.objects.create(
            object_type=self.columnist_type, title="Columnist 1", created_by=self.user
        )

        self.columnist2 = ObjectInstance.objects.create(
            object_type=self.columnist_type, title="Columnist 2", created_by=self.user
        )

        self.columnist3 = ObjectInstance.objects.create(
            object_type=self.columnist_type, title="Columnist 3", created_by=self.user
        )

    def test_add_relationship(self):
        """Test adding a single relationship"""
        result = self.column.add_relationship("authors", self.columnist1.id)
        self.assertTrue(result)

        # Verify relationship exists
        self.assertTrue(self.column.has_relationship("authors", self.columnist1.id))
        self.assertEqual(self.column.count_relationships(), 1)

        # Verify reverse relationship
        self.assertTrue(
            any(
                r.get("object_id") == self.column.id
                for r in self.columnist1.related_from
            )
        )

    def test_add_duplicate_relationship(self):
        """Test that adding duplicate relationship returns False"""
        self.column.add_relationship("authors", self.columnist1.id)
        result = self.column.add_relationship("authors", self.columnist1.id)
        self.assertFalse(result)
        self.assertEqual(self.column.count_relationships(), 1)

    def test_add_multiple_relationships(self):
        """Test adding multiple relationships of same type"""
        self.column.add_relationship("authors", self.columnist1.id)
        self.column.add_relationship("authors", self.columnist2.id)
        self.column.add_relationship("authors", self.columnist3.id)

        self.assertEqual(self.column.count_relationships("authors"), 3)

        # Check all relationships exist
        self.assertTrue(self.column.has_relationship("authors", self.columnist1.id))
        self.assertTrue(self.column.has_relationship("authors", self.columnist2.id))
        self.assertTrue(self.column.has_relationship("authors", self.columnist3.id))

    def test_remove_relationship(self):
        """Test removing a relationship"""
        self.column.add_relationship("authors", self.columnist1.id)
        self.column.add_relationship("authors", self.columnist2.id)

        result = self.column.remove_relationship("authors", self.columnist1.id)
        self.assertTrue(result)

        # Verify relationship removed
        self.assertFalse(self.column.has_relationship("authors", self.columnist1.id))
        self.assertTrue(self.column.has_relationship("authors", self.columnist2.id))
        self.assertEqual(self.column.count_relationships("authors"), 1)

    def test_remove_nonexistent_relationship(self):
        """Test removing a relationship that doesn't exist"""
        result = self.column.remove_relationship("authors", self.columnist1.id)
        self.assertFalse(result)

    def test_clear_relationships_by_type(self):
        """Test clearing relationships of a specific type"""
        self.column.add_relationship("authors", self.columnist1.id)
        self.column.add_relationship("authors", self.columnist2.id)
        self.column.add_relationship("translators", self.columnist3.id)

        self.column.clear_relationships("authors")

        self.assertEqual(self.column.count_relationships("authors"), 0)
        self.assertEqual(self.column.count_relationships("translators"), 1)

    def test_clear_all_relationships(self):
        """Test clearing all relationships"""
        self.column.add_relationship("authors", self.columnist1.id)
        self.column.add_relationship("translators", self.columnist2.id)

        self.column.clear_relationships()

        self.assertEqual(self.column.count_relationships(), 0)

    def test_set_relationships(self):
        """Test replacing all relationships of a type"""
        # Start with some relationships
        self.column.add_relationship("authors", self.columnist1.id)
        self.column.add_relationship("authors", self.columnist2.id)

        # Replace with new set
        self.column.set_relationships(
            "authors", [self.columnist2.id, self.columnist3.id]
        )

        # Verify old relationship removed and new ones added
        self.assertFalse(self.column.has_relationship("authors", self.columnist1.id))
        self.assertTrue(self.column.has_relationship("authors", self.columnist2.id))
        self.assertTrue(self.column.has_relationship("authors", self.columnist3.id))
        self.assertEqual(self.column.count_relationships("authors"), 2)

    def test_reorder_relationships(self):
        """Test reordering relationships"""
        self.column.add_relationship("authors", self.columnist1.id)
        self.column.add_relationship("authors", self.columnist2.id)
        self.column.add_relationship("authors", self.columnist3.id)

        # Get original order
        original_order = [
            r["object_id"] for r in self.column.relationships if r["type"] == "authors"
        ]
        self.assertEqual(
            original_order, [self.columnist1.id, self.columnist2.id, self.columnist3.id]
        )

        # Reorder
        self.column.reorder_relationships(
            "authors", [self.columnist3.id, self.columnist1.id, self.columnist2.id]
        )

        # Verify new order
        new_order = [
            r["object_id"] for r in self.column.relationships if r["type"] == "authors"
        ]
        self.assertEqual(
            new_order, [self.columnist3.id, self.columnist1.id, self.columnist2.id]
        )

    def test_prevent_self_reference(self):
        """Test that self-references are prevented"""
        with self.assertRaises(ValueError):
            self.column.add_relationship("related", self.column.id)

    def test_nonexistent_object(self):
        """Test handling of nonexistent object references"""
        with self.assertRaises(ValueError):
            self.column.add_relationship("authors", 99999)

    def test_reverse_relationship_created(self):
        """Test that reverse relationships are automatically created"""
        self.column.add_relationship("authors", self.columnist1.id)

        # Refresh from DB
        self.columnist1.refresh_from_db()

        # Check reverse relationship
        self.assertIsNotNone(self.columnist1.related_from)
        self.assertTrue(
            any(
                r.get("type") == "authors" and r.get("object_id") == self.column.id
                for r in self.columnist1.related_from
            )
        )

    def test_reverse_relationship_removed(self):
        """Test that reverse relationships are cleaned up"""
        self.column.add_relationship("authors", self.columnist1.id)
        self.column.remove_relationship("authors", self.columnist1.id)

        # Refresh from DB
        self.columnist1.refresh_from_db()

        # Check reverse relationship removed
        self.assertFalse(
            any(
                r.get("type") == "authors" and r.get("object_id") == self.column.id
                for r in self.columnist1.related_from
            )
        )

    def test_cascade_delete(self):
        """Test that relationships are cleaned up on delete"""
        self.column.add_relationship("authors", self.columnist1.id)
        self.column.add_relationship("authors", self.columnist2.id)

        # Delete the column
        column_id = self.column.id
        self.column.delete()

        # Refresh columnists
        self.columnist1.refresh_from_db()
        self.columnist2.refresh_from_db()

        # Verify reverse relationships removed
        self.assertFalse(
            any(r.get("object_id") == column_id for r in self.columnist1.related_from)
        )
        self.assertFalse(
            any(r.get("object_id") == column_id for r in self.columnist2.related_from)
        )

    def test_get_related_objects(self):
        """Test getting related objects as queryset"""
        self.column.add_relationship("authors", self.columnist1.id)
        self.column.add_relationship("authors", self.columnist2.id)

        related = self.column.get_related_objects("authors")
        self.assertEqual(related.count(), 2)
        self.assertIn(self.columnist1, related)
        self.assertIn(self.columnist2, related)

    def test_get_related_objects_preserves_order(self):
        """Test that get_related_objects preserves order"""
        self.column.add_relationship("authors", self.columnist1.id)
        self.column.add_relationship("authors", self.columnist2.id)
        self.column.add_relationship("authors", self.columnist3.id)

        related = list(self.column.get_related_objects("authors"))
        self.assertEqual(related[0].id, self.columnist1.id)
        self.assertEqual(related[1].id, self.columnist2.id)
        self.assertEqual(related[2].id, self.columnist3.id)

    def test_get_related_from_objects(self):
        """Test getting reverse relationships"""
        self.column.add_relationship("authors", self.columnist1.id)

        # Get columns where columnist1 is an author
        related = self.columnist1.get_related_from_objects("authors")
        self.assertEqual(related.count(), 1)
        self.assertIn(self.column, related)

    def test_has_relationship(self):
        """Test checking if relationship exists"""
        self.column.add_relationship("authors", self.columnist1.id)

        self.assertTrue(self.column.has_relationship("authors", self.columnist1.id))
        self.assertFalse(self.column.has_relationship("authors", self.columnist2.id))
        self.assertFalse(
            self.column.has_relationship("translators", self.columnist1.id)
        )

    def test_get_relationship_types(self):
        """Test getting all relationship types"""
        self.column.add_relationship("authors", self.columnist1.id)
        self.column.add_relationship("translators", self.columnist2.id)
        self.column.add_relationship("editors", self.columnist3.id)

        types = self.column.get_relationship_types()
        self.assertEqual(types, {"authors", "translators", "editors"})

    def test_mixed_object_types(self):
        """Test that different ObjectTypes can be in same relationship array"""
        # Create another column
        column2 = ObjectInstance.objects.create(
            object_type=self.column_type, title="Column 2", created_by=self.user
        )

        # Add relationships to mixed types
        self.column.add_relationship("authors", self.columnist1.id)
        self.column.add_relationship("related_articles", column2.id)

        self.assertEqual(self.column.count_relationships(), 2)
        self.assertTrue(self.column.has_relationship("authors", self.columnist1.id))
        self.assertTrue(self.column.has_relationship("related_articles", column2.id))

    def test_rebuild_related_from(self):
        """Test rebuilding related_from for a single instance"""
        # Add relationships
        self.column.add_relationship("authors", self.columnist1.id)

        # Manually corrupt the related_from
        self.columnist1.related_from = []
        self.columnist1.save(update_fields=["related_from"])

        # Rebuild
        count = self.columnist1.rebuild_related_from()

        # Verify
        self.assertEqual(count, 1)
        self.assertTrue(
            any(
                r.get("type") == "authors" and r.get("object_id") == self.column.id
                for r in self.columnist1.related_from
            )
        )

    def test_rebuild_all_related_from(self):
        """Test rebuilding related_from for all instances"""
        # Add multiple relationships
        self.column.add_relationship("authors", self.columnist1.id)
        self.column.add_relationship("authors", self.columnist2.id)

        # Manually corrupt all related_from fields
        ObjectInstance.objects.update(related_from=[])

        # Rebuild all
        stats = ObjectInstance.rebuild_all_related_from()

        # Verify
        self.assertEqual(stats["total_relationships_restored"], 2)

        self.columnist1.refresh_from_db()
        self.columnist2.refresh_from_db()

        self.assertTrue(len(self.columnist1.related_from) > 0)
        self.assertTrue(len(self.columnist2.related_from) > 0)


class ObjectInstanceRelationshipAPITestCase(APITestCase):
    """Test relationship API endpoints"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client.force_authenticate(user=self.user)

        # Create object types
        self.column_type = ObjectTypeDefinition.objects.create(
            name="column", label="Column", plural_label="Columns", created_by=self.user
        )

        self.columnist_type = ObjectTypeDefinition.objects.create(
            name="columnist",
            label="Columnist",
            plural_label="Columnists",
            created_by=self.user,
        )

        # Create test instances
        self.column = ObjectInstance.objects.create(
            object_type=self.column_type, title="Test Column", created_by=self.user
        )

        self.columnist1 = ObjectInstance.objects.create(
            object_type=self.columnist_type, title="Columnist 1", created_by=self.user
        )

        self.columnist2 = ObjectInstance.objects.create(
            object_type=self.columnist_type, title="Columnist 2", created_by=self.user
        )

    def test_add_relationship_endpoint(self):
        """Test POST /api/objects/{id}/add_relationship/"""
        url = f"/api/objects/{self.column.id}/add_relationship/"
        data = {"relationship_type": "authors", "object_id": self.columnist1.id}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "Relationship added successfully")

        # Verify in database
        self.column.refresh_from_db()
        self.assertTrue(self.column.has_relationship("authors", self.columnist1.id))

    def test_remove_relationship_endpoint(self):
        """Test POST /api/objects/{id}/remove_relationship/"""
        self.column.add_relationship("authors", self.columnist1.id)

        url = f"/api/objects/{self.column.id}/remove_relationship/"
        data = {"relationship_type": "authors", "object_id": self.columnist1.id}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify in database
        self.column.refresh_from_db()
        self.assertFalse(self.column.has_relationship("authors", self.columnist1.id))

    def test_set_relationships_endpoint(self):
        """Test PUT /api/objects/{id}/set_relationships/"""
        url = f"/api/objects/{self.column.id}/set_relationships/"
        data = {
            "relationship_type": "authors",
            "object_ids": [self.columnist1.id, self.columnist2.id],
        }

        response = self.client.put(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify in database
        self.column.refresh_from_db()
        self.assertEqual(self.column.count_relationships("authors"), 2)

    def test_related_objects_endpoint(self):
        """Test GET /api/objects/{id}/related_objects/"""
        self.column.add_relationship("authors", self.columnist1.id)
        self.column.add_relationship("authors", self.columnist2.id)

        url = (
            f"/api/objects/{self.column.id}/related_objects/?relationship_type=authors"
        )

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)

    def test_related_from_objects_endpoint(self):
        """Test GET /api/objects/{id}/related_from_objects/"""
        self.column.add_relationship("authors", self.columnist1.id)

        url = f"/api/objects/{self.columnist1.id}/related_from_objects/?relationship_type=authors"

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_rebuild_related_from_endpoint(self):
        """Test POST /api/objects/{id}/rebuild_related_from/"""
        self.column.add_relationship("authors", self.columnist1.id)

        # Corrupt related_from
        self.columnist1.related_from = []
        self.columnist1.save(update_fields=["related_from"])

        url = f"/api/objects/{self.columnist1.id}/rebuild_related_from/"

        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_validation_self_reference(self):
        """Test that API validates self-references"""
        url = f"/api/objects/{self.column.id}/add_relationship/"
        data = {"relationship_type": "related", "object_id": self.column.id}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_validation_nonexistent_object(self):
        """Test that API validates object existence"""
        url = f"/api/objects/{self.column.id}/add_relationship/"
        data = {"relationship_type": "authors", "object_id": 99999}

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ObjectReferenceFieldTestCase(TestCase):
    """Test object_reference schema field type functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

        # Create object types with object_reference fields
        self.column_type = ObjectTypeDefinition.objects.create(
            name="column",
            label="Column",
            plural_label="Columns",
            schema={
                "type": "object",
                "properties": {
                    "authors": {
                        "name": "authors",
                        "type": "object_reference",
                        "title": "Authors",
                        "multiple": True,
                        "max_items": 5,
                        "allowed_object_types": ["columnist"],
                        "relationship_type": "authors",
                    },
                    "primary_author": {
                        "name": "primary_author",
                        "type": "object_reference",
                        "title": "Primary Author",
                        "multiple": False,
                        "allowed_object_types": ["columnist"],
                        "required": True,
                    },
                },
            },
            created_by=self.user,
        )

        self.columnist_type = ObjectTypeDefinition.objects.create(
            name="columnist",
            label="Columnist",
            plural_label="Columnists",
            schema={
                "type": "object",
                "properties": {
                    "first_name": {
                        "name": "first_name",
                        "type": "text",
                        "title": "First Name",
                    },
                    "columns_authored": {
                        "name": "columns_authored",
                        "type": "reverse_object_reference",
                        "title": "Columns Authored",
                        "reverse_relationship_type": "authors",
                        "reverse_object_types": ["column"],
                    },
                },
            },
            created_by=self.user,
        )

        # Create test instances
        self.column = ObjectInstance.objects.create(
            object_type=self.column_type, title="Test Column", created_by=self.user
        )

        self.columnist1 = ObjectInstance.objects.create(
            object_type=self.columnist_type, title="Columnist 1", created_by=self.user
        )

        self.columnist2 = ObjectInstance.objects.create(
            object_type=self.columnist_type, title="Columnist 2", created_by=self.user
        )

        self.columnist3 = ObjectInstance.objects.create(
            object_type=self.columnist_type, title="Columnist 3", created_by=self.user
        )

    def test_single_reference_validation(self):
        """Test validation of single object_reference field"""
        from utils.schema_system import validate_object_reference

        field_config = {"multiple": False, "allowed_object_types": ["columnist"]}

        # Valid single reference
        validate_object_reference(self.columnist1.id, field_config)

        # Invalid: array when expecting single
        with self.assertRaises(Exception):
            validate_object_reference([self.columnist1.id], field_config)

    def test_multiple_references_validation(self):
        """Test validation of multiple object_reference field"""
        from utils.schema_system import validate_object_reference

        field_config = {
            "multiple": True,
            "max_items": 3,
            "allowed_object_types": ["columnist"],
        }

        # Valid multiple references
        validate_object_reference(
            [self.columnist1.id, self.columnist2.id], field_config
        )

        # Empty is valid if not required
        validate_object_reference([], field_config)

    def test_max_items_enforcement(self):
        """Test that max_items is enforced"""
        from utils.schema_system import validate_object_reference
        from django.core.exceptions import ValidationError

        field_config = {"multiple": True, "max_items": 2}

        # Valid: within limit
        validate_object_reference(
            [self.columnist1.id, self.columnist2.id], field_config
        )

        # Invalid: exceeds limit
        with self.assertRaises(ValidationError) as cm:
            validate_object_reference(
                [self.columnist1.id, self.columnist2.id, self.columnist3.id],
                field_config,
            )
        self.assertIn("Cannot have more than 2", str(cm.exception))

    def test_allowed_types_validation(self):
        """Test that allowed_object_types is enforced"""
        from utils.schema_system import validate_object_reference
        from django.core.exceptions import ValidationError

        # Create object of different type
        news_type = ObjectTypeDefinition.objects.create(
            name="news", label="News", plural_label="News", created_by=self.user
        )
        news = ObjectInstance.objects.create(
            object_type=news_type, title="Test News", created_by=self.user
        )

        field_config = {"multiple": True, "allowed_object_types": ["columnist"]}

        # Valid: correct type
        validate_object_reference([self.columnist1.id], field_config)

        # Invalid: wrong type
        with self.assertRaises(ValidationError) as cm:
            validate_object_reference([news.id], field_config)
        self.assertIn("is not allowed", str(cm.exception))

    def test_nonexistent_object_validation(self):
        """Test that nonexistent objects are caught"""
        from utils.schema_system import validate_object_reference
        from django.core.exceptions import ValidationError

        field_config = {"multiple": True}

        with self.assertRaises(ValidationError) as cm:
            validate_object_reference([99999], field_config)
        self.assertIn("does not exist", str(cm.exception))

    def test_sync_to_relationships(self):
        """Test that object_reference fields sync to relationships"""
        # Create version with object_reference field
        version = ObjectVersion.objects.create(
            object_instance=self.column,
            version_number=1,
            created_by=self.user,
            data={
                "authors": [self.columnist1.id, self.columnist2.id],
                "primary_author": self.columnist1.id,
            },
            widgets={},
        )

        # Refresh to ensure sync happened
        self.column.refresh_from_db()

        # Verify synced to relationships
        self.assertTrue(self.column.has_relationship("authors", self.columnist1.id))
        self.assertTrue(self.column.has_relationship("authors", self.columnist2.id))
        self.assertTrue(
            self.column.has_relationship("primary_author", self.columnist1.id)
        )

    def test_reverse_reference_computation(self):
        """Test that reverse_object_reference fields are computed correctly"""
        # Create version with authors
        version = ObjectVersion.objects.create(
            object_instance=self.column,
            version_number=1,
            created_by=self.user,
            data={"authors": [self.columnist1.id, self.columnist2.id]},
            widgets={},
        )

        # Create columnist version
        columnist_version = ObjectVersion.objects.create(
            object_instance=self.columnist1,
            version_number=1,
            created_by=self.user,
            data={"first_name": "John"},
            widgets={},
        )

        # Populate reverse references
        columnist_version.populate_reverse_references()

        # Verify computed field
        self.assertIn("columns_authored", columnist_version.data)
        self.assertIn(self.column.id, columnist_version.data["columns_authored"])

    def test_reverse_reference_read_only(self):
        """Test that reverse_object_reference cannot be set"""
        from utils.schema_system import validate_reverse_object_reference
        from django.core.exceptions import ValidationError

        field_config = {"reverse_relationship_type": "authors"}

        # Attempting to set value should fail
        with self.assertRaises(ValidationError) as cm:
            validate_reverse_object_reference([123], field_config)
        self.assertIn("read-only", str(cm.exception))

        # Empty value is OK
        validate_reverse_object_reference(None, field_config)
        validate_reverse_object_reference([], field_config)

    def test_direct_pk_entry(self):
        """Test that direct PK entry works"""
        # Create version with direct PKs
        version = ObjectVersion.objects.create(
            object_instance=self.column,
            version_number=1,
            created_by=self.user,
            data={"authors": [self.columnist1.id, self.columnist2.id]},  # Direct PKs
            widgets={},
        )

        # Verify synced
        self.column.refresh_from_db()
        self.assertEqual(self.column.count_relationships("authors"), 2)

    def test_relationship_type_override(self):
        """Test that relationship_type can be overridden"""
        # Create custom field with relationship_type override
        custom_type = ObjectTypeDefinition.objects.create(
            name="article",
            label="Article",
            plural_label="Articles",
            schema={
                "type": "object",
                "properties": {
                    "contributors": {
                        "name": "contributors",
                        "type": "object_reference",
                        "multiple": True,
                        "relationship_type": "authors",  # Override to use 'authors' type
                    }
                },
            },
            created_by=self.user,
        )

        article = ObjectInstance.objects.create(
            object_type=custom_type, title="Test Article", created_by=self.user
        )

        version = ObjectVersion.objects.create(
            object_instance=article,
            version_number=1,
            created_by=self.user,
            data={"contributors": [self.columnist1.id]},
            widgets={},
        )

        # Should use 'authors' as relationship type, not 'contributors'
        article.refresh_from_db()
        self.assertTrue(article.has_relationship("authors", self.columnist1.id))
        self.assertFalse(article.has_relationship("contributors", self.columnist1.id))

    def test_sync_updates_on_version_update(self):
        """Test that updating version data updates relationships"""
        # Create initial version
        version = ObjectVersion.objects.create(
            object_instance=self.column,
            version_number=1,
            created_by=self.user,
            data={"authors": [self.columnist1.id]},
            widgets={},
        )

        # Update version data
        version.data = {"authors": [self.columnist2.id, self.columnist3.id]}
        version.save()

        # Verify relationships updated
        self.column.refresh_from_db()
        self.assertFalse(self.column.has_relationship("authors", self.columnist1.id))
        self.assertTrue(self.column.has_relationship("authors", self.columnist2.id))
        self.assertTrue(self.column.has_relationship("authors", self.columnist3.id))

    def test_mixed_reference_types(self):
        """Test multiple object_reference fields in same schema"""
        # Create type with multiple reference fields
        multi_type = ObjectTypeDefinition.objects.create(
            name="article",
            label="Article",
            plural_label="Articles",
            schema={
                "type": "object",
                "properties": {
                    "authors": {
                        "name": "authors",
                        "type": "object_reference",
                        "multiple": True,
                    },
                    "translator": {
                        "name": "translator",
                        "type": "object_reference",
                        "multiple": False,
                    },
                },
            },
            created_by=self.user,
        )

        article = ObjectInstance.objects.create(
            object_type=multi_type, title="Test Article", created_by=self.user
        )

        version = ObjectVersion.objects.create(
            object_instance=article,
            version_number=1,
            created_by=self.user,
            data={
                "authors": [self.columnist1.id, self.columnist2.id],
                "translator": self.columnist3.id,
            },
            widgets={},
        )

        # Verify both fields synced
        article.refresh_from_db()
        self.assertEqual(article.count_relationships("authors"), 2)
        self.assertEqual(article.count_relationships("translator"), 1)


class ObjectReferenceFieldAPITestCase(APITestCase):
    """Test object_reference field API functionality"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        self.client.force_authenticate(user=self.user)

        # Create object types
        self.column_type = ObjectTypeDefinition.objects.create(
            name="column",
            label="Column",
            plural_label="Columns",
            schema={
                "type": "object",
                "properties": {
                    "authors": {
                        "name": "authors",
                        "type": "object_reference",
                        "multiple": True,
                        "max_items": 3,
                        "allowed_object_types": ["columnist"],
                    }
                },
            },
            created_by=self.user,
        )

        self.columnist_type = ObjectTypeDefinition.objects.create(
            name="columnist",
            label="Columnist",
            plural_label="Columnists",
            schema={
                "type": "object",
                "properties": {
                    "first_name": {"name": "first_name", "type": "text"},
                    "columns_authored": {
                        "name": "columns_authored",
                        "type": "reverse_object_reference",
                        "reverse_relationship_type": "authors",
                        "reverse_object_types": ["column"],
                    },
                },
            },
            created_by=self.user,
        )

        # Create instances
        self.columnist1 = ObjectInstance.objects.create(
            object_type=self.columnist_type, title="Columnist 1", created_by=self.user
        )

        self.columnist2 = ObjectInstance.objects.create(
            object_type=self.columnist_type, title="Columnist 2", created_by=self.user
        )

    def test_search_for_references_endpoint(self):
        """Test GET /api/objects/search_for_references/"""
        url = "/api/objects/search_for_references/?q=Columnist&object_types=columnist"

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertIn("count", response.data)
        self.assertEqual(response.data["count"], 2)

    def test_search_pagination(self):
        """Test search endpoint pagination"""
        url = "/api/objects/search_for_references/?page=1&page_size=1"

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["page_size"], 1)
        self.assertLessEqual(len(response.data["results"]), 1)

    def test_create_object_with_references(self):
        """Test creating object with object_reference field"""
        url = "/api/objects/"
        data = {
            "object_type_id": self.column_type.id,
            "title": "New Column",
            "data": {"authors": [self.columnist1.id, self.columnist2.id]},
        }

        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify relationships synced
        column = ObjectInstance.objects.get(id=response.data["id"])
        self.assertEqual(column.count_relationships("authors"), 2)

    def test_validation_max_items(self):
        """Test that max_items validation works via API"""
        url = "/api/objects/"

        # Create more columnists
        columnist3 = ObjectInstance.objects.create(
            object_type=self.columnist_type, title="Columnist 3", created_by=self.user
        )
        columnist4 = ObjectInstance.objects.create(
            object_type=self.columnist_type, title="Columnist 4", created_by=self.user
        )

        data = {
            "object_type_id": self.column_type.id,
            "title": "New Column",
            "data": {
                "authors": [
                    self.columnist1.id,
                    self.columnist2.id,
                    columnist3.id,
                    columnist4.id,
                ]  # 4 items, max is 3
            },
        }

        response = self.client.post(url, data, format="json")

        # Should fail validation
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_validation_allowed_types(self):
        """Test that allowed_object_types validation works via API"""
        # Create object of wrong type
        news_type = ObjectTypeDefinition.objects.create(
            name="news", label="News", plural_label="News", created_by=self.user
        )
        news = ObjectInstance.objects.create(
            object_type=news_type, title="Test News", created_by=self.user
        )

        url = "/api/objects/"
        data = {
            "object_type_id": self.column_type.id,
            "title": "New Column",
            "data": {"authors": [news.id]},  # Wrong type
        }

        response = self.client.post(url, data, format="json")

        # Should fail validation
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reverse_reference_populated_in_response(self):
        """Test that reverse references are populated in API responses"""
        # Create column with authors
        column = ObjectInstance.objects.create(
            object_type=self.column_type, title="Test Column", created_by=self.user
        )

        ObjectVersion.objects.create(
            object_instance=column,
            version_number=1,
            created_by=self.user,
            data={"authors": [self.columnist1.id]},
            widgets={},
        )

        # Get columnist via API
        url = f"/api/objects/{self.columnist1.id}/"
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_reverse_reference_read_only(self):
        """Test that reverse_object_reference cannot be set via API"""
        url = "/api/objects/"
        data = {
            "object_type_id": self.columnist_type.id,
            "title": "New Columnist",
            "data": {
                "first_name": "John",
                "columns_authored": [999],  # Trying to set read-only field
            },
        }

        response = self.client.post(url, data, format="json")

        # Should fail validation
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
