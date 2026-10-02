from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from easy_widgets.widgets.image import ImageWidget
from webpages.utils.mustache_renderer import prepare_carousel_context


class ImageWidgetTests(SimpleTestCase):
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
