"""Built-in widget data contracts. Importable without Django or a database."""

import copy
import json
from functools import lru_cache
from pathlib import Path

CONTRACT_ROOT = Path(__file__).parent


@lru_cache(maxsize=2)
def _document(name):
    document = json.loads((CONTRACT_ROOT / name).read_text(encoding="utf-8"))
    if document["formatVersion"] != 1:
        raise ValueError(f"Unsupported widget contract version: {name}")
    return document


def render_catalog():
    return copy.deepcopy(_document("render_catalog.json"))


def pilot_models():
    return copy.deepcopy(_document("pilot_models.json"))


def render_metadata(type_id):
    """Return fresh metadata, so one widget cannot mutate another consumer's data."""
    return copy.deepcopy(_document("render_catalog.json")["widgets"][type_id])


def default_special_pages():
    return copy.deepcopy(_document("render_catalog.json")["defaultSpecialPages"])


def catalog_widget(cls):
    """Apply static built-in presentation data before Django registers the class."""
    type_id = f"{cls.__module__.split('.')[0]}.{cls.__name__}"
    metadata = render_metadata(type_id)
    cls.name = metadata["name"]
    cls.widget_css = metadata["css"]
    cls.css_variables = metadata["cssVariables"]
    cls.layout_parts = metadata["layoutParts"]
    cls.variants = metadata["variants"]
    return cls


def build_render_manifest():
    catalog = render_catalog()
    widgets = {}
    for type_id, entry in sorted(catalog["widgets"].items()):
        parts = {
            name: {
                "selector": raw.get("selector") if isinstance(raw, dict) else None,
                "relationship": raw.get("relationship", "auto") if isinstance(raw, dict) else "auto",
            }
            for name, raw in sorted(entry["layoutParts"].items())
        }
        widgets[type_id] = {
            "name": entry["name"],
            "css": entry["css"],
            "cssVariables": dict(sorted(entry["cssVariables"].items())),
            "layoutParts": parts,
            "variants": sorted(entry["variants"], key=lambda item: (item.get("id", ""), item.get("type", ""))),
        }
    return {
        "formatVersion": catalog["manifestVersion"],
        "defaultSpecialPages": catalog["defaultSpecialPages"],
        "widgets": widgets,
    }
