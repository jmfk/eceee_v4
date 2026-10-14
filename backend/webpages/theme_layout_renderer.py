"""Safe server-side rendering for validated theme-owned layout definitions."""

from __future__ import annotations

import re
from urllib.parse import urlparse

from django.utils.html import format_html, format_html_join
from django.utils.safestring import mark_safe

PROPERTY_MAP = {
    "display": "display",
    "width": "width",
    "max_width": "max-width",
    "min_height": "min-height",
    "grid_template_columns": "grid-template-columns",
    "grid_column": "grid-column",
    "flex_direction": "flex-direction",
    "flex_wrap": "flex-wrap",
    "flex_grow": "flex-grow",
    "order": "order",
    "gap": "gap",
    "padding": "padding",
    "margin": "margin",
    "align_items": "align-items",
    "justify_content": "justify-content",
    "background_color": "background-color",
    "background_image": "background-image",
    "background_position": "background-position",
    "background_repeat": "background-repeat",
    "background_size": "background-size",
    "color": "color",
    "font_family": "font-family",
    "border": "border",
    "border_radius": "border-radius",
}
SEMANTIC_TAGS = {"div", "header", "nav", "main", "aside", "section", "footer"}
DEFAULT_BREAKPOINTS = {"xs": 0, "sm": 640, "md": 768, "lg": 1024, "xl": 1280}


def _safe_value(property_name, value):
    text = str(value).strip()
    if property_name == "background_image":
        if not text or len(text) > 2048 or re.search(r"[\x00-\x20\"'\\();{}<>]", text):
            return None
        parsed = urlparse(text)
        return f'url("{text}")' if parsed.scheme in {"http", "https"} and parsed.netloc else None
    if not text or len(text) > 160 or re.search(r"[;{}<>]|url\s*\(|expression\s*\(|@import", text, re.IGNORECASE):
        return None
    if text.startswith("token:"):
        token = re.sub(r"[^a-zA-Z0-9_-]", "", text[6:])
        return f"var(--{token})" if token else None
    return text


def layout_definition_css(layout, breakpoints=None):
    """Compile the same structured style allowlist used by the React renderer."""
    rules = {}

    def visit(node):
        for breakpoint, values in (node.get("styles") or {}).items():
            declarations = []
            for property_name, value in (values or {}).items():
                css_property = PROPERTY_MAP.get(property_name)
                css_value = _safe_value(property_name, value) if css_property else None
                if css_value:
                    declarations.append(f"{css_property}:{css_value}")
            if declarations:
                rules.setdefault(breakpoint, []).append(
                    f'[data-layout-node-id="{node.get("id", "")}"]' + "{" + ";".join(declarations) + "}"
                )
        for child in node.get("children") or []:
            visit(child)

    visit(layout.get("root") or {})
    widths = {**DEFAULT_BREAKPOINTS, **(breakpoints or {})}
    css = "".join(rules.get("base", []) + rules.get("xs", []))
    for breakpoint in ("sm", "md", "lg", "xl"):
        body = "".join(rules.get(breakpoint, []))
        if body:
            css += f"@media(min-width:{int(widths[breakpoint])}px)" + "{" + body + "}"
    return css


def render_theme_layout(layout, widgets_by_slot, breakpoints=None):
    """Render a validated layout tree and already-rendered widgets by slot."""

    def render_node(node):
        node_type = node.get("type")
        node_id = node.get("id", "")
        class_names = " ".join(node.get("class_names") or [])
        if node_type == "slot":
            slot_key = node.get("slot_key", "")
            content = format_html_join(
                "", "{}", ((item.get("html", ""),) for item in widgets_by_slot.get(slot_key, []))
            )
            return format_html(
                '<div class="{}" data-layout-node-id="{}" data-layout-node-type="slot" data-slot-name="{}">{}</div>',
                class_names or f"layout-slot slot-{slot_key}",
                node_id,
                slot_key,
                content,
            )
        tag = node.get("tag", "div") if node_type == "semantic" else "div"
        if tag not in SEMANTIC_TAGS:
            tag = "div"
        children = format_html_join("", "{}", ((render_node(child),) for child in node.get("children") or []))
        return format_html(
            '<{} class="{}" data-layout-node-id="{}" data-layout-node-type="{}">{}</{}>',
            mark_safe(tag),
            class_names,
            node_id,
            node_type,
            children,
            mark_safe(tag),
        )

    css = layout_definition_css(layout, breakpoints)
    tree = render_node(layout.get("root") or {})
    return format_html(
        '<div class="site-renderer cms-content" data-render-layout="{}">'
        '<style data-theme-layout-css="{}">{}</style>{}</div>',
        layout.get("key", ""),
        layout.get("key", ""),
        mark_safe(css),
        tree,
    )
