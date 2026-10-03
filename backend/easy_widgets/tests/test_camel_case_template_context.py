from unittest.mock import patch

from django.test import SimpleTestCase

from easy_widgets.widgets.forms import FormsWidget
from easy_widgets.widgets.hero import HeroWidget
from easy_widgets.widgets.section import SectionWidget


class CamelCaseTemplateContextTests(SimpleTestCase):
    def test_hero_normalizes_frontend_owned_configuration(self):
        with patch("file_manager.imgproxy.imgproxy_service.generate_url") as generate_url:
            generate_url.side_effect = ["/hero-1x.jpg", "/hero-2x.jpg"]
            context = HeroWidget().prepare_template_context(
                {
                    "header": "Parity",
                    "beforeText": "Before",
                    "afterText": "After",
                    "backgroundColor": "#123456",
                    "image": {"imgproxyBaseUrl": "https://media.example/hero.jpg"},
                }
            )

        self.assertEqual(context["before_text"], "Before")
        self.assertEqual(context["after_text"], "After")
        self.assertIn("--hero-bg-color: #123456", context["hero_style"])
        self.assertEqual(context["background_image_url"], "/hero-1x.jpg")
        self.assertEqual(context["background_image_url_2x"], "/hero-2x.jpg")
        self.assertEqual(generate_url.call_count, 2)

    def test_forms_normalizes_frontend_owned_configuration(self):
        context = FormsWidget().prepare_template_context(
            {
                "title": "Interaction test",
                "fields": [{"name": "name", "label": "Name", "type": "text"}],
                "submitButtonText": "Submit test",
            }
        )

        self.assertEqual(context["title"], "Interaction test")
        self.assertEqual(context["submit_button_text"], "Submit test")

    def test_section_normalizes_behavior_without_losing_slots(self):
        slots = {"content": [{"id": "child"}]}
        context = SectionWidget().prepare_template_context(
            {
                "enableCollapse": True,
                "startExpanded": False,
                "expandText": "Expand",
                "contractText": "Collapse",
                "slots": slots,
            }
        )

        self.assertTrue(context["enable_collapse"])
        self.assertFalse(context["start_expanded"])
        self.assertEqual(context["expand_text"], "Expand")
        self.assertEqual(context["contract_text"], "Collapse")
        self.assertEqual(context["slots_data"], slots)
