"""Compatibility for layout identifiers stored before the camelCase migration."""

import copy
import re

LAYOUT_KEY_ALIASES = {"main_layout": "mainLayout", "landing_page": "landingPage", "error_layout": "errorLayout"}
SLOT_KEY_ALIASES = {
    "landing_page": "landingPage",
    "content_grid": "contentGrid",
    "secondary_sidebar": "secondarySidebar",
}
GENERATED_SLOT_KEY = re.compile(r"^slot_([0-9]+)$")


def canonical_layout_key(key):
    return LAYOUT_KEY_ALIASES.get(key, key)


def canonical_slot_key(key):
    if not isinstance(key, str):
        return key
    match = GENERATED_SLOT_KEY.fullmatch(key)
    return SLOT_KEY_ALIASES.get(key, f"slot{match.group(1)}" if match else key)


def canonical_slot_widgets(widgets, allowed_slots=None):
    """Move known legacy widget slots without dropping either side of a collision."""
    if not isinstance(widgets, dict):
        return widgets
    result = copy.deepcopy(widgets)
    for old in list(result):
        new = canonical_slot_key(old)
        if old == new or (allowed_slots is not None and (new not in allowed_slots or old in allowed_slots)):
            continue
        previous = result.pop(old)
        current = result.get(new, [])
        if not isinstance(previous, list) or not isinstance(current, list):
            raise ValueError(f"Slot widgets for {old} and {new} must be lists.")
        result[new] = [*previous, *current]
    return result


def canonical_layout_document(document):
    """Read old snapshots and imported themes without modifying their history."""
    if not isinstance(document, dict):
        return document
    result = copy.deepcopy(document)
    if "default_layout_key" in result:
        result["default_layout_key"] = canonical_layout_key(result["default_layout_key"])
    for item in result.get("items", []):
        if not isinstance(item, dict):
            continue
        item["key"] = canonical_layout_key(item.get("key"))
        slots = item.get("slots")
        if not isinstance(slots, dict):
            continue
        renamed = {}
        for old in list(slots):
            new = canonical_slot_key(old)
            if old == new:
                continue
            if new in slots:
                raise ValueError(f"Layout has both {old} and {new} slot keys.")
            slots[new] = slots.pop(old)
            renamed[old] = new

        def visit(node):
            if not isinstance(node, dict):
                return
            slot_key = node.get("slot_key")
            if isinstance(slot_key, str) and slot_key in renamed:
                node["slot_key"] = renamed[slot_key]
            for child in node.get("children", []):
                visit(child)

        visit(item.get("root"))
    for page in result.get("special_pages", []):
        if isinstance(page, dict):
            if "layout_key" in page:
                page["layout_key"] = canonical_layout_key(page["layout_key"])
            if isinstance(page.get("widgets"), dict):
                layout = next(
                    (
                        item
                        for item in result.get("items", [])
                        if isinstance(item, dict) and item.get("key") == page.get("layout_key")
                    ),
                    None,
                )
                slots = layout.get("slots") if layout else None
                page["widgets"] = canonical_slot_widgets(
                    page["widgets"], set(slots) if isinstance(slots, dict) else set()
                )
    return result


def canonical_preview(preview, layouts=None):
    if not isinstance(preview, dict):
        return preview
    result = copy.deepcopy(preview)
    by_key = (
        {
            item.get("key"): set(item.get("slots", {}))
            for item in layouts.get("items", [])
            if isinstance(item, dict) and isinstance(item.get("slots"), dict)
        }
        if isinstance(layouts, dict)
        else {}
    )
    default_key = layouts.get("default_layout_key") if isinstance(layouts, dict) else None
    for view in result.get("views", []):
        if isinstance(view, dict):
            if "layout" in view:
                view["layout"] = canonical_layout_key(view["layout"])
            content = view.get("content")
            if isinstance(content, dict) and "codeLayout" in content:
                content["codeLayout"] = canonical_layout_key(content["codeLayout"])
            if isinstance(content, dict) and "widgets" in content:
                key = content.get("codeLayout") or view.get("layout") or default_key
                content["widgets"] = canonical_slot_widgets(content["widgets"], by_key.get(key, set()))
    return result


def canonical_theme_snapshot(snapshot):
    if not isinstance(snapshot, dict):
        return snapshot
    result = copy.deepcopy(snapshot)
    if "layouts" in result:
        result["layouts"] = canonical_layout_document(result["layouts"])
    if "designer_preview" in result:
        result["designer_preview"] = canonical_preview(result["designer_preview"], result.get("layouts"))
    return result
