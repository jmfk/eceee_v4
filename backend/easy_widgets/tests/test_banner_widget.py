from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import patch

from django.template.loader import render_to_string
from django.test import SimpleTestCase

from easy_widgets.widgets.banner import BannerConfig, BannerWidget


class BannerWidgetTests(SimpleTestCase):
    def setUp(self):
        self.widget = BannerWidget()
        self.config = {
            "bannerMode": "text",
            "headerContent": "Banner heading",
            "textContent": "<p>Banner body</p>",
            "imageSize": "rectangle",
            "image1": {"file_url": "/inline.jpg"},
            "image1Url": "/inline.jpg",
            "image1Url2x": "/inline-2x.jpg",
            "backgroundImage": {"file_url": "/background.jpg"},
            "backgroundImageUrl": "/background.jpg",
            "backgroundImageUrl2x": "/background-2x.jpg",
        }

    def test_schema_keeps_active_image_controls_primary_and_content_inline(self):
        properties = BannerConfig.model_json_schema()["properties"]

        for field in ("image1", "imageSize", "backgroundImage"):
            self.assertTrue(
                properties[field].get("editorPrimary") or properties[field]["group"] in ("Content", "Layout")
            )
        for field in ("image1", "imageSize"):
            self.assertEqual(properties[field]["conditionalOn"], {"bannerMode": ["text"]})
        self.assertEqual(properties["backgroundImage"]["conditionalOn"], {"bannerMode": ["header"]})
        self.assertTrue(properties["headerContent"]["hidden"])
        self.assertTrue(properties["textContent"]["hidden"])

    def test_only_the_active_mode_image_reaches_the_public_template(self):
        original = deepcopy(self.config)
        for mode in ("text", "header"):
            with self.subTest(mode=mode):
                config = {**self.config, "bannerMode": mode}
                prepared = self.widget.prepare_template_context(config)
                with patch("file_manager.imgproxy.imgproxy_service.generate_url") as generate:
                    generate.side_effect = lambda source_url, **kwargs: source_url
                    html = render_to_string(
                        self.widget.template_name,
                        {"config": prepared, "widget_type": SimpleNamespace(css_class_name="banner")},
                    )

                self.assertIn("/background.jpg" if mode == "header" else "/inline.jpg", html)
                self.assertNotIn("/inline.jpg" if mode == "header" else "/background.jpg", html)
                self.assertEqual('class="banner-images"' in html, mode == "text")
                self.assertEqual('class="banner-background"' in html, mode == "header")
                inactive_field = "image_1" if mode == "header" else "background_image"
                self.assertIsNone(prepared[inactive_field])
        self.assertEqual(self.config, original)

    def test_custom_styles_cannot_access_inactive_images_or_cached_urls(self):
        theme = SimpleNamespace(
            component_styles={
                "custom": {
                    "template": (
                        "{{#backgroundImage}}BG{{/backgroundImage}}"
                        "{{#image1}}INLINE{{/image1}}"
                        "{{#config.backgroundImageUrl2x}}BG-CACHE{{/config.backgroundImageUrl2x}}"
                        "{{#config.image1Url2x}}INLINE-CACHE{{/config.image1Url2x}}"
                    ),
                },
            }
        )
        for mode, expected in (("text", "INLINEINLINE-CACHE"), ("header", "BGBG-CACHE")):
            with self.subTest(mode=mode):
                html, _ = self.widget.render_with_style(
                    {**self.config, "bannerMode": mode, "componentStyle": "custom"}, theme
                )
                self.assertEqual(html, expected)

    def test_legacy_snake_case_and_default_mode_obey_the_same_image_rules(self):
        config = BannerConfig(**self.config).model_dump()
        config.pop("banner_mode")
        prepared = self.widget.prepare_template_context(config)
        self.assertEqual(prepared["banner_mode"], "text")
        self.assertIsNone(prepared["background_image"])
        self.assertEqual(prepared["image_1"], self.config["image1"])

        prepared = self.widget.prepare_template_context({**config, "banner_mode": "header"})
        self.assertEqual(prepared["background_image"], self.config["backgroundImage"])
        self.assertIsNone(prepared["image_1"])
