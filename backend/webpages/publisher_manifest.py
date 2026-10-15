"""Build the checked-in renderer manifest consumed by the standalone publisher."""

import json
from pathlib import Path

from django.conf import settings

from webpages.theme_layouts import default_special_pages
from webpages.widget_registry import widget_type_registry

MANIFEST_VERSION = 1
MANIFEST_PATH = (
    Path(settings.BASE_DIR).parent
    / "frontend"
    / "src"
    / "rendering"
    / "generated"
    / "render-manifest.json"
)
BASE_CSS_PATH = Path(settings.BASE_DIR) / "static" / "css" / "tailwind.output.css"


def _layout_parts(widget):
    parts = {}
    for part_id, raw in sorted(getattr(widget, "layout_parts", {}).items()):
        if isinstance(raw, dict):
            parts[part_id] = {
                "selector": raw.get("selector"),
                "relationship": raw.get("relationship", "auto"),
            }
        else:
            parts[part_id] = {"selector": None, "relationship": "auto"}
    return parts


def build_publisher_manifest():
    """Return deterministic runtime CSS and widget selector metadata."""
    widgets = {}
    for widget in sorted(widget_type_registry.list_widget_types(active_only=True), key=lambda item: item.type):
        widgets[widget.type] = {
            "name": widget.name,
            "css": widget.widget_css or "",
            "cssVariables": dict(sorted((widget.css_variables or {}).items())),
            "layoutParts": _layout_parts(widget),
            "variants": sorted(widget.variants or [], key=lambda item: (item.get("id", ""), item.get("type", ""))),
        }
    return {
        "formatVersion": MANIFEST_VERSION,
        "baseCss": BASE_CSS_PATH.read_text(encoding="utf-8"),
        "defaultSpecialPages": default_special_pages(),
        "widgets": widgets,
    }


def serialize_publisher_manifest():
    return json.dumps(build_publisher_manifest(), indent=2, sort_keys=True, ensure_ascii=False) + "\n"
