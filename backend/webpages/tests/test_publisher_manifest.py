from django.test import SimpleTestCase

from webpages.publisher_manifest import build_publisher_manifest


class PublisherManifestTests(SimpleTestCase):
    def test_manifest_contains_runtime_css_and_widget_metadata(self):
        manifest = build_publisher_manifest()

        self.assertEqual(manifest["formatVersion"], 1)
        self.assertIn(".container", manifest["baseCss"])
        self.assertEqual(
            {page["status_code"] for page in manifest["defaultSpecialPages"]},
            {403, 404, 500, 503},
        )
        self.assertIn("easy_widgets.HeaderWidget", manifest["widgets"])
        self.assertIn("header-widget", manifest["widgets"]["easy_widgets.HeaderWidget"]["layoutParts"])
