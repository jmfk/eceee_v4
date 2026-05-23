import io
import json
import zipfile
from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from content.models import Namespace
from core.models import Tenant
from file_manager.models import MediaFile
from webpages.models import PageTheme, PageVersion, SitePackageJob, WebPage
from webpages.services.site_package import (
    MultipartUploadWriter,
    SitePackageExporter,
    SitePackageImporter,
)


class MemoryStorage:
    def __init__(self):
        self.files = {}
        self.client = None
        self.bucket_name = "test-bucket"

    def _open(self, name, mode="rb"):
        return io.BytesIO(self.files[name])

    def _save(self, name, content):
        content.seek(0)
        self.files[name] = content.read()
        return name

    def generate_signed_url(self, name, expires=3600):
        return f"https://storage.test/{name}?expires={expires}"


class SitePackageServiceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("sitepkg", password="pass")
        self.tenant = Tenant.objects.create(
            name="Site Package Tenant",
            identifier="site-package",
            created_by=self.user,
        )
        self.namespace = Namespace.objects.create(
            name="Site Package Namespace",
            slug="site-package",
            tenant=self.tenant,
            is_default=True,
            created_by=self.user,
        )
        self.theme = PageTheme.objects.create(
            tenant=self.tenant,
            name="Package Theme",
            created_by=self.user,
        )
        self.media = MediaFile.objects.create(
            title="Hero",
            slug="hero",
            original_filename="hero.jpg",
            file_path="site-package/hero.jpg",
            file_size=9,
            content_type="image/jpeg",
            file_hash="hash-hero",
            file_type="image",
            namespace=self.namespace,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
            uploaded_by=self.user,
        )
        self.root = WebPage.objects.create(
            title="Root",
            slug="root",
            hostnames=["example.com"],
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.child = WebPage.objects.create(
            title="Child",
            slug="child",
            parent=self.root,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_export_selects_current_published_and_newer_versions(self):
        old = PageVersion.objects.create(
            page=self.root,
            version_number=1,
            effective_date=timezone.now() - timedelta(days=5),
            page_data={"title": "Old"},
            widgets={},
            created_by=self.user,
        )
        current = PageVersion.objects.create(
            page=self.root,
            version_number=2,
            effective_date=timezone.now() - timedelta(days=1),
            page_data={"title": "Current"},
            widgets={"main": [{"data": {"content": f"/media/{self.media.id}/hero.jpg"}}]},
            theme=self.theme,
            created_by=self.user,
        )
        draft = PageVersion.objects.create(
            page=self.root,
            version_number=3,
            page_data={"title": "Draft"},
            widgets={},
            created_by=self.user,
        )
        PageVersion.objects.create(
            page=self.child,
            version_number=1,
            page_data={"title": "Child"},
            widgets={},
            created_by=self.user,
        )
        self.root.refresh_from_db()
        job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_EXPORT,
            root_page=self.root,
            created_by=self.user,
            options={"include_media": True, "include_themes": True},
        )
        storage = MemoryStorage()
        storage.files[self.media.file_path] = b"hero-data"

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
            manifest = SitePackageExporter(job, storage=storage).write_package(
                package, self.root, include_media=True, include_themes=True
            )

        buffer.seek(0)
        with zipfile.ZipFile(buffer, "r") as package:
            pages = json.loads(package.read("pages.json").decode("utf-8"))["pages"]
            media_manifest = json.loads(package.read("media/manifest.json").decode("utf-8"))

        root_versions = pages[0]["versions"]
        self.assertNotIn(old.id, [version["source_id"] for version in root_versions])
        self.assertIn(current.id, [version["source_id"] for version in root_versions])
        self.assertIn(draft.id, [version["source_id"] for version in root_versions])
        self.assertEqual(manifest["counts"]["pages"], 2)
        self.assertEqual(manifest["counts"]["media"], 1)
        self.assertEqual(media_manifest["files"][0]["source_id"], str(self.media.id))

    def test_import_creates_copy_clears_root_hostnames_and_remaps_media(self):
        PageVersion.objects.create(
            page=self.root,
            version_number=1,
            effective_date=timezone.now() - timedelta(days=1),
            page_data={"title": "Root"},
            widgets={"main": [{"data": {"content": f"/media/{self.media.id}/hero.jpg"}}]},
            theme=self.theme,
            created_by=self.user,
        )
        self.root.refresh_from_db()
        export_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_EXPORT,
            root_page=self.root,
            created_by=self.user,
            options={"include_media": True, "include_themes": True},
        )
        storage = MemoryStorage()
        storage.files[self.media.file_path] = b"hero-data"
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
            SitePackageExporter(export_job, storage=storage).write_package(
                package, self.root, include_media=True, include_themes=True
            )
        buffer.seek(0)

        import_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "preserve_publication_status": True,
            },
        )
        with zipfile.ZipFile(buffer, "r") as package:
            imported_root = SitePackageImporter(import_job, storage=storage).import_package(package)

        imported_version = imported_root.versions.get(version_number=1)
        self.assertNotEqual(imported_root.id, self.root.id)
        self.assertEqual(imported_root.hostnames, [])
        self.assertTrue(imported_version.effective_date)
        self.assertIn("/media/", json.dumps(imported_version.widgets))


class FakeMultipartClient:
    def __init__(self):
        self.uploaded_parts = []
        self.completed = None
        self.aborted = None

    def create_multipart_upload(self, **kwargs):
        return {"UploadId": "upload-1"}

    def upload_part(self, **kwargs):
        self.uploaded_parts.append(kwargs)
        return {"ETag": f"etag-{kwargs['PartNumber']}"}

    def complete_multipart_upload(self, **kwargs):
        self.completed = kwargs

    def abort_multipart_upload(self, **kwargs):
        self.aborted = kwargs


class MultipartUploadWriterTests(TestCase):
    def test_writer_uploads_and_completes_parts(self):
        storage = MemoryStorage()
        storage.client = FakeMultipartClient()
        writer = MultipartUploadWriter(storage, "exports/test.zip")
        writer.part_size = 5

        writer.write(b"abcdef")
        writer.write(b"gh")
        writer.complete()

        self.assertEqual(len(storage.client.uploaded_parts), 2)
        self.assertIsNotNone(storage.client.completed)
        self.assertIsNone(storage.client.aborted)


class SitePackageAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user("sitepkg-api", password="pass")
        self.client.force_authenticate(self.user)
        self.tenant = Tenant.objects.create(
            name="Site Package API Tenant",
            identifier="site-package-api",
            created_by=self.user,
        )
        self.root = WebPage.objects.create(
            title="Root",
            slug="root",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )

    @patch("webpages.views.site_package_views.export_site_package.delay")
    def test_start_export_job(self, delay):
        response = self.client.post(
            "/api/v1/webpages/site-packages/exports/",
            {"rootPageId": self.root.id, "includeMedia": True, "includeThemes": False},
            format="json",
        )

        self.assertEqual(response.status_code, 202)
        job = SitePackageJob.objects.get(id=response.data["id"])
        self.assertEqual(job.root_page, self.root)
        self.assertTrue(job.options["include_media"])
        self.assertFalse(job.options["include_themes"])
        delay.assert_called_once_with(str(job.id))

    def test_list_export_jobs_returns_recent_user_jobs(self):
        SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_EXPORT,
            status=SitePackageJob.STATUS_PENDING,
            root_page=self.root,
            created_by=self.user,
            expires_at=timezone.now() + timedelta(hours=1),
        )
        SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_EXPORT,
            status=SitePackageJob.STATUS_COMPLETED,
            root_page=self.root,
            created_by=self.user,
            expires_at=timezone.now() - timedelta(hours=1),
        )

        response = self.client.get("/api/v1/webpages/site-packages/exports/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["status"], SitePackageJob.STATUS_PENDING)
        self.assertEqual(response.data[0]["root_page_title"], self.root.title)

    def test_download_requires_completed_export(self):
        job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_EXPORT,
            status=SitePackageJob.STATUS_PENDING,
            root_page=self.root,
            created_by=self.user,
        )
        response = self.client.get(
            f"/api/v1/webpages/site-packages/exports/{job.id}/download/"
        )
        self.assertEqual(response.status_code, 409)

    @patch("webpages.views.site_package_views.import_site_package.delay")
    @patch("webpages.views.site_package_views.S3MediaStorage")
    def test_start_import_job(self, storage_class, delay):
        storage = MemoryStorage()
        storage_class.return_value = storage
        upload = ContentFile(b"not-a-real-zip", name="site.zip")
        response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {"site_zip": upload, "preserve_publication_status": "true"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 202)
        job = SitePackageJob.objects.get(id=response.data["id"])
        self.assertEqual(job.kind, SitePackageJob.KIND_IMPORT)
        self.assertIn(str(job.id), job.object_key)
        delay.assert_called_once_with(str(job.id))

    def test_list_import_jobs_returns_recent_user_jobs(self):
        SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            status=SitePackageJob.STATUS_RUNNING,
            created_by=self.user,
            expires_at=timezone.now() + timedelta(hours=1),
        )

        response = self.client.get("/api/v1/webpages/site-packages/imports/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["kind"], SitePackageJob.KIND_IMPORT)
