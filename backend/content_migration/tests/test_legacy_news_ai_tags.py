from django.test import SimpleTestCase

from content_migration.legacy_news.ai_tags import LegacyNewsAITagger


class LegacyNewsAITaggerTests(SimpleTestCase):
    def test_normalizes_deduplicates_and_excludes_migration_tags(self):
        tags = LegacyNewsAITagger._normalize_tags([" Heat Pump ", "heat   pump", "Legacy", "News", "", "Data centres"])
        self.assertEqual(tags, ["heat pump", "data centres"])
