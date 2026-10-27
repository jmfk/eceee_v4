"""
Tests for Object Storage System
"""

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from core.models import Tenant
from utils.schema_system import validate_schema

from .models import ObjectInstance, ObjectTypeDefinition


class ObjectSchemaValidationTest(SimpleTestCase):
    def test_object_schema_rejects_legacy_fields_format(self):
        schema = {
            "type": "object",
            "fields": [{"name": "title", "type": "string", "field_type": "text"}],
        }

        with self.assertRaisesMessage(ValidationError, "Schema must contain a 'properties' object"):
            validate_schema(schema, "object_type")

    def test_object_schema_rejects_reserved_system_field_names(self):
        schema = {
            "type": "object",
            "properties": {
                "publishDate": {"type": "string", "field_type": "text"},
            },
        }

        with self.assertRaisesMessage(ValidationError, "Property name 'publishDate' is reserved for system data"):
            validate_schema(schema, "object_type")

    def test_object_schema_allows_similar_content_field_names(self):
        schema = {
            "type": "object",
            "properties": {
                "publication_date_label": {"type": "string", "field_type": "text"},
            },
        }

        validate_schema(schema, "object_type")


class ObjectStorageModelTestBase(TestCase):
    """Base class for Object Storage model tests with tenant setup"""

    def setUp(self):
        self.user = User.objects.create_user(username="testuser_obj", email="test@example.com", password="testpass123")
        self.tenant = Tenant.objects.create(name="Test Tenant", identifier="test-tenant", created_by=self.user)


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

    def test_browser_group_is_cleared_when_main_type_is_deleted(self):
        main_type = ObjectTypeDefinition.objects.create(
            name="news", label="News", plural_label="News", created_by=self.user
        )
        supporting_type = ObjectTypeDefinition.objects.create(
            name="news_category",
            label="News Category",
            plural_label="News Categories",
            browser_group=main_type,
            created_by=self.user,
        )

        main_type.delete()
        supporting_type.refresh_from_db()

        self.assertIsNone(supporting_type.browser_group)

    def test_browser_group_rejects_self_and_nested_groups(self):
        main_type = ObjectTypeDefinition.objects.create(
            name="news", label="News", plural_label="News", created_by=self.user
        )
        supporting_type = ObjectTypeDefinition.objects.create(
            name="news_category",
            label="News Category",
            plural_label="News Categories",
            browser_group=main_type,
            created_by=self.user,
        )

        main_type.browser_group = main_type
        with self.assertRaisesMessage(ValidationError, "cannot be its own browser group"):
            main_type.full_clean()

        nested_type = ObjectTypeDefinition(
            name="news_category_type",
            label="News Category Type",
            plural_label="News Category Types",
            browser_group=supporting_type,
            created_by=self.user,
        )
        with self.assertRaisesMessage(ValidationError, "Browser groups cannot be nested"):
            nested_type.full_clean()

        main_type.browser_group = supporting_type
        with self.assertRaisesMessage(ValidationError, "Browser groups cannot be nested"):
            main_type.full_clean()


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
            tenant=self.tenant,
        )

        self.assertEqual(instance.title, "Test News Article")
        self.assertEqual(instance.tenant, self.tenant)

    def test_relationships_cannot_cross_tenant_boundaries(self):
        source = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Source",
            created_by=self.user,
            tenant=self.tenant,
        )
        other_tenant = Tenant.objects.create(
            name="Other tenant",
            identifier="relationship-other-tenant",
            created_by=self.user,
        )
        foreign_target = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Foreign target",
            created_by=self.user,
            tenant=other_tenant,
        )

        with self.assertRaisesMessage(ValueError, "does not exist"):
            source.add_relationship("related", foreign_target.id)
        with self.assertRaisesMessage(ValueError, "does not exist"):
            source.set_relationships("related", [foreign_target.id])

        source.refresh_from_db()
        foreign_target.refresh_from_db()
        self.assertEqual(source.relationships, [])
        self.assertEqual(foreign_target.related_from, [])

    def test_rebuild_all_related_from_only_changes_the_selected_tenant(self):
        selected_source = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Selected source",
            relationships=[],
            created_by=self.user,
            tenant=self.tenant,
        )
        selected_target = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Selected target",
            created_by=self.user,
            tenant=self.tenant,
        )
        selected_source.relationships = [{"type": "related", "object_id": selected_target.id}]
        selected_source.save(update_fields=["relationships"])

        other_tenant = Tenant.objects.create(
            name="Other rebuild tenant",
            identifier="other-rebuild-tenant",
            created_by=self.user,
        )
        foreign_source = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Foreign source",
            created_by=self.user,
            tenant=other_tenant,
        )
        foreign_target = ObjectInstance.objects.create(
            object_type=self.obj_type,
            title="Foreign target",
            related_from=[{"type": "stale", "object_id": foreign_source.id}],
            created_by=self.user,
            tenant=other_tenant,
        )
        foreign_source.relationships = [{"type": "related", "object_id": foreign_target.id}]
        foreign_source.save(update_fields=["relationships"])

        stats = ObjectInstance.rebuild_all_related_from(tenant=self.tenant)

        selected_target.refresh_from_db()
        foreign_target.refresh_from_db()
        self.assertEqual(stats, {"total_objects": 2, "total_relationships_restored": 1})
        self.assertEqual(selected_target.related_from, [{"type": "related", "object_id": selected_source.id}])
        self.assertEqual(foreign_target.related_from, [{"type": "stale", "object_id": foreign_source.id}])


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
        self.tenant = Tenant.objects.create(name="Test Tenant API", identifier="test-tenant-api", created_by=self.user)
        self.client.force_authenticate(user=self.user)

    def test_list_object_types(self):
        """Test listing object types via API"""
        ObjectTypeDefinition.objects.create(name="news", label="News", plural_label="News", created_by=self.user)

        url = reverse("api:object_storage:objecttypedefinition-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Might be empty if tenant filtering is active

    def test_browser_roots_and_search_are_paginated_with_root_counts(self):
        obj_type = ObjectTypeDefinition.objects.create(
            name="article", label="Article", plural_label="Articles", created_by=self.user
        )
        roots = [
            ObjectInstance(
                object_type=obj_type, title=f"Article {number:03d}", created_by=self.user, tenant=self.tenant
            )
            for number in range(55)
        ]
        # MPTT needs each root saved individually to assign tree coordinates.
        for root in roots:
            root.save()
        ObjectInstance.objects.create(
            object_type=obj_type, title="Article child", parent=roots[0], created_by=self.user, tenant=self.tenant
        )

        roots_url = reverse("api:object_storage:objectinstance-roots")
        first = self.client.get(roots_url, {"type": "article", "page_size": 20, "page": 1})
        second = self.client.get(roots_url, {"type": "article", "page_size": 20, "page": 2})
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["count"], 55)
        self.assertEqual(first.data["total_pages"], 3)
        self.assertEqual(len(first.data["results"]), 20)
        self.assertEqual(len(second.data["results"]), 20)
        self.assertFalse(
            {item["id"] for item in first.data["results"]} & {item["id"] for item in second.data["results"]}
        )

        search_url = reverse("api:object_storage:objectinstance-search")
        search = self.client.get(
            search_url, {"q": "Article", "type": "article", "roots_only": "true", "page_size": 50, "page": 2}
        )
        self.assertEqual(search.status_code, status.HTTP_200_OK)
        self.assertEqual(search.data["count"], 55)
        self.assertEqual(len(search.data["results"]), 5)
        self.assertEqual(search.data["page"], 2)

        invalid = self.client.get(roots_url, {"type": "article", "page_size": 30})
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_object_type_with_browser_group(self):
        main_type = ObjectTypeDefinition.objects.create(
            name="news", label="News", plural_label="News Articles", created_by=self.user
        )

        response = self.client.post(
            reverse("api:object_storage:objecttypedefinition-list"),
            {
                "name": "news_type",
                "label": "News Type",
                "pluralLabel": "News Types",
                "browserGroupId": main_type.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["browserGroup"]["id"], main_type.id)
        self.assertEqual(ObjectTypeDefinition.objects.get(name="news_type").browser_group, main_type)

    def test_relationship_update_exposes_browser_group(self):
        main_type = ObjectTypeDefinition.objects.create(
            name="news", label="News", plural_label="News Articles", created_by=self.user
        )
        supporting_type = ObjectTypeDefinition.objects.create(
            name="news_category",
            label="News Category",
            plural_label="News Categories",
            created_by=self.user,
        )

        url = reverse(
            "api:object_storage:objecttypedefinition-update-relationships",
            args=[supporting_type.id],
        )
        response = self.client.put(
            url,
            {"hierarchyLevel": "both", "allowedChildTypes": [], "browserGroupId": main_type.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["browserGroup"]["id"], main_type.id)
        supporting_type.refresh_from_db()
        self.assertEqual(supporting_type.browser_group, main_type)

    def test_relationship_update_rejects_nested_browser_group(self):
        main_type = ObjectTypeDefinition.objects.create(
            name="news", label="News", plural_label="News", created_by=self.user
        )
        supporting_type = ObjectTypeDefinition.objects.create(
            name="news_category",
            label="News Category",
            plural_label="News Categories",
            browser_group=main_type,
            created_by=self.user,
        )
        third_type = ObjectTypeDefinition.objects.create(
            name="news_type", label="News Type", plural_label="News Types", created_by=self.user
        )

        url = reverse(
            "api:object_storage:objecttypedefinition-update-relationships",
            args=[third_type.id],
        )
        response = self.client.put(
            url,
            {"hierarchyLevel": "both", "allowedChildTypes": [], "browserGroupId": supporting_type.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Browser groups cannot be nested", response.json()["error"])

    def test_main_browser_types_include_group_information_and_visibility_filter(self):
        main_type = ObjectTypeDefinition.objects.create(
            name="news", label="News", plural_label="News Articles", created_by=self.user
        )
        supporting_type = ObjectTypeDefinition.objects.create(
            name="news_category",
            label="News Category",
            plural_label="News Categories",
            browser_group=main_type,
            created_by=self.user,
        )
        ObjectTypeDefinition.objects.create(
            name="news_detail",
            label="News Detail",
            plural_label="News Details",
            hierarchy_level="sub_object_only",
            created_by=self.user,
        )

        url = reverse("api:object_storage:objecttypedefinition-main-browser-types")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.json()
        self.assertEqual([item["name"] for item in payload], ["news", "news_category"])
        supporting_payload = next(item for item in payload if item["id"] == supporting_type.id)
        self.assertEqual(supporting_payload["browserGroup"]["id"], main_type.id)

    def test_object_instances_reject_an_inaccessible_tenant(self):
        other_user = User.objects.create_user(username="other-object-user")
        other_tenant = Tenant.objects.create(
            name="Other Tenant",
            identifier="other-object-tenant",
            created_by=other_user,
        )

        url = reverse("api:object_storage:objectinstance-list")
        response = self.client.get(url, HTTP_X_TENANT_ID=other_tenant.identifier)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_news_list_only_returns_objects_from_the_selected_tenant(self):
        object_type = ObjectTypeDefinition.objects.create(
            name="tenant-news",
            label="Tenant news",
            plural_label="Tenant news",
            created_by=self.user,
        )
        selected = ObjectInstance.objects.create(
            object_type=object_type,
            title="Selected tenant article",
            slug="selected-tenant-article",
            created_by=self.user,
            tenant=self.tenant,
        )
        selected_version = selected.create_version(self.user, data={"content": "Selected"})
        selected_version.effective_date = timezone.now()
        selected_version.save(update_fields=["effective_date"])

        other_user = User.objects.create_user(username="other-news-user")
        other_tenant = Tenant.objects.create(
            name="Other News Tenant",
            identifier="other-news-tenant",
            created_by=other_user,
        )
        other = ObjectInstance.objects.create(
            object_type=object_type,
            title="Other tenant article",
            slug="other-tenant-article",
            created_by=other_user,
            tenant=other_tenant,
        )
        other_version = other.create_version(other_user, data={"content": "Other"})
        other_version.effective_date = timezone.now()
        other_version.save(update_fields=["effective_date"])

        url = reverse("api:object_storage:objectinstance-news-list")
        response = self.client.get(
            url,
            {"object_types": str(object_type.id)},
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data["results"]], [selected.id])

    def test_object_read_surfaces_do_not_cross_the_selected_tenant(self):
        object_type = ObjectTypeDefinition.objects.create(
            name="tenant-readable",
            label="Tenant readable",
            plural_label="Tenant readable",
            created_by=self.user,
        )
        selected = ObjectInstance.objects.create(
            object_type=object_type,
            title="Selected object",
            slug="selected-object",
            created_by=self.user,
            tenant=self.tenant,
        )
        selected_version = selected.create_version(self.user, data={"content": "Selected"})
        selected_version.effective_date = timezone.now()
        selected_version.save(update_fields=["effective_date"])

        other_user = User.objects.create_user(username="other-readable-user")
        other_tenant = Tenant.objects.create(
            name="Other Readable Tenant",
            identifier="other-readable-tenant",
            created_by=other_user,
        )
        other = ObjectInstance.objects.create(
            object_type=object_type,
            title="Other object",
            slug="other-object",
            created_by=other_user,
            tenant=other_tenant,
        )
        other_version = other.create_version(other_user, data={"content": "Other"})
        other_version.effective_date = timezone.now()
        other_version.save(update_fields=["effective_date"])

        headers = {"HTTP_X_TENANT_ID": self.tenant.identifier}
        own_version = self.client.get(f"/api/v1/objects/versions/{selected_version.id}/", **headers)
        foreign_version = self.client.get(f"/api/v1/objects/versions/{other_version.id}/", **headers)
        published = self.client.get("/api/v1/objects/objects/published/", **headers)
        type_instances = self.client.get(
            f"/api/v1/objects/object-types/{object_type.id}/instances/",
            **headers,
        )
        references = self.client.get("/api/v1/objects/objects/search_for_references/", **headers)

        self.assertEqual(own_version.status_code, status.HTTP_200_OK)
        self.assertEqual(foreign_version.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual([item["id"] for item in published.data], [selected.id])
        self.assertEqual([item["id"] for item in type_instances.data], [selected.id])
        self.assertEqual([item["id"] for item in references.data["results"]], [selected.id])

    def test_object_moves_cannot_select_a_parent_from_another_tenant(self):
        object_type = ObjectTypeDefinition.objects.create(
            name="tenant-parent",
            label="Tenant parent",
            plural_label="Tenant parents",
            created_by=self.user,
        )
        selected = ObjectInstance.objects.create(
            object_type=object_type,
            title="Selected object",
            slug="selected-move-object",
            created_by=self.user,
            tenant=self.tenant,
        )
        other_user = User.objects.create_user(username="other-parent-user")
        other_tenant = Tenant.objects.create(
            name="Other Parent Tenant",
            identifier="other-parent-tenant",
            created_by=other_user,
        )
        foreign_parent = ObjectInstance.objects.create(
            object_type=object_type,
            title="Foreign parent",
            slug="foreign-parent",
            created_by=other_user,
            tenant=other_tenant,
        )

        response = self.client.post(
            f"/api/v1/objects/objects/{selected.id}/move_to/",
            {"newParentId": foreign_parent.id},
            format="json",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        selected.refresh_from_db()
        self.assertIsNone(selected.parent_id)
