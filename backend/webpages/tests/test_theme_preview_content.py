import io
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Tenant
from object_storage.models import ObjectInstance, ObjectTypeDefinition
from webpages.models import PageTheme, PageVersion, WebPage
from webpages.services.theme_preview_content import import_theme_preview_document, rewrite_theme_library_image_urls


class ThemePreviewContentTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("theme-preview-owner", password="test")
        self.tenant = Tenant.objects.create(
            name="Theme preview tenant",
            identifier="theme-preview-tenant",
            created_by=self.user,
        )
        self.other_tenant = Tenant.objects.create(
            name="Other tenant",
            identifier="other-preview-tenant",
            created_by=self.user,
        )
        self.theme = PageTheme.objects.create(
            tenant=self.tenant,
            created_by=self.user,
            name="Portable theme",
        )
        self.root = WebPage.objects.create(
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
            title="Example site",
            slug="example-site",
            hostnames=["example.test"],
        )
        self.page = WebPage.objects.create(
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
            parent=self.root,
            title="Article",
            slug="article",
        )
        self.page_version = PageVersion.objects.create(
            page=self.page,
            version_number=1,
            version_title="Draft",
            created_by=self.user,
            code_layout="main_layout",
            page_data={
                "intro": "Copied body",
                "body": '<p>Rich text</p><img src="https://storage.test/media/uploads/article.jpg">',
                "siteId": self.root.id,
            },
            widgets={
                "main": [
                    {
                        "id": "hero",
                        "type": "easy_widgets.ImageWidget",
                        "config": {
                            "imageUrl": "https://storage.test/media/uploads/article.jpg",
                            "pageId": self.page.id,
                        },
                    }
                ]
            },
        )
        self.page.latest_version = self.page_version
        self.page.save(update_fields=["latest_version"])

        self.object_type = ObjectTypeDefinition.objects.create(
            name="theme-preview-article",
            label="Article",
            plural_label="Articles",
            created_by=self.user,
            schema={
                "type": "object",
                "properties": {
                    "summary": {"type": "string", "componentType": "textarea"},
                    "related": {"type": "integer", "componentType": "object_reference"},
                },
            },
            slot_configuration={"slots": [{"name": "main", "label": "Main"}]},
        )
        self.object = ObjectInstance.objects.create(
            tenant=self.tenant,
            object_type=self.object_type,
            title="Imported object",
            slug="imported-object",
            created_by=self.user,
        )
        self.other_page = WebPage.objects.create(
            tenant=self.other_tenant,
            created_by=self.user,
            last_modified_by=self.user,
            title="Private page",
            slug="private-page",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.client.credentials(HTTP_X_TENANT_ID=self.tenant.identifier)

    def test_sources_only_include_content_from_selected_tenant(self):
        response = self.client.get(f"/api/v1/webpages/themes/{self.theme.id}/preview-content/sources/")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn(self.page.id, [source["id"] for source in response.data["pages"]])
        self.assertNotIn(self.other_page.id, [source["id"] for source in response.data["pages"]])
        self.assertEqual([source["id"] for source in response.data["objects"]], [self.object.id])
        self.assertTrue(response.data["layouts"])
        self.assertIn(self.object_type.name, [source["key"] for source in response.data["objectTypes"]])

    @patch("webpages.services.theme_preview_content.system_storage")
    def test_page_import_detaches_source_and_copies_managed_images(self, storage):
        storage.bucket_name = "media"
        storage.exists.return_value = True
        storage.open.return_value = io.BytesIO(b"copied-image")
        storage.save.return_value = f"theme_images/{self.theme.id}/library/article-copy.jpg"
        storage.url.return_value = "https://storage.test/media/theme_images/1/library/article-copy.jpg"

        preview, copied_images = import_theme_preview_document(self.theme, "page", self.page.id)

        self.assertEqual(preview["kind"], "page")
        self.assertEqual(preview["content"]["pageData"]["intro"], "Copied body")
        self.assertNotIn("siteId", preview["content"]["pageData"])
        self.assertIn("theme_images/1/library/article-copy.jpg", preview["content"]["pageData"]["body"])
        config = preview["content"]["widgets"]["main"][0]["config"]
        self.assertNotIn("pageId", config)
        self.assertIn("theme_images/1/library/article-copy.jpg", config["imageUrl"])
        self.assertEqual(copied_images, 1)
        storage.save.assert_called_once()

    @patch("webpages.services.theme_preview_content.ObjectVersion.objects.filter")
    @patch("webpages.services.theme_preview_content.ObjectInstance.objects.filter")
    def test_object_import_snapshots_schema_and_removes_object_references(self, instance_filter, version_filter):
        self.object.current_version_id = 999
        instance_filter.return_value.select_related.return_value.first.return_value = self.object
        version_filter.return_value.values.return_value.first.return_value = {
            "data": {"summary": "Object body", "related": 999},
            "widgets": {"main": []},
        }

        preview, copied_images = import_theme_preview_document(self.theme, "object", self.object.id)

        self.assertEqual(preview["kind"], "object")
        self.assertEqual(preview["objectType"]["key"], self.object_type.name)
        self.assertEqual(preview["content"]["data"]["summary"], "Object body")
        self.assertIsNone(preview["content"]["data"]["related"])
        self.assertNotIn("id", preview["objectType"])
        self.assertEqual(copied_images, 0)

    def test_import_endpoint_rejects_page_from_another_tenant(self):
        response = self.client.post(
            f"/api/v1/webpages/themes/{self.theme.id}/preview-content/import/",
            {"sourceKind": "page", "sourceId": self.other_page.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "That page is not available in this account.")

    def test_theme_package_import_rewrites_preview_library_urls(self):
        preview = {
            "views": [
                {
                    "content": {
                        "widgets": {
                            "main": [{"config": {"imageUrl": "https://old.test/theme_images/8/library/hero.jpg"}}]
                        },
                        "pageData": {
                            "body": '<img src="https://old.test/theme_images/8/library/hero.jpg">',
                        },
                    }
                }
            ]
        }

        rewritten = rewrite_theme_library_image_urls(
            preview,
            {"hero.jpg": "https://new.test/theme_images/12/library/hero.jpg"},
        )

        self.assertIn("theme_images/12/library/hero.jpg", rewritten["views"][0]["content"]["pageData"]["body"])
        self.assertEqual(
            rewritten["views"][0]["content"]["widgets"]["main"][0]["config"]["imageUrl"],
            "https://new.test/theme_images/12/library/hero.jpg",
        )
