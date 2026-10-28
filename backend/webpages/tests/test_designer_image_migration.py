"""Path extraction used when registering pre-existing Designer uploads."""

from importlib import import_module
from unittest import TestCase


class DesignerImageMigrationTests(TestCase):
    def test_extracts_exact_paths_from_urls_and_css(self):
        paths = import_module("webpages.migrations.0091_backfill_designer_image_series")._paths
        prefix = "theme_images/7/designer_drafts/"
        first = f"{prefix}draft-1/header-abc123.png"
        second = f"{prefix}draft-1/footer-def456.webp"

        self.assertEqual(
            set(paths({"css": f'background: url("https://storage.test/{first}?v=1"); url({second})'}, prefix)),
            {first, second},
        )
