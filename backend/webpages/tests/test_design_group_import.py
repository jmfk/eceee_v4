from io import BytesIO
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Tenant
from webpages.models import PageTheme
from webpages.views.page_theme_views import PageThemeViewSet


class DesignGroupImportAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("theme-importer", password="test")
        self.tenant = Tenant.objects.create(name="Theme tenant", identifier="theme-tenant", created_by=self.user)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)
        self.target = PageTheme.objects.create(
            name="Target",
            tenant=self.tenant,
            created_by=self.user,
            design_groups={"groups": [{"name": "Header", "elements": {"h1": {"color": "red"}}}]},
        )
        self.source = PageTheme.objects.create(
            name="Source",
            tenant=self.tenant,
            created_by=self.user,
            design_groups={
                "groups": [
                    {
                        "name": "Header",
                        "widgetTypes": ["easy_widgets.HeaderWidget"],
                        "layoutProperties": {
                            "header-widget": {
                                "xs": {
                                    "backgroundImage": {
                                        "url": f"theme_images/{self.target.id + 1}/library/header.png",
                                        "filename": "header.png",
                                    }
                                }
                            }
                        },
                    },
                    {"name": "Cards", "elements": {"h2": {"color": "blue"}}},
                ]
            },
        )
        # Use the actual source id in the fixture URL.
        self.source.design_groups["groups"][0]["layoutProperties"]["header-widget"]["xs"]["backgroundImage"][
            "url"
        ] = f"theme_images/{self.source.id}/library/header.png"
        self.source.save(update_fields=["design_groups"])

    def payload(self, indices, resolution=None):
        data = {"source_theme_id": self.source.id, "group_indices": indices}
        if resolution:
            data["conflict_resolution"] = resolution
        return data

    def test_lists_only_sources_from_the_selected_tenant(self):
        other_user = User.objects.create_user("other-theme-owner", password="test")
        other_tenant = Tenant.objects.create(name="Other", identifier="other-theme", created_by=other_user)
        PageTheme.objects.create(name="Hidden", tenant=other_tenant, created_by=other_user)

        response = self.client.get(reverse("api:pagetheme-importable-design-groups", kwargs={"pk": self.target.pk}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([theme["id"] for theme in response.data["themes"]], [self.source.id])
        self.assertEqual(response.data["themes"][0]["groups"][0]["image_count"], 1)

    def test_preview_reports_conflicts_without_changing_the_target(self):
        response = self.client.post(
            reverse("api:pagetheme-preview-design-group-import", kwargs={"pk": self.target.pk}),
            self.payload([0, 1]),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["conflict_count"], 1)
        self.assertEqual(response.data["image_count"], 1)
        self.target.refresh_from_db()
        self.assertEqual([group["name"] for group in self.target.design_groups["groups"]], ["Header"])

    @patch("webpages.views.page_theme_views.system_storage")
    def test_skip_keeps_conflicting_group_and_imports_non_conflicting_group(self, storage):
        storage.exists.side_effect = lambda path: path.startswith(f"theme_images/{self.source.id}/")
        storage._open.return_value = BytesIO(b"image")
        storage.url.side_effect = lambda path: f"https://storage.test/{path}"

        response = self.client.post(
            reverse("api:pagetheme-import-design-groups", kwargs={"pk": self.target.pk}),
            self.payload([0, 1], "skip"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["imported"], ["Cards"])
        self.assertEqual(response.data["skipped"], ["Header"])
        self.assertEqual(response.data["copied_images"], 0)
        self.target.refresh_from_db()
        self.assertEqual([group["name"] for group in self.target.design_groups["groups"]], ["Header", "Cards"])

    @patch("webpages.views.page_theme_views.system_storage")
    def test_overwrite_replaces_group_and_copies_images_to_target_library(self, storage):
        source_path = f"theme_images/{self.source.id}/library/header.png"
        storage.exists.side_effect = lambda path: path == source_path
        storage._open.return_value = BytesIO(b"image")
        storage.save.side_effect = lambda path, _content: path
        storage.url.side_effect = lambda path: f"https://storage.test/{path}"

        response = self.client.post(
            reverse("api:pagetheme-import-design-groups", kwargs={"pk": self.target.pk}),
            self.payload([0], "overwrite"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["imported"], ["Header"])
        self.assertEqual(response.data["copied_images"], 1)
        storage.save.assert_called_once()
        self.target.refresh_from_db()
        imported_image = self.target.design_groups["groups"][0]["layoutProperties"]["header-widget"]["xs"][
            "backgroundImage"
        ]
        self.assertEqual(
            imported_image["url"],
            f"https://storage.test/theme_images/{self.target.id}/library/header.png",
        )
        self.assertEqual(imported_image["filename"], "header.png")

    @patch("webpages.views.page_theme_views.system_storage")
    def test_image_name_collision_uses_the_actual_saved_name(self, storage):
        source_path = f"theme_images/{self.source.id}/library/header.png"
        target_path = f"theme_images/{self.target.id}/library/header.png"
        collision_path = f"theme_images/{self.target.id}/library/header_from_theme_{self.source.id}.png"
        storage.exists.side_effect = lambda path: path == source_path
        storage._open.return_value = BytesIO(b"image")
        storage.save.return_value = collision_path
        storage.url.side_effect = lambda path: f"https://storage.test/{path}"

        response = self.client.post(
            reverse("api:pagetheme-import-design-groups", kwargs={"pk": self.target.pk}),
            self.payload([0], "overwrite"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.target.refresh_from_db()
        imported_image = self.target.design_groups["groups"][0]["layoutProperties"]["header-widget"]["xs"][
            "backgroundImage"
        ]
        self.assertEqual(imported_image["url"], f"https://storage.test/{collision_path}")
        self.assertEqual(imported_image["filename"], f"header_from_theme_{self.source.id}.png")
        storage.save.assert_called_once()
        self.assertEqual(storage.save.call_args.args[0], target_path)

    def test_import_merges_into_the_latest_target_design_groups(self):
        stale_target = PageTheme.objects.get(pk=self.target.pk)
        latest_design_groups = {
            "groups": [
                {"name": "Header", "elements": {"h1": {"color": "red"}}},
                {"name": "Footer", "elements": {"p": {"color": "gray"}}},
            ]
        }
        PageTheme.objects.filter(pk=self.target.pk).update(design_groups=latest_design_groups)

        with patch.object(PageThemeViewSet, "get_object", return_value=stale_target):
            response = self.client.post(
                reverse("api:pagetheme-import-design-groups", kwargs={"pk": self.target.pk}),
                self.payload([1], "skip"),
                format="json",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.target.refresh_from_db()
        self.assertEqual(
            [group["name"] for group in self.target.design_groups["groups"]],
            ["Header", "Footer", "Cards"],
        )

    def test_cannot_import_from_a_theme_in_another_tenant(self):
        other_user = User.objects.create_user("foreign-owner", password="test")
        other_tenant = Tenant.objects.create(name="Foreign", identifier="foreign", created_by=other_user)
        foreign = PageTheme.objects.create(
            name="Foreign theme",
            tenant=other_tenant,
            created_by=other_user,
            design_groups={"groups": [{"name": "Foreign group"}]},
        )

        response = self.client.post(
            reverse("api:pagetheme-preview-design-group-import", kwargs={"pk": self.target.pk}),
            {"source_theme_id": foreign.id, "group_indices": [0]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
