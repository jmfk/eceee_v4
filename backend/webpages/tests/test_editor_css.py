from django.test import SimpleTestCase

from webpages.services.editor_css import compile_editor_css
from webpages.services.theme_css_generator import ThemeCSSGenerator


class EditorCSSCompilerTest(SimpleTestCase):
    def test_scopes_rules_and_rewrites_document_roots(self):
        result = compile_editor_css(
            ":root { --primary: red; } html body { margin: 0; } body.dark h1, .card { color: var(--primary); }"
        )

        self.assertIn("@scope (.eceee-theme-scope) to (.eceee-editor-ui)", result)
        self.assertIn(":scope { --primary: red; }", result)
        self.assertIn(":scope { margin: 0; }", result)
        self.assertIn(":scope.dark h1, .card { color: var(--primary); }", result)
        self.assertNotIn("html body", result)

    def test_preserves_nested_rules_inside_scope(self):
        result = compile_editor_css(
            "@media (min-width: 40rem) { body .card { display: grid; } } "
            "@supports (display: subgrid) { .card { grid-template-columns: subgrid; } }"
        )

        self.assertEqual(result.count("@scope"), 1)
        self.assertIn("@media (min-width: 40rem)", result)
        self.assertIn(":scope .card { display: grid; }", result)
        self.assertIn("@supports (display: subgrid)", result)

    def test_keeps_grammar_sensitive_at_rules_at_top_level(self):
        result = compile_editor_css(
            "@import url('https://fonts.googleapis.com/css2?family=Inter'); "
            "@font-face { font-family: Demo; src: url(demo.woff2); } "
            "@keyframes pulse { from { opacity: 0; } to { opacity: 1; } } .hero { animation: pulse 1s; }"
        )

        scope_position = result.index("@scope")
        self.assertLess(result.index("@import"), scope_position)
        self.assertLess(result.index("@font-face"), scope_position)
        self.assertLess(result.index("@keyframes"), scope_position)
        self.assertIn(".hero { animation: pulse 1s; }", result[scope_position:])

    def test_omits_non_font_imports_that_would_escape_the_scope(self):
        result = compile_editor_css("@import url('https://example.com/site.css'); h1 { color: red; }")

        self.assertNotIn("example.com", result)
        self.assertIn("@import omitted", result)
        self.assertIn("h1 { color: red; }", result)

    def test_accepts_version_specific_scope(self):
        result = compile_editor_css(
            "h1 { color: blue; }",
            root_selector='.eceee-theme-scope[data-eceee-theme-scope="version-83"]',
        )

        self.assertIn(
            '@scope (.eceee-theme-scope[data-eceee-theme-scope="version-83"]) to (.eceee-editor-ui)',
            result,
        )


class ThemeCSSGeneratorEditorTest(SimpleTestCase):
    def test_scopes_every_complete_theme_css_source_once(self):
        class Theme:
            fonts = {}
            component_styles = {"card": {"name": "Card", "css": ".component-rule { color: red; }"}}
            gallery_styles = {"grid": {"name": "Grid", "css": ".gallery-rule { display: grid; }"}}
            carousel_styles = {"slides": {"name": "Slides", "css": ".carousel-rule { display: flex; }"}}

            @staticmethod
            def generate_css(**kwargs):
                assert kwargs["frontend_scoped"] is False
                return ":root { --brand: blue; } .design-rule { color: var(--brand); }"

            @staticmethod
            def get_breakpoints():
                return {"sm": 640, "md": 768, "lg": 1024, "xl": 1280}

        generator = ThemeCSSGenerator()
        generator._generate_widget_css = lambda: ".widget-rule { display: block; }"

        result = generator.generate_complete_css(Theme(), frontend_scoped=True)
        public_result = generator.generate_complete_css(Theme(), frontend_scoped=False)

        self.assertEqual(result.count("@scope"), 1)
        for selector in (".widget-rule", ".design-rule", ".component-rule", ".gallery-rule", ".carousel-rule"):
            self.assertIn(selector, result)
        self.assertIn(":scope { --brand: blue; }", result)
        self.assertNotIn("@scope", public_result)
        self.assertIn(":root { --brand: blue; }", public_result)
