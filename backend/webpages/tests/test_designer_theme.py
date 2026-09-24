import io
import zipfile
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient

from core.models import Tenant
from webpages.models import PageTheme, ThemeDesignerAssignment, ThemeDesignerRevision
from webpages.services.designer_export import ThemeDesignerExporter
from webpages.services.designer_theme import generate_placeholder_png


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


class DesignerPlaceholderTests(TestCase):
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
