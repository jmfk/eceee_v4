from django.test import SimpleTestCase

from easy_widgets.widgets.navbar import NavbarWidget


class NavbarWidgetTests(SimpleTestCase):
    def setUp(self):
        self.widget = NavbarWidget()

    def test_prepare_template_context_accepts_camel_case_config(self):
        context = self.widget.prepare_template_context(
            {
                "menuItems": [
                    {
                        "order": 1,
                        "linkData": {
                            "type": "external",
                            "label": "Docs",
                            "url": "/docs/",
                            "isActive": True,
                        },
                    }
                ],
                "hamburgerBreakpoint": 900,
                "secondaryMenuItems": [],
            },
            {},
        )

        self.assertEqual(context["widgetTypeCssClass"], "easy-widgets-navbarwidget")
        self.assertEqual(context["hamburgerBreakpoint"], 900)
        self.assertEqual(context["menuItems"][0]["url"], "/docs/")

    def test_prepare_template_context_does_not_fail_on_legacy_missing_link_type(self):
        context = self.widget.prepare_template_context(
            {
                "menuItems": [
                    {
                        "order": 0,
                        "linkData": {
                            "label": "Home",
                            "isActive": True,
                            "targetBlank": False,
                        },
                    }
                ]
            },
            {},
        )

        self.assertEqual(context["hamburgerBreakpoint"], 768)
        self.assertEqual(context["menuItems"][0]["type"], "external")
        self.assertEqual(context["menuItems"][0]["url"], "/")
