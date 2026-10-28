"""Safety rules for manually deleting old image versions."""

from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from content.models import Namespace
from core.models import Tenant
from file_manager.image_version_cleanup import execute_cleanup, preview_cleanup
from file_manager.models import MediaFile, MediaFileVersion
from webpages.models import PageTheme, ThemeVersion


class ImageVersionCleanupTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="image-cleanup", password="test")
        self.tenant = Tenant.objects.create(name="Image cleanup", identifier="image-cleanup", created_by=self.user)
        self.namespace = Namespace.objects.create(
            name="Images",
            slug="image-cleanup",
            tenant=self.tenant,
            created_by=self.user,
        )
        self.media = MediaFile.objects.create(
            title="Header",
            slug="header",
            original_filename="header.jpg",
            file_path="uploads/current-header.jpg",
            file_size=20,
            content_type="image/jpeg",
            file_type="image",
            file_hash="a" * 64,
            namespace=self.namespace,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.old = MediaFileVersion.objects.create(
            media_file=self.media,
            version_number=1,
            file_path="uploads/old-header.jpg",
            original_filename="old-header.jpg",
            file_size=10,
            content_type="image/jpeg",
            file_hash="b" * 64,
            uploaded_at=timezone.now() - timedelta(days=900),
            superseded_at=timezone.now() - timedelta(days=800),
            uploaded_by=self.user,
        )

    def test_preview_excludes_protected_and_referenced_versions(self):
        self.assertEqual(preview_cleanup(self.tenant, 1)["count"], 1)
        self.media.protected_from_cleanup = True
        self.media.save(update_fields=["protected_from_cleanup"])
        self.assertEqual(preview_cleanup(self.tenant, 1)["count"], 0)

        self.media.protected_from_cleanup = False
        self.media.save(update_fields=["protected_from_cleanup"])
        theme = PageTheme.objects.create(tenant=self.tenant, created_by=self.user, name="Image theme")
        theme.design_groups = {"header": {"url": "https://storage.test/uploads/old-header.jpg"}}
        theme.save(update_fields=["design_groups"])
        self.assertEqual(preview_cleanup(self.tenant, 1)["count"], 0)

    def test_theme_version_snapshot_keeps_old_file(self):
        theme = PageTheme.objects.create(tenant=self.tenant, created_by=self.user, name="Versioned theme")
        ThemeVersion.objects.create(
            theme=theme,
            version_number=1,
            sync_version=1,
            snapshot={"design_groups": {"header": {"url": "https://storage.test/uploads/old-header.jpg"}}},
            content_hash="c" * 64,
        )

        self.assertEqual(preview_cleanup(self.tenant, 1)["count"], 0)

    @patch("file_manager.image_version_cleanup.S3MediaStorage")
    def test_storage_failure_leaves_version_retryable(self, storage_class):
        storage_class.return_value.delete.side_effect = RuntimeError("storage unavailable")
        result = execute_cleanup(self.tenant, 1)
        self.assertEqual(result, {"deleted": 0, "errors": 1})
        self.assertTrue(MediaFileVersion.objects.filter(pk=self.old.pk).exists())

        storage_class.return_value.delete.side_effect = None
        result = execute_cleanup(self.tenant, 1)
        self.assertEqual(result, {"deleted": 1, "errors": 0})
        self.assertFalse(MediaFileVersion.objects.filter(pk=self.old.pk).exists())
