from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from content.models import Namespace
from core.models import Tenant
from object_storage.models import ObjectInstance, ObjectTypeDefinition


class ObjectTrashTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="object-trash-owner")
        self.tenant = Tenant.objects.create(name="Object Trash", identifier="object-trash", created_by=self.user)
        self.namespace = Namespace.objects.create(
            name="Objects", slug="objects", is_active=True, tenant=self.tenant, created_by=self.user
        )
        self.object_type = ObjectTypeDefinition.objects.create(
            name="trash_article",
            label="Article",
            plural_label="Articles",
            namespace=self.namespace,
            schema={"type": "object", "properties": {}},
            created_by=self.user,
        )
        self.parent = ObjectInstance.objects.create(
            title="Parent article", object_type=self.object_type, tenant=self.tenant, created_by=self.user
        )
        self.child = ObjectInstance.objects.create(
            title="Child article",
            object_type=self.object_type,
            tenant=self.tenant,
            parent=self.parent,
            created_by=self.user,
        )
        self.parent.create_version(self.user, data={"body": "Keep this version"})
        self.client.force_authenticate(user=self.user)
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)

    def test_deleting_object_moves_its_tree_to_trash_and_preserves_versions(self):
        version = self.parent.current_version
        version.effective_date = timezone.now()
        version.save(update_fields=["effective_date"])
        self.assertTrue(ObjectInstance.get_published_objects(tenant=self.tenant).filter(pk=self.parent.pk).exists())
        response = self.client.delete(reverse("api:object_storage:objectinstance-detail", args=[self.parent.pk]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.parent.refresh_from_db()
        self.child.refresh_from_db()
        self.assertTrue(self.parent.is_deleted and self.child.is_deleted)
        self.assertEqual(self.parent.deleted_by, self.user)
        self.assertEqual(self.parent.versions.count(), 1)
        self.assertFalse(ObjectInstance.get_published_objects(tenant=self.tenant).filter(pk=self.parent.pk).exists())
        active = self.client.get(reverse("api:object_storage:objectinstance-list"))
        self.assertEqual(active.data["count"], 0)
        trash = self.client.get(reverse("api:trash"), {"type": "object"})
        self.assertEqual(trash.data["count"], 2)
        type_instances = self.client.get(
            reverse("api:object_storage:objecttypedefinition-instances", args=[self.object_type.pk])
        )
        self.assertEqual(type_instances.data, [])

        child_only = self.client.post(
            reverse("api:trash-restore"), {"items": [{"type": "object", "id": self.child.pk}]}, format="json"
        )
        self.assertEqual(child_only.status_code, status.HTTP_400_BAD_REQUEST)
        self.child.refresh_from_db()
        self.assertTrue(self.child.is_deleted)

        restored_parent = self.client.post(
            reverse("api:trash-restore"), {"items": [{"type": "object", "id": self.parent.pk}]}, format="json"
        )
        self.assertEqual(restored_parent.status_code, status.HTTP_200_OK)
        tree = self.client.get(reverse("api:object_storage:objectinstance-tree", args=[self.parent.pk]))
        self.assertEqual([item["id"] for item in tree.data], [self.parent.pk])

    def test_type_and_instances_are_restorable_as_one_selection(self):
        type_url = reverse("api:object_storage:objecttypedefinition-detail", args=[self.object_type.pk])
        blocked = self.client.delete(type_url)
        self.assertEqual(blocked.status_code, status.HTTP_409_CONFLICT)
        moved = self.client.delete(f"{type_url}?delete_instances=true")
        self.assertEqual(moved.status_code, status.HTTP_200_OK, moved.data)
        self.assertEqual(moved.data["instances_deleted"], 2)
        self.object_type.refresh_from_db()
        self.assertTrue(self.object_type.is_deleted)
        self.assertEqual(self.client.get(reverse("api:trash"), {"type": "object_type"}).data["count"], 1)

        restored = self.client.post(
            reverse("api:trash-restore"),
            {
                "items": [
                    {"type": "object", "id": self.child.pk},
                    {"type": "object_type", "id": self.object_type.pk},
                    {"type": "object", "id": self.parent.pk},
                ]
            },
            format="json",
        )
        self.assertEqual(restored.status_code, status.HTTP_200_OK, restored.data)
        self.parent.refresh_from_db()
        self.child.refresh_from_db()
        self.object_type.refresh_from_db()
        self.assertFalse(self.parent.is_deleted or self.child.is_deleted or self.object_type.is_deleted)
        self.assertEqual(self.child.parent_id, self.parent.pk)

    def test_legacy_force_delete_is_disabled(self):
        url = reverse("api:object_storage:objecttypedefinition-detail", args=[self.object_type.pk])
        response = self.client.delete(f"{url}?force_delete=true")
        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        self.assertTrue(ObjectTypeDefinition.objects.filter(pk=self.object_type.pk).exists())

    def test_deleted_type_is_excluded_from_published_objects_and_new_instances(self):
        version = self.parent.current_version
        version.effective_date = timezone.now()
        version.save(update_fields=["effective_date"])
        self.parent.soft_delete(self.user)
        self.child.soft_delete(self.user)
        self.object_type.soft_delete(self.user)
        self.assertFalse(ObjectInstance.get_published_objects(tenant=self.tenant).exists())
        response = self.client.post(
            reverse("api:object_storage:objectinstance-list"),
            {"title": "New article", "object_type_id": self.object_type.pk},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_trashed_relationship_target_is_hidden_until_restored(self):
        self.parent.add_relationship("related", self.child.pk)
        self.child.soft_delete(self.user)
        relationships = self.client.get(
            reverse("api:object_storage:objectinstance-relationships", args=[self.parent.pk])
        )
        self.assertEqual(relationships.data["count"], 0)
        detail = self.client.get(reverse("api:object_storage:objectinstance-detail", args=[self.parent.pk]))
        self.assertEqual(detail.data["relationships"], [])
        with self.assertRaisesRegex(ValueError, "does not exist"):
            self.parent.add_relationship("another", self.child.pk)

        self.child.restore(self.user)
        relationships = self.client.get(
            reverse("api:object_storage:objectinstance-relationships", args=[self.parent.pk])
        )
        self.assertEqual(relationships.data["count"], 1)

    def test_global_type_cannot_be_deleted_from_a_workspace(self):
        global_type = ObjectTypeDefinition.objects.create(
            name="global_trash_type",
            label="Global",
            plural_label="Globals",
            created_by=self.user,
        )
        response = self.client.delete(reverse("api:object_storage:objecttypedefinition-detail", args=[global_type.pk]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
