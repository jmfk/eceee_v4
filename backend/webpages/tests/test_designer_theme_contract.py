import io
import json
from types import SimpleNamespace

from django.test import SimpleTestCase

from webpages.services.designer_theme import _page_preview_content
from webpages.views.designer_theme_views import DesignerJSONParser, DesignerJSONRenderer, DesignerPlaceholderSerializer


class DesignerThemeContractTests(SimpleTestCase):
    def test_user_defined_theme_keys_round_trip_unchanged(self):
        request_payload = {
            "draftVersion": 2,
            "colors": {"brand_color": "#123456", "accentColor": "#abcdef"},
            "typography": [{"groupIndex": 0, "values": {"fontSize": "40px"}}],
        }

        parsed = DesignerJSONParser().parse(io.BytesIO(json.dumps(request_payload).encode()))

        self.assertEqual(parsed["draft_version"], 2)
        self.assertEqual(parsed["typography"][0]["group_index"], 0)
        self.assertEqual(parsed["colors"], request_payload["colors"])
        self.assertEqual(parsed["typography"][0]["values"], {"fontSize": "40px"})

        rendered = json.loads(DesignerJSONRenderer().render(parsed))
        self.assertEqual(rendered["draftVersion"], 2)
        self.assertEqual(rendered["typography"][0]["groupIndex"], 0)
        self.assertEqual(rendered["colors"], request_payload["colors"])
        self.assertEqual(rendered["typography"][0]["values"], {"fontSize": "40px"})

    def test_placeholder_dimensions_are_bounded(self):
        serializer = DesignerPlaceholderSerializer(
            data={
                "asset_key": "hero",
                "display_name": "Hero",
                "width": 5000,
                "height": 5000,
                "draft_version": 1,
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("Placeholder images cannot exceed 16 megapixels.", serializer.errors["non_field_errors"])

    def test_site_preview_content_extracts_readable_text_and_images(self):
        page = SimpleNamespace(title="Conference", description="Published introduction")
        version = SimpleNamespace(
            page_data={"title": "Programme"},
            widgets={
                "main": [
                    {
                        "type": "easy_widgets.ContentWidget",
                        "config": {
                            "content": "<p>Useful <strong>body</strong> copy.</p>",
                            "image_url": "https://media.example/hero.jpg",
                        },
                    }
                ]
            },
        )

        texts, images = _page_preview_content(page, version)

        self.assertEqual(texts, ["Conference", "Published introduction", "Programme", "Useful body copy."])
        self.assertEqual(images, ["https://media.example/hero.jpg"])
