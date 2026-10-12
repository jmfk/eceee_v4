import hashlib
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from content.models import Namespace
from content_migration.legacy_news.locking import LegacyNewsImportAlreadyRunning, legacy_news_import_lock
from content_migration.legacy_news.media import LegacyMediaImporter
from core.models import Tenant
from file_manager.models import MediaFile


class LegacyNewsMediaImporterTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="legacy-media")
        self.tenant = Tenant.objects.create(
            name="Legacy media",
            identifier="legacy-media",
            created_by=self.user,
        )
        self.namespace = Namespace.objects.create(
            name="Legacy media",
            slug="legacy-media",
            tenant=self.tenant,
            created_by=self.user,
        )
        self.importer = LegacyMediaImporter(
            namespace=self.namespace,
            tenant=self.tenant,
            user=self.user,
        )

    @staticmethod
    def _upload_result(content, path="legacy/news/imported.png"):
        return {
            "file_path": path,
            "file_size": len(content),
            "content_type": "image/png",
            "file_hash": hashlib.sha256(content).hexdigest(),
            "width": 10,
            "height": 10,
        }

    @patch("content_migration.legacy_news.media.storage")
    def test_rerun_reuses_media_and_records_each_article_once(self, mocked_storage):
        content = b"valid-image-content"
        mocked_storage.overwrite_file.return_value = self._upload_result(content)
        mocked_storage.get_public_url.return_value = "https://media.example/imported.png"

        with patch.object(self.importer, "_read_image", return_value=(content, "image/png")):
            first = self.importer.import_image(
                "https://legacy.example/imported.png",
                article_identity="article-1",
            )
            second = self.importer.import_image(
                "https://legacy.example/imported.png",
                article_identity="article-1",
            )
            third = self.importer.import_image(
                "https://legacy.example/imported.png",
                article_identity="article-2",
            )

        self.assertEqual(first.id, second.id)
        self.assertEqual(first.id, third.id)
        self.assertEqual(MediaFile.objects.count(), 1)
        mocked_storage.overwrite_file.assert_called_once()
        first.refresh_from_db()
        self.assertEqual(first.metadata["legacy_news_articles"], ["article-1", "article-2"])

    @patch("content_migration.legacy_news.media.storage")
    def test_resume_replaces_placeholder_without_changing_media_id(self, mocked_storage):
        source_url = "https://legacy.example/retry.png"
        stable_path = self.importer._storage_path(source_url, "placeholder.png", "image/png")
        placeholder_result = self._upload_result(b"placeholder", stable_path)
        real_result = self._upload_result(b"real-image", stable_path)
        mocked_storage.overwrite_file.side_effect = [placeholder_result, real_result]
        mocked_storage.get_public_url.return_value = "https://media.example/placeholder.png"

        with patch.object(self.importer, "_read_image", side_effect=ValueError("not-an-image")):
            placeholder = self.importer.import_image(source_url)

        with patch.object(self.importer, "_read_image", return_value=(b"real-image", "image/png")):
            resumed = self.importer.import_image(source_url, resume=True)

        self.assertEqual(placeholder.id, resumed.id)
        self.assertEqual(MediaFile.objects.count(), 1)
        resumed.refresh_from_db()
        self.assertFalse(resumed.metadata["migration_placeholder"])
        self.assertEqual(resumed.metadata["legacy_media_failure"], "")
        self.assertEqual(mocked_storage.overwrite_file.call_count, 2)
        first_path = mocked_storage.overwrite_file.call_args_list[0].args[0]
        second_path = mocked_storage.overwrite_file.call_args_list[1].args[0]
        self.assertEqual(first_path, second_path)
        self.assertFalse(resumed.tags.filter(slug="migration-placeholder").exists())

    @patch("content_migration.legacy_news.media.MediaFile.objects.create")
    @patch("content_migration.legacy_news.media.storage")
    def test_database_failure_removes_newly_uploaded_file(self, mocked_storage, mocked_create):
        content = b"valid-image-content"
        result = self._upload_result(content)
        mocked_storage.overwrite_file.return_value = result
        mocked_storage.get_public_url.return_value = "https://media.example/imported.png"
        mocked_create.side_effect = RuntimeError("database unavailable")

        with patch.object(self.importer, "_read_image", return_value=(content, "image/png")):
            with self.assertRaisesMessage(RuntimeError, "database unavailable"):
                self.importer.import_image("https://legacy.example/imported.png")

        mocked_storage.delete.assert_called_once_with(result["file_path"])

    def test_storage_path_is_stable_for_the_source_url(self):
        first = self.importer._storage_path(
            "https://legacy.example/photo.png",
            "photo.png",
            "image/png",
        )
        second = self.importer._storage_path(
            "https://legacy.example/photo.png",
            "renamed.png",
            "image/png",
        )

        self.assertEqual(first, second)
        self.assertTrue(first.startswith("legacy/news/"))
        self.assertTrue(first.endswith(".png"))


class LegacyNewsImportLockTests(TestCase):
    def test_second_writer_is_rejected_while_import_lock_is_held(self):
        with legacy_news_import_lock():
            with self.assertRaisesMessage(LegacyNewsImportAlreadyRunning, "already running"):
                with legacy_news_import_lock():
                    pass
