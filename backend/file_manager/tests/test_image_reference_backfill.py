from django.test import SimpleTestCase

from file_manager.management.commands.backfill_media_image_references import _rewrite


class ImageReferenceBackfillTests(SimpleTestCase):
    def test_rewrites_known_storage_url_in_embedded_content(self):
        references = {"https://storage.test/uploads/old.jpg": "/api/v1/media/file/1234/"}
        value = {"body": '<img src="https://storage.test/uploads/old.jpg">'}
        self.assertEqual(_rewrite(value, references), {"body": '<img src="/api/v1/media/file/1234/">'})

    def test_leaves_unmatched_and_embedded_raw_paths_unchanged(self):
        references = {"uploads/old.jpg": "/api/v1/media/file/1234/"}
        self.assertEqual(_rewrite("uploads/old.jpg", references), "/api/v1/media/file/1234/")
        self.assertEqual(_rewrite('<img src="uploads/old.jpg">', references), '<img src="uploads/old.jpg">')
