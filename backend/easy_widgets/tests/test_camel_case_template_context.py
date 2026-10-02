from django.test import SimpleTestCase

from easy_widgets.widgets.forms import FormsWidget
from easy_widgets.widgets.hero import HeroWidget
from easy_widgets.widgets.section import SectionWidget


class CamelCaseTemplateContextTests(SimpleTestCase):
    def test_hero_normalizes_frontend_owned_configuration(self):
        context = HeroWidget().prepare_template_context(
            {
                "header": "Parity",
                "beforeText": "Before",
                "afterText": "After",
                "backgroundColor": "#123456",
            }
        )

        self.assertEqual(context["before_text"], "Before")
        self.assertEqual(context["after_text"], "After")
        self.assertIn("--hero-bg-color: #123456", context["hero_style"])

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
