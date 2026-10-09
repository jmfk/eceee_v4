import base64
import copy
import hashlib
import io
import json
import os
import tempfile
import uuid
import zipfile
from datetime import datetime, timedelta
from datetime import timezone as datetime_timezone
from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.test import TestCase
from django.utils import timezone
from django.utils.text import slugify
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
    _canonical_imported_layout,
    _package_layout_references,
    _remap_structured_references,
    _with_compatibility_layouts,
    build_site_package_export_filename,
    build_theme_transfer_package,
    inspect_site_package_upload,
    restore_theme_transfer_package,
)
from webpages.tasks import import_remote_site_package
from webpages.theme_layouts import default_theme_layouts


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
            file_hash=hashlib.sha256(b"hero-data").hexdigest(),
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
            widgets={
                "main": [
                    {
                        "type": "easy_widgets.ContentWidget",
                        "data": {"content": f"/media/{self.media.id}/hero.jpg"},
                    }
                ]
            },
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

    def test_legacy_error_layout_references_are_canonicalized(self):
        key, widgets = _canonical_imported_layout(
            "error_404",
            {
                "branding": [{"type": "easy_widgets.ImageWidget"}],
                "error_message": [{"type": "easy_widgets.HeadlineWidget"}],
                "helpful_content": [{"type": "easy_widgets.ContentWidget"}],
            },
        )

        self.assertEqual(key, "error_layout")
        self.assertEqual(set(widgets), {"visual", "message", "actions"})

    def test_imported_versions_enforce_layout_widget_policies(self):
        self.theme.layouts = default_theme_layouts()
        self.theme.save(update_fields=["layouts"])
        version = PageVersion.objects.create(
            page=self.root,
            version_number=1,
            layout_key="main_layout",
            code_layout="main_layout",
            theme=self.theme,
            widgets={
                "header": [
                    {"type": "easy_widgets.HeaderWidget"},
                    {"type": "easy_widgets.HeaderWidget"},
                ]
            },
            created_by=self.user,
        )

        with self.assertRaisesMessage(ValidationError, "allows at most 1 widgets"):
            SitePackageImporter._validate_imported_version_layout(version)

    def test_published_import_uses_the_published_parent_theme(self):
        theme_a_layouts = default_theme_layouts()
        theme_b_layouts = copy.deepcopy(theme_a_layouts)
        for item in theme_a_layouts["items"]:
            if item["key"] == "main_layout":
                item["slots"]["main"]["allowed_widget_types"] = ["easy_widgets.ContentWidget"]
                item["slots"]["main"].pop("disallowed_widget_types", None)
        for item in theme_b_layouts["items"]:
            if item["key"] == "main_layout":
                item["slots"]["main"]["allowed_widget_types"] = ["easy_widgets.HeaderWidget"]
                item["slots"]["main"].pop("disallowed_widget_types", None)
        self.theme.layouts = theme_a_layouts
        self.theme.save(update_fields=["layouts"])
        theme_b = PageTheme.objects.create(
            tenant=self.tenant,
            name="Draft parent theme",
            layouts=theme_b_layouts,
            created_by=self.user,
        )
        PageVersion.objects.create(
            page=self.root,
            version_number=1,
            layout_key="main_layout",
            theme=self.theme,
            effective_date=timezone.now() - timedelta(days=2),
            created_by=self.user,
        )
        PageVersion.objects.create(
            page=self.root,
            version_number=2,
            layout_key="main_layout",
            theme=theme_b,
            created_by=self.user,
        )
        child_version = PageVersion.objects.create(
            page=self.child,
            version_number=1,
            widgets={"main": [{"type": "easy_widgets.ContentWidget"}]},
            effective_date=timezone.now() - timedelta(days=1),
            created_by=self.user,
        )

        SitePackageImporter._validate_imported_version_layout(child_version)

    def test_legacy_theme_import_seeds_referenced_custom_layout_and_observed_slots(self):
        theme_data = {"source_id": self.theme.id, "name": "Legacy theme"}
        pages_payload = [
            {
                "versions": [
                    {
                        "theme_source_id": self.theme.id,
                        "code_layout": "article_layout",
                        "widgets": {"lead": [], "main": [{"type": "easy_widgets.ContentWidget"}]},
                    }
                ]
            }
        ]
        package_buffer = io.BytesIO()
        with zipfile.ZipFile(package_buffer, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr(f"themes/{self.theme.id}.json", json.dumps(theme_data))
        package_buffer.seek(0)
        import_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={"tenant_id": str(self.tenant.id)},
        )

        with zipfile.ZipFile(package_buffer, "r") as package:
            imported_theme = SitePackageImporter(import_job, storage=MemoryStorage())._import_themes(
                package, pages_payload
            )[self.theme.id]

        imported_layout = next(item for item in imported_theme.layouts["items"] if item["key"] == "article_layout")
        self.assertEqual(set(imported_layout["slots"]), {"lead", "main"})

    def test_legacy_unbound_layout_is_seeded_on_destination_default_theme(self):
        pages_payload = [
            {
                "versions": [
                    {
                        "theme_source_id": None,
                        "code_layout": "article_layout",
                        "widgets": {"main": [{"type": "easy_widgets.ContentWidget"}]},
                    }
                ]
            }
        ]
        package_buffer = io.BytesIO()
        with zipfile.ZipFile(package_buffer, "w", zipfile.ZIP_DEFLATED):
            pass
        package_buffer.seek(0)
        import_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={"tenant_id": str(self.tenant.id)},
        )

        with zipfile.ZipFile(package_buffer, "r") as package:
            SitePackageImporter(import_job, storage=MemoryStorage())._import_themes(package, pages_payload)

        default_theme = PageTheme.get_default_theme(tenant=self.tenant)
        imported_layout = next(item for item in default_theme.layouts["items"] if item["key"] == "article_layout")
        self.assertEqual(set(imported_layout["slots"]), {"main"})

    def test_legacy_inherited_layout_is_seeded_on_ancestor_theme(self):
        pages_payload = [
            {
                "source_id": 100,
                "parent_source_id": None,
                "versions": [{"theme_source_id": self.theme.id, "code_layout": "main_layout", "widgets": {}}],
            },
            {
                "source_id": 101,
                "parent_source_id": 100,
                "versions": [
                    {
                        "theme_source_id": None,
                        "code_layout": "article_layout",
                        "widgets": {"main": [{"type": "easy_widgets.ContentWidget"}]},
                    }
                ],
            },
        ]
        theme_data = {"source_id": self.theme.id, "name": "Inherited legacy theme"}
        package_buffer = io.BytesIO()
        with zipfile.ZipFile(package_buffer, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr(f"themes/{self.theme.id}.json", json.dumps(theme_data))
        package_buffer.seek(0)
        import_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={"tenant_id": str(self.tenant.id)},
        )

        with zipfile.ZipFile(package_buffer, "r") as package:
            imported_theme = SitePackageImporter(import_job, storage=MemoryStorage())._import_themes(
                package, pages_payload
            )[self.theme.id]

        imported_layout = next(item for item in imported_theme.layouts["items"] if item["key"] == "article_layout")
        self.assertEqual(set(imported_layout["slots"]), {"main"})

    def test_inherited_layout_collects_slots_from_child_content(self):
        pages_payload = [
            {
                "source_id": 100,
                "parent_source_id": None,
                "versions": [
                    {"theme_source_id": self.theme.id, "code_layout": "article_layout", "widgets": {"main": []}}
                ],
            },
            {
                "source_id": 101,
                "parent_source_id": 100,
                "versions": [{"theme_source_id": None, "code_layout": "", "widgets": {"sidebar": []}}],
            },
        ]
        references = _package_layout_references(pages_payload)

        self.assertEqual(references["by_theme"][str(self.theme.id)]["article_layout"], {"main", "sidebar"})

    def test_generated_compatibility_layout_expands_with_new_observed_slots(self):
        first = _with_compatibility_layouts(self.theme.layouts, {"article_layout": {"main"}})
        generated = next(item for item in first["items"] if item["key"] == "article_layout")
        generated["label"] = "Customized article"
        generated["root"]["styles"]["base"]["gap"] = "24px"
        expanded = _with_compatibility_layouts(first, {"article_layout": {"sidebar"}})

        layout = next(item for item in expanded["items"] if item["key"] == "article_layout")
        self.assertEqual(set(layout["slots"]), {"main", "sidebar"})
        self.assertEqual(layout["label"], "Customized article")
        self.assertEqual(layout["root"]["styles"]["base"]["gap"], "24px")

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
        self.assertEqual(local_root.versions.count(), initial_count + 2)
        imported_draft = local_root.versions.order_by("-version_number").first()
        theme_update = local_root.versions.get(version_number=2)
        self.assertIsNone(imported_draft.effective_date)
        self.assertEqual(imported_draft.page_data["heading"], "Remote draft")
        self.assertEqual(
            imported_draft.page_data["featuredLink"]["currentVersionId"],
            theme_update.id,
        )
        self.assertNotEqual(imported_draft.theme_id, original_local_theme_id)
        self.assertEqual(local_root.versions.get(version_number=1).theme_id, original_local_theme_id)
        self.assertTrue(WebPage.objects.filter(pk=local_only.pk).exists())
        self.assertIn("local_page_preserved", {item["code"] for item in update_job.progress["warnings"]})

        self.assertEqual(theme_update.page_data["heading"], "Published")
        self.assertEqual(theme_update.theme_id, imported_draft.theme_id)

        import_update()
        self.assertEqual(local_root.versions.count(), initial_count + 2)
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
            widgets={
                "main": [
                    {
                        "type": "easy_widgets.ContentWidget",
                        "data": {"content": f"/media/{self.media.id}/hero.jpg"},
                    }
                ]
            },
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

    def test_clone_import_names_the_new_root_and_reuses_soft_deleted_media(self):
        PageVersion.objects.create(
            page=self.root,
            version_number=1,
            page_data={},
            widgets={
                "main": [
                    {
                        "type": "easy_widgets.ContentWidget",
                        "data": {"content": f"/media/{self.media.id}/hero.jpg"},
                    }
                ]
            },
            created_by=self.user,
        )
        export_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_EXPORT,
            root_page=self.root,
            created_by=self.user,
            options={"include_media": True, "include_themes": False},
        )
        storage = MemoryStorage()
        storage.files[self.media.file_path] = b"hero-data"
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
            SitePackageExporter(export_job, storage=storage).write_package(
                package, self.root, include_media=True, include_themes=False
            )
        self.media.is_deleted = True
        self.media.deleted_at = timezone.now()
        self.media.deleted_by = self.user
        self.media.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])

        import_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "mode": "clone",
                "source_root_key": str(self.root.stable_key),
            },
        )
        buffer.seek(0)
        with zipfile.ZipFile(buffer, "r") as package:
            imported_root = SitePackageImporter(import_job, storage=storage).import_package(package)

        self.assertEqual(imported_root.title, "Root (clone)")
        revived_media = MediaFile.objects.get(file_hash=self.media.file_hash)
        self.assertFalse(revived_media.is_deleted)
        self.assertEqual(MediaFile.objects.with_deleted().filter(file_hash=self.media.file_hash).count(), 1)

    def test_zip_update_keeps_the_existing_root_without_duplicating_identical_versions(self):
        self.theme.image.name = "theme_images/source/preview.png"
        self.theme.site_icon.name = "theme_images/source/favicon.png"
        self.theme.save(update_fields=["image", "site_icon", "updated_at"])
        PageVersion.objects.create(
            page=self.root,
            version_number=1,
            page_data={"heading": "Package heading"},
            widgets={},
            theme=self.theme,
            created_by=self.user,
        )
        export_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_EXPORT,
            root_page=self.root,
            created_by=self.user,
            options={"include_media": False, "include_themes": True},
        )
        storage = MemoryStorage()
        storage.files[self.theme.image.name] = b"preview"
        storage.files[self.theme.site_icon.name] = b"favicon"
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
            SitePackageExporter(export_job, storage=storage).write_package(
                package, self.root, include_media=False, include_themes=True
            )

        import_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "mode": "update",
                "local_root_id": self.root.id,
                "source_root_key": str(self.root.stable_key),
            },
        )
        buffer.seek(0)
        with zipfile.ZipFile(buffer, "r") as package:
            updated_root = SitePackageImporter(import_job, storage=storage).import_package(package)

        self.assertEqual(updated_root.id, self.root.id)
        self.assertEqual(updated_root.versions.count(), 1)
        self.assertEqual(PageTheme.objects.filter(tenant=self.tenant).count(), 1)
        self.assertEqual(import_job.progress["binding"]["local_root_id"], self.root.id)

    def test_zip_update_creates_a_version_when_only_the_theme_changes(self):
        source_version = PageVersion.objects.create(
            page=self.root,
            version_number=1,
            effective_date=timezone.now() - timedelta(hours=1),
            page_data={"heading": "Same content"},
            widgets={},
            theme=self.theme,
            created_by=self.user,
        )
        storage = MemoryStorage()

        def package_bytes():
            export_job = SitePackageJob.objects.create(
                kind=SitePackageJob.KIND_EXPORT,
                root_page=self.root,
                created_by=self.user,
                options={"include_media": False, "include_themes": True},
            )
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
                SitePackageExporter(export_job, storage=storage).write_package(
                    package, self.root, include_media=False, include_themes=True
                )
            return buffer.getvalue()

        first_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "mode": "create",
                "source_root_key": str(self.root.stable_key),
            },
        )
        with zipfile.ZipFile(io.BytesIO(package_bytes()), "r") as package:
            imported_root = SitePackageImporter(first_job, storage=storage).import_package(package)
        first_job.status = SitePackageJob.STATUS_COMPLETED
        first_job.imported_root_page = imported_root
        first_job.save(update_fields=["status", "imported_root_page", "updated_at"])
        original_theme_id = imported_root.versions.get().theme_id

        replacement_expiry = timezone.now() + timedelta(days=1)
        source_version.expiry_date = replacement_expiry
        source_version.save(update_fields=["expiry_date", "updated_at"])
        self.theme.colors = {"brand": "#123456"}
        self.theme.save(update_fields=["colors", "updated_at"])
        update_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "mode": "update",
                "local_root_id": imported_root.id,
                "source_root_key": str(self.root.stable_key),
                "source_binding_job_id": str(first_job.id),
            },
        )
        with zipfile.ZipFile(io.BytesIO(package_bytes()), "r") as package:
            SitePackageImporter(update_job, storage=storage).import_package(package)

        self.assertEqual(imported_root.versions.count(), 2)
        original_version = imported_root.versions.order_by("version_number").first()
        latest = imported_root.versions.order_by("-version_number").first()
        original_version.refresh_from_db()
        self.assertLessEqual(original_version.expiry_date, timezone.now())
        self.assertNotEqual(latest.theme_id, original_theme_id)
        self.assertEqual(latest.theme.colors, {"brand": "#123456"})
        self.assertIsNone(imported_root.get_current_published_version(now=replacement_expiry + timedelta(seconds=1)))

    def test_zip_update_imports_a_revert_to_previously_seen_content(self):
        stable_key = str(self.root.stable_key)

        def package_bytes(heading):
            version_data = {
                "source_id": 501,
                "version_number": 1,
                "page_data": {"heading": heading},
                "widgets": {},
            }
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
                package.writestr(
                    "manifest.json",
                    json.dumps({"package_version": "2.0", "source": {"root_stable_key": stable_key}}),
                )
                package.writestr(
                    "pages.json",
                    json.dumps(
                        {
                            "pages": [
                                {
                                    "source_id": 101,
                                    "stable_key": stable_key,
                                    "parent_source_id": None,
                                    "title": "Revert site",
                                    "slug": "revert-site",
                                    "versions": [version_data],
                                }
                            ]
                        }
                    ),
                )
            return buffer.getvalue()

        previous_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={"tenant_id": str(self.tenant.id), "mode": "create", "source_root_key": stable_key},
        )
        with zipfile.ZipFile(io.BytesIO(package_bytes("A")), "r") as package:
            imported_root = SitePackageImporter(previous_job, storage=MemoryStorage()).import_package(package)
        previous_job.status = SitePackageJob.STATUS_COMPLETED
        previous_job.imported_root_page = imported_root
        previous_job.save(update_fields=["status", "imported_root_page", "updated_at"])

        for heading in ("B", "A"):
            update_job = SitePackageJob.objects.create(
                kind=SitePackageJob.KIND_IMPORT,
                created_by=self.user,
                options={
                    "tenant_id": str(self.tenant.id),
                    "mode": "update",
                    "local_root_id": imported_root.id,
                    "source_root_key": stable_key,
                    "source_binding_job_id": str(previous_job.id),
                },
            )
            with zipfile.ZipFile(io.BytesIO(package_bytes(heading)), "r") as package:
                SitePackageImporter(update_job, storage=MemoryStorage()).import_package(package)
            update_job.status = SitePackageJob.STATUS_COMPLETED
            update_job.imported_root_page = imported_root
            update_job.save(update_fields=["status", "imported_root_page", "updated_at"])
            previous_job = update_job

        self.assertEqual(imported_root.versions.count(), 3)
        self.assertEqual(
            list(imported_root.versions.order_by("version_number").values_list("page_data__heading", flat=True)),
            ["A", "B", "A"],
        )

    def test_zip_update_preserves_imported_publication_status(self):
        effective_date = timezone.now() - timedelta(hours=1)
        page_stable_key = str(self.root.stable_key)
        version_data = {
            "source_id": 501,
            "version_number": 1,
            "version_title": "Published import",
            "page_data": {"heading": "Updated"},
            "widgets": {},
            "effective_date": effective_date.isoformat(),
            "expiry_date": None,
        }
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr(
                "manifest.json",
                json.dumps(
                    {
                        "package_version": "2.0",
                        "source": {"root_stable_key": page_stable_key},
                    }
                ),
            )
            package.writestr(
                "pages.json",
                json.dumps(
                    {
                        "pages": [
                            {
                                "source_id": 101,
                                "stable_key": page_stable_key,
                                "parent_source_id": None,
                                "title": self.root.title,
                                "slug": self.root.slug,
                                "versions": [version_data],
                            }
                        ]
                    }
                ),
            )

        import_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "mode": "update",
                "local_root_id": self.root.id,
                "source_root_key": page_stable_key,
                "preserve_publication_status": True,
            },
        )
        buffer.seek(0)
        with zipfile.ZipFile(buffer, "r") as package:
            SitePackageImporter(import_job, storage=MemoryStorage()).import_package(package)

        imported_version = self.root.versions.get()
        self.root.refresh_from_db()
        self.assertEqual(imported_version.effective_date, effective_date)
        self.assertEqual(self.root.current_published_version_id, imported_version.id)

    def test_zip_update_reconciles_publication_only_changes(self):
        stable_key = str(self.root.stable_key)

        def package_bytes(effective_date=None, expiry_date=None):
            version_data = {
                "source_id": 501,
                "version_number": 1,
                "version_title": "Publication sync",
                "page_data": {"heading": "Unchanged"},
                "widgets": {},
                "effective_date": effective_date.isoformat() if effective_date else None,
                "expiry_date": expiry_date.isoformat() if expiry_date else None,
            }
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
                package.writestr(
                    "manifest.json",
                    json.dumps({"package_version": "2.0", "source": {"root_stable_key": stable_key}}),
                )
                package.writestr(
                    "pages.json",
                    json.dumps(
                        {
                            "pages": [
                                {
                                    "source_id": 101,
                                    "stable_key": stable_key,
                                    "parent_source_id": None,
                                    "title": self.root.title,
                                    "slug": self.root.slug,
                                    "versions": [version_data],
                                }
                            ]
                        }
                    ),
                )
            return buffer.getvalue()

        first_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={"tenant_id": str(self.tenant.id), "mode": "create", "source_root_key": stable_key},
        )
        with zipfile.ZipFile(io.BytesIO(package_bytes()), "r") as package:
            imported_root = SitePackageImporter(first_job, storage=MemoryStorage()).import_package(package)
        first_job.status = SitePackageJob.STATUS_COMPLETED
        first_job.imported_root_page = imported_root
        first_job.save(update_fields=["status", "imported_root_page", "updated_at"])

        effective_date = timezone.now() - timedelta(hours=1)
        publish_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "mode": "update",
                "local_root_id": imported_root.id,
                "source_root_key": stable_key,
                "source_binding_job_id": str(first_job.id),
                "preserve_publication_status": True,
            },
        )
        with zipfile.ZipFile(io.BytesIO(package_bytes(effective_date=effective_date)), "r") as package:
            SitePackageImporter(publish_job, storage=MemoryStorage()).import_package(package)

        published_version = imported_root.versions.get()
        imported_root.refresh_from_db()
        self.assertEqual(published_version.effective_date, effective_date)
        self.assertEqual(imported_root.current_published_version_id, published_version.id)

        publish_job.status = SitePackageJob.STATUS_COMPLETED
        publish_job.save(update_fields=["status", "updated_at"])
        expiry_date = timezone.now() + timedelta(days=1)
        expiry_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "mode": "update",
                "local_root_id": imported_root.id,
                "source_root_key": stable_key,
                "source_binding_job_id": str(publish_job.id),
                "preserve_publication_status": True,
            },
        )
        with zipfile.ZipFile(
            io.BytesIO(package_bytes(effective_date=effective_date, expiry_date=expiry_date)), "r"
        ) as package:
            SitePackageImporter(expiry_job, storage=MemoryStorage()).import_package(package)

        imported_root.refresh_from_db()
        published_version.refresh_from_db()
        self.assertEqual(imported_root.versions.count(), 1)
        self.assertEqual(published_version.expiry_date, expiry_date)
        self.assertIsNone(imported_root.get_current_published_version(now=expiry_date + timedelta(seconds=1)))

    def test_zip_update_expires_the_prior_publication_for_a_new_source_version(self):
        stable_key = str(self.root.stable_key)

        def package_bytes(source_version_id, heading, effective_date, expiry_date=None):
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
                package.writestr(
                    "manifest.json",
                    json.dumps({"package_version": "2.0", "source": {"root_stable_key": stable_key}}),
                )
                package.writestr(
                    "pages.json",
                    json.dumps(
                        {
                            "pages": [
                                {
                                    "source_id": 101,
                                    "stable_key": stable_key,
                                    "parent_source_id": None,
                                    "title": "Publication replacement",
                                    "slug": "publication-replacement",
                                    "versions": [
                                        {
                                            "source_id": source_version_id,
                                            "source_page_id": 101,
                                            "version_number": source_version_id,
                                            "page_data": {"heading": heading},
                                            "widgets": {},
                                            "effective_date": effective_date.isoformat(),
                                            "expiry_date": expiry_date.isoformat() if expiry_date else None,
                                        }
                                    ],
                                }
                            ]
                        }
                    ),
                )
            return buffer.getvalue()

        first_effective = timezone.now() - timedelta(days=2)
        first_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "mode": "create",
                "source_root_key": stable_key,
                "preserve_publication_status": True,
            },
        )
        with zipfile.ZipFile(io.BytesIO(package_bytes(501, "First", first_effective)), "r") as package:
            imported_root = SitePackageImporter(first_job, storage=MemoryStorage()).import_package(package)
        first_job.status = SitePackageJob.STATUS_COMPLETED
        first_job.imported_root_page = imported_root
        first_job.save(update_fields=["status", "imported_root_page", "updated_at"])
        first_version = imported_root.versions.get()

        replacement_effective = timezone.now() - timedelta(hours=1)
        replacement_expiry = timezone.now() + timedelta(days=1)
        update_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "mode": "update",
                "local_root_id": imported_root.id,
                "source_root_key": stable_key,
                "source_binding_job_id": str(first_job.id),
                "preserve_publication_status": True,
            },
        )
        with zipfile.ZipFile(
            io.BytesIO(package_bytes(502, "Replacement", replacement_effective, replacement_expiry)), "r"
        ) as package:
            SitePackageImporter(update_job, storage=MemoryStorage()).import_package(package)

        first_version.refresh_from_db()
        self.assertLessEqual(first_version.expiry_date, timezone.now())
        self.assertEqual(imported_root.versions.count(), 2)
        self.assertIsNone(imported_root.get_current_published_version(now=replacement_expiry + timedelta(seconds=1)))

    def test_repeated_v1_update_reuses_the_existing_child_tree(self):
        package_bytes = io.BytesIO()
        with zipfile.ZipFile(package_bytes, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr("manifest.json", json.dumps({"package_version": "1.0"}))
            package.writestr(
                "pages.json",
                json.dumps(
                    {
                        "pages": [
                            {
                                "source_id": 101,
                                "parent_source_id": None,
                                "title": "Legacy root",
                                "slug": "legacy-root",
                                "versions": [],
                            },
                            {
                                "source_id": 102,
                                "parent_source_id": 101,
                                "title": "Legacy child",
                                "slug": "legacy-child",
                                "versions": [],
                            },
                        ]
                    }
                ),
            )
        raw_package = package_bytes.getvalue()
        package_hash = inspect_site_package_upload(ContentFile(raw_package, name="legacy.zip"))["package_hash"]
        first_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "mode": "create",
                "source_root_key": "",
                "source_package_hash": package_hash,
            },
        )
        with zipfile.ZipFile(io.BytesIO(raw_package), "r") as package:
            imported_root = SitePackageImporter(first_job, storage=MemoryStorage()).import_package(package)
        first_job.status = SitePackageJob.STATUS_COMPLETED
        first_job.imported_root_page = imported_root
        first_job.save(update_fields=["status", "imported_root_page", "updated_at"])

        update_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "mode": "update",
                "local_root_id": imported_root.id,
                "source_root_key": "",
                "source_package_hash": package_hash,
                "source_binding_job_id": str(first_job.id),
            },
        )
        with zipfile.ZipFile(io.BytesIO(raw_package), "r") as package:
            SitePackageImporter(update_job, storage=MemoryStorage()).import_package(package)

        self.assertEqual(imported_root.children.filter(is_deleted=False).count(), 1)

    def test_zip_update_recreates_deleted_child_versions_and_remaps_links(self):
        root_key = str(self.root.stable_key)
        child_key = str(self.child.stable_key)
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr(
                "manifest.json",
                json.dumps({"package_version": "2.0", "source": {"root_stable_key": root_key}}),
            )
            package.writestr(
                "pages.json",
                json.dumps(
                    {
                        "pages": [
                            {
                                "source_id": 101,
                                "stable_key": root_key,
                                "parent_source_id": None,
                                "title": "Imported root",
                                "slug": "imported-root",
                                "versions": [
                                    {
                                        "source_id": 501,
                                        "source_page_id": 101,
                                        "version_number": 1,
                                        "page_data": {"pageId": 102},
                                        "widgets": {},
                                    }
                                ],
                            },
                            {
                                "source_id": 102,
                                "stable_key": child_key,
                                "parent_source_id": 101,
                                "title": "Imported child",
                                "slug": "imported-child",
                                "versions": [
                                    {
                                        "source_id": 502,
                                        "source_page_id": 102,
                                        "version_number": 1,
                                        "page_data": {"heading": "Child"},
                                        "widgets": {},
                                    }
                                ],
                            },
                        ]
                    }
                ),
            )
        raw_package = buffer.getvalue()
        first_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={"tenant_id": str(self.tenant.id), "mode": "create", "source_root_key": root_key},
        )
        with zipfile.ZipFile(io.BytesIO(raw_package), "r") as package:
            imported_root = SitePackageImporter(first_job, storage=MemoryStorage()).import_package(package)
        first_job.status = SitePackageJob.STATUS_COMPLETED
        first_job.imported_root_page = imported_root
        first_job.save(update_fields=["status", "imported_root_page", "updated_at"])
        deleted_child = imported_root.children.get(is_deleted=False)
        deleted_child.soft_delete(self.user)

        update_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "mode": "update",
                "local_root_id": imported_root.id,
                "source_root_key": root_key,
                "source_binding_job_id": str(first_job.id),
            },
        )
        with zipfile.ZipFile(io.BytesIO(raw_package), "r") as package:
            SitePackageImporter(update_job, storage=MemoryStorage()).import_package(package)

        recreated_child = imported_root.children.get(is_deleted=False)
        self.assertNotEqual(recreated_child.id, deleted_child.id)
        self.assertEqual(recreated_child.versions.count(), 1)
        self.assertEqual(imported_root.versions.count(), 2)
        self.assertEqual(
            imported_root.versions.order_by("-version_number").first().page_data["pageId"],
            recreated_child.id,
        )

    def test_zip_update_uses_the_latest_persisted_binding(self):
        stable_key = str(self.root.stable_key)
        PageVersion.objects.create(
            page=self.root,
            version_number=1,
            page_data={"heading": "Already imported"},
            widgets={},
            created_by=self.user,
        )
        version_data = {
            "source_id": 501,
            "version_number": 1,
            "page_data": {"heading": "Already imported"},
            "widgets": {},
            "content_fingerprint": "latest-fingerprint",
        }
        old_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            status=SitePackageJob.STATUS_COMPLETED,
            imported_root_page=self.root,
            created_by=self.user,
            options={"tenant_id": str(self.tenant.id), "source_root_key": stable_key},
            progress={
                "binding": {
                    "page_map": {stable_key: self.root.id},
                    "version_fingerprints": {stable_key: []},
                }
            },
        )
        SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            status=SitePackageJob.STATUS_RUNNING,
            imported_root_page=self.root,
            created_by=self.user,
            options={"tenant_id": str(self.tenant.id), "source_root_key": stable_key},
            progress={
                "binding": {
                    "page_map": {stable_key: self.root.id},
                    "version_fingerprints": {stable_key: ["latest-fingerprint"]},
                }
            },
        )
        update_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "mode": "update",
                "local_root_id": self.root.id,
                "source_root_key": stable_key,
                "source_binding_job_id": str(old_job.id),
            },
        )
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr(
                "manifest.json",
                json.dumps({"package_version": "2.0", "source": {"root_stable_key": stable_key}}),
            )
            package.writestr(
                "pages.json",
                json.dumps(
                    {
                        "pages": [
                            {
                                "source_id": 101,
                                "stable_key": stable_key,
                                "parent_source_id": None,
                                "title": self.root.title,
                                "slug": self.root.slug,
                                "versions": [version_data],
                            }
                        ]
                    }
                ),
            )
        buffer.seek(0)
        with zipfile.ZipFile(buffer, "r") as package:
            SitePackageImporter(update_job, storage=MemoryStorage()).import_package(package)

        self.assertEqual(self.root.versions.count(), 1)

    def test_missing_package_bytes_do_not_revive_soft_deleted_media(self):
        self.media.is_deleted = True
        self.media.deleted_at = timezone.now()
        self.media.deleted_by = self.user
        self.media.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr("manifest.json", json.dumps({"package_version": "2.0"}))
            package.writestr(
                "pages.json",
                json.dumps(
                    {
                        "pages": [
                            {
                                "source_id": 101,
                                "parent_source_id": None,
                                "title": "Media import",
                                "slug": "media-import",
                                "versions": [],
                            }
                        ]
                    }
                ),
            )
            package.writestr(
                "media/manifest.json",
                json.dumps(
                    {
                        "files": [
                            {
                                "source_id": str(self.media.id),
                                "file_hash": self.media.file_hash,
                                "original_filename": self.media.original_filename,
                            }
                        ]
                    }
                ),
            )
        import_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={"tenant_id": str(self.tenant.id), "mode": "create"},
        )
        buffer.seek(0)
        with zipfile.ZipFile(buffer, "r") as package:
            SitePackageImporter(import_job, storage=MemoryStorage()).import_package(package)

        self.media.refresh_from_db()
        self.assertTrue(self.media.is_deleted)

    def test_media_members_are_spooled_instead_of_loaded_as_bytes(self):
        class StreamingAssertionStorage(MemoryStorage):
            received_spooled_file = False

            def _save(self, name, content):
                self.received_spooled_file = isinstance(getattr(content, "file", None), tempfile.SpooledTemporaryFile)
                return super()._save(name, content)

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr("manifest.json", json.dumps({"package_version": "2.0"}))
            package.writestr(
                "pages.json",
                json.dumps(
                    {
                        "pages": [
                            {
                                "source_id": 101,
                                "parent_source_id": None,
                                "title": "Media stream",
                                "slug": "media-stream",
                                "versions": [],
                            }
                        ]
                    }
                ),
            )
            package.writestr(
                "media/manifest.json",
                json.dumps(
                    {
                        "files": [
                            {
                                "source_id": "new-media",
                                "file_hash": hashlib.sha256(b"x" * 1024).hexdigest(),
                                "original_filename": "streamed.bin",
                                "file_size": 1024,
                            }
                        ]
                    }
                ),
            )
            package.writestr("media/files/new-media/streamed.bin", b"x" * 1024)
        storage = StreamingAssertionStorage()
        import_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={"tenant_id": str(self.tenant.id), "mode": "create"},
        )
        buffer.seek(0)
        with zipfile.ZipFile(buffer, "r") as package:
            SitePackageImporter(import_job, storage=storage).import_package(package)

        self.assertTrue(storage.received_spooled_file)

    def test_media_hash_mismatch_does_not_revive_or_overwrite_a_deleted_file(self):
        self.media.is_deleted = True
        self.media.deleted_at = timezone.now()
        self.media.deleted_by = self.user
        self.media.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])
        storage = MemoryStorage()
        storage.files[self.media.file_path] = b"original"
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr("manifest.json", json.dumps({"package_version": "2.0"}))
            package.writestr(
                "pages.json",
                json.dumps(
                    {
                        "pages": [
                            {
                                "source_id": 101,
                                "parent_source_id": None,
                                "title": "Media import",
                                "slug": "media-import",
                                "versions": [],
                            }
                        ]
                    }
                ),
            )
            package.writestr(
                "media/manifest.json",
                json.dumps(
                    {
                        "files": [
                            {
                                "source_id": str(self.media.id),
                                "file_hash": self.media.file_hash,
                                "original_filename": self.media.original_filename,
                            }
                        ]
                    }
                ),
            )
            package.writestr(f"media/files/{self.media.id}/hero.jpg", b"tampered")
        import_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={"tenant_id": str(self.tenant.id), "mode": "create"},
        )

        buffer.seek(0)
        with zipfile.ZipFile(buffer, "r") as package:
            with self.assertRaisesMessage(ValueError, "SHA-256"):
                SitePackageImporter(import_job, storage=storage).import_package(package)

        self.media.refresh_from_db()
        self.assertTrue(self.media.is_deleted)
        self.assertEqual(storage.files[self.media.file_path], b"original")

    def test_zip_update_replaces_a_version_when_referenced_media_changes(self):
        stable_key = str(self.root.stable_key)
        media_source_id = str(uuid.uuid4())

        def package_bytes(content):
            file_hash = hashlib.sha256(content).hexdigest()
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
                package.writestr(
                    "manifest.json",
                    json.dumps({"package_version": "2.0", "source": {"root_stable_key": stable_key}}),
                )
                package.writestr(
                    "pages.json",
                    json.dumps(
                        {
                            "pages": [
                                {
                                    "source_id": 101,
                                    "stable_key": stable_key,
                                    "parent_source_id": None,
                                    "title": "Media dependency",
                                    "slug": "media-dependency",
                                    "versions": [
                                        {
                                            "source_id": 501,
                                            "version_number": 1,
                                            "page_data": {"imageId": media_source_id},
                                            "widgets": {},
                                        }
                                    ],
                                }
                            ]
                        }
                    ),
                )
                package.writestr(
                    "media/manifest.json",
                    json.dumps(
                        {
                            "files": [
                                {
                                    "source_id": media_source_id,
                                    "file_hash": file_hash,
                                    "original_filename": "dependency.bin",
                                }
                            ]
                        }
                    ),
                )
                package.writestr(f"media/files/{media_source_id}/dependency.bin", content)
            return buffer.getvalue(), file_hash

        first_package, first_hash = package_bytes(b"first")
        first_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={"tenant_id": str(self.tenant.id), "mode": "create", "source_root_key": stable_key},
        )
        with zipfile.ZipFile(io.BytesIO(first_package), "r") as package:
            imported_root = SitePackageImporter(first_job, storage=MemoryStorage()).import_package(package)
        first_job.status = SitePackageJob.STATUS_COMPLETED
        first_job.imported_root_page = imported_root
        first_job.save(update_fields=["status", "imported_root_page", "updated_at"])

        second_package, second_hash = package_bytes(b"second")
        update_job = SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "mode": "update",
                "local_root_id": imported_root.id,
                "source_root_key": stable_key,
                "source_binding_job_id": str(first_job.id),
            },
        )
        with zipfile.ZipFile(io.BytesIO(second_package), "r") as package:
            SitePackageImporter(update_job, storage=MemoryStorage()).import_package(package)

        self.assertEqual(imported_root.versions.count(), 2)
        first_media_id = imported_root.versions.get(version_number=1).page_data["imageId"]
        latest_media_id = imported_root.versions.get(version_number=2).page_data["imageId"]
        self.assertNotEqual(first_media_id, latest_media_id)
        self.assertEqual(MediaFile.objects.get(id=first_media_id).file_hash, first_hash)
        self.assertEqual(MediaFile.objects.get(id=latest_media_id).file_hash, second_hash)

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

    def site_package_upload(self, *, stable_key=None, source_id=900, title="Imported Site"):
        stable_key = stable_key or uuid.uuid4()
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr(
                "manifest.json",
                json.dumps(
                    {
                        "package_version": "2.0",
                        "kind": "site-root-tree",
                        "source": {
                            "root_stable_key": str(stable_key),
                            "root_title": title,
                            "root_slug": "imported-site",
                        },
                    }
                ),
            )
            package.writestr(
                "pages.json",
                json.dumps(
                    {
                        "pages": [
                            {
                                "source_id": source_id,
                                "stable_key": str(stable_key),
                                "parent_source_id": None,
                                "title": title,
                                "slug": "imported-site",
                                "versions": [],
                            }
                        ]
                    }
                ),
            )
        return ContentFile(buffer.getvalue(), name="site.zip")

    def legacy_site_package_bytes(self, *, source_id=101, title="Legacy Site", children=()):
        pages = [
            {
                "source_id": source_id,
                "parent_source_id": None,
                "title": title,
                "slug": slugify(title),
                "versions": [],
            }
        ]
        pages.extend(
            {
                "source_id": child_id,
                "parent_source_id": source_id,
                "title": child_title,
                "slug": slugify(child_title),
                "versions": [],
            }
            for child_id, child_title in children
        )
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
            package.writestr("manifest.json", json.dumps({"package_version": "1.0", "kind": "site-root-tree"}))
            package.writestr("pages.json", json.dumps({"pages": pages}))
        return buffer.getvalue()

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

        self.assertEqual(response.status_code, 202, response.data)
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
        upload = self.site_package_upload()
        response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {"site_zip": upload, "preservePublicationStatus": "true"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 202, response.data)
        job = SitePackageJob.objects.get(id=response.data["id"])
        self.assertEqual(job.kind, SitePackageJob.KIND_IMPORT)
        self.assertEqual(job.options["mode"], "create")
        self.assertTrue(job.options["source_root_key"])
        self.assertIn(str(job.id), job.object_key)
        delay.assert_called_once_with(str(job.id))

    @patch("webpages.views.site_package_views.import_site_package.delay")
    @patch("webpages.views.site_package_views.S3MediaStorage")
    def test_import_accepts_the_legacy_snake_case_publication_option(self, storage_class, delay):
        storage_class.return_value = MemoryStorage()

        response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {"site_zip": self.site_package_upload(), "preserve_publication_status": "false"},
            format="multipart",
        )

        self.assertEqual(response.status_code, 202)
        job = SitePackageJob.objects.get(id=response.data["id"])
        self.assertFalse(job.options["preserve_publication_status"])
        delay.assert_called_once_with(str(job.id))

    @patch("webpages.views.site_package_views.import_site_package.delay")
    @patch("webpages.views.site_package_views.S3MediaStorage")
    def test_import_rejects_conflicting_publication_options(self, storage_class, delay):
        storage_class.return_value = MemoryStorage()

        response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {
                "site_zip": self.site_package_upload(),
                "preserve_publication_status": "false",
                "preservePublicationStatus": "true",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        delay.assert_not_called()

    @patch("webpages.services.site_package.SITE_PACKAGE_MAX_IDENTITY_FILE_SIZE", 128)
    @patch("webpages.views.site_package_views.import_site_package.delay")
    @patch("webpages.views.site_package_views.S3MediaStorage")
    def test_import_rejects_oversized_identity_documents(self, storage_class, delay):
        storage_class.return_value = MemoryStorage()
        upload = self.site_package_upload(title="X" * 256)

        response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {"site_zip": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        delay.assert_not_called()

    @patch("webpages.views.site_package_views.import_site_package.delay")
    @patch("webpages.views.site_package_views.S3MediaStorage")
    def test_import_rejects_an_invalid_root_stable_key(self, storage_class, delay):
        storage_class.return_value = MemoryStorage()

        response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {"site_zip": self.site_package_upload(stable_key="not-a-uuid")},
            format="multipart",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(SitePackageJob.objects.filter(kind=SitePackageJob.KIND_IMPORT).exists())
        delay.assert_not_called()

    @patch("webpages.views.site_package_views.import_site_package.delay")
    @patch("webpages.views.site_package_views.S3MediaStorage")
    def test_import_rejects_inconsistent_or_reordered_roots(self, storage_class, delay):
        storage_class.return_value = MemoryStorage()
        root_key = uuid.uuid4()
        child_key = uuid.uuid4()

        def upload(pages, manifest_key=root_key):
            buffer = io.BytesIO()
            with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as package:
                package.writestr(
                    "manifest.json",
                    json.dumps(
                        {
                            "package_version": "2.0",
                            "source": {"root_stable_key": str(manifest_key)},
                        }
                    ),
                )
                package.writestr("pages.json", json.dumps({"pages": pages}))
            return ContentFile(buffer.getvalue(), name="invalid-root.zip")

        root = {
            "source_id": 1,
            "stable_key": str(root_key),
            "parent_source_id": None,
            "title": "Root",
            "slug": "root",
            "versions": [],
        }
        child = {
            "source_id": 2,
            "stable_key": str(child_key),
            "parent_source_id": 1,
            "title": "Child",
            "slug": "child",
            "versions": [],
        }

        reordered_response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {"site_zip": upload([child, root])},
            format="multipart",
        )
        mismatched_root = {**root, "stable_key": str(uuid.uuid4())}
        mismatched_response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {"site_zip": upload([mismatched_root, child])},
            format="multipart",
        )
        duplicate_child_key = uuid.uuid4()
        duplicate_lineage_response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {
                "site_zip": upload(
                    [
                        root,
                        {**child, "stable_key": str(duplicate_child_key)},
                        {
                            **child,
                            "source_id": 3,
                            "stable_key": str(duplicate_child_key),
                            "slug": "second-child",
                        },
                    ]
                )
            },
            format="multipart",
        )
        mixed_id_response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {"site_zip": upload([root, {**child, "parent_source_id": "1"}])},
            format="multipart",
        )
        zero_id_response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {
                "site_zip": upload(
                    [
                        {**root, "source_id": 0},
                        {**child, "parent_source_id": 0},
                    ]
                )
            },
            format="multipart",
        )

        self.assertEqual(reordered_response.status_code, 400)
        self.assertEqual(mismatched_response.status_code, 400)
        self.assertEqual(duplicate_lineage_response.status_code, 400)
        self.assertEqual(mixed_id_response.status_code, 400)
        self.assertEqual(zero_id_response.status_code, 400)
        self.assertFalse(SitePackageJob.objects.filter(kind=SitePackageJob.KIND_IMPORT).exists())
        delay.assert_not_called()

    @patch("webpages.views.site_package_views.import_site_package.delay")
    @patch("webpages.views.site_package_views.S3MediaStorage")
    def test_import_prompts_before_reimporting_an_existing_site(self, storage_class, delay):
        storage_class.return_value = MemoryStorage()

        response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {"site_zip": self.site_package_upload(stable_key=self.root.stable_key, title=self.root.title)},
            format="multipart",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "site_already_exists")
        self.assertEqual(response.data["existingSites"][0]["id"], self.root.id)
        self.assertFalse(SitePackageJob.objects.filter(kind=SitePackageJob.KIND_IMPORT).exists())
        delay.assert_not_called()

    @patch("webpages.views.site_package_views.import_site_package.delay")
    @patch("webpages.views.site_package_views.S3MediaStorage")
    def test_import_does_not_match_a_different_stable_site_with_the_same_source_id(self, storage_class, delay):
        storage_class.return_value = MemoryStorage()
        previous_root = WebPage.objects.create(
            title="Previous import",
            slug="previous-import",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        previous_key = uuid.uuid4()
        SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            status=SitePackageJob.STATUS_COMPLETED,
            imported_root_page=previous_root,
            created_by=self.user,
            options={"tenant_id": str(self.tenant.id), "source_root_key": str(previous_key)},
            progress={"object_maps": {"pages": {"900": previous_root.id}}},
        )

        response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {"site_zip": self.site_package_upload(stable_key=uuid.uuid4(), source_id=900)},
            format="multipart",
        )

        self.assertEqual(response.status_code, 202)
        delay.assert_called_once()

    @patch("webpages.views.site_package_views.import_site_package.delay")
    @patch("webpages.views.site_package_views.S3MediaStorage")
    def test_import_rejects_a_duplicate_while_the_same_source_is_pending(self, storage_class, delay):
        storage_class.return_value = MemoryStorage()
        stable_key = uuid.uuid4()
        SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            status=SitePackageJob.STATUS_PENDING,
            created_by=self.user,
            options={"tenant_id": str(self.tenant.id), "source_root_key": str(stable_key)},
        )

        response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {"site_zip": self.site_package_upload(stable_key=stable_key)},
            format="multipart",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["code"], "site_import_in_progress")
        delay.assert_not_called()

    @patch("webpages.views.site_package_views.import_site_package.delay")
    @patch("webpages.views.site_package_views.S3MediaStorage")
    def test_expired_pending_import_does_not_block_a_retry(self, storage_class, delay):
        storage_class.return_value = MemoryStorage()
        stable_key = uuid.uuid4()
        SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            status=SitePackageJob.STATUS_PENDING,
            created_by=self.user,
            options={"tenant_id": str(self.tenant.id), "source_root_key": str(stable_key)},
            expires_at=timezone.now() - timedelta(minutes=1),
        )

        response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {"site_zip": self.site_package_upload(stable_key=stable_key)},
            format="multipart",
        )

        self.assertEqual(response.status_code, 202, response.data)
        delay.assert_called_once()

    @patch("webpages.views.site_package_views.import_site_package.delay", side_effect=RuntimeError("queue unavailable"))
    @patch("webpages.views.site_package_views.S3MediaStorage")
    def test_import_marks_the_job_failed_when_queue_dispatch_fails(self, storage_class, delay):
        storage_class.return_value = MemoryStorage()

        with self.assertRaises(RuntimeError):
            self.client.post(
                "/api/v1/webpages/site-packages/imports/",
                {"site_zip": self.site_package_upload()},
                format="multipart",
            )

        job = SitePackageJob.objects.get(kind=SitePackageJob.KIND_IMPORT)
        self.assertEqual(job.status, SitePackageJob.STATUS_FAILED)
        self.assertEqual(job.errors, ["queue unavailable"])
        delay.assert_called_once_with(str(job.id))

    @patch("webpages.views.site_package_views.import_site_package.delay")
    @patch("webpages.views.site_package_views.S3MediaStorage")
    def test_legacy_packages_only_match_the_same_package_bytes(self, storage_class, delay):
        storage_class.return_value = MemoryStorage()
        first_bytes = self.legacy_site_package_bytes(source_id=101, title="First legacy site")
        first_hash = inspect_site_package_upload(ContentFile(first_bytes, name="first.zip"))["package_hash"]
        previous_root = WebPage.objects.create(
            title="First legacy site",
            slug="first-legacy-site",
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        SitePackageJob.objects.create(
            kind=SitePackageJob.KIND_IMPORT,
            status=SitePackageJob.STATUS_COMPLETED,
            imported_root_page=previous_root,
            created_by=self.user,
            options={
                "tenant_id": str(self.tenant.id),
                "source_root_key": "",
                "source_package_hash": first_hash,
            },
            progress={"object_maps": {"pages": {"101": previous_root.id}}},
        )

        unrelated_response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {
                "site_zip": ContentFile(
                    self.legacy_site_package_bytes(source_id=101, title="Other site"), name="other.zip"
                )
            },
            format="multipart",
        )
        repeated_response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {"site_zip": ContentFile(first_bytes, name="first.zip")},
            format="multipart",
        )

        self.assertEqual(unrelated_response.status_code, 202)
        self.assertEqual(repeated_response.status_code, 409)
        self.assertEqual(repeated_response.data["code"], "site_already_exists")

    @patch("webpages.views.site_package_views.import_site_package.delay")
    @patch("webpages.views.site_package_views.S3MediaStorage")
    def test_reimport_can_update_the_selected_existing_site(self, storage_class, delay):
        storage_class.return_value = MemoryStorage()

        response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {
                "site_zip": self.site_package_upload(stable_key=self.root.stable_key, title=self.root.title),
                "mode": "update",
                "existingRootId": self.root.id,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 202)
        job = SitePackageJob.objects.get(id=response.data["id"])
        self.assertEqual(job.options["mode"], "update")
        self.assertEqual(job.options["local_root_id"], self.root.id)
        delay.assert_called_once_with(str(job.id))

    @patch("webpages.views.site_package_views.import_site_package.delay")
    @patch("webpages.views.site_package_views.S3MediaStorage")
    def test_reimport_can_create_a_clone(self, storage_class, delay):
        storage_class.return_value = MemoryStorage()

        response = self.client.post(
            "/api/v1/webpages/site-packages/imports/",
            {
                "site_zip": self.site_package_upload(stable_key=self.root.stable_key, title=self.root.title),
                "mode": "clone",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, 202)
        job = SitePackageJob.objects.get(id=response.data["id"])
        self.assertEqual(job.options["mode"], "clone")
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
