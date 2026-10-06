import base64
import hashlib
import io
import json
import os
import zipfile
from datetime import datetime, timedelta
from datetime import timezone as datetime_timezone
from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from content.models import Namespace
from core.models import Tenant
from file_manager.models import MediaCollection, MediaFile, MediaTag
from taxonomy.models import Tag as TaxonomyTag
from webpages.models import (
    PageTheme,
    PageVersion,
    PageVersionTag,
    RemoteSiteBinding,
    SitePackageJob,
    ThemeRemoteAccessKey,
    ThemeRemoteConnection,
    WebPage,
)
from webpages.services.site_package import (
    MultipartUploadWriter,
    SitePackageExporter,
    SitePackageImporter,
    _remap_structured_references,
    build_site_package_export_filename,
    build_theme_transfer_package,
    restore_theme_transfer_package,
)
from webpages.tasks import import_remote_site_package


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

    def url(self, name):
        return f"https://storage.test/{name}"

    def generate_signed_url(self, name, expires=3600, response_filename=None):
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

    def test_v2_package_round_trip_preserves_page_and_media_taxonomy(self):
        source_media_url = f"https://storage.test/{self.media.file_path}"
        self.root.page_css_variables = {"heroImage": source_media_url}
        self.root.page_custom_css = f".root-hero {{ background-image: url('{source_media_url}'); }}"
        self.root.save(update_fields=["page_css_variables", "page_custom_css", "updated_at"])
        legacy_tag = MediaTag.objects.create(
            name="Portrait",
            slug="portrait",
            namespace=self.namespace,
            created_by=self.user,
        )
        canonical_tag = TaxonomyTag.objects.create(
            tenant=self.tenant,
            namespace=self.namespace,
            name="People",
            slug="people",
            tag_type="subject",
            created_by=self.user,
        )
        collection = MediaCollection.objects.create(
            title="Team",
            slug="team",
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.media.tags.add(legacy_tag)
        self.media.canonical_tags.add(canonical_tag)
        self.media.collections.add(collection)
        version = PageVersion.objects.create(
            page=self.root,
            version_number=1,
            page_data={
                "hero": {"fileUrl": source_media_url},
                "externalLogo": "https://cdn.example.net/logo.png",
            },
            widgets={},
            page_css_variables={"heroImage": source_media_url},
            page_custom_css=f".version-hero {{ background-image: url('{source_media_url}'); }}",
            tags=["Editorial"],
            created_by=self.user,
        )
        PageVersionTag.objects.create(page_version=version, tag=canonical_tag, position=0)
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
            manifest = SitePackageExporter(export_job, storage=storage).write_package(package, self.root)
        self.assertEqual(manifest["package_version"], "2.0")
        self.assertEqual(manifest["warnings"][0]["code"], "external_media_reference")

        destination_tenant = Tenant.objects.create(
            name="Destination Tenant",
            identifier="site-package-destination",
            created_by=self.user,
        )
        Namespace.objects.create(
            name="Destination Namespace",
            slug="site-package-destination",
            tenant=destination_tenant,
            is_default=True,
            created_by=self.user,
        )
        import_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={"tenant_id": str(destination_tenant.id)},
        )
        buffer.seek(0)
        with zipfile.ZipFile(buffer, "r") as package:
            imported_root = SitePackageImporter(import_job, storage=storage).import_package(package)

        imported_version = imported_root.versions.get()
        self.assertEqual(imported_version.tags, ["Editorial"])
        self.assertEqual(imported_version.canonical_tags.get().slug, "people")
        imported_media = MediaFile.objects.get(tenant=destination_tenant)
        imported_media_url = storage.url(imported_media.file_path)
        self.assertEqual(imported_version.page_data["hero"]["fileUrl"], storage.url(imported_media.file_path))
        self.assertEqual(imported_root.page_css_variables["heroImage"], imported_media_url)
        self.assertIn(imported_media_url, imported_root.page_custom_css)
        self.assertEqual(imported_version.page_css_variables["heroImage"], imported_media_url)
        self.assertIn(imported_media_url, imported_version.page_custom_css)
        self.assertEqual(imported_media.tags.get().slug, "portrait")
        self.assertEqual(imported_media.canonical_tags.get().slug, "people")
        self.assertEqual(imported_media.collections.get().slug, "team")

        second_import_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={"tenant_id": str(destination_tenant.id)},
        )
        buffer.seek(0)
        with zipfile.ZipFile(buffer, "r") as package:
            SitePackageImporter(second_import_job, storage=storage).import_package(package)
        self.assertEqual(MediaFile.objects.filter(tenant=destination_tenant).count(), 1)

    def test_v1_package_remains_importable(self):
        package_buffer = io.BytesIO()
        with zipfile.ZipFile(package_buffer, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr(
                "manifest.json",
                json.dumps({"package_version": "1.0", "kind": "site-root-tree"}),
            )
            package.writestr(
                "pages.json",
                json.dumps(
                    {
                        "pages": [
                            {
                                "source_id": 101,
                                "parent_source_id": None,
                                "title": "Legacy root",
                                "description": "",
                                "slug": "legacy-root",
                                "hostnames": ["legacy.example"],
                                "versions": [],
                            }
                        ]
                    }
                ),
            )
        package_buffer.seek(0)
        import_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={"tenant_id": str(self.tenant.id)},
        )

        with zipfile.ZipFile(package_buffer, "r") as package:
            imported_root = SitePackageImporter(import_job, storage=MemoryStorage()).import_package(package)

        self.assertEqual(imported_root.title, "Legacy root")
        self.assertEqual(imported_root.hostnames, [])

    def test_remote_update_creates_drafts_and_is_idempotent_without_deleting_local_pages(self):
        published_source_version = PageVersion.objects.create(
            page=self.root,
            version_number=1,
            effective_date=timezone.now() - timedelta(days=1),
            page_data={"heading": "Published"},
            widgets={},
            theme=self.theme,
            created_by=self.user,
        )
        destination_tenant = Tenant.objects.create(
            name="Remote Copy Tenant",
            identifier="remote-copy-tenant",
            created_by=self.user,
        )
        Namespace.objects.create(
            name="Remote Copy Namespace",
            slug="remote-copy-tenant",
            tenant=destination_tenant,
            is_default=True,
            created_by=self.user,
        )
        connection = ThemeRemoteConnection.objects.create(
            tenant=destination_tenant,
            name="Source",
            base_url="https://source.test",
            remote_workspace=self.tenant.identifier,
            encrypted_access_key="unused-in-service-test",
            created_by=self.user,
            updated_by=self.user,
        )
        storage = MemoryStorage()

        def export_buffer():
            export_job = SitePackageJob.objects.create(
                kind=SitePackageJob.KIND_EXPORT,
                root_page=self.root,
                created_by=self.user,
                options={"include_media": True, "include_themes": True},
            )
            output = io.BytesIO()
            with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as package:
                SitePackageExporter(export_job, storage=storage).write_package(package, self.root)
            output.seek(0)
            return output

        copy_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "tenant_id": str(destination_tenant.id),
                "source": "remote",
                "connection_id": str(connection.id),
                "remote_site_key": str(self.root.stable_key),
                "mode": "copy",
                "preserve_publication_status": True,
            },
        )
        with zipfile.ZipFile(export_buffer(), "r") as package:
            local_root = SitePackageImporter(copy_job, storage=storage).import_package(package)
        binding = RemoteSiteBinding.objects.get(local_root=local_root)
        local_only = WebPage.objects.create(
            parent=local_root,
            title="Local only",
            slug="local-only",
            tenant=destination_tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        initial_count = local_root.versions.count()
        original_local_theme_id = local_root.versions.get(version_number=1).theme_id

        self.theme.colors = {"brand": "#123456"}
        self.theme.save(update_fields=["colors", "updated_at"])
        PageVersion.objects.create(
            page=self.root,
            version_number=2,
            page_data={
                "heading": "Remote draft",
                "featuredLink": {"currentVersionId": published_source_version.id},
            },
            widgets={},
            theme=self.theme,
            created_by=self.user,
        )
        update_package = export_buffer().getvalue()

        def import_update():
            job = SitePackageJob.objects.create(
                kind=SitePackageJob.KIND_IMPORT,
                root_page=local_root,
                created_by=self.user,
                options={
                    "tenant_id": str(destination_tenant.id),
                    "source": "remote",
                    "connection_id": str(connection.id),
                    "remote_site_key": str(self.root.stable_key),
                    "local_root_id": local_root.id,
                    "mode": "update",
                },
            )
            with zipfile.ZipFile(io.BytesIO(update_package), "r") as package:
                SitePackageImporter(job, storage=storage).import_package(package)
            return job

        update_job = import_update()
        self.assertEqual(local_root.versions.count(), initial_count + 1)
        imported_draft = local_root.versions.order_by("-version_number").first()
        self.assertIsNone(imported_draft.effective_date)
        self.assertEqual(imported_draft.page_data["heading"], "Remote draft")
        self.assertEqual(
            imported_draft.page_data["featuredLink"]["currentVersionId"],
            local_root.versions.get(version_number=1).id,
        )
        self.assertNotEqual(imported_draft.theme_id, original_local_theme_id)
        self.assertEqual(local_root.versions.get(version_number=1).theme_id, original_local_theme_id)
        self.assertTrue(WebPage.objects.filter(pk=local_only.pk).exists())
        self.assertIn("local_page_preserved", {item["code"] for item in update_job.progress["warnings"]})

        import_update()
        self.assertEqual(local_root.versions.count(), initial_count + 1)
        binding.refresh_from_db()
        self.assertEqual(binding.local_root_id, local_root.id)

        local_root.soft_delete(self.user, recursive=True)
        with self.assertRaisesMessage(ValueError, "not linked"):
            import_update()

    @patch("webpages.services.theme_remote.remote_site_request")
    def test_remote_import_rejects_invalid_zip_and_marks_job_failed(self, remote_request):
        connection = ThemeRemoteConnection.objects.create(
            tenant=self.tenant,
            name="Invalid package source",
            base_url="https://source.test",
            remote_workspace=self.tenant.identifier,
            encrypted_access_key="unused-in-task-test",
            created_by=self.user,
            updated_by=self.user,
        )
        response = Mock()
        response.iter_content.return_value = [b"not-a-zip"]
        remote_request.side_effect = [
            {"id": "remote-job", "status": "completed"},
            response,
        ]
        job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            status=SitePackageJob.STATUS_RUNNING,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "connection_id": str(connection.id),
                "remote_site_key": str(self.root.stable_key),
                "source": "remote",
                "mode": "copy",
            },
            progress={"remote_job_id": "remote-job"},
        )

        with self.assertRaises(zipfile.BadZipFile):
            import_remote_site_package.run(str(job.id))

        job.refresh_from_db()
        self.assertEqual(job.status, SitePackageJob.STATUS_FAILED)
        response.close.assert_called_once()

    @patch("webpages.services.theme_remote.remote_site_request")
    def test_remote_import_reports_cancelled_export(self, remote_request):
        connection = ThemeRemoteConnection.objects.create(
            tenant=self.tenant,
            name="Cancelled export source",
            base_url="https://source.test",
            remote_workspace=self.tenant.identifier,
            encrypted_access_key="unused-in-task-test",
            created_by=self.user,
            updated_by=self.user,
        )
        remote_request.return_value = {"status": "failed", "errors": ["Export cancelled."]}
        job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            status=SitePackageJob.STATUS_RUNNING,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "connection_id": str(connection.id),
                "remote_site_key": str(self.root.stable_key),
                "source": "remote",
                "mode": "copy",
            },
            progress={"remote_job_id": "remote-job"},
        )

        with self.assertRaisesMessage(ValueError, "Export cancelled"):
            import_remote_site_package.run(str(job.id))

        job.refresh_from_db()
        self.assertEqual(job.status, SitePackageJob.STATUS_FAILED)

    def test_theme_transfer_package_copies_and_rewrites_all_theme_assets(self):
        storage = MemoryStorage()
        self.theme.image.name = "theme_images/source/preview.png"
        self.theme.site_icon.name = "theme_images/source/favicon.png"
        self.theme.design_groups = {
            "groups": [
                {
                    "layoutProperties": {
                        "hero": {
                            "md": {
                                "background": {
                                    "url": "https://production.test/bucket/theme_images/source/hero.png",
                                    "filename": "hero.png",
                                }
                            }
                        }
                    }
                }
            ]
        }
        self.theme.designer_preview = {
            "views": [
                {
                    "id": "home",
                    "images": {"hero": {"url": f"/media/theme_images/{self.theme.id}/library/demo.png"}},
                }
            ]
        }
        self.theme.list_library_images = lambda: ["demo.png"]
        storage.files = {
            "theme_images/source/preview.png": b"preview",
            "theme_images/source/favicon.png": b"favicon",
            "theme_images/source/hero.png": b"hero",
            f"theme_images/{self.theme.id}/library/demo.png": b"demo",
        }

        encoded = build_theme_transfer_package(self.theme, storage=storage)
        imported = PageTheme.objects.create(tenant=self.tenant, name="Imported", created_by=self.user)
        restored = restore_theme_transfer_package(encoded, imported, storage=storage)

        destination = f"theme_images/{imported.id}/library"
        preview_path = f"{destination}/{hashlib.sha256(b'preview').hexdigest()}.png"
        favicon_path = f"{destination}/{hashlib.sha256(b'favicon').hexdigest()}.png"
        hero_path = f"{destination}/{hashlib.sha256(b'hero').hexdigest()}.png"
        demo_path = f"{destination}/{hashlib.sha256(b'demo').hexdigest()}.png"
        self.assertEqual(restored["image"], preview_path)
        self.assertEqual(restored["site_icon"], favicon_path)
        background = restored["design_groups"]["groups"][0]["layoutProperties"]["hero"]["md"]["background"]
        self.assertEqual(background["url"], storage.url(hero_path))
        self.assertEqual(background["filename"], os.path.basename(hero_path))
        self.assertIn(storage.url(demo_path), str(restored["designer_preview"]))
        self.assertEqual(storage.files[preview_path], b"preview")

    def test_theme_transfer_package_keeps_assets_with_the_same_basename_distinct(self):
        storage = MemoryStorage()
        self.theme.image.name = "theme_images/source/preview/logo.png"
        self.theme.site_icon.name = "theme_images/source/favicon/logo.png"
        storage.files = {
            self.theme.image.name: b"preview-logo",
            self.theme.site_icon.name: b"favicon-logo",
        }

        encoded = build_theme_transfer_package(self.theme, storage=storage)
        imported = PageTheme.objects.create(tenant=self.tenant, name="Imported", created_by=self.user)
        restored = restore_theme_transfer_package(encoded, imported, storage=storage)

        self.assertNotEqual(restored["image"], restored["site_icon"])
        self.assertEqual(storage.files[restored["image"]], b"preview-logo")
        self.assertEqual(storage.files[restored["site_icon"]], b"favicon-logo")

    def test_theme_transfer_package_does_not_overwrite_earlier_asset_content(self):
        storage = MemoryStorage()
        self.theme.image.name = "theme_images/source/preview.png"
        imported = PageTheme.objects.create(tenant=self.tenant, name="Imported", created_by=self.user)

        storage.files[self.theme.image.name] = b"first-preview"
        first = restore_theme_transfer_package(
            build_theme_transfer_package(self.theme, storage=storage), imported, storage=storage
        )
        storage.files[self.theme.image.name] = b"second-preview"
        second = restore_theme_transfer_package(
            build_theme_transfer_package(self.theme, storage=storage), imported, storage=storage
        )

        self.assertNotEqual(first["image"], second["image"])
        self.assertEqual(storage.files[first["image"]], b"first-preview")
        self.assertEqual(storage.files[second["image"]], b"second-preview")

    @patch("webpages.services.site_package.THEME_TRANSFER_MAX_FILE_SIZE", 3)
    def test_theme_transfer_package_rejects_oversized_files(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr("theme.json", "{}")
            package.writestr("assets/image.png", b"large")

        with self.assertRaisesMessage(ValueError, "Invalid theme transfer package"):
            restore_theme_transfer_package(
                base64.b64encode(buffer.getvalue()).decode(), self.theme, storage=MemoryStorage()
            )

    @patch("webpages.services.site_package.THEME_TRANSFER_MAX_FILES", 1)
    def test_theme_transfer_package_rejects_too_many_files(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr("theme.json", "{}")
            package.writestr("assets/image.png", b"image")

        with self.assertRaisesMessage(ValueError, "Invalid theme transfer package"):
            restore_theme_transfer_package(
                base64.b64encode(buffer.getvalue()).decode(), self.theme, storage=MemoryStorage()
            )

    @patch("webpages.services.site_package.THEME_TRANSFER_MAX_TOTAL_SIZE", 6)
    def test_theme_transfer_package_rejects_excessive_total_size(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr("theme.json", "{}")
            package.writestr("assets/one.png", b"123")
            package.writestr("assets/two.png", b"456")

        with self.assertRaisesMessage(ValueError, "Invalid theme transfer package"):
            restore_theme_transfer_package(
                base64.b64encode(buffer.getvalue()).decode(), self.theme, storage=MemoryStorage()
            )

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

    def test_import_remaps_exported_page_and_version_ids_inside_json(self):
        child_version = PageVersion.objects.create(
            page=self.child,
            version_number=1,
            page_data={"title": "Child"},
            widgets={},
            created_by=self.user,
        )
        PageVersion.objects.create(
            page=self.root,
            version_number=1,
            effective_date=timezone.now() - timedelta(days=1),
            page_data={
                "featuredLink": {
                    "type": "internal",
                    "page_id": self.child.id,
                    "current_version_id": child_version.id,
                }
            },
            widgets={
                "main": [
                    {
                        "type": "Navigation",
                        "data": {
                            "menu_items": [
                                {
                                    "link_data": {
                                        "type": "internal",
                                        "label": "Child",
                                        "pageId": self.child.id,
                                        "currentVersionId": child_version.id,
                                    }
                                }
                            ]
                        },
                    }
                ]
            },
            created_by=self.user,
        )
        export_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_EXPORT,
            root_page=self.root,
            created_by=self.user,
            options={"include_media": False, "include_themes": False},
        )
        storage = MemoryStorage()
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
            SitePackageExporter(export_job, storage=storage).write_package(
                package, self.root, include_media=False, include_themes=False
            )
        buffer.seek(0)

        import_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={"tenant_id": str(self.tenant.id)},
        )
        with patch(
            "webpages.services.site_package._remap_structured_references",
            wraps=_remap_structured_references,
        ) as remap_references:
            with zipfile.ZipFile(buffer, "r") as package:
                imported_root = SitePackageImporter(import_job, storage=storage).import_package(package)

        self.assertTrue(remap_references.called)
        self.assertTrue(
            all(call.kwargs.get("version_map") for call in remap_references.call_args_list),
            "Structured references must only be remapped once all object maps are complete",
        )

        imported_child = imported_root.children.get(title="Child")
        imported_root_version = imported_root.versions.get(version_number=1)
        imported_child_version = imported_child.versions.get(version_number=1)
        imported_link = imported_root_version.widgets["main"][0]["data"]["menu_items"][0]["link_data"]

        self.assertNotEqual(imported_child.id, self.child.id)
        self.assertEqual(imported_root_version.page_data["featuredLink"]["page_id"], imported_child.id)
        self.assertEqual(
            imported_root_version.page_data["featuredLink"]["current_version_id"],
            imported_child_version.id,
        )
        self.assertEqual(imported_link["pageId"], imported_child.id)
        self.assertEqual(imported_link["currentVersionId"], imported_child_version.id)
        self.assertEqual(
            import_job.progress["object_maps"]["pages"][str(self.child.id)],
            imported_child.id,
        )

    def test_site_package_import_uses_destination_tenant_preview_namespace(self):
        destination_tenant = Tenant.objects.create(
            name="Destination tenant",
            identifier="site-package-destination",
            created_by=self.user,
        )
        destination_namespace = Namespace.objects.create(
            name="Destination namespace",
            slug="site-package-destination",
            tenant=destination_tenant,
            is_default=True,
            created_by=self.user,
        )
        theme_data = {
            "source_id": self.theme.id,
            "name": "Transferred theme",
            "image": "branding/hero.jpg",
            "designer_preview": {
                "views": [
                    {
                        "kind": "object",
                        "objectType": {
                            "key": "article",
                            "namespace": {"id": self.namespace.id, "slug": self.namespace.slug},
                            "schema": {"properties": {"related": {"field_type": "object_reference"}}},
                        },
                        "content": {
                            "data": {"related": [123]},
                            "imageUrl": f"https://source.test/theme_images/{self.theme.id}/library/hero.jpg",
                        },
                    }
                ]
            },
        }
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr(f"themes/{self.theme.id}.json", json.dumps(theme_data))
            package.writestr(f"themes/assets/{self.theme.id}/branding/hero.jpg", b"thumbnail")
            package.writestr(
                f"themes/assets/{self.theme.id}/theme_images/{self.theme.id}/library/hero.jpg",
                b"hero",
            )
        buffer.seek(0)
        import_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={"tenant_id": str(destination_tenant.id)},
        )

        storage = MemoryStorage()
        with zipfile.ZipFile(buffer, "r") as package:
            imported_theme = SitePackageImporter(import_job, storage=storage)._import_themes(package)[self.theme.id]

        namespace = imported_theme.designer_preview["views"][0]["objectType"]["namespace"]
        self.assertEqual(namespace["slug"], destination_namespace.slug)
        self.assertEqual(imported_theme.designer_preview["views"][0]["content"]["data"]["related"], [])
        self.assertEqual(
            imported_theme.designer_preview["views"][0]["content"]["imageUrl"],
            f"https://storage.test/theme_images/{imported_theme.id}/library/hero-2.jpg",
        )
        self.assertEqual(imported_theme.image.name, f"theme_images/{imported_theme.id}/library/hero.jpg")
        self.assertEqual(storage.files[imported_theme.image.name], b"thumbnail")
        self.assertEqual(storage.files[f"theme_images/{imported_theme.id}/library/hero-2.jpg"], b"hero")


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
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)
        self.root = WebPage.objects.create(
            title="Root",
            slug="root",
            hostnames=["www.Example.com:8000"],
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )

    def test_export_filename_uses_hostname_with_export_datetime_and_random_suffix(self):
        export_datetime = datetime(2026, 5, 24, 13, 14, 15, tzinfo=datetime_timezone.utc)
        filename = build_site_package_export_filename(
            self.root,
            random_part="abc123",
            export_datetime=export_datetime,
        )

        self.assertEqual(filename, "www.example.com-20260524-131415-abc123.zip")

    def test_export_filename_falls_back_to_root_title(self):
        self.root.hostnames = []
        self.root.title = "Summer Study 2026"
        self.root.save()

        export_datetime = datetime(2026, 5, 24, 13, 14, 15, tzinfo=datetime_timezone.utc)
        filename = build_site_package_export_filename(
            self.root,
            random_part="abc123",
            export_datetime=export_datetime,
        )

        self.assertEqual(filename, "summer-study-2026-20260524-131415-abc123.zip")

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
        self.assertRegex(
            job.object_key,
            r"^site-packages/exports/www\.example\.com-\d{8}-\d{6}-[0-9a-f]{8}\.zip$",
        )
        self.assertRegex(
            response.data["download_filename"],
            r"^www\.example\.com-\d{8}-\d{6}-[0-9a-f]{8}\.zip$",
        )
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

    def test_export_jobs_are_scoped_to_the_selected_tenant(self):
        other_tenant = Tenant.objects.create(
            name="Other site package tenant",
            identifier="other-site-package",
            created_by=self.user,
        )
        other_root = WebPage.objects.create(
            title="Other root",
            slug="other-root",
            tenant=other_tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        other_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_EXPORT,
            status=SitePackageJob.STATUS_COMPLETED,
            root_page=other_root,
            object_key="site-packages/exports/other.zip",
            created_by=self.user,
            expires_at=timezone.now() + timedelta(hours=1),
        )

        list_response = self.client.get("/api/v1/webpages/site-packages/exports/")
        download_response = self.client.get(f"/api/v1/webpages/site-packages/exports/{other_job.id}/download/")

        self.assertEqual(list_response.status_code, 200)
        self.assertNotIn(str(other_job.id), [str(job["id"]) for job in list_response.data])
        self.assertEqual(download_response.status_code, 404)

    def test_download_requires_completed_export(self):
        job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_EXPORT,
            status=SitePackageJob.STATUS_PENDING,
            root_page=self.root,
            created_by=self.user,
        )
        response = self.client.get(f"/api/v1/webpages/site-packages/exports/{job.id}/download/")
        self.assertEqual(response.status_code, 409)

    @patch("webpages.views.site_package_views.S3MediaStorage")
    def test_download_returns_hostname_based_filename(self, storage_class):
        storage = MemoryStorage()
        storage_class.return_value = storage
        job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_EXPORT,
            status=SitePackageJob.STATUS_COMPLETED,
            root_page=self.root,
            object_key="site-packages/exports/www.example.com-abc123.zip",
            created_by=self.user,
            expires_at=timezone.now() + timedelta(hours=1),
        )

        response = self.client.get(f"/api/v1/webpages/site-packages/exports/{job.id}/download/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["filename"], "www.example.com-abc123.zip")
        self.assertIn("www.example.com-abc123.zip", response.data["download_url"])

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
            options={"tenant_id": str(self.tenant.id)},
            expires_at=timezone.now() + timedelta(hours=1),
        )

        response = self.client.get("/api/v1/webpages/site-packages/imports/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["kind"], SitePackageJob.KIND_IMPORT)

    @patch("webpages.views.site_package_views.import_remote_site_package.delay")
    def test_start_remote_copy_job_uses_camel_case_contract(self, delay):
        connection = ThemeRemoteConnection.objects.create(
            tenant=self.tenant,
            name="Remote source",
            base_url="https://remote.example",
            remote_workspace="remote-workspace",
            encrypted_access_key="not-used-by-this-test",
            created_by=self.user,
            updated_by=self.user,
        )

        response = self.client.post(
            "/api/v1/webpages/site-packages/remote/imports/",
            {
                "connectionId": str(connection.id),
                "remoteSiteKey": str(self.root.stable_key),
                "mode": "copy",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["source"], "remote")
        self.assertEqual(response.data["mode"], "copy")
        self.assertEqual(response.data["remote_site_key"], str(self.root.stable_key))
        self.assertEqual(response.data["phase"], "queued")
        job = SitePackageJob.objects.get(id=response.data["id"])
        self.assertEqual(job.options["source"], "remote")
        self.assertEqual(job.options["connection_id"], str(connection.id))
        self.assertEqual(job.options["remote_site_key"], str(self.root.stable_key))
        delay.assert_called_once_with(str(job.id))

    @patch("webpages.views.site_package_views.import_remote_site_package.delay")
    @patch("webpages.views.site_package_views.remote_site_request")
    def test_soft_deleted_remote_copy_is_not_listed_or_updateable(self, remote_request, delay):
        connection = ThemeRemoteConnection.objects.create(
            tenant=self.tenant,
            name="Remote source",
            base_url="https://remote.example",
            remote_workspace="remote-workspace",
            encrypted_access_key="not-used-by-this-test",
            created_by=self.user,
            updated_by=self.user,
        )
        remote_key = self.root.stable_key
        RemoteSiteBinding.objects.create(
            tenant=self.tenant,
            connection=connection,
            remote_root_key=remote_key,
            local_root=self.root,
        )
        self.root.soft_delete(self.user, recursive=True)
        remote_request.return_value = {
            "results": [{"stableKey": str(remote_key), "title": "Remote site"}],
        }

        listed = self.client.post(
            "/api/v1/webpages/site-packages/remote/sites/",
            {"connectionId": str(connection.id)},
            format="json",
        )
        rejected = self.client.post(
            "/api/v1/webpages/site-packages/remote/imports/",
            {
                "connectionId": str(connection.id),
                "remoteSiteKey": str(remote_key),
                "mode": "update",
                "localRootId": self.root.id,
            },
            format="json",
        )

        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data["results"][0]["localCopies"], [])
        self.assertEqual(rejected.status_code, 400)
        self.assertIn("localRootId", rejected.data)
        delay.assert_not_called()

    def test_import_jobs_are_scoped_to_the_selected_tenant(self):
        other_tenant = Tenant.objects.create(
            name="Other import tenant",
            identifier="other-import-tenant",
            created_by=self.user,
        )
        other_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            status=SitePackageJob.STATUS_RUNNING,
            created_by=self.user,
            options={"tenant_id": str(other_tenant.id)},
            expires_at=timezone.now() + timedelta(hours=1),
        )

        response = self.client.get("/api/v1/webpages/site-packages/imports/")

        self.assertEqual(response.status_code, 200)
        self.assertNotIn(str(other_job.id), [str(job["id"]) for job in response.data])

    def test_remote_source_requires_explicit_site_transfer_capability(self):
        raw_key = "eceee_theme_site-package-test"
        access_key = ThemeRemoteAccessKey.objects.create(
            tenant=self.tenant,
            name="Scoped remote",
            key_hash=hashlib.sha256(raw_key.encode()).hexdigest(),
            key_prefix=raw_key[:12],
            created_by=self.user,
        )
        self.client.force_authenticate(user=None)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"ThemeKey {raw_key}",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )

        denied = self.client.get("/api/v1/webpages/site-packages/remote-source/sites/")
        self.assertEqual(denied.status_code, 403)

        access_key.capabilities = ["site.transfer"]
        access_key.save(update_fields=["capabilities"])
        allowed = self.client.get("/api/v1/webpages/site-packages/remote-source/sites/")
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(allowed.data["results"][0]["stableKey"], str(self.root.stable_key))

    @patch("webpages.views.site_package_views.export_site_package.delay")
    def test_remote_export_job_is_owned_by_the_exact_access_key(self, delay):
        first_raw_key = "eceee_theme_first-site-key"
        first_key = ThemeRemoteAccessKey.objects.create(
            tenant=self.tenant,
            name="First site key",
            key_hash=hashlib.sha256(first_raw_key.encode()).hexdigest(),
            key_prefix=first_raw_key[:12],
            capabilities=["site.transfer"],
            created_by=self.user,
        )
        second_raw_key = "eceee_theme_second-site-key"
        ThemeRemoteAccessKey.objects.create(
            tenant=self.tenant,
            name="Second site key",
            key_hash=hashlib.sha256(second_raw_key.encode()).hexdigest(),
            key_prefix=second_raw_key[:12],
            capabilities=["site.transfer"],
            created_by=self.user,
        )
        self.client.force_authenticate(user=None)
        self.client.credentials(
            HTTP_AUTHORIZATION=f"ThemeKey {first_raw_key}",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )
        created = self.client.post(
            "/api/v1/webpages/site-packages/remote-source/exports/",
            {"stableKey": str(self.root.stable_key)},
            format="json",
        )
        self.assertEqual(created.status_code, 202)
        job = SitePackageJob.objects.get(id=created.data["id"])
        self.assertEqual(job.options["remote_access_key_id"], str(first_key.id))

        self.client.credentials(
            HTTP_AUTHORIZATION=f"ThemeKey {second_raw_key}",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )
        denied = self.client.get(f"/api/v1/webpages/site-packages/remote-source/exports/{job.id}/")
        self.assertEqual(denied.status_code, 404)

        self.client.credentials(
            HTTP_AUTHORIZATION=f"ThemeKey {first_raw_key}",
            HTTP_X_TENANT_ID=self.tenant.identifier,
        )
        allowed = self.client.get(f"/api/v1/webpages/site-packages/remote-source/exports/{job.id}/")
        self.assertEqual(allowed.status_code, 200)
        delay.assert_called_once_with(str(job.id))
