import io
import zipfile
from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase
from django.utils import timezone
from PIL import Image
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from core.models import Tenant
from webpages.models import PageTheme, ThemeDesignerAssignment, ThemeDesignerExportJob, ThemeDesignerRevision
from webpages.services.designer_export import ThemeDesignerExporter, cleanup_expired_designer_exports
from webpages.services.designer_theme import generate_placeholder_png, validate_image_upload
from webpages.views.designer_theme_views import DesignerExportThrottle, DesignerThemeExportView


class DesignerThemeApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("theme-owner", password="test")
        self.designer = User.objects.create_user("theme-designer", password="test")
        self.other = User.objects.create_user("other-designer", password="test")
        self.tenant = Tenant.objects.create(name="Theme tenant", identifier="theme-tenant", created_by=self.owner)
        self.theme = PageTheme.objects.create(
            tenant=self.tenant,
            created_by=self.owner,
            name="Editorial",
            colors={"brandColor": "#123456"},
            fonts={"google_fonts": [{"family": "Inter", "variants": ["400", "700"], "display": "swap"}]},
            component_styles={
                "feature-card": {
                    "name": "Feature card",
                    "description": "Highlighted editorial card",
                    "template": '<article class="feature-card">{{{content}}}</article>',
                    "css": ".feature-card { padding: 1rem; }",
                }
            },
            design_groups={
                "groups": [
                    {
                        "name": "Article",
                        "elements": {"h1": {"fontFamily": "Inter", "fontSize": "32px", "marginBottom": "16px"}},
                        "layoutProperties": {
                            "hero": {
                                "md": {
                                    "padding": "24px",
                                    "images": {
                                        "background": {
                                            "displayName": "Article hero",
                                            "requiredWidth": 1600,
                                            "requiredHeight": 900,
                                            "dpr": 2,
                                            "isPlaceholder": True,
                                        }
                                    },
                                }
                            }
                        },
                    }
                ]
            },
        )
        self.other_theme = PageTheme.objects.create(
            tenant=self.tenant,
            created_by=self.owner,
            name="Unassigned",
        )
        ThemeDesignerAssignment.objects.create(
            tenant=self.tenant,
            theme=self.theme,
            user=self.designer,
            created_by=self.owner,
        )
        self.client = APIClient()

    def authenticate(self, user):
        self.client.force_authenticate(user)
        self.client.credentials(HTTP_X_TENANT_ID=str(self.tenant.id))

    @property
    def workspace_url(self):
        return f"/api/v1/webpages/designer/themes/{self.theme.id}/workspace/"

    def test_assignment_limits_designer_to_one_theme_and_not_advanced_api(self):
        self.authenticate(self.designer)
        response = self.client.get("/api/v1/webpages/designer/themes/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data["results"]], [self.theme.id])

        self.assertEqual(self.client.get(self.workspace_url).status_code, 200)
        denied = self.client.get(f"/api/v1/webpages/designer/themes/{self.other_theme.id}/workspace/")
        self.assertEqual(denied.status_code, 403)
        self.assertIn(
            self.client.get(f"/api/v1/webpages/themes/{self.theme.id}/").status_code,
            {403, 404},
        )

    def test_unassigned_user_is_denied(self):
        self.authenticate(self.other)
        self.assertEqual(self.client.get(self.workspace_url).status_code, 403)

    def test_workspace_exposes_semantic_catalog_without_selectors(self):
        self.authenticate(self.designer)
        workspace = self.client.get(self.workspace_url).data

        group = workspace["catalog"]["designGroups"][0]
        self.assertEqual(group["label"], "Article")
        self.assertEqual(group["elements"][0]["id"], "group:0:element:h1")
        self.assertEqual(group["parts"][0]["label"], "Hero")
        self.assertEqual(group["assetKeys"], ["design:0:hero:md:background"])
        self.assertNotIn("selector", str(workspace["catalog"]).lower())
        self.assertEqual(workspace["catalog"]["componentStyles"][0]["label"], "Feature card")
        self.assertTrue(workspace["catalog"]["layouts"])
        main_layout = next(layout for layout in workspace["catalog"]["layouts"] if layout["key"] == "main_layout")
        self.assertIn('class="main-layout-container"', main_layout["previewTemplate"])
        self.assertIn("__DESIGNER_SLOT_main__", main_layout["previewTemplate"])
        self.assertTrue(main_layout["layoutCss"])
        self.assertEqual(workspace["previewContent"], {"views": workspace["catalog"]["previewViews"]})

    def test_workspace_places_chrome_widgets_in_natural_preview_slots(self):
        groups = self.theme.design_groups
        groups["groups"].append(
            {
                "name": "Navigation",
                "widgetTypes": ["easy_widgets.NavigationWidget"],
                "layoutProperties": {"nav-container": {"md": {"padding": "12px"}}},
                "elements": {},
            }
        )
        self.theme.design_groups = groups
        self.theme.save(update_fields=["design_groups"])
        self.authenticate(self.designer)

        workspace = self.client.get(self.workspace_url).data
        navigation = next(
            group
            for group in workspace["catalog"]["designGroups"]
            if group["widgetTypes"] == ["easy_widgets.NavigationWidget"]
        )

        self.assertEqual(navigation["slots"], ["sidebar"])
        self.assertEqual(navigation["parts"][0]["part"], "nav-container")

    def test_preview_text_is_saved_separately_from_theme_draft_and_preserves_metadata(self):
        self.theme.designer_preview = {
            "developerNote": "Use realistic editorial copy",
            "views": [
                {
                    "id": "article-page",
                    "label": "Article page",
                    "kind": "page",
                    "layout": "main_layout",
                    "objectType": "article",
                    "texts": {},
                    "images": {},
                }
            ],
        }
        self.theme.save(update_fields=["designer_preview"])
        self.authenticate(self.designer)
        workspace = self.client.get(self.workspace_url).data
        self.theme.refresh_from_db()
        original_sync_version = self.theme.sync_version
        original_draft_version = workspace["draftVersion"]

        response = self.client.patch(
            f"/api/v1/webpages/designer/themes/{self.theme.id}/preview-content/",
            {
                "viewId": "article-page",
                "texts": {"group:0:element:h1": "A temporary demo headline"},
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.theme.refresh_from_db()
        self.theme.designer_draft.refresh_from_db()
        self.assertEqual(self.theme.sync_version, original_sync_version)
        self.assertEqual(self.theme.designer_draft.version, original_draft_version)
        self.assertEqual(self.theme.colors["brandColor"], "#123456")
        self.assertEqual(self.theme.designer_preview["developerNote"], "Use realistic editorial copy")
        saved_view = self.theme.designer_preview["views"][0]
        self.assertEqual(saved_view["objectType"], "article")
        self.assertEqual(saved_view["texts"], {"group:0:element:h1": "A temporary demo headline"})

    def test_advanced_theme_editor_preserves_preview_ids_and_metadata(self):
        self.authenticate(self.owner)
        designer_preview = {
            "developerNote": "Object-specific demo",
            "views": [
                {
                    "id": "article-card",
                    "label": "Article card",
                    "kind": "object",
                    "layout": "main_layout",
                    "objectType": "article",
                    "texts": {"group:0:element:h1": "Demo heading"},
                    "images": {"preview:article-card:image:main": {"url": "https://example.test/demo.png"}},
                }
            ],
        }

        response = self.client.patch(
            f"/api/v1/webpages/themes/{self.theme.id}/",
            {"designerPreview": designer_preview},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.theme.refresh_from_db()
        self.assertEqual(self.theme.designer_preview, designer_preview)
        self.assertEqual(response.json()["designerPreview"], designer_preview)

    @patch(
        "webpages.services.designer_theme.system_storage.url",
        return_value="https://storage.test/theme_images/preview.png",
    )
    @patch(
        "webpages.services.designer_theme.system_storage.save",
        return_value="theme_images/1/designer_preview/preview.png",
    )
    def test_preview_image_is_stored_as_demo_content(self, _save, _url):
        self.theme.designer_preview = {
            "views": [
                {
                    "id": "card-object",
                    "label": "Card",
                    "kind": "object",
                    "layout": "main_layout",
                    "texts": {},
                    "images": {},
                }
            ]
        }
        self.theme.save(update_fields=["designer_preview"])
        image_buffer = io.BytesIO()
        Image.new("RGB", (80, 60), "#123456").save(image_buffer, format="PNG")
        upload = SimpleUploadedFile("card.png", image_buffer.getvalue(), content_type="image/png")
        self.authenticate(self.designer)

        response = self.client.post(
            f"/api/v1/webpages/designer/themes/{self.theme.id}/preview-content/image/",
            {"view_id": "card-object", "target_id": "preview-image:main", "image": upload},
            format="multipart",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.theme.refresh_from_db()
        saved_image = self.theme.designer_preview["views"][0]["images"]["preview-image:main"]
        self.assertEqual(saved_image["url"], "https://storage.test/theme_images/preview.png")
        self.assertEqual((saved_image["width"], saved_image["height"]), (80, 60))
        self.assertNotIn(
            "url", self.theme.design_groups["groups"][0]["layoutProperties"]["hero"]["md"]["images"]["background"]
        )

    def test_workspace_normalizes_legacy_snake_case_values_and_preserves_storage_style(self):
        groups = self.theme.design_groups
        groups["groups"][0]["elements"]["h1"] = {
            "font_family": "Inter",
            "font_size": "32px",
            "margin_bottom": "16px",
        }
        self.theme.design_groups = groups
        self.theme.save(update_fields=["design_groups"])
        self.authenticate(self.designer)

        workspace = self.client.get(self.workspace_url).data
        self.assertEqual(workspace["typography"][0]["values"]["fontSize"], "32px")
        saved = self.client.patch(
            self.workspace_url,
            {
                "draftVersion": workspace["draftVersion"],
                "typography": [{"groupIndex": 0, "element": "h1", "values": {"fontSize": "40px"}}],
            },
            format="json",
        )
        self.assertEqual(saved.status_code, 200, saved.data)
        snapshot_element = self.theme.designer_draft.snapshot["design_groups"]["groups"][0]["elements"]["h1"]
        self.assertEqual(snapshot_element["font_size"], "40px")
        self.assertNotIn("fontSize", snapshot_element)

    def test_valid_patch_stays_in_draft_until_atomic_publish(self):
        self.authenticate(self.designer)
        workspace = self.client.get(self.workspace_url).data
        response = self.client.patch(
            self.workspace_url,
            {
                "draftVersion": workspace["draftVersion"],
                "colors": {"brandColor": "#abcdef"},
                "fonts": [{"family": "Inter", "variants": ["400", "700"], "display": "swap"}],
                "typography": [{"groupIndex": 0, "element": "h1", "values": {"fontSize": "40px"}}],
                "spacing": [
                    {
                        "scope": "layout",
                        "groupIndex": 0,
                        "part": "hero",
                        "breakpoint": "md",
                        "values": {"padding": "32px"},
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.theme.refresh_from_db()
        self.assertEqual(self.theme.colors["brandColor"], "#123456")
        self.assertEqual(self.theme.design_groups["groups"][0]["elements"]["h1"]["fontSize"], "32px")
        self.assertTrue(response.data["hasDraftChanges"])
        self.assertEqual(ThemeDesignerRevision.objects.filter(theme=self.theme).count(), 0)

        published = self.client.post(
            f"/api/v1/webpages/designer/themes/{self.theme.id}/publish/",
            {"draftVersion": response.data["draftVersion"]},
            format="json",
        )
        self.assertEqual(published.status_code, 200, published.data)
        self.theme.refresh_from_db()
        self.assertEqual(self.theme.colors["brandColor"], "#abcdef")
        self.assertEqual(self.theme.design_groups["groups"][0]["elements"]["h1"]["fontSize"], "40px")
        self.assertEqual(ThemeDesignerRevision.objects.filter(theme=self.theme).count(), 1)
        self.assertFalse(published.data["hasDraftChanges"])

    def test_undo_restores_and_consumes_latest_published_revision(self):
        self.authenticate(self.designer)
        workspace = self.client.get(self.workspace_url).data
        saved = self.client.patch(
            self.workspace_url,
            {"draftVersion": workspace["draftVersion"], "colors": {"brandColor": "#abcdef"}},
            format="json",
        )
        published = self.client.post(
            f"/api/v1/webpages/designer/themes/{self.theme.id}/publish/",
            {"draftVersion": saved.data["draftVersion"]},
            format="json",
        )

        stale = self.client.post(
            f"/api/v1/webpages/designer/themes/{self.theme.id}/undo/",
            {
                "draftVersion": published.data["draftVersion"],
                "liveSyncVersion": published.data["liveSyncVersion"] - 1,
            },
            format="json",
        )
        self.assertEqual(stale.status_code, 409, stale.data)
        self.assertEqual(ThemeDesignerRevision.objects.filter(theme=self.theme).count(), 1)

        restored = self.client.post(
            f"/api/v1/webpages/designer/themes/{self.theme.id}/undo/",
            {
                "draftVersion": published.data["draftVersion"],
                "liveSyncVersion": published.data["liveSyncVersion"],
            },
            format="json",
        )

        self.assertEqual(restored.status_code, 200, restored.data)
        self.theme.refresh_from_db()
        self.assertEqual(self.theme.colors["brandColor"], "#123456")
        self.assertFalse(restored.data["canUndo"])
        self.assertFalse(restored.data["hasDraftChanges"])
        self.assertEqual(ThemeDesignerRevision.objects.filter(theme=self.theme).count(), 0)

    @patch("webpages.services.designer_theme.system_storage.delete")
    @patch("webpages.services.designer_theme.system_storage.exists", return_value=True)
    def test_discard_removes_unreferenced_immutable_draft_asset(self, _exists, delete):
        self.authenticate(self.designer)
        workspace = self.client.get(self.workspace_url).data
        draft = self.theme.designer_draft
        object_key = f"theme_images/{self.theme.id}/designer_drafts/{draft.id}/abandoned.png"
        draft.snapshot = {**draft.snapshot, "image": object_key}
        draft.has_changes = True
        draft.save(update_fields=["snapshot", "has_changes", "updated_at"])

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                f"/api/v1/webpages/designer/themes/{self.theme.id}/discard/",
                {"draftVersion": workspace["draftVersion"]},
                format="json",
            )

        self.assertEqual(response.status_code, 200, response.data)
        delete.assert_called_once_with(object_key)

    def test_stale_or_unsupported_patch_is_rejected(self):
        self.authenticate(self.designer)
        stale = self.client.patch(self.workspace_url, {"draftVersion": 0, "colors": {}}, format="json")
        self.assertEqual(stale.status_code, 409)

        workspace = self.client.get(self.workspace_url).data
        unsupported = self.client.patch(
            self.workspace_url,
            {"draftVersion": workspace["draftVersion"], "name": "Hacked"},
            format="json",
        )
        self.assertEqual(unsupported.status_code, 400)
        unsafe = self.client.post(
            f"/api/v1/webpages/designer/themes/{self.theme.id}/preview/",
            {
                "draftVersion": workspace["draftVersion"],
                "colors": {"brandColor": "red; background:url(https://example.test)"},
            },
            format="json",
        )
        self.assertEqual(unsafe.status_code, 400)

    def test_preview_does_not_save(self):
        self.authenticate(self.designer)
        workspace = self.client.get(self.workspace_url).data
        response = self.client.post(
            f"/api/v1/webpages/designer/themes/{self.theme.id}/preview/",
            {"draftVersion": workspace["draftVersion"], "colors": {"brandColor": "#ffffff"}},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("css", response.data)
        self.assertNotIn("content", response.data)
        self.theme.refresh_from_db()
        self.assertEqual(self.theme.colors["brandColor"], "#123456")

    def test_only_tenant_admin_can_manage_assignments(self):
        url = f"/api/v1/webpages/themes/{self.other_theme.id}/designer-assignments/"
        self.authenticate(self.designer)
        self.assertEqual(self.client.post(url, {"username": self.other.username}, format="json").status_code, 403)

        self.authenticate(self.owner)
        created = self.client.post(url, {"username": self.other.username}, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.assertTrue(ThemeDesignerAssignment.objects.filter(theme=self.other_theme, user=self.other).exists())
        removed = self.client.delete(url, {"assignmentId": created.data["id"]}, format="json")
        self.assertEqual(removed.status_code, 200)
        self.assertFalse(ThemeDesignerAssignment.objects.filter(theme=self.other_theme, user=self.other).exists())

    @patch(
        "webpages.services.designer_theme.system_storage.url",
        return_value="https://storage.test/theme_images/asset.png",
    )
    @patch(
        "webpages.services.designer_theme.system_storage.save", return_value="theme_images/1/designer_assets/asset.png"
    )
    def test_placeholder_has_exact_dimensions_and_is_marked(self, _save, _url):
        self.authenticate(self.designer)
        workspace = self.client.get(self.workspace_url).data
        asset_key = "design:0:hero:md:background"
        response = self.client.post(
            f"/api/v1/webpages/designer/themes/{self.theme.id}/placeholder/",
            {
                "assetKey": asset_key,
                "displayName": "New hero",
                "width": 1600,
                "height": 900,
                "draftVersion": workspace["draftVersion"],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        asset = next(item for item in response.data["assets"] if item["assetKey"] == asset_key)
        self.assertTrue(asset["isPlaceholder"])
        self.assertEqual((asset["requiredWidth"], asset["requiredHeight"]), (1600, 900))
        self.theme.refresh_from_db()
        live_asset = self.theme.design_groups["groups"][0]["layoutProperties"]["hero"]["md"]["images"]["background"]
        self.assertNotIn("url", live_asset)

    @patch("webpages.views.designer_theme_views.generate_placeholder_png")
    def test_placeholder_rejects_oversized_dimensions_before_generation(self, generate_placeholder):
        self.authenticate(self.designer)
        workspace = self.client.get(self.workspace_url).data
        response = self.client.post(
            f"/api/v1/webpages/designer/themes/{self.theme.id}/placeholder/",
            {
                "assetKey": "design:0:hero:md:background",
                "displayName": "Too large",
                "width": 5000,
                "height": 5000,
                "draftVersion": workspace["draftVersion"],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        generate_placeholder.assert_not_called()


class DesignerPlaceholderTests(SimpleTestCase):
    @patch("webpages.services.designer_theme.Image.open")
    def test_raster_upload_rejects_excessive_decoded_pixel_count(self, open_image):
        image = open_image.return_value
        image.width = 5000
        image.height = 5000
        image.format = "PNG"
        upload = SimpleUploadedFile("oversized.png", b"compressed-image", content_type="image/png")

        with self.assertRaisesMessage(ValidationError, "Images cannot exceed 16 megapixels."):
            validate_image_upload(upload)

        image.verify.assert_not_called()

    def test_generated_placeholder_uses_requested_full_size(self):
        content = generate_placeholder_png("Hero artwork", "Article / hero", 1200, 630)
        with Image.open(io.BytesIO(content)) as image:
            self.assertEqual(image.size, (1200, 630))
            self.assertEqual(image.format, "PNG")

    @patch("webpages.services.designer_export.render_asset_book_pdf", return_value=b"%PDF-test")
    @patch("webpages.services.designer_export._read_asset", return_value=b"image-bytes")
    @patch("webpages.services.designer_export.collect_designer_assets")
    def test_export_deduplicates_shared_assets_and_leaks_no_settings(self, collect_assets, _read, _pdf):
        collect_assets.return_value = [
            {
                "assetKey": "design:0:hero:md:first",
                "displayName": "Hero",
                "filename": "hero.png",
                "url": "https://storage.test/shared.png",
                "usage": ["Group / hero / md / first"],
                "kind": "design-group",
                "part": "hero",
                "breakpoint": "md",
                "property": "first",
            },
            {
                "assetKey": "design:0:hero:md:second",
                "displayName": "Hero duplicate",
                "filename": "hero.png",
                "url": "https://storage.test/shared.png",
                "usage": ["Group / hero / md / second"],
                "kind": "design-group",
                "part": "hero",
                "breakpoint": "md",
                "property": "second",
            },
        ]
        captured = {}

        class Storage:
            def _save(self, key, content):
                captured["key"] = key
                captured["content"] = content.read()

        theme = SimpleNamespace(id=7, name="Editorial")
        job = MagicMock(theme=theme, theme_id=7, object_key="exports/test.zip", snapshot={})
        ThemeDesignerExporter(job, storage=Storage()).run()
        with zipfile.ZipFile(io.BytesIO(captured["content"])) as archive:
            names = archive.namelist()
        self.assertEqual(names.count("designer-asset-book.pdf"), 1)
        self.assertEqual(len([name for name in names if name.startswith("images/")]), 1)
        self.assertFalse(any(name.endswith((".yaml", ".yml", ".json")) for name in names))


class DesignerExportLifecycleTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("designer-export-owner", password="test")
        self.tenant = Tenant.objects.create(
            name="Export tenant", identifier="designer-export-tenant", created_by=self.user
        )
        self.theme = PageTheme.objects.create(tenant=self.tenant, created_by=self.user, name="Exportable")

    def test_export_creation_has_an_explicit_per_user_rate_limit(self):
        self.assertEqual(DesignerThemeExportView.throttle_classes, [DesignerExportThrottle])
        self.assertEqual(DesignerExportThrottle.rate, "10/hour")

    @patch("webpages.services.designer_export.delete_unreferenced_designer_assets")
    def test_expired_export_objects_and_snapshots_are_deleted(self, delete_assets):
        job = ThemeDesignerExportJob.objects.create(
            theme=self.theme,
            created_by=self.user,
            status=ThemeDesignerExportJob.STATUS_COMPLETED,
            object_key="theme-designer-exports/1/job/export.zip",
            expires_at=timezone.now() - timedelta(minutes=1),
            snapshot={"image": f"theme_images/{self.theme.id}/designer_drafts/1/old.png"},
        )
        storage = MagicMock()
        storage.exists.return_value = True

        removed = cleanup_expired_designer_exports(storage=storage)

        self.assertEqual(removed, 1)
        storage.delete.assert_called_once_with(job.object_key)
        self.assertFalse(ThemeDesignerExportJob.objects.filter(id=job.id).exists())
        delete_assets.assert_called_once_with(
            self.theme.id,
            {f"theme_images/{self.theme.id}/designer_drafts/1/old.png"},
        )
