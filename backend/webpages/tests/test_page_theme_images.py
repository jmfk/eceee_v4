from unittest.mock import patch

from django.test import SimpleTestCase

from webpages.models import PageTheme
from webpages.serializers.theme import PageThemeSerializer


class PageThemeImageResolutionTests(SimpleTestCase):
    def test_resolves_stale_cloned_theme_library_url_to_current_theme(self):
        theme = PageTheme(id=3, name="Clone")
        stale_url = "https://example.com/eceee-v4-media/theme_images/2/library/header.png"

        with patch("webpages.models.page_theme.system_storage") as storage:
            storage.exists.return_value = True
            storage.url.return_value = "https://example.com/eceee-v4-media/theme_images/3/library/header.png"

            resolved = theme._resolve_theme_library_image_url(stale_url)

        storage.exists.assert_called_once_with("theme_images/3/library/header.png")
        self.assertEqual(
            resolved,
            "https://example.com/eceee-v4-media/theme_images/3/library/header.png",
        )

    def test_resolves_relative_stale_cloned_theme_library_path(self):
        theme = PageTheme(id=3, name="Clone")

        with patch("webpages.models.page_theme.system_storage") as storage:
            storage.exists.return_value = True
            storage.url.return_value = "theme_images/3/library/header.png"

            resolved = theme._resolve_theme_library_image_url("theme_images/2/library/header.png")

        storage.exists.assert_called_once_with("theme_images/3/library/header.png")
        self.assertEqual(resolved, "theme_images/3/library/header.png")

    def test_resolves_current_theme_library_url_to_configured_storage(self):
        theme = PageTheme(id=3, name="Local")
        remote_url = "https://example.com/eceee-v4-media/theme_images/3/library/header.png"

        with patch("webpages.models.page_theme.system_storage") as storage:
            storage.exists.return_value = True
            storage.url.return_value = "http://minio:9000/eceee-media/theme_images/3/library/header.png"

            resolved = theme._resolve_theme_library_image_url(remote_url)

        storage.exists.assert_called_once_with("theme_images/3/library/header.png")
        self.assertEqual(
            resolved,
            "http://minio:9000/eceee-media/theme_images/3/library/header.png",
        )

    def test_serializer_resolves_snake_case_design_group_image_urls(self):
        theme = PageTheme(
            id=3,
            name="Clone",
            design_groups={
                "groups": [
                    {
                        "name": "Header",
                        "layout_properties": {
                            "header-widget": {
                                "xs": {
                                    "background_image": {
                                        "url": "https://example.com/eceee-v4-media/theme_images/2/library/header.png",
                                        "filename": "header.png",
                                    }
                                }
                            }
                        },
                    }
                ]
            },
        )

        with patch("webpages.models.page_theme.system_storage") as storage:
            storage.exists.return_value = True
            storage.url.return_value = "https://example.com/eceee-v4-media/theme_images/3/library/header.png"

            data = PageThemeSerializer(theme).data

        image = data["design_groups"]["groups"][0]["layout_properties"]["header-widget"]["xs"]["background_image"]
        self.assertEqual(
            image["url"],
            "https://example.com/eceee-v4-media/theme_images/3/library/header.png",
        )
        self.assertEqual(
            image["imgproxy_base_url"],
            "https://example.com/eceee-v4-media/theme_images/3/library/header.png",
        )

    def test_image_usage_accepts_snake_case_layout_properties(self):
        theme = PageTheme(
            id=3,
            name="Clone",
            design_groups={
                "groups": [
                    {
                        "name": "Header",
                        "layout_properties": {
                            "header-widget": {
                                "xs": {
                                    "background_image": {
                                        "url": "https://example.com/eceee-v4-media/theme_images/2/library/header.png",
                                        "filename": "header.png",
                                    }
                                }
                            }
                        },
                    }
                ]
            },
        )

        self.assertEqual(
            theme.get_image_usage("header.png"),
            ["design_group:Header:header-widget:xs:background_image"],
        )
