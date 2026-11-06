from django.test import SimpleTestCase
from pydantic import ValidationError

from content_migration.legacy_content.profile import DEFINITIONS
from easy_widgets.widgets.news_flash import NewsFlashConfig, NewsFlashWidget
from webpages.widget_registry import widget_type_registry


class NewsFlashContractTests(SimpleTestCase):
    def test_registered_widget_preserves_frontend_configuration(self):
        widget = widget_type_registry.get_widget_type_by_type("easy_widgets.NewsFlashWidget")
        self.assertIsInstance(widget, NewsFlashWidget)
        config = widget.configuration_model(
            objectTypes=[8, "article"],
            newsPagePath="/updates/",
            showExcerpts=False,
            classificationIds=["11111111-1111-4111-8111-111111111111"],
        ).model_dump(by_alias=True)
        self.assertEqual(config["limit"], 3)
        self.assertEqual(config["objectTypes"], [8, "article"])
        self.assertEqual(config["newsPagePath"], "/updates/")
        self.assertFalse(config["showExcerpts"])

    def test_story_count_cannot_be_changed_to_another_layout_count(self):
        with self.assertRaises(ValidationError):
            NewsFlashConfig(limit=2)
        with self.assertRaises(ValidationError):
            NewsFlashConfig(limit=4)

    def test_initial_article_definition_contains_optional_priority_controls(self):
        fields = DEFINITIONS["article"][2]
        self.assertEqual(fields["newsPriority"]["componentType"], "boolean")
        self.assertFalse(fields["newsPriority"]["default"])
        self.assertEqual(fields["newsPriorityUntil"]["componentType"], "datetime")
