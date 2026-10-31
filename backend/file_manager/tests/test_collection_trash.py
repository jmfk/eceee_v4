import uuid

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from content.models import Namespace
from core.models import Tenant
from file_manager.models import MediaCollection, MediaFile


class CollectionTrashTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="collection-trash-editor")
        self.tenant = Tenant.objects.create(
            name="Collection Trash", identifier="collection-trash", created_by=self.user
        )
        self.namespace = Namespace.objects.create(
            name="Media", slug="media", is_active=True, tenant=self.tenant, created_by=self.user
        )
        self.client.force_authenticate(user=self.user)
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)
        self.collection = self.make_collection("First")
        self.file = MediaFile.objects.create(
            title="Photo",
            original_filename="photo.jpg",
            file_path="test/photo.jpg",
            file_size=100,
            content_type="image/jpeg",
            file_type="image",
            file_hash=str(uuid.uuid4()),
            namespace=self.namespace,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.collection.mediafile_set.add(self.file)

    def make_collection(self, title):
        return MediaCollection.objects.create(
            title=title, namespace=self.namespace, created_by=self.user, last_modified_by=self.user
        )

    def bulk_delete(self, ids, delete_files=False):
        return self.client.post(
            reverse("api:file_manager:mediacollection-bulk-delete") + "?namespace=media",
            {"collectionIds": [str(value) for value in ids], "deleteFiles": delete_files},
            format="json",
        )

    def test_delete_collection_keeps_files_and_can_restore_memberships(self):
        response = self.bulk_delete([self.collection.id])
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(MediaCollection.objects.filter(pk=self.collection.pk).exists())
        self.assertTrue(MediaFile.objects.filter(pk=self.file.pk).exists())

        trash = self.client.get(reverse("api:file_manager:mediacollection-trash"), {"namespace": "media"})
        self.assertEqual(trash.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in trash.data["results"]], [str(self.collection.id)])
        restored = self.client.post(reverse("api:file_manager:mediacollection-restore", args=[self.collection.id]))
        self.assertEqual(restored.status_code, status.HTTP_200_OK, restored.data)
        self.assertTrue(self.collection.mediafile_set.filter(pk=self.file.pk).exists())

    def test_single_collection_delete_uses_trash(self):
        response = self.client.delete(reverse("api:file_manager:mediacollection-detail", args=[self.collection.id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        deleted = MediaCollection.objects.with_deleted().get(pk=self.collection.pk)
        self.assertTrue(deleted.is_deleted)
        self.assertEqual(deleted.deleted_by, self.user)
        self.assertTrue(MediaFile.objects.filter(pk=self.file.pk).exists())

    def test_bulk_delete_with_files_soft_deletes_both(self):
        second = self.make_collection("Second")
        response = self.bulk_delete([self.collection.id, second.id], delete_files=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["deleted_count"], 2)
        self.assertEqual(response.data["deleted_file_count"], 1)
        self.assertTrue(MediaFile.objects.with_deleted().get(pk=self.file.pk).is_deleted)
        self.assertEqual(MediaFile.objects.with_deleted().get(pk=self.file.pk).deleted_by, self.user)
        self.assertTrue(MediaCollection.objects.with_deleted().get(pk=self.collection.pk).is_deleted)

        restored = self.client.post(
            reverse("api:file_manager:mediacollection-bulk-restore"),
            {"collectionIds": [str(self.collection.id), str(second.id)]},
            format="json",
        )
        self.assertEqual(restored.status_code, status.HTTP_200_OK, restored.data)
        self.assertEqual(restored.data["restored_count"], 2)
        self.assertTrue(MediaFile.objects.with_deleted().get(pk=self.file.pk).is_deleted)

    def test_shared_or_referenced_file_blocks_whole_operation(self):
        other = self.make_collection("Other")
        other.mediafile_set.add(self.file)
        response = self.bulk_delete([self.collection.id], delete_files=True)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(MediaCollection.objects.filter(pk=self.collection.pk).exists())

        other.mediafile_set.remove(self.file)
        self.file.add_reference("webpage", str(uuid.uuid4()))
        response = self.bulk_delete([self.collection.id], delete_files=True)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(MediaCollection.objects.filter(pk=self.collection.pk).exists())

    def test_non_owner_cannot_bulk_delete_another_users_file(self):
        editor = User.objects.create_user(username="collection-trash-other-editor")
        self.tenant.members.add(editor)
        self.client.force_authenticate(user=editor)
        response = self.bulk_delete([self.collection.id], delete_files=True)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(MediaCollection.objects.filter(pk=self.collection.pk).exists())
        self.assertTrue(MediaFile.objects.filter(pk=self.file.pk).exists())

    def test_other_tenant_collection_cannot_be_deleted_or_restored(self):
        other_tenant = Tenant.objects.create(name="Other", identifier="other-collection-trash", created_by=self.user)
        other_namespace = Namespace.objects.create(
            name="Other Media", slug="other-media", is_active=True, tenant=other_tenant, created_by=self.user
        )
        foreign = MediaCollection.objects.create(
            title="Foreign", namespace=other_namespace, created_by=self.user, last_modified_by=self.user
        )
        response = self.bulk_delete([foreign.id])
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        foreign.soft_delete(self.user)
        restored = self.client.post(reverse("api:file_manager:mediacollection-restore", args=[foreign.id]))
        self.assertEqual(restored.status_code, status.HTTP_404_NOT_FOUND)

    def test_media_search_trash_returns_deleted_files_for_the_editor(self):
        self.file.delete(user=self.user)
        search = reverse("api:file_manager:media-search")
        normal = self.client.get(search, {"namespace": "media"})
        trash = self.client.get(search, {"namespace": "media", "show_deleted": "true", "deleted_only": "true"})
        self.assertEqual(normal.status_code, status.HTTP_200_OK)
        self.assertEqual(trash.status_code, status.HTTP_200_OK, trash.data)
        self.assertEqual(normal.data["count"], 0)
        self.assertEqual(trash.data["count"], 1)

        other = User.objects.create_user(username="collection-trash-reader")
        self.tenant.members.add(other)
        self.client.force_authenticate(user=other)
        other_trash = self.client.get(search, {"namespace": "media", "show_deleted": "true", "deleted_only": "true"})
        self.assertEqual(other_trash.data["count"], 0)
        other_restore = self.client.post(reverse("api:file_manager:mediafile-restore", args=[self.file.id]))
        self.assertEqual(other_restore.status_code, status.HTTP_404_NOT_FOUND)

    def test_bulk_media_delete_records_actor_and_rejects_referenced_file(self):
        url = reverse("api:file_manager:bulk-operations")
        response = self.client.post(url, {"file_ids": [str(self.file.id)], "operation": "delete"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(MediaFile.objects.with_deleted().get(pk=self.file.pk).is_deleted)
        self.assertEqual(MediaFile.objects.with_deleted().get(pk=self.file.pk).deleted_by, self.user)
