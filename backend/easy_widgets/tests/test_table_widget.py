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
                "columnWidths": ["60%", "40%"],
                "rows": [{"cells": [{"content": "Name"}, {"content": "Value"}]}],
            }
        )

        html = render_to_string(
            "easy_widgets/widgets/table.html",
            {"config": config, "widget_type": widget},
        )

        self.assertIn('class="w-full border"', html)
        self.assertIn("<colgroup>", html)
        self.assertIn('style="width: 60%;"', html)
