from django.template.loader import render_to_string
from django.test import SimpleTestCase

from easy_widgets.widgets.table import TableWidget


class TableWidgetRenderTests(SimpleTestCase):
    def test_camel_case_config_renders_canonical_table_structure(self):
        widget = TableWidget()
        config = widget.prepare_template_context(
            {
                "showBorders": True,
                "tableWidth": "full",
                "caption": "Canonical table",
                "columnWidths": ["60%", "40%"],
                "rows": [{"cells": [{"content": "Name"}, {"content": "Value"}]}],
            }
        )

        html = render_to_string(
            "easy_widgets/widgets/table.html",
            {"config": config, "widget_type": widget},
        )

        self.assertIn('class="w-full border"', html)
        self.assertIn('<caption class="table-caption text-sm text-gray-600 mb-2">Canonical table</caption>', html)
        self.assertIn(".table-widget .table-caption {\n        text-align: left;\n    }", widget.widget_css)
        self.assertLess(html.index("<caption"), html.index("<colgroup>"))
        self.assertIn("<colgroup>", html)
        self.assertIn('style="width: 60%;"', html)

    def test_image_url_and_vertical_alignment_survive_camel_case_normalization(self):
        widget = TableWidget()
        config = widget.prepare_template_context(
            {
                "showBorders": True,
                "tableWidth": "full",
                "rows": [
                    {
                        "cells": [
                            {
                                "contentType": "image",
                                "imageData": {"url": "/portrait.jpg", "alt": "Ada portrait"},
                                "verticalAlignment": "middle",
                            }
                        ]
                    }
                ],
            }
        )

        html = render_to_string(
            "easy_widgets/widgets/table.html",
            {"config": config, "widget_type": widget},
        )

        self.assertIn('class="w-full border"', html)
        self.assertIn('class=" cell-left cell-v-middle cell-image"', html)
        self.assertIn("vertical-align:middle", html)
        self.assertIn('src="/portrait.jpg"', html)
        self.assertIn('alt="Ada portrait"', html)

    def test_hover_rows_and_hidden_borders_render_without_inline_javascript(self):
        widget = TableWidget()
        config = widget.prepare_template_context(
            {
                "showBorders": False,
                "rows": [
                    {
                        "height": "40px",
                        "backgroundColor": "#123456",
                        "cells": [
                            {
                                "content": "Safe hover",
                                "hoverBgColor": "';window.__xss=1;//",
                                "hoverTextColor": "#ffffff",
                            }
                        ],
                    }
                ],
            }
        )

        html = render_to_string(
            "easy_widgets/widgets/table.html",
            {"config": config, "widget_type": widget},
        )

        self.assertIn("table-no-borders", html)
        self.assertIn('style="height: 40px;background-color: #123456;"', html)
        self.assertIn("cell-hover-bg", html)
        self.assertIn("cell-hover-text", html)
        self.assertIn("--cell-hover-bg:", html)
        self.assertNotIn("onmouseover", html)
        self.assertNotIn("onmouseout", html)
