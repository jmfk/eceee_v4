"""Stable identity helpers for page-version widget trees."""

from copy import deepcopy
from uuid import uuid4


def new_widget_id():
    return f"widget-{uuid4()}"


def normalize_widget_ids(widgets):
    """Return a copy whose page widget instances have unique, stable IDs."""
    normalized = deepcopy(widgets)
    seen = set()

    def normalize_slot_map(slot_map):
        if not isinstance(slot_map, dict):
            return
        for slot_widgets in slot_map.values():
            if not isinstance(slot_widgets, list):
                continue
            for widget in slot_widgets:
                if not isinstance(widget, dict):
                    continue
                widget_id = widget.get("id") or widget.get("widget_id")
                widget_id = str(widget_id).strip() if widget_id is not None else ""
                if not widget_id or widget_id in seen:
                    widget_id = new_widget_id()
                widget["id"] = widget_id
                widget.pop("widget_id", None)
                seen.add(widget_id)
                config = widget.get("config")
                if isinstance(config, dict):
                    normalize_slot_map(config.get("slots"))

    if isinstance(normalized, dict):
        normalize_slot_map(normalized)
    elif isinstance(normalized, list):
        normalize_slot_map({"legacy": normalized})
    return normalized
