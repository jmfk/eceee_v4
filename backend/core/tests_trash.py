import uuid

from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from content.models import Namespace
from core.models import Tenant
from file_manager.models import MediaCollection, MediaFile
from webpages.models import WebPage


class GlobalTrashTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="trash-owner")
        self.tenant = Tenant.objects.create(name="Trash", identifier="trash", created_by=self.user)
        self.namespace = Namespace.objects.create(
            name="Media", slug="media", is_active=True, tenant=self.tenant, created_by=self.user
        )
        self.client.force_authenticate(user=self.user)
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)
        self.page = WebPage.objects.create(
            title="Removed page",
            slug="removed-page",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.page.is_deleted = True
        self.page.deleted_at = timezone.now()
        self.page.deleted_by = self.user
        self.page.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])
        self.collection = MediaCollection.objects.create(
            title="Removed collection",
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.collection.soft_delete(self.user)
        self.file = MediaFile.objects.create(
            title="Removed photo",
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
        self.file.delete(user=self.user)

    def test_global_list_filters_and_searches_across_types(self):
        response = self.client.get(reverse("api:trash"))
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["count"], 3)
        self.assertEqual({item["type"] for item in response.data["results"]}, {"page", "media", "collection"})
        self.assertEqual(
            response.data["counts"],
            {
                "page": 1,
                "media": 1,
                "collection": 1,
                "object": 0,
                "object_type": 0,
            },
        )
        searched = self.client.get(reverse("api:trash"), {"search": "photo"})
        self.assertEqual([item["type"] for item in searched.data["results"]], ["media"])
        filtered = self.client.get(reverse("api:trash"), {"type": "collection"})
        self.assertEqual([item["type"] for item in filtered.data["results"]], ["collection"])

    def test_mixed_bulk_restore_and_scope_validation(self):
        items = [
            {"type": "page", "id": self.page.pk},
            {"type": "media", "id": str(self.file.pk)},
            {"type": "collection", "id": str(self.collection.pk)},
        ]
        response = self.client.post(reverse("api:trash-restore"), {"items": items}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["restored_count"], 3)
        self.page.refresh_from_db()
        self.file.refresh_from_db()
        self.collection.refresh_from_db()
        self.assertFalse(self.page.is_deleted or self.file.is_deleted or self.collection.is_deleted)

    def test_foreign_item_aborts_whole_restore(self):
        other_tenant = Tenant.objects.create(name="Other", identifier="other-trash", created_by=self.user)
        other_page = WebPage.objects.create(
            title="Foreign",
            slug="foreign",
            tenant=other_tenant,
            created_by=self.user,
            last_modified_by=self.user,
            is_deleted=True,
            deleted_at=timezone.now(),
        )
        response = self.client.post(
            reverse("api:trash-restore"),
            {
                "items": [
                    {"type": "media", "id": str(self.file.pk)},
                    {"type": "page", "id": other_page.pk},
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.file.refresh_from_db()
        self.assertTrue(self.file.is_deleted)

    def test_nonmember_cannot_list_trash(self):
        outsider = User.objects.create_user(username="trash-outsider")
        self.client.force_authenticate(user=outsider)
        response = self.client.get(reverse("api:trash"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_member_sees_collection_but_not_pages_or_other_users_media(self):
        member = User.objects.create_user(username="trash-member")
        self.tenant.members.add(member)
        self.client.force_authenticate(user=member)
        response = self.client.get(reverse("api:trash"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["type"] for item in response.data["results"]], ["collection"])

    def test_invalid_restore_id_returns_validation_error(self):
        response = self.client.post(
            reverse("api:trash-restore"), {"items": [{"type": "page", "id": "oops"}]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_selected_page_parent_restores_before_its_child(self):
        child = WebPage.objects.create(
            title="Deleted child",
            slug="deleted-child",
            parent=self.page,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
            is_deleted=True,
            deleted_at=timezone.now(),
        )
        response = self.client.post(
            reverse("api:trash-restore"),
            {
                "items": [
                    {"type": "page", "id": child.pk},
                    {"type": "page", "id": self.page.pk},
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        child.refresh_from_db()
        self.assertEqual(child.parent_id, self.page.pk)
        self.assertFalse(child.is_deleted)

    def test_legacy_page_purge_routes_are_non_destructive(self):
        single = self.client.delete(reverse("api:webpage-permanent-delete", args=[self.page.pk]))
        bulk = self.client.post(
            reverse("api:webpage-bulk-permanent-delete"), {"pageIds": [self.page.pk]}, format="json"
        )
        all_pages = self.client.post(reverse("api:webpage-permanent-delete-all"), {"confirm": True}, format="json")
        self.assertEqual([single.status_code, bulk.status_code, all_pages.status_code], [410, 410, 410])
        self.page.refresh_from_db()
        self.assertTrue(self.page.is_deleted)
