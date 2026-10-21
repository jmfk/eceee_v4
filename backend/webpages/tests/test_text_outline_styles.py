from copy import deepcopy
from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from webpages.text_outline_styles import (
    DEFAULT_STYLE,
    text_outline_css,
    text_outline_shadow,
    validate_text_outline_styles,
)


class TextOutlineStylesTests(SimpleTestCase):
    def test_named_styles_and_defaults(self):
        self.assertEqual(validate_text_outline_styles({"softGlow": {}}), {"softGlow": DEFAULT_STYLE})
        self.assertIn("--text-outline-softGlow:", text_outline_css({"softGlow": {}}))
        for effect in ("outline", "gradientBlur", "dropShadow"):
            style = {**DEFAULT_STYLE, "style": effect, "colorMode": "complement"}
            self.assertIn("calc(255 - r)", text_outline_shadow(style))

    def test_rejects_invalid_styles_and_css_injection(self):
        for value in (
            [],
            {"none": {}},
            {"bad;key": {}},
            {"glow": {"color": "red; color: blue"}},
            {"glow": {"radius": -1}},
            {"glow": {"thickness": float("nan")}},
            {"glow": {"opacity": True}},
            {"glow": {"style": "unknown"}},
            {"glow": {"colorMode": "__proto__"}},
            {"glow": {"css": "arbitrary"}},
        ):
            with self.subTest(value=value), self.assertRaises(ValidationError):
                validate_text_outline_styles(value)
        self.assertEqual(text_outline_css({"bad;key": {}}), "")

    def test_offset_angle_and_zero_thickness(self):
        shadow = text_outline_shadow({"style": "dropShadow", "angle": 90, "offset": 3, "thickness": 0, "radius": 5})
        self.assertEqual(shadow, "0px 3px 5px #000000")

    def test_designer_snapshot_restores_presets(self):
        from webpages.models import PageTheme
        from webpages.services.designer_theme import (
            theme_designer_snapshot,
            apply_designer_snapshot,
            apply_designer_patch,
        )
        from core.models import Tenant

        theme = PageTheme(name="Outline test", tenant=Tenant(name="Test", identifier="outline-test"))
        apply_designer_patch(
            theme, {"text_outline_styles": {"softGlow": {"style": "gradientBlur"}}}, validate_version=False
        )
        snapshot = theme_designer_snapshot(theme)
        theme.text_outline_styles = {}
        apply_designer_snapshot(theme, deepcopy(snapshot))
        self.assertEqual(theme.text_outline_styles["softGlow"]["style"], "gradientBlur")

    def test_api_casing_preserves_style_keys_and_properties(self):
        import io
        import json
        from webpages.views.designer_theme_views import DesignerJSONParser, DesignerJSONRenderer
        from webpages.views.page_theme_views import ThemeJSONParser, ThemeJSONRenderer

        styles = {"soft_glow": {"colorMode": "same", "style": "gradientBlur"}}
        for parser, renderer in ((DesignerJSONParser, DesignerJSONRenderer), (ThemeJSONParser, ThemeJSONRenderer)):
            parsed = parser().parse(io.BytesIO(json.dumps({"textOutlineStyles": styles}).encode()))
            self.assertEqual(parsed["text_outline_styles"], styles)
            rendered = json.loads(renderer().render(parsed))
            self.assertEqual(rendered["textOutlineStyles"], styles)
