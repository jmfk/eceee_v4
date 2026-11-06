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
        self.assertEqual(config["fullWidthCount"], 1)
        self.assertEqual(config["halfWidthCount"], 2)
        self.assertEqual(config["thirdWidthCount"], 0)
        self.assertEqual(config["objectTypes"], [8, "article"])
        self.assertEqual(config["newsPagePath"], "/updates/")
        self.assertFalse(config["showExcerpts"])

    def test_counts_support_zero_and_large_values_but_reject_negative_values(self):
        config = NewsFlashConfig(fullWidthCount=0, halfWidthCount=1000, thirdWidthCount=3)
        self.assertEqual(config.half_width_count, 1000)
        with self.assertRaises(ValidationError):
            NewsFlashConfig(thirdWidthCount=-1)

    def test_image_shape_is_validated_and_preserved(self):
        self.assertEqual(NewsFlashConfig(imageShape="square").model_dump(by_alias=True)["imageShape"], "square")
        self.assertEqual(NewsFlashConfig().image_shape, "landscape")
        with self.assertRaises(ValidationError):
            NewsFlashConfig(imageShape="invalid")

    def test_initial_article_definition_contains_optional_priority_controls(self):
        fields = DEFINITIONS["article"][2]
        self.assertEqual(fields["newsPriority"]["componentType"], "boolean")
        self.assertFalse(fields["newsPriority"]["default"])
        self.assertEqual(fields["newsPriorityUntil"]["componentType"], "datetime")
