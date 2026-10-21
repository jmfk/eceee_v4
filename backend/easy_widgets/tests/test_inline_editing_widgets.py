from django.test import SimpleTestCase

from easy_widgets.widgets.bio import BioConfig, BioWidget
from easy_widgets.widgets.content_card import ContentCardConfig, ContentCardWidget
from easy_widgets.widgets.headline import HeadlineConfig


class InlineEditingWidgetTests(SimpleTestCase):
    def test_text_fields_are_hidden_from_sidebar_without_removing_data(self):
        for model, fields in (
            (ContentCardConfig, ("header", "content")),
            (BioConfig, ("bioText", "caption")),
            (HeadlineConfig, ("content",)),
        ):
            properties = model.model_json_schema()["properties"]
            for field in fields:
                with self.subTest(model=model.__name__, field=field):
                    self.assertTrue(properties[field]["hidden"])

    def test_image_settings_remain_primary(self):
        for model, fields in ((ContentCardConfig, ("image1", "imageSize")), (BioConfig, ("image", "imageSize"))):
            properties = model.model_json_schema()["properties"]
            for field in fields:
                self.assertTrue(properties[field]["editorPrimary"])
                self.assertFalse(properties[field].get("hidden", False))

    def test_bio_legacy_images_keep_original_shape(self):
        self.assertEqual(BioConfig().image_size, "original")
        self.assertEqual(BioWidget().prepare_template_context({})["image_size"], "original")

    def test_shape_reaches_public_templates_for_both_casing_contracts(self):
        for widget in (BioWidget(), ContentCardWidget()):
            for key in ("imageSize", "image_size"):
                for shape in ("square", "rectangle"):
                    with self.subTest(widget=widget.name, key=key, shape=shape):
                        self.assertEqual(widget.prepare_template_context({key: shape})["image_size"], shape)
