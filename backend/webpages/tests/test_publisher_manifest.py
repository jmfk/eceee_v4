import json
import subprocess
import sys

from django.conf import settings
from django.test import SimpleTestCase

from webpages.publisher_manifest import MANIFEST_PATH


class PublisherManifestTests(SimpleTestCase):
    def test_manifest_contains_runtime_css_and_widget_metadata(self):
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))

        self.assertEqual(manifest["formatVersion"], 1)
        self.assertIn(".container", manifest["baseCss"])
        self.assertIn("easy_widgets.HeaderWidget", manifest["widgets"])
        self.assertIn("header-widget", manifest["widgets"]["easy_widgets.HeaderWidget"]["layoutParts"])

    def test_checked_in_manifest_is_current(self):
        self.assertTrue(MANIFEST_PATH.exists())
        result = subprocess.run(
            [sys.executable, str(settings.BASE_DIR / "manage.py"), "export_publisher_manifest", "--check"],
            cwd=settings.BASE_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
