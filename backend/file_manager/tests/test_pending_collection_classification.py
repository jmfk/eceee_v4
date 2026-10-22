from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, override_settings
from rest_framework.exceptions import ValidationError

from content.models import Namespace
from core.models import Tenant
from file_manager.models import MediaCollection, MediaFile
from file_manager.views.pending_media import PendingMediaFileViewSet
from taxonomy.assignments import classification_ids, replace_assignments
from taxonomy.models import ClassificationRollout, ClassificationType, Tag


@override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}})
class PendingCollectionClassificationTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="pending-collection-owner")
        self.tenant = Tenant.objects.create(
            name="Pending collections", identifier="pending-collections", created_by=self.user
        )
        self.namespace = Namespace.objects.create(
            tenant=self.tenant, name="Media", slug="pending-media", created_by=self.user
        )
        self.definition = ClassificationType.objects.create(
            tenant=self.tenant, namespace=self.namespace, key="file-only", name="Files", allowed_uses=["media_files"]
        )
        self.term = Tag.objects.create(
            tenant=self.tenant,
            namespace=self.namespace,
            classification_type=self.definition,
            name="Image",
            slug="image",
        )
        self.media = MediaFile.objects.create(
            title="Image",
            original_filename="image.jpg",
            file_path="tests/image.jpg",
            file_size=100,
            content_type="image/jpeg",
            file_hash="e" * 64,
            file_type="image",
            namespace=self.namespace,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        replace_assignments(self.media, [str(self.term.pk)], self.user)

    def attempt_collection(self):
        return PendingMediaFileViewSet()._get_or_create_collection(
            None, "Optional collection", self.namespace, self.user, media_file=self.media
        )

    def assert_failed_collection_is_rolled_back(self, phase):
        ClassificationRollout.objects.create(namespace=self.namespace, phase=phase)
        # The approval action catches this error and continues approving the file.
        with self.assertRaises(ValidationError):
            self.attempt_collection()
        self.assertFalse(MediaCollection.objects.filter(namespace=self.namespace).exists())
        self.assertEqual(classification_ids(self.media), [str(self.term.pk)])
        connection.check_constraints()

    def test_optional_collection_failure_leaves_no_orphan_in_legacy_mode(self):
        self.assert_failed_collection_is_rolled_back("legacy")

    def test_optional_collection_failure_does_not_poison_canonical_commit(self):
        self.assert_failed_collection_is_rolled_back("canonical")

    def test_compatible_classification_creates_and_reuses_collection(self):
        self.definition.allowed_uses.append("media_collections")
        self.definition.save()
        ClassificationRollout.objects.create(namespace=self.namespace, phase="canonical")
        collection = self.attempt_collection()
        self.assertEqual(classification_ids(collection), [str(self.term.pk)])
        self.assertEqual(self.attempt_collection().pk, collection.pk)
        self.assertEqual(MediaCollection.objects.filter(namespace=self.namespace).count(), 1)
        connection.check_constraints()
