import io
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient

from content.models import Namespace
from core.models import Tenant
from file_manager.models import MediaCollection, MediaFile
from object_storage.models import ObjectInstance, ObjectTypeDefinition, ObjectVersion
from webpages.models import PageTheme, PageVersion, WebPage
from webpages.serializers.theme import PageThemeSerializer
from webpages.services.theme_preview_content import (
    MAX_IMPORTED_IMAGE_BYTES,
    _copy_preview_images,
    _managed_storage_path,
    import_theme_preview_document,
    normalize_theme_preview_namespaces,
    rewrite_theme_library_image_urls,
)


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
        self.namespace = Namespace.objects.create(
            name="Theme preview media",
            slug="theme-preview-media",
            tenant=self.tenant,
            created_by=self.user,
            is_default=True,
        )
        self.media_file = MediaFile.objects.create(
            title="Article image",
            slug="article-image",
            original_filename="article.jpg",
            file_path="uploads/article.jpg",
            file_size=12,
            content_type="image/jpeg",
            file_hash="a" * 64,
            uploaded_by=self.user,
            file_type="image",
            namespace=self.namespace,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
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
                "currentVersionId": 123,
                "published_version_id": 456,
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
            namespace=self.namespace,
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
        self.assertEqual(response.data["defaultNamespace"]["slug"], self.namespace.slug)

    def test_sources_apply_tenant_default_namespace_to_object_types_without_one(self):
        object_type = ObjectTypeDefinition.objects.create(
            name="theme-preview-with-default-namespace",
            label="Default namespace object",
            plural_label="Default namespace objects",
            created_by=self.user,
            schema={"type": "object", "properties": {}},
        )

        response = self.client.get(f"/api/v1/webpages/themes/{self.theme.id}/preview-content/sources/")

        self.assertEqual(response.status_code, 200, response.data)
        snapshot = next(source for source in response.data["objectTypes"] if source["key"] == object_type.name)
        self.assertEqual(snapshot["namespace"]["slug"], self.namespace.slug)

    def test_sources_replace_another_tenants_object_type_namespace(self):
        foreign_namespace = Namespace.objects.create(
            name="Foreign preview media",
            slug="foreign-preview-media",
            tenant=self.other_tenant,
            created_by=self.user,
        )
        object_type = ObjectTypeDefinition.objects.create(
            name="theme-preview-with-foreign-namespace",
            label="Foreign namespace object",
            plural_label="Foreign namespace objects",
            created_by=self.user,
            namespace=foreign_namespace,
            schema={"type": "object", "properties": {}},
        )

        response = self.client.get(f"/api/v1/webpages/themes/{self.theme.id}/preview-content/sources/")

        self.assertEqual(response.status_code, 200, response.data)
        snapshot = next(source for source in response.data["objectTypes"] if source["key"] == object_type.name)
        self.assertEqual(snapshot["namespace"]["slug"], self.namespace.slug)

    def test_theme_import_replaces_foreign_preview_namespace_with_tenant_default(self):
        preview = {
            "views": [
                {
                    "kind": "object",
                    "objectType": {
                        "key": "article",
                        "namespace": {"id": 999, "slug": "foreign"},
                        "schema": {"properties": {"related": {"componentType": "object_reference"}}},
                    },
                    "content": {"data": {"related": 123}, "widgets": {}},
                }
            ]
        }

        normalized = normalize_theme_preview_namespaces(preview, self.tenant)

        self.assertEqual(normalized["views"][0]["objectType"]["namespace"]["slug"], self.namespace.slug)
        self.assertIsNone(normalized["views"][0]["content"]["data"]["related"])
        self.assertEqual(preview["views"][0]["objectType"]["namespace"]["slug"], "foreign")
        self.assertEqual(preview["views"][0]["content"]["data"]["related"], 123)

    @patch("webpages.services.theme_preview_content.system_storage")
    def test_managed_storage_path_rejects_external_origins_and_buckets(self, storage):
        storage.bucket_name = "media"
        storage.url.side_effect = lambda path: f"https://storage.test/media/{path}"

        self.assertIsNone(_managed_storage_path("https://cdn.example/uploads/article.jpg"))
        self.assertIsNone(_managed_storage_path("s3://other-bucket/uploads/article.jpg"))
        self.assertEqual(
            _managed_storage_path("https://storage.test/media/uploads/article.jpg"),
            "uploads/article.jpg",
        )
        self.assertEqual(_managed_storage_path("s3://media/uploads/article.jpg"), "uploads/article.jpg")

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
        self.assertNotIn("currentVersionId", preview["content"]["pageData"])
        self.assertNotIn("published_version_id", preview["content"]["pageData"])
        self.assertIn("theme_images/1/library/article-copy.jpg", preview["content"]["pageData"]["body"])
        config = preview["content"]["widgets"]["main"][0]["config"]
        self.assertNotIn("pageId", config)
        self.assertIn("theme_images/1/library/article-copy.jpg", config["imageUrl"])
        self.assertEqual(copied_images, 1)
        storage.save.assert_called_once()

    @patch("webpages.services.theme_preview_content.system_storage")
    def test_page_import_copies_canonical_and_uuid_media_urls(self, storage):
        canonical_url = self.media_file.get_absolute_url()
        uuid_url = f"/api/v1/media/file/{self.media_file.id}/"
        self.page_version.page_data = {"body": f'<img data-media-id="{self.media_file.id}" src="{canonical_url}">'}
        self.page_version.widgets = {
            "main": [
                {
                    "id": "image-widget",
                    "config": {
                        "mediaItems": [
                            {
                                "id": str(self.media_file.id),
                                "mediaId": str(self.media_file.id),
                                "fileId": str(self.media_file.id),
                                "type": "image",
                                "fileUrl": uuid_url,
                            }
                        ]
                    },
                }
            ]
        }
        self.page_version.save(update_fields=["page_data", "widgets"])
        copied_path = f"theme_images/{self.theme.id}/library/article-copy.jpg"
        copied_url = f"https://storage.test/media/{copied_path}"
        storage.exists.return_value = True
        storage.open.return_value = io.BytesIO(b"copied-image")
        storage.save.return_value = copied_path
        storage.url.return_value = copied_url

        preview, copied_images = import_theme_preview_document(self.theme, "page", self.page.id)

        self.assertIn(copied_url, preview["content"]["pageData"]["body"])
        self.assertNotIn("data-media-id", preview["content"]["pageData"]["body"])
        widget = preview["content"]["widgets"]["main"][0]
        media_item = widget["config"]["mediaItems"][0]
        self.assertEqual(widget["id"], "image-widget")
        self.assertEqual(media_item["fileUrl"], copied_url)
        self.assertNotIn("id", media_item)
        self.assertNotIn("mediaId", media_item)
        self.assertNotIn("fileId", media_item)
        self.assertEqual(copied_images, 1)
        storage.open.assert_called_once_with(self.media_file.file_path, "rb")

    @patch("webpages.services.theme_preview_content.system_storage")
    def test_page_import_does_not_copy_another_tenants_canonical_media_url(self, storage):
        foreign_namespace = Namespace.objects.create(
            name="Foreign canonical media",
            slug="foreign-canonical-media",
            tenant=self.other_tenant,
            created_by=self.user,
        )
        foreign_media = MediaFile.objects.create(
            title="Foreign image",
            slug="foreign-image",
            original_filename="foreign.jpg",
            file_path="uploads/foreign.jpg",
            file_size=12,
            content_type="image/jpeg",
            file_hash="b" * 64,
            uploaded_by=self.user,
            file_type="image",
            namespace=foreign_namespace,
            tenant=self.other_tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        foreign_url = foreign_media.get_absolute_url()
        self.page_version.page_data = {"body": f'<img src="{foreign_url}">'}
        self.page_version.widgets = {}
        self.page_version.save(update_fields=["page_data", "widgets"])

        preview, copied_images = import_theme_preview_document(self.theme, "page", self.page.id)

        self.assertEqual(preview["content"]["pageData"]["body"], f'<img src="{foreign_url}">')
        self.assertEqual(copied_images, 0)
        storage.open.assert_not_called()
        storage.save.assert_not_called()

    def test_page_import_materializes_media_navigation_link_before_removing_id(self):
        document = MediaFile.objects.create(
            title="Programme PDF",
            slug="programme",
            original_filename="programme.pdf",
            file_path="uploads/programme.pdf",
            file_size=12,
            content_type="application/pdf",
            file_hash="c" * 64,
            uploaded_by=self.user,
            file_type="document",
            namespace=self.namespace,
            tenant=self.tenant,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.page_version.page_data = {}
        self.page_version.widgets = {
            "navbar": [
                {
                    "id": "navigation-widget",
                    "config": {"menuItems": [{"type": "media", "mediaId": str(document.id), "label": "Programme"}]},
                }
            ]
        }
        self.page_version.save(update_fields=["page_data", "widgets"])

        preview, copied_images = import_theme_preview_document(self.theme, "page", self.page.id)

        widget = preview["content"]["widgets"]["navbar"][0]
        link = widget["config"]["menuItems"][0]
        self.assertEqual(widget["id"], "navigation-widget")
        self.assertEqual(link["url"], document.get_absolute_url())
        self.assertNotIn("mediaId", link)
        self.assertEqual(copied_images, 0)

    @patch("webpages.services.theme_preview_content.system_storage")
    def test_page_import_does_not_copy_another_tenants_theme_image(self, storage):
        other_theme = PageTheme.objects.create(
            tenant=self.other_tenant,
            created_by=self.user,
            name="Private theme",
        )
        private_url = f"https://storage.test/media/theme_images/{other_theme.id}/library/private.jpg"
        self.page_version.page_data = {"body": f'<img src="{private_url}">'}
        self.page_version.widgets = {}
        self.page_version.save(update_fields=["page_data", "widgets"])
        storage.bucket_name = "media"
        storage.url.return_value = private_url

        preview, copied_images = import_theme_preview_document(self.theme, "page", self.page.id)

        self.assertEqual(preview["content"]["pageData"]["body"], f'<img src="{private_url}">')
        self.assertEqual(copied_images, 0)
        storage.exists.assert_not_called()
        storage.open.assert_not_called()
        storage.save.assert_not_called()

    @patch("webpages.services.theme_preview_content.MediaFile.objects.filter")
    @patch("webpages.services.theme_preview_content.system_storage")
    def test_failed_image_import_removes_files_already_copied(self, storage, media_filter):
        media_filter.return_value.exists.return_value = True
        storage.exists.return_value = True
        storage.open.side_effect = [
            io.BytesIO(b"small-image"),
            io.BytesIO(b"x" * (MAX_IMPORTED_IMAGE_BYTES + 1)),
        ]
        saved_path = f"theme_images/{self.theme.id}/library/copied.jpg"
        storage.save.return_value = saved_path
        storage.url.return_value = f"https://storage.test/media/{saved_path}"

        with self.assertRaises(ValidationError):
            _copy_preview_images(
                self.theme,
                {
                    "firstImage": "uploads/first.jpg",
                    "secondImage": "uploads/second.jpg",
                },
            )

        storage.save.assert_called_once()
        storage.delete.assert_called_once_with(saved_path)

    @patch("webpages.services.theme_preview_content.system_storage")
    def test_collection_image_widget_is_materialized_without_live_collection_id(self, storage):
        collection = MediaCollection.objects.create(
            title="Article gallery",
            namespace=self.namespace,
            created_by=self.user,
            last_modified_by=self.user,
        )
        self.media_file.collections.add(collection)
        self.page_version.page_data = {}
        self.page_version.widgets = {
            "main": [
                {
                    "id": "gallery",
                    "type": "easy_widgets.ImageWidget",
                    "config": {
                        "image": {"id": str(collection.id), "type": "collection"},
                        "mediaItems": [{"url": self.media_file.get_absolute_url()}],
                        "collectionId": str(collection.id),
                    },
                }
            ]
        }
        self.page_version.save(update_fields=["page_data", "widgets"])
        saved_path = f"theme_images/{self.theme.id}/library/article-image.jpg"
        storage.exists.return_value = True
        storage.open.return_value = io.BytesIO(b"image")
        storage.save.return_value = saved_path
        storage.url.return_value = f"https://storage.test/media/{saved_path}"

        preview, copied_images = import_theme_preview_document(self.theme, "page", self.page.id)

        config = preview["content"]["widgets"]["main"][0]["config"]
        self.assertNotIn("image", config)
        self.assertNotIn("collectionId", config)
        self.assertEqual(copied_images, 1)
        self.assertEqual(len(config["mediaItems"]), 1)
        self.assertIn(f"theme_images/{self.theme.id}/library/", config["mediaItems"][0]["url"])
        self.assertNotIn(str(collection.id), str(config))

    def test_page_import_removes_object_children_parent_but_keeps_widget_id(self):
        self.page_version.page_data = {}
        self.page_version.widgets = {
            "main": [
                {
                    "id": "children-widget",
                    "type": "object_storage.ObjectChildrenWidget",
                    "config": {"parent_object_id": self.object.id, "limit": 5},
                }
            ]
        }
        self.page_version.save(update_fields=["page_data", "widgets"])

        preview, copied_images = import_theme_preview_document(self.theme, "page", self.page.id)

        widget = preview["content"]["widgets"]["main"][0]
        self.assertEqual(widget["id"], "children-widget")
        self.assertNotIn("parent_object_id", widget["config"])
        self.assertEqual(widget["config"]["limit"], 5)
        self.assertEqual(copied_images, 0)

    @patch("webpages.services.theme_preview_content.ObjectVersion.objects.filter")
    @patch("webpages.services.theme_preview_content.ObjectInstance.objects.filter")
    def test_object_import_snapshots_schema_and_removes_object_references(self, instance_filter, version_filter):
        self.object.current_version_id = 999
        self.object_type.schema["properties"].update(
            {
                "canonicalRelated": {"type": "integer", "field_type": "object_reference"},
                "canonicalRelatedList": {"type": "array", "field_type": "object_reference"},
            }
        )
        instance_filter.return_value.select_related.return_value.first.return_value = self.object
        version_filter.return_value.values.return_value.first.return_value = {
            "data": {
                "summary": "Object body",
                "related": 999,
                "canonicalRelated": 1000,
                "canonicalRelatedList": [1001, 1002],
            },
            "widgets": {"main": []},
        }

        preview, copied_images = import_theme_preview_document(self.theme, "object", self.object.id)

        self.assertEqual(preview["kind"], "object")
        self.assertEqual(preview["objectType"]["key"], self.object_type.name)
        self.assertEqual(preview["objectType"]["namespace"]["slug"], self.namespace.slug)
        self.assertEqual(preview["content"]["data"]["summary"], "Object body")
        self.assertIsNone(preview["content"]["data"]["related"])
        self.assertIsNone(preview["content"]["data"]["canonicalRelated"])
        self.assertEqual(preview["content"]["data"]["canonicalRelatedList"], [])
        self.assertNotIn("id", preview["objectType"])
        self.assertEqual(copied_images, 0)

    def test_theme_update_removes_object_references_from_preview_data(self):
        preview = {
            "views": [
                {
                    "id": "object-preview",
                    "kind": "object",
                    "layout": "main_layout",
                    "objectType": {
                        "schema": {
                            "properties": {
                                "summary": {"type": "string"},
                                "related": {"componentType": "object_reference"},
                                "reverse": {"field_type": "reverse_object_reference"},
                            }
                        }
                    },
                    "content": {"data": {"summary": "Safe", "related": 123, "reverse": [456]}},
                }
            ]
        }
        serializer = PageThemeSerializer(self.theme, data={"designer_preview": preview}, partial=True)

        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        self.theme.refresh_from_db()

        data = self.theme.designer_preview["views"][0]["content"]["data"]
        self.assertEqual(data, {"summary": "Safe", "related": None, "reverse": []})

    def test_import_endpoint_rejects_page_from_another_tenant(self):
        response = self.client.post(
            f"/api/v1/webpages/themes/{self.theme.id}/preview-content/import/",
            {"sourceKind": "page", "sourceId": self.other_page.id},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "That page is not available in this account.")

    def test_live_object_preview_includes_slot_configuration(self):
        version = ObjectVersion.objects.create(
            object_instance=self.object,
            version_number=1,
            data={"summary": "Object body"},
            widgets={"main": []},
            created_by=self.user,
        )
        self.object.current_version = version
        self.object.save(update_fields=["current_version"])

        response = self.client.post(
            f"/api/v1/webpages/designer/themes/{self.theme.id}/preview-content/from-object/",
            {"sourceObjectId": self.object.id},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["objectType"]["slotConfiguration"], self.object_type.slot_configuration)

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
            8,
        )

        self.assertIn("theme_images/12/library/hero.jpg", rewritten["views"][0]["content"]["pageData"]["body"])
        self.assertEqual(
            rewritten["views"][0]["content"]["widgets"]["main"][0]["config"]["imageUrl"],
            "https://new.test/theme_images/12/library/hero.jpg",
        )

    def test_theme_package_import_leaves_external_image_with_same_filename_unchanged(self):
        external_url = "https://cdn.example/hero.jpg"

        rewritten = rewrite_theme_library_image_urls(
            {"imageUrl": external_url},
            {"hero.jpg": "https://new.test/theme_images/12/library/hero.jpg"},
            8,
        )

        self.assertEqual(rewritten["imageUrl"], external_url)

    def test_legacy_theme_package_infers_one_preview_library_source(self):
        source_url = "https://old.test/theme_images/8/library/hero.jpg"
        replacement = "https://new.test/theme_images/12/library/hero.jpg"

        rewritten = rewrite_theme_library_image_urls(
            {"imageUrl": source_url},
            {"hero.jpg": replacement},
            None,
        )

        self.assertEqual(rewritten["imageUrl"], replacement)

    def test_legacy_theme_package_leaves_ambiguous_library_sources_unchanged(self):
        preview = {
            "first": "https://old.test/theme_images/8/library/hero.jpg",
            "second": "https://cdn.example/theme_images/999/library/hero.jpg",
        }

        rewritten = rewrite_theme_library_image_urls(
            preview,
            {"hero.jpg": "https://new.test/theme_images/12/library/hero.jpg"},
            None,
        )

        self.assertEqual(rewritten, preview)

    @patch("file_manager.storage.system_storage")
    @patch.object(PageTheme, "list_library_images", return_value=["hero.jpg"])
    def test_theme_clone_rewrites_preview_library_urls(self, _list_images, storage):
        old_url = f"https://storage.test/media/theme_images/{self.theme.id}/library/hero.jpg"
        foreign_url = "https://cdn.example/theme_images/999/library/hero.jpg"
        self.theme.designer_preview = {"views": [{"content": {"imageUrl": old_url, "foreignImageUrl": foreign_url}}]}
        self.theme.save(update_fields=["designer_preview"])
        storage.exists.return_value = True
        storage._open.return_value = io.BytesIO(b"copied-image")
        storage.url.side_effect = lambda path: f"https://storage.test/media/{path}"
        storage.listdir.return_value = ([], [])

        cloned_theme = self.theme.clone(new_name="Portable theme copy", created_by=self.user)

        self.assertEqual(
            cloned_theme.designer_preview["views"][0]["content"]["imageUrl"],
            f"https://storage.test/media/theme_images/{cloned_theme.id}/library/hero.jpg",
        )
        self.assertEqual(
            cloned_theme.designer_preview["views"][0]["content"]["foreignImageUrl"],
            foreign_url,
        )
