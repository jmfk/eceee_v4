"""Compatibility for layout identifiers stored before the camelCase migration."""

import copy


LAYOUT_KEY_ALIASES = {"main_layout": "mainLayout", "landing_page": "landingPage", "error_layout": "errorLayout"}


def canonical_layout_key(key):
    return LAYOUT_KEY_ALIASES.get(key, key)


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
        if item.get("key") != "landingPage":
            continue
        slots = item.get("slots")
        if isinstance(slots, dict) and "landing_page" in slots:
            if "landingPage" in slots:
                raise ValueError("Landing layout has both legacy and current slot keys.")
            slots["landingPage"] = slots.pop("landing_page")

        def visit(node):
            if not isinstance(node, dict):
                return
            if node.get("slot_key") == "landing_page":
                node["slot_key"] = "landingPage"
            for child in node.get("children", []):
                visit(child)

        visit(item.get("root"))
    for page in result.get("special_pages", []):
        if isinstance(page, dict):
            if "layout_key" in page:
                page["layout_key"] = canonical_layout_key(page["layout_key"])
            if page.get("layout_key") == "landingPage" and isinstance(page.get("widgets"), dict):
                widgets = page["widgets"]
                if "landing_page" in widgets:
                    widgets["landingPage"] = [*widgets.pop("landing_page"), *(widgets.get("landingPage") or [])]
    return result


def canonical_preview(preview):
    if not isinstance(preview, dict):
        return preview
    result = copy.deepcopy(preview)
    for view in result.get("views", []):
        if isinstance(view, dict):
            if "layout" in view:
                view["layout"] = canonical_layout_key(view["layout"])
            content = view.get("content")
            if isinstance(content, dict) and "codeLayout" in content:
                content["codeLayout"] = canonical_layout_key(content["codeLayout"])
    return result


def canonical_theme_snapshot(snapshot):
    if not isinstance(snapshot, dict):
        return snapshot
    result = copy.deepcopy(snapshot)
    if "layouts" in result:
        result["layouts"] = canonical_layout_document(result["layouts"])
    if "designer_preview" in result:
        result["designer_preview"] = canonical_preview(result["designer_preview"])
    return result
