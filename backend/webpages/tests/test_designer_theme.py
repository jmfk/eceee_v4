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
from webpages.models import (
    PageTheme,
    PageVersion,
    ThemeDesignerAssignment,
    ThemeDesignerExportJob,
    ThemeDesignerRevision,
    WebPage,
)
from webpages.services.designer_export import ThemeDesignerExporter, cleanup_expired_designer_exports
from webpages.services.designer_theme import (
    _safe_reference_preview_html,
    collect_designer_assets,
    generate_placeholder_png,
    validate_image_upload,
)
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
            description="Theme for editorial sites",
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
        self.assertEqual(workspace["breakpoints"], {"xs": 0, "sm": 640, "md": 768, "lg": 1024, "xl": 1280})
        self.assertEqual(workspace["previewContent"], {"views": []})
        self.assertEqual(workspace["catalog"]["previewViews"], [])
        self.assertEqual(workspace["contentObjects"], [])
        self.assertEqual(workspace["name"], "Editorial")
        self.assertEqual(workspace["description"], "Theme for editorial sites")
        self.assertEqual(
            {asset["assetKey"] for asset in workspace["assets"] if asset["kind"] in {"preview", "site-icon"}},
            {"preview", "site-icon"},
        )

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

    def test_preview_content_can_be_copied_from_a_site_using_the_theme(self):
        root = WebPage.objects.create(
            title="Conference site",
            slug="conference",
            hostnames=["conference.example"],
            tenant=self.tenant,
            created_by=self.owner,
            last_modified_by=self.owner,
        )
        version = PageVersion.objects.create(
            page=root,
            version_number=1,
            effective_date=timezone.now() - timedelta(days=1),
            code_layout="main_layout",
            theme=self.theme,
            page_data={"title": "Real conference heading", "description": "Published conference introduction"},
            widgets={
                "main": [
                    {
                        "type": "easy_widgets.ContentWidget",
                        "config": {
                            "content": "<p>Real body content from the site.</p>",
                            "image_url": "https://media.example/conference.jpg",
                        },
                    }
                ]
            },
            created_by=self.owner,
        )
        root.current_published_version = version
        root.latest_version = version
        root.is_currently_published = True
        root.cached_root_id = root.id
        root.save(
            update_fields=["current_published_version", "latest_version", "is_currently_published", "cached_root_id"]
        )
        other_theme_page = WebPage.objects.create(
            title="Archive",
            slug="archive",
            parent=root,
            cached_path="/archive/",
            cached_root_id=root.id,
            tenant=self.tenant,
            created_by=self.owner,
            last_modified_by=self.owner,
        )
        other_theme_version = PageVersion.objects.create(
            page=other_theme_page,
            version_number=1,
            effective_date=timezone.now() - timedelta(days=1),
            code_layout="main_layout",
            theme=self.other_theme,
            widgets={"main": []},
            created_by=self.owner,
        )
        other_theme_page.current_published_version = other_theme_version
        other_theme_page.latest_version = other_theme_version
        other_theme_page.is_currently_published = True
        other_theme_page.save(update_fields=["current_published_version", "latest_version", "is_currently_published"])
        other_theme_draft = PageVersion.objects.create(
            page=other_theme_page,
            version_number=2,
            code_layout="main_layout",
            theme=self.other_theme,
            widgets={"main": [{"type": "easy_widgets.ContentWidget", "config": {"content": "Draft archive"}}]},
            created_by=self.owner,
        )
        other_theme_page.latest_version = other_theme_draft
        other_theme_page.save(update_fields=["latest_version"])

        draft_site = WebPage.objects.create(
            title="Draft site",
            slug="draft-site",
            tenant=self.tenant,
            created_by=self.owner,
            last_modified_by=self.owner,
        )
        draft_site_version = PageVersion.objects.create(
            page=draft_site,
            version_number=1,
            code_layout="main_layout",
            theme=self.other_theme,
            widgets={"main": []},
            created_by=self.owner,
        )
        draft_site.latest_version = draft_site_version
        draft_site.cached_root_id = draft_site.id
        draft_site.save(update_fields=["latest_version", "cached_root_id"])
        empty_page = WebPage.objects.create(
            title="Empty page",
            slug="empty",
            parent=draft_site,
            cached_path="/empty/",
            cached_root_id=draft_site.id,
            tenant=self.tenant,
            created_by=self.owner,
            last_modified_by=self.owner,
        )

        foreign_owner = User.objects.create_user("foreign-theme-owner", password="test")
        foreign_tenant = Tenant.objects.create(
            name="Foreign theme tenant",
            identifier="foreign-theme-tenant",
            created_by=foreign_owner,
        )
        foreign_theme = PageTheme.objects.create(
            tenant=foreign_tenant,
            created_by=foreign_owner,
            name="Foreign",
        )
        foreign_page = WebPage.objects.create(
            title="Private foreign page",
            slug="private",
            tenant=foreign_tenant,
            created_by=foreign_owner,
            last_modified_by=foreign_owner,
        )
        foreign_version = PageVersion.objects.create(
            page=foreign_page,
            version_number=1,
            effective_date=timezone.now() - timedelta(days=1),
            code_layout="main_layout",
            theme=foreign_theme,
            widgets={"main": []},
            created_by=foreign_owner,
        )
        foreign_page.current_published_version = foreign_version
        foreign_page.latest_version = foreign_version
        foreign_page.is_currently_published = True
        foreign_page.cached_root_id = foreign_page.id
        foreign_page.save(
            update_fields=["current_published_version", "latest_version", "is_currently_published", "cached_root_id"]
        )
        self.authenticate(self.designer)

        workspace = self.client.get(self.workspace_url).data
        self.assertEqual({source["id"] for source in workspace["contentSources"]}, {root.id, draft_site.id})
        self.assertEqual(
            {source["id"] for source in workspace["contentPages"]},
            {root.id, other_theme_page.id, draft_site.id, empty_page.id},
        )
        archive_source = next(source for source in workspace["contentPages"] if source["id"] == other_theme_page.id)
        self.assertEqual(archive_source["siteId"], root.id)
        self.assertEqual(archive_source["versionId"], other_theme_draft.id)
        self.assertEqual(archive_source["versionStatus"], "draft")
        self.assertEqual(archive_source["tenantIdentifier"], self.tenant.identifier)
        self.assertEqual(archive_source["slugPath"], "archive")
        empty_source = next(source for source in workspace["contentPages"] if source["id"] == empty_page.id)
        self.assertIsNone(empty_source["versionId"])
        self.assertEqual(empty_source["versionStatus"], "empty")
        self.assertEqual(empty_source["layout"], "main_layout")
        self.assertNotIn(foreign_page.id, {source["id"] for source in workspace["contentPages"]})
        self.assertEqual(workspace["previewContent"]["views"], [])

        page_response = self.client.post(
            f"/api/v1/webpages/designer/themes/{self.theme.id}/preview-content/from-page/",
            {"sourcePageId": other_theme_page.id},
            format="json",
        )
        self.assertEqual(page_response.status_code, 200, page_response.data)
        self.assertEqual(page_response.data["page"]["id"], other_theme_page.id)
        self.assertEqual(page_response.data["version"]["id"], other_theme_draft.id)
        self.assertIn("slots", page_response.data["inheritance"])

        empty_response = self.client.post(
            f"/api/v1/webpages/designer/themes/{self.theme.id}/preview-content/from-page/",
            {"sourcePageId": empty_page.id},
            format="json",
        )
        self.assertEqual(empty_response.status_code, 200, empty_response.data)
        self.assertIsNone(empty_response.data["version"]["id"])
        self.assertEqual(empty_response.data["version"]["code_layout"], "main_layout")
        self.assertEqual(empty_response.data["version"]["widgets"], {})

        foreign_response = self.client.post(
            f"/api/v1/webpages/designer/themes/{self.theme.id}/preview-content/from-page/",
            {"sourcePageId": foreign_page.id},
            format="json",
        )
        self.assertEqual(foreign_response.status_code, 404)
        response = self.client.post(
            f"/api/v1/webpages/designer/themes/{self.theme.id}/preview-content/from-site/",
            {"sourceSiteId": root.id, "draftVersion": workspace["draftVersion"]},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        views = response.data["previewContent"]["views"]
        main_view = next(view for view in views if view["layout"] == "main_layout")
        self.assertEqual(main_view["texts"]["group:0:element:h1"], "Conference site")
        self.assertEqual(main_view["sourceSiteId"], root.id)
        self.assertIn("https://media.example/conference.jpg", str(main_view["images"]))

    def test_preview_text_is_saved_in_theme_draft_and_preserves_metadata(self):
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
                "draftVersion": original_draft_version,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.theme.refresh_from_db()
        self.theme.designer_draft.refresh_from_db()
        self.assertEqual(self.theme.sync_version, original_sync_version)
        self.assertEqual(self.theme.designer_draft.version, original_draft_version + 1)
        self.assertTrue(self.theme.designer_draft.has_changes)
        self.assertEqual(self.theme.colors["brandColor"], "#123456")
        self.assertEqual(self.theme.designer_preview["developerNote"], "Use realistic editorial copy")
        saved_view = self.theme.designer_draft.snapshot["designer_preview"]["views"][0]
        self.assertEqual(saved_view["objectType"], "article")
        self.assertEqual(saved_view["texts"], {"group:0:element:h1": "A temporary demo headline"})
        self.assertEqual(response.data["draftVersion"], original_draft_version + 1)

        publish = self.client.post(
            f"/api/v1/webpages/designer/themes/{self.theme.id}/publish/",
            {"draftVersion": response.data["draftVersion"]},
            format="json",
        )
        self.assertEqual(publish.status_code, 200, publish.data)
        self.theme.refresh_from_db()
        published_view = self.theme.designer_preview["views"][0]
        self.assertEqual(published_view["texts"], {"group:0:element:h1": "A temporary demo headline"})
        self.assertGreater(self.theme.sync_version, original_sync_version)

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
                "name": "Editorial refresh",
                "description": "Updated identity and styles",
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
        self.assertEqual(self.theme.name, "Editorial")
        self.assertEqual(self.theme.description, "Theme for editorial sites")
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
        self.assertEqual(self.theme.name, "Editorial refresh")
        self.assertEqual(self.theme.description, "Updated identity and styles")
        self.assertEqual(self.theme.colors["brandColor"], "#abcdef")
        self.assertEqual(self.theme.design_groups["groups"][0]["elements"]["h1"]["fontSize"], "40px")
        self.assertEqual(ThemeDesignerRevision.objects.filter(theme=self.theme).count(), 1)
        self.assertFalse(published.data["hasDraftChanges"])

    def test_clean_draft_automatically_reloads_when_live_theme_changes(self):
        self.authenticate(self.designer)
        original = self.client.get(self.workspace_url).data

        self.theme.description = "Updated outside Designer"
        self.theme.save()
        self.theme.refresh_from_db()
        refreshed = self.client.get(self.workspace_url)

        self.assertEqual(refreshed.status_code, 200, refreshed.data)
        self.assertFalse(refreshed.data["draftIsStale"])
        self.assertFalse(refreshed.data["hasDraftChanges"])
        self.assertEqual(refreshed.data["description"], "Updated outside Designer")
        self.assertEqual(refreshed.data["liveSyncVersion"], self.theme.sync_version)
        self.assertGreater(refreshed.data["draftVersion"], original["draftVersion"])

    def test_changed_draft_stays_stale_when_live_theme_changes(self):
        self.authenticate(self.designer)
        workspace = self.client.get(self.workspace_url).data
        saved = self.client.patch(
            self.workspace_url,
            {"draftVersion": workspace["draftVersion"], "colors": {"brandColor": "#abcdef"}},
            format="json",
        )
        self.assertEqual(saved.status_code, 200, saved.data)

        self.theme.description = "Updated outside Designer"
        self.theme.save()
        refreshed = self.client.get(self.workspace_url)

        self.assertEqual(refreshed.status_code, 200, refreshed.data)
        self.assertTrue(refreshed.data["draftIsStale"])
        self.assertTrue(refreshed.data["hasDraftChanges"])
        self.assertEqual(refreshed.data["description"], "Theme for editorial sites")

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
            {"draftVersion": workspace["draftVersion"], "unsupportedField": "Hacked"},
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

    @patch("webpages.services.designer_theme._field_dimensions", return_value=(64, 64))
    @patch("webpages.services.designer_theme.system_storage.url", return_value="https://storage.test/identity.png")
    @patch(
        "webpages.services.designer_theme.system_storage.save",
        side_effect=["theme_images/1/designer_drafts/1/preview.png", "theme_images/1/designer_drafts/1/favicon.png"],
    )
    def test_preview_and_site_icon_can_be_added_when_theme_has_no_identity_images(self, _save, _url, _dimensions):
        self.authenticate(self.designer)
        workspace = self.client.get(self.workspace_url).data

        for asset_key, filename in (("preview", "preview.png"), ("site-icon", "favicon.png")):
            upload = SimpleUploadedFile(
                filename,
                generate_placeholder_png(filename, asset_key, 64, 64),
                content_type="image/png",
            )
            response = self.client.post(
                f"/api/v1/webpages/designer/themes/{self.theme.id}/replace-asset/",
                {"asset_key": asset_key, "image": upload, "draft_version": workspace["draftVersion"]},
                format="multipart",
            )
            self.assertEqual(response.status_code, 200, response.data)
            workspace = response.data
            saved_asset = next(asset for asset in response.data["assets"] if asset["assetKey"] == asset_key)
            self.assertEqual(saved_asset["url"], "https://storage.test/identity.png")

        self.theme.designer_draft.refresh_from_db()
        self.assertTrue(self.theme.designer_draft.snapshot["image"].endswith("preview.png"))
        self.assertTrue(self.theme.designer_draft.snapshot["site_icon"].endswith("favicon.png"))

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
    @patch("webpages.services.designer_theme._stored_asset_metadata", return_value=(None, None, None))
    @patch("webpages.services.designer_theme.system_storage.url", return_value="/media/current-theme/header.png")
    def test_designer_asset_prefers_current_theme_library_file(self, storage_url, _metadata):
        theme = SimpleNamespace(
            id=3,
            image=None,
            site_icon=None,
            design_groups={
                "groups": [
                    {
                        "name": "Header",
                        "layoutProperties": {
                            "header-widget": {
                                "lg": {
                                    "background_image": {
                                        "filename": "header.png",
                                        "url": "https://storage.invalid/theme_images/2/library/header.png",
                                    }
                                }
                            }
                        },
                    }
                ]
            },
            get_breakpoints=lambda: {"lg": 1024},
            list_library_images=lambda: ["header.png"],
        )

        asset = next(item for item in collect_designer_assets(theme) if item["kind"] == "design-group")

        self.assertEqual(asset["url"], "/media/current-theme/header.png")
        storage_url.assert_any_call("theme_images/3/library/header.png")

    def test_reference_preview_html_removes_executable_markup(self):
        markup = _safe_reference_preview_html(
            """
            <html><body>
                <script>alert('script')</script>
                <button onclick="alert('click')">Safe button</button>
                <a href="javascript:alert('link')">Safe link</a>
                <iframe src="https://example.com">unsafe frame</iframe>
            </body></html>
            """
        )

        self.assertIn("Safe button", markup)
        self.assertIn("Safe link", markup)
        self.assertNotIn("<script", markup)
        self.assertNotIn("onclick", markup)
        self.assertNotIn("javascript:", markup)
        self.assertNotIn("<iframe", markup)

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
