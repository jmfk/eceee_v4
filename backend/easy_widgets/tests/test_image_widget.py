from types import SimpleNamespace
from unittest.mock import patch

from django.template.loader import render_to_string
from django.test import SimpleTestCase

from easy_widgets.widgets.image import ImageConfig, ImageWidget
from webpages.utils.mustache_renderer import prepare_carousel_context


class ImageWidgetTests(SimpleTestCase):
    def test_image_style_is_a_primary_editor_field(self):
        schema = ImageConfig.model_json_schema()

        self.assertTrue(schema["properties"]["imageStyle"]["editorPrimary"])

    @patch("file_manager.models.MediaCollection.objects.get")
    def test_collection_prefers_explicit_public_file_url(self, get_collection):
        media = SimpleNamespace(
            id="media-1",
            file_type="image",
            file_url="data:image/svg+xml,public",
            title="Public image",
            description="Caption",
            width=800,
            height=450,
            metadata={},
            get_file_url=lambda: "https://storage.invalid/derived.svg",
            get_imgproxy_url=lambda **kwargs: "https://imgproxy.invalid/thumb.webp",
        )
        files = get_collection.return_value.mediafile_set.filter.return_value
        files.order_by.return_value = [media]

        result = ImageWidget().resolve_collection_images("collection-1")

        self.assertEqual(result[0]["url"], "data:image/svg+xml,public")

    @patch("file_manager.imgproxy.imgproxy_service.generate_responsive_urls")
    def test_default_image_uses_one_x_source_and_two_density_srcset(self, generate_responsive_urls):
        generate_responsive_urls.return_value = {
            "1x": {"url": "/image-1x.webp", "width": 600, "height": 338},
            "2x": {"url": "/image-2x.webp", "width": 1200, "height": 675},
            "srcset": "/image-1x.webp 600w, /image-2x.webp 1200w",
        }

        config = ImageWidget().prepare_template_context(
            {
                "image": {
                    "id": "media-1",
                    "url": "/original.jpg",
                    "type": "image",
                    "title": "Responsive image",
                    "width": 1600,
                    "height": 900,
                }
            }
        )
        html = render_to_string(
            "easy_widgets/widgets/image.html",
            {
                "config": config,
                "widget": SimpleNamespace(id="image-1"),
                "widget_type": SimpleNamespace(css_class_name="imagewidget"),
            },
        )

        self.assertIn('src="/image-1x.webp"', html)
        self.assertIn('srcset="/image-1x.webp 600w, /image-2x.webp 1200w"', html)
        self.assertIn('width="600"', html)
        self.assertIn('height="338"', html)
        self.assertIn('data-lightbox-src="/original.jpg"', html)
        generate_responsive_urls.assert_called_once_with(
            source_url="/original.jpg",
            max_width=896,
            max_height=None,
            original_width=1600,
            original_height=900,
            resize_type="fit",
            gravity="sm",
            quality=85,
            format="webp",
        )

    @patch("file_manager.imgproxy.imgproxy_service.generate_responsive_urls")
    def test_widget_imgproxy_aliases_override_style_aliases(self, generate_responsive_urls):
        generate_responsive_urls.return_value = {}
        theme = SimpleNamespace(
            image_styles={
                "cropped": {
                    "imgproxy_config": {
                        "max_width": 800,
                        "max_height": 600,
                        "resize_type": "fit",
                    }
                }
            },
            gallery_styles={},
            carousel_styles={},
        )

        ImageWidget().prepare_template_context(
            {
                "image_style": "cropped",
                "image": {"id": "media-1", "url": "/original.jpg", "type": "image"},
                "imgproxyOverride": {"width": 400, "resizeType": "fill"},
            },
            {"theme": theme},
        )

        generate_responsive_urls.assert_called_once_with(
            source_url="/original.jpg",
            max_width=400,
            max_height=600,
            original_width=None,
            original_height=None,
            resize_type="fill",
            gravity="sm",
            quality=85,
            format="webp",
        )

    def test_styled_carousel_script_scopes_controls_and_supports_autoplay(self):
        script = ImageWidget._carousel_behavior_script({"autoPlay": True, "autoPlayInterval": 4})

        self.assertIn("script.previousElementSibling", script)
        self.assertIn("[data-direction]", script)
        self.assertIn("dataset.slideIndex", script)
        self.assertIn("window.setInterval", script)
        self.assertIn("}, 4000);", script)

    def test_carousel_context_normalizes_image_alt_text(self):
        context = prepare_carousel_context(
            [{"url": "data:image/svg+xml,image", "alt_text": "Slide one"}],
            {},
        )

        self.assertEqual(context["images"][0]["alt"], "Slide one")
