from unittest.mock import patch

from cryptography.fernet import Fernet
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core.models import Tenant
from webpages.models import PageTheme, ThemeDesignerAssignment, ThemeRemoteAccessKey, ThemeRemoteConnection
from webpages.services.theme_remote_credentials import encrypt_access_key, generate_access_key


@override_settings(THEME_REMOTE_CREDENTIAL_KEYS=[Fernet.generate_key().decode()])
class ThemeVersionApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("theme-admin", password="test")
        self.tenant = Tenant.objects.create(
            name="Design workspace", identifier="design-workspace", created_by=self.user
        )
        self.left = PageTheme.objects.create(
            tenant=self.tenant,
            created_by=self.user,
            name="Editorial",
            colors={"brand": "#112233"},
        )
        self.right = PageTheme.objects.create(
            tenant=self.tenant,
            created_by=self.user,
            name="Editorial copy",
            colors={"brand": "#112233"},
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.client.credentials(HTTP_X_TENANT_ID=str(self.tenant.id))

    def test_material_changes_append_versions_but_identical_saves_do_not(self):
        self.assertEqual(self.left.versions.count(), 1)
        self.left.save()
        self.assertEqual(self.left.versions.count(), 1)
        self.left.colors = {"brand": "#445566"}
        self.left.save(version_created_by=self.user)
        self.assertEqual(self.left.versions.count(), 2)

    def test_legacy_snapshot_without_asset_fields_is_still_current(self):
        version = self.left.versions.first()
        version.snapshot.pop("image", None)
        version.snapshot.pop("site_icon", None)
        version.save(update_fields=["snapshot"])
        self.left.image.name = "theme_images/legacy-current-preview.png"

        response = self.client.get(f"/api/v1/webpages/designer/themes/{self.left.id}/versions/")

        self.assertEqual(self.left.versions.count(), 1)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data["results"][0]["isCurrent"])

    def test_named_checkpoint_gets_next_number_and_name_can_change_without_changing_snapshot(self):
        original = self.left.versions.first()
        response = self.client.post(
            f"/api/v1/webpages/designer/themes/{self.left.id}/versions/",
            {"name": "Before rebrand"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["versionNumber"], 2)
        checkpoint = self.left.versions.get(id=response.data["id"])
        self.assertEqual(checkpoint.name, "Before rebrand")
        self.assertEqual(checkpoint.snapshot, original.snapshot)
        self.assertEqual(checkpoint.content_hash, original.content_hash)

        history = self.client.get(f"/api/v1/webpages/designer/themes/{self.left.id}/versions/")
        self.assertEqual(history.status_code, 200, history.data)
        self.assertTrue(history.data["results"][0]["isCurrent"])
        self.assertFalse(history.data["results"][1]["isCurrent"])

        renamed = self.client.patch(
            f"/api/v1/webpages/designer/themes/{self.left.id}/versions/{checkpoint.id}/",
            {"name": "Production"},
            format="json",
        )
        self.assertEqual(renamed.status_code, 200, renamed.data)
        checkpoint.refresh_from_db()
        self.assertEqual(checkpoint.name, "Production")
        self.assertEqual(checkpoint.snapshot, original.snapshot)
        self.assertEqual(checkpoint.content_hash, original.content_hash)

    def test_compare_reports_changed_paths_and_newer_theme(self):
        self.right.colors = {"brand": "#ffffff"}
        self.right.save()
        response = self.client.post(
            "/api/v1/webpages/designer/themes/compare/",
            {"left_theme_id": self.left.id, "right_theme_id": self.right.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["identical"])
        self.assertIn("colors.brand", response.data["changedPaths"])
        self.assertEqual(response.data["newerThemeId"], self.right.id)

    def test_compare_ignores_names_and_other_operational_metadata(self):
        response = self.client.post(
            "/api/v1/webpages/designer/themes/compare/",
            {"left_theme_id": self.left.id, "right_theme_id": self.right.id},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["identical"])

    def test_restore_appends_a_new_current_version(self):
        original = self.left.versions.first()
        self.left.colors = {"brand": "#abcdef"}
        self.left.save()
        response = self.client.post(f"/api/v1/webpages/designer/themes/{self.left.id}/versions/{original.id}/restore/")
        self.assertEqual(response.status_code, 200)
        self.left.refresh_from_db()
        self.assertEqual(self.left.colors, {"brand": "#112233"})
        self.assertEqual(self.left.versions.count(), 3)

    def test_preview_image_and_site_icon_are_versioned_and_restored(self):
        self.left.image.name = "theme_images/original-preview.png"
        self.left.site_icon.name = "theme_icons/original-icon.png"
        self.left.save(version_created_by=self.user)
        original_assets = self.left.versions.first()
        self.assertEqual(original_assets.snapshot["image"], "theme_images/original-preview.png")
        self.assertEqual(original_assets.snapshot["site_icon"], "theme_icons/original-icon.png")

        self.left.image.name = "theme_images/replacement-preview.png"
        self.left.site_icon.name = "theme_icons/replacement-icon.png"
        self.left.save(version_created_by=self.user)
        response = self.client.post(
            f"/api/v1/webpages/designer/themes/{self.left.id}/versions/{original_assets.id}/restore/"
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.left.refresh_from_db()
        self.assertEqual(self.left.image.name, "theme_images/original-preview.png")
        self.assertEqual(self.left.site_icon.name, "theme_icons/original-icon.png")

    def test_compare_reports_preview_image_and_site_icon_differences(self):
        self.left.image.name = "theme_images/left-preview.png"
        self.left.site_icon.name = "theme_icons/left-icon.png"
        self.left.save()
        self.right.image.name = "theme_images/right-preview.png"
        self.right.site_icon.name = "theme_icons/right-icon.png"
        self.right.save()

        response = self.client.post(
            "/api/v1/webpages/designer/themes/compare/",
            {"left_theme_id": self.left.id, "right_theme_id": self.right.id},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertCountEqual(response.data["changedAreas"], ["image", "site_icon"])

    @patch("webpages.views.designer_theme_views.remote_sync_request")
    def test_remote_download_adds_version_without_replacing_current_head(self, remote_request):
        connection = ThemeRemoteConnection.objects.create(
            tenant=self.tenant,
            name="Production",
            base_url="https://remote.example",
            remote_workspace="remote-workspace",
            encrypted_access_key=encrypt_access_key("secret-token"),
            is_default=True,
            created_by=self.user,
            updated_by=self.user,
        )
        remote_request.return_value = {
            "themes": [
                {
                    "stable_key": str(self.left.stable_key),
                    "name": self.left.name,
                    "colors": {"brand": "#ffffff"},
                    "sync_version": 7,
                }
            ]
        }
        response = self.client.post(
            "/api/v1/webpages/designer/themes/remote/pull/",
            {
                "connection_id": str(connection.id),
                "stable_key": str(self.left.stable_key),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.left.refresh_from_db()
        self.assertEqual(self.left.colors, {"brand": "#112233"})
        self.assertEqual(self.left.versions.first().snapshot["colors"], {"brand": "#ffffff"})

    def test_designer_can_use_connection_but_cannot_manage_it_or_read_key(self):
        designer = User.objects.create_user("restricted-designer", password="test")
        ThemeDesignerAssignment.objects.create(
            tenant=self.tenant,
            theme=self.left,
            user=designer,
            created_by=self.user,
        )
        connection = ThemeRemoteConnection.objects.create(
            tenant=self.tenant,
            name="Production",
            base_url="https://remote.example",
            remote_workspace="remote",
            encrypted_access_key=encrypt_access_key("secret-token"),
            is_default=True,
            created_by=self.user,
            updated_by=self.user,
        )
        self.client.force_authenticate(designer)
        response = self.client.get("/api/v1/webpages/designer/remote-connections/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["canManage"])
        self.assertEqual(response.data["results"][0]["id"], str(connection.id))
        self.assertNotIn("accessKey", response.data["results"][0])
        with patch("webpages.views.designer_theme_views.remote_sync_request") as remote_request:
            remote_request.return_value = {"themes": []}
            use_response = self.client.post(
                "/api/v1/webpages/designer/themes/remote/",
                {"connection_id": str(connection.id)},
                format="json",
            )
            self.assertEqual(use_response.status_code, 200)
            remote_request.assert_called_once_with(
                "https://remote.example",
                "remote",
                "secret-token",
                "pull",
                None,
            )
        create_response = self.client.post(
            "/api/v1/webpages/designer/remote-connections/",
            {"name": "Other", "base_url": "https://other.example", "remote_workspace": "remote", "access_key": "no"},
            format="json",
        )
        self.assertEqual(create_response.status_code, 403)

    def test_first_connection_is_default_and_only_ciphertext_is_persisted(self):
        response = self.client.post(
            "/api/v1/webpages/designer/remote-connections/",
            {
                "name": "Production",
                "base_url": "https://remote.example",
                "remote_workspace": "remote",
                "access_key": "plain-secret",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        connection = ThemeRemoteConnection.objects.get()
        self.assertTrue(connection.is_default)
        self.assertNotEqual(connection.encrypted_access_key, "plain-secret")
        self.assertNotIn("accessKey", response.data)

        second_response = self.client.post(
            "/api/v1/webpages/designer/remote-connections/",
            {
                "name": "Staging",
                "base_url": "https://staging.example",
                "remote_workspace": "staging",
                "access_key": "other-secret",
                "is_default": True,
            },
            format="json",
        )
        self.assertEqual(second_response.status_code, 201)
        connection.refresh_from_db()
        self.assertFalse(connection.is_default)
        self.assertEqual(ThemeRemoteConnection.objects.filter(tenant=self.tenant, is_default=True).count(), 1)

        delete_response = self.client.delete(
            f"/api/v1/webpages/designer/remote-connections/{second_response.data['id']}/"
        )
        self.assertEqual(delete_response.status_code, 204)
        connection.refresh_from_db()
        self.assertTrue(connection.is_default)

    @override_settings(THEME_SYNC_ENABLED=True)
    def test_scoped_remote_access_key_authenticates_only_for_its_workspace(self):
        raw_key, key_hash, key_prefix = generate_access_key()
        ThemeRemoteAccessKey.objects.create(
            tenant=self.tenant,
            name="Designer sync",
            key_hash=key_hash,
            key_prefix=key_prefix,
            created_by=self.user,
        )
        self.client.force_authenticate(user=None)
        self.client.credentials(
            HTTP_X_TENANT_ID=str(self.tenant.id),
            HTTP_AUTHORIZATION=f"ThemeKey {raw_key}",
        )
        response = self.client.post("/api/v1/webpages/themes/sync/pull/", {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["themes"][0]["name"], self.left.name)

    @override_settings(THEME_SYNC_ENABLED=True)
    def test_sync_upload_of_identical_content_still_appends_a_remote_version(self):
        previous_count = self.left.versions.count()
        response = self.client.post(
            "/api/v1/webpages/themes/sync/push/",
            {
                "sync_version": self.left.sync_version,
                "theme_data": {
                    "stable_key": str(self.left.stable_key),
                    "name": self.left.name,
                    "colors": self.left.colors,
                },
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.left.versions.count(), previous_count + 1)
