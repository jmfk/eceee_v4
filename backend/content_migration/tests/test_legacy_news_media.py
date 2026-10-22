import hashlib
import socket
from unittest.mock import MagicMock, call, patch

from django.contrib.auth import get_user_model
from django.db import transaction
from django.test import TestCase

from content.models import Namespace
from content_migration.legacy_news.locking import LegacyNewsImportAlreadyRunning, legacy_news_import_lock
from content_migration.legacy_news.media import MAX_IMAGE_BYTES, LegacyMediaImporter
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
        source_url = "https://legacy.example/retry.jpg"
        stable_path = self.importer._storage_path(source_url)
        repair_path = f"{stable_path}/repair-{hashlib.sha256(b'real-image').hexdigest()}"
        placeholder_result = self._upload_result(b"placeholder", stable_path)
        real_result = self._upload_result(b"real-image", repair_path)
        mocked_storage.overwrite_file.side_effect = [placeholder_result, real_result]
        mocked_storage.get_public_url.return_value = "https://media.example/placeholder.png"

        with patch.object(self.importer, "_read_image", side_effect=ValueError("not-an-image")):
            placeholder = self.importer.import_image(source_url)

        with patch.object(self.importer, "_read_image", return_value=(b"real-image", "image/jpeg")):
            resumed = self.importer.import_image(source_url, resume=True)

        self.assertEqual(placeholder.id, resumed.id)
        self.assertEqual(MediaFile.objects.count(), 1)
        resumed.refresh_from_db()
        self.assertFalse(resumed.metadata["migration_placeholder"])
        self.assertEqual(resumed.metadata["legacy_media_failure"], "")
        self.assertEqual(mocked_storage.overwrite_file.call_count, 2)
        first_path = mocked_storage.overwrite_file.call_args_list[0].args[0]
        second_path = mocked_storage.overwrite_file.call_args_list[1].args[0]
        self.assertEqual(first_path, stable_path)
        self.assertEqual(second_path, repair_path)
        self.assertEqual(resumed.file_path, repair_path)
        self.assertFalse(resumed.tags.filter(slug="migration-placeholder").exists())

    @patch("content_migration.legacy_news.media.storage")
    def test_placeholder_repair_rollback_preserves_original_bytes_and_retries_same_new_key(self, mocked_storage):
        objects = {}

        def upload(path, file):
            objects[path] = file.read()
            return self._upload_result(objects[path], path)

        mocked_storage.overwrite_file.side_effect = upload
        mocked_storage.get_public_url.side_effect = lambda path: "https://media.example/" + path
        source_url = "https://legacy.example/transactional-retry.jpg"
        with patch.object(self.importer, "_read_image", side_effect=ValueError("not-an-image")):
            placeholder = self.importer.import_image(source_url)
        old_path, old_url, old_hash = placeholder.file_path, placeholder.file_url, placeholder.file_hash
        old_bytes = objects[old_path]
        with patch.object(self.importer, "_read_image", return_value=(b"repaired-image", "image/jpeg")):
            with self.assertRaisesRegex(RuntimeError, "later attachment failed"):
                with transaction.atomic():
                    repaired = self.importer.import_image(source_url, resume=True)
                    attempted_path = repaired.file_path
                    raise RuntimeError("later attachment failed")
            placeholder.refresh_from_db()
            self.assertEqual(placeholder.file_path, old_path)
            self.assertEqual(placeholder.file_url, old_url)
            self.assertEqual(placeholder.file_hash, old_hash)
            self.assertTrue(placeholder.metadata["migration_placeholder"])
            self.assertTrue(placeholder.tags.filter(slug="migration-placeholder").exists())
            self.assertEqual(objects[old_path], old_bytes)
            self.assertNotEqual(attempted_path, old_path)
            resumed = self.importer.import_image(source_url, resume=True)
        self.assertEqual(resumed.pk, placeholder.pk)
        self.assertEqual(resumed.file_path, attempted_path)
        self.assertEqual(resumed.file_url, "https://media.example/" + attempted_path)
        self.assertFalse(resumed.metadata["migration_placeholder"])
        self.assertEqual(objects[old_path], old_bytes)
        self.assertEqual(objects[attempted_path], b"repaired-image")
        self.assertEqual(len(objects), 2)
        self.assertEqual(MediaFile.objects.count(), 1)

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
        source_url = "https://legacy.example/photo.png"
        first = self.importer._storage_path(source_url)
        second = self.importer._storage_path(source_url)

        self.assertEqual(first, second)
        self.assertTrue(first.startswith(f"legacy/news/{self.tenant.id}/{self.namespace.id}/"))

    def test_storage_path_is_isolated_by_tenant_and_namespace(self):
        sibling_namespace = Namespace.objects.create(
            name="Sibling legacy media",
            slug="sibling-legacy-media",
            tenant=self.tenant,
            created_by=self.user,
        )
        sibling_importer = LegacyMediaImporter(
            namespace=sibling_namespace,
            tenant=self.tenant,
            user=self.user,
        )
        other_tenant = Tenant.objects.create(
            name="Other legacy media",
            identifier="other-legacy-media",
            created_by=self.user,
        )
        other_namespace = Namespace.objects.create(
            name="Other legacy media",
            slug="other-legacy-media",
            tenant=other_tenant,
            created_by=self.user,
        )
        other_importer = LegacyMediaImporter(
            namespace=other_namespace,
            tenant=other_tenant,
            user=self.user,
        )
        source_url = "https://legacy.example/shared.png"

        local_path = self.importer._storage_path(source_url)
        sibling_path = sibling_importer._storage_path(source_url)
        other_path = other_importer._storage_path(source_url)

        self.assertNotEqual(local_path, sibling_path)
        self.assertNotEqual(local_path, other_path)

    @patch("content_migration.legacy_news.remote.http.client.HTTPConnection")
    @patch("content_migration.legacy_news.remote.socket.getaddrinfo")
    def test_remote_image_get_pins_and_revalidates_redirect_addresses(self, getaddrinfo, connection_class):
        getaddrinfo.side_effect = [
            [(2, 1, 6, "", ("93.184.216.34", 80))],
            [(2, 1, 6, "", ("93.184.216.35", 80))],
        ]
        redirect_connection = MagicMock()
        redirect_response = redirect_connection.getresponse.return_value
        redirect_response.status = 302
        redirect_response.getheaders.return_value = [("Location", "http://例え.テスト/image.svg")]
        image_connection = MagicMock()
        image_response = image_connection.getresponse.return_value
        image_response.status = 200
        image_response.getheaders.return_value = [("Content-Type", "image/svg+xml")]
        image_response.read.return_value = b"<svg/>"
        connection_class.side_effect = [redirect_connection, image_connection]

        content, content_type = self.importer._read_image("http://external.example/image.svg?legacy=1")

        self.assertEqual(content, b"<svg/>")
        self.assertEqual(content_type, "image/svg+xml")
        self.assertEqual(getaddrinfo.call_count, 2)
        self.assertEqual(
            getaddrinfo.call_args_list[1],
            call("xn--r8jz45g.xn--zckzah", 80, type=socket.SOCK_STREAM),
        )
        self.assertEqual(
            connection_class.call_args_list,
            [
                call("93.184.216.34", port=80, timeout=20),
                call("93.184.216.35", port=80, timeout=20),
            ],
        )
        redirect_connection.request.assert_called_once_with(
            "GET",
            "/image.svg?legacy=1",
            headers={
                "Host": "external.example",
                "User-Agent": "ECEEE-v4-Legacy-News-Migrator/1.0 (+https://www.eceee.org/)",
            },
        )
        image_connection.request.assert_called_once_with(
            "GET",
            "/image.svg",
            headers={
                "Host": "xn--r8jz45g.xn--zckzah",
                "User-Agent": "ECEEE-v4-Legacy-News-Migrator/1.0 (+https://www.eceee.org/)",
            },
        )
        image_response.read.assert_called_once_with(MAX_IMAGE_BYTES + 1)


class LegacyNewsImportLockTests(TestCase):
    def test_second_writer_is_rejected_while_import_lock_is_held(self):
        with legacy_news_import_lock():
            with self.assertRaisesMessage(LegacyNewsImportAlreadyRunning, "already running"):
                with legacy_news_import_lock():
                    pass
