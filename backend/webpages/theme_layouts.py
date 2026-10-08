"""Validated, portable layout documents owned by page themes."""

from __future__ import annotations

import copy
import re
import uuid

from django.core.exceptions import ValidationError

SCHEMA_VERSION = 1
LAYOUT_KEY = re.compile(r"^[a-z][a-z0-9_]{0,63}$")
NODE_TYPES = {"container", "section", "grid", "row", "column", "semantic", "slot"}
SEMANTIC_TAGS = {"div", "header", "nav", "main", "aside", "section", "footer"}
BREAKPOINTS = {"base", "xs", "sm", "md", "lg", "xl"}
STYLE_PROPERTIES = {
    "display",
    "width",
    "max_width",
    "min_height",
    "grid_template_columns",
    "grid_column",
    "flex_direction",
    "flex_wrap",
    "flex_grow",
    "order",
    "gap",
    "padding",
    "margin",
    "align_items",
    "justify_content",
    "background_color",
    "color",
    "border",
    "border_radius",
}
EXTERNALLY_EDITABLE_NODE_TYPES = {"container", "semantic", "slot"}
COLLAPSE_BEHAVIORS = {"never", "any", "all"}
MAX_LAYOUTS = 50
MAX_NODES = 250
MAX_DEPTH = 12
REQUIRED_LAYOUT_KEYS = {"main_layout", "landing_page", "error_layout"}


def _stable_uuid(name: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"https://eceee.org/theme-layout/{name}"))


def _node(name, node_type, *, children=None, styles=None, class_names=None, tag=None, slot_key=None, label=None):
    node = {
        "id": _stable_uuid(f"node/{name}"),
        "type": node_type,
        "label": label or name.rsplit("/", 1)[-1].replace("_", " ").replace("-", " ").title(),
        "children": children or [],
        "styles": styles or {},
    }
    if class_names:
        node["class_names"] = class_names
    if tag:
        node["tag"] = tag
    if slot_key:
        node["slot_key"] = slot_key
    return node


def _slot_node(layout, key, class_names=None):
    return _node(
        f"{layout}/slot/{key}",
        "slot",
        slot_key=key,
        label=key.replace("_", " ").title(),
        class_names=class_names or ["layout-slot", f"slot-{key}"],
    )


def _dimensions(widths, height=None):
    return {name: {"width": width, "height": height} for name, width in widths.items()}


SHARED_SLOTS = {
    "header": {
        "label": "Header",
        "description": "Page header content",
        "order": 10,
        "max_widgets": 1,
        "allows_inheritance": True,
        "allow_merge": False,
        "collapse_behavior": "any",
        "allowed_widget_types": ["easy_widgets.HeaderWidget"],
        "inheritable_types": ["easy_widgets.HeaderWidget"],
        "default_widgets": [{"type": "header"}],
        "dimensions": _dimensions({"mobile": 640, "tablet": 1024, "desktop": 1280}, 112),
    },
    "navbar": {
        "label": "Navigation Bar",
        "description": "Main navigation menu",
        "order": 20,
        "max_widgets": 1,
        "allows_inheritance": True,
        "allow_merge": False,
        "collapse_behavior": "any",
        "allowed_widget_types": ["easy_widgets.NavbarWidget"],
        "inheritable_types": ["easy_widgets.NavbarWidget"],
        "default_widgets": [{"type": "navbar"}],
        "dimensions": _dimensions({"mobile": 640, "tablet": 1024, "desktop": 1280}, 28),
    },
    "hero": {
        "label": "Hero",
        "description": "The Hero space",
        "order": 30,
        "max_widgets": 1,
        "allows_inheritance": True,
        "allow_merge": False,
        "collapse_behavior": "any",
        "allowed_widget_types": ["easy_widgets.HeroWidget"],
        "inheritable_types": ["easy_widgets.HeroWidget"],
        "default_widgets": [{"type": "hero", "config": {}}],
        "dimensions": _dimensions({"mobile": 640, "tablet": 1024, "desktop": 1280}, 28),
    },
    "footer": {
        "label": "Footer",
        "description": "Page footer content",
        "order": 1000,
        "max_widgets": 1,
        "allows_inheritance": True,
        "allow_merge": False,
        "collapse_behavior": "any",
        "allowed_widget_types": ["easy_widgets.FooterWidget"],
        "inheritable_types": ["easy_widgets.FooterWidget"],
        "default_widgets": [{"type": "footer"}],
        "dimensions": _dimensions({"mobile": 640, "tablet": 1024, "desktop": 1280}),
    },
}


def _main_layout():
    slots = copy.deepcopy(SHARED_SLOTS)
    slots["main"] = {
        "label": "Main Content",
        "description": "Primary page content area",
        "order": 50,
        "max_widgets": None,
        "allows_inheritance": False,
        "allow_merge": False,
        "collapse_behavior": "never",
        "disallowed_widget_types": [
            "easy_widgets.FooterWidget",
            "easy_widgets.NavbarWidget",
            "easy_widgets.HeaderWidget",
        ],
        "default_widgets": [],
        "dimensions": _dimensions({"mobile": 640, "tablet": 1024, "desktop": 1280}),
    }
    slots["sidebar"] = {
        "label": "Sidebar",
        "description": "Complementary content and widgets",
        "order": 60,
        "max_widgets": None,
        "allows_inheritance": True,
        "allow_merge": True,
        "collapse_behavior": "all",
        "inheritable_types": [],
        "disallowed_widget_types": [
            "easy_widgets.FooterWidget",
            "easy_widgets.NavbarWidget",
            "easy_widgets.HeaderWidget",
        ],
        "default_widgets": [],
        "dimensions": _dimensions({"mobile": 640, "tablet": 1024, "desktop": 1280}),
    }
    main = _node(
        "main/main",
        "semantic",
        tag="main",
        class_names=["main-layout-main"],
        styles={
            "base": {"width": "100%", "max_width": "650px", "margin": "0 auto"},
            "xl": {"max_width": "790px", "margin": "0"},
        },
        children=[_slot_node("main", "main")],
    )
    aside = _node(
        "main/aside",
        "semantic",
        tag="aside",
        class_names=["main-layout-aside"],
        styles={
            "base": {"display": "grid", "grid_template_columns": "1fr", "gap": "30px", "min_height": "310px"},
            "md": {"grid_template_columns": "repeat(2, minmax(0, 1fr))"},
            "lg": {"grid_template_columns": "1fr"},
        },
        children=[_slot_node("main", "sidebar")],
    )
    grid = _node(
        "main/grid",
        "grid",
        class_names=["main-layout-grid"],
        styles={
            "base": {
                "display": "grid",
                "grid_template_columns": "1fr",
                "gap": "30px",
                "padding": "30px 40px",
                "min_height": "300px",
                "flex_grow": "1",
            },
            "lg": {"grid_template_columns": "repeat(3, minmax(0, 1fr))"},
        },
        children=[
            {**main, "styles": {**main["styles"], "lg": {**main["styles"].get("lg", {}), "grid_column": "span 2"}}},
            {**aside, "styles": {**aside["styles"], "lg": {**aside["styles"].get("lg", {}), "grid_column": "span 1"}}},
        ],
    )
    footer = _node(
        "main/footer",
        "semantic",
        tag="footer",
        class_names=["main-layout-footer"],
        styles={"base": {"min_height": "310px", "display": "flex", "flex_direction": "column"}},
        children=[_slot_node("main", "footer")],
    )
    wrapper = _node(
        "main/wrapper",
        "container",
        class_names=["main-layout-wrapper"],
        styles={
            "base": {
                "width": "100%",
                "max_width": "1280px",
                "margin": "0 auto",
                "display": "flex",
                "flex_direction": "column",
                "flex_grow": "1",
                "background_color": "#ffffff",
            }
        },
        children=[_slot_node("main", "header"), _slot_node("main", "navbar"), _slot_node("main", "hero"), grid, footer],
    )
    return {
        "id": _stable_uuid("layout/main_layout"),
        "key": "main_layout",
        "label": "Main",
        "description": "Header, navigation, hero, main content, sidebar, and footer.",
        "status": "active",
        "root": _node(
            "main/root",
            "container",
            class_names=["main-layout-container"],
            styles={
                "base": {
                    "min_height": "100vh",
                    "display": "flex",
                    "flex_direction": "column",
                    "background_color": "#9ca3af",
                }
            },
            children=[wrapper],
        ),
        "slots": slots,
    }


def _landing_layout():
    slots = copy.deepcopy(SHARED_SLOTS)
    slots["landing_page"] = {
        "label": "Landing Page Main Content",
        "description": "Primary content area for articles and posts",
        "order": 40,
        "max_widgets": None,
        "required": True,
        "allowed_widget_types": [
            "easy_widgets.BannerWidget",
            "easy_widgets.HeroWidget",
            "easy_widgets.TwoColumnsWidget",
            "easy_widgets.ThreeColumnsWidget",
        ],
        "default_widgets": [],
        "dimensions": _dimensions({"mobile": 640, "tablet": 1024, "desktop": 1280}),
    }
    main = _node(
        "landing/main",
        "semantic",
        tag="main",
        class_names=["landing-page-main"],
        styles={"base": {"padding": "30px", "min_height": "310px", "background_color": "#ffffff"}},
        children=[_slot_node("landing", "landing_page", ["layout-slot", "slot-landing-page", "slot-landingPage"])],
    )
    footer = _node(
        "landing/footer",
        "semantic",
        tag="footer",
        class_names=["landing-page-footer"],
        styles={"base": {"min_height": "310px", "display": "flex", "flex_direction": "column"}},
        children=[_slot_node("landing", "footer")],
    )
    wrapper = _node(
        "landing/wrapper",
        "container",
        class_names=["landing-page-wrapper"],
        styles={
            "base": {
                "width": "100%",
                "max_width": "1280px",
                "margin": "0 auto",
                "display": "flex",
                "flex_direction": "column",
                "flex_grow": "1",
                "background_color": "#ffffff",
            }
        },
        children=[
            _slot_node("landing", "header"),
            _slot_node("landing", "navbar"),
            _slot_node("landing", "hero"),
            main,
            footer,
        ],
    )
    return {
        "id": _stable_uuid("layout/landing_page"),
        "key": "landing_page",
        "label": "Landing Page",
        "description": "Full-width landing page with hero and conversion content.",
        "status": "active",
        "root": _node(
            "landing/root",
            "container",
            class_names=["landing-page-container"],
            styles={
                "base": {
                    "min_height": "100vh",
                    "display": "flex",
                    "flex_direction": "column",
                    "background_color": "#9ca3af",
                }
            },
            children=[wrapper],
        ),
        "slots": slots,
    }


def _error_layout():
    slots = {
        "visual": {
            "label": "Illustration",
            "description": "An image or other visual that supports the error message.",
            "order": 10,
            "max_widgets": 1,
            "collapse_behavior": "any",
            "allowed_widget_types": ["easy_widgets.ImageWidget"],
            "default_widgets": [],
            "dimensions": _dimensions({"mobile": 640, "tablet": 760, "desktop": 880}, 260),
        },
        "message": {
            "label": "Error Message",
            "description": "Status-specific heading and explanatory text.",
            "order": 20,
            "max_widgets": None,
            "required": True,
            "collapse_behavior": "never",
            "allowed_widget_types": ["easy_widgets.HeadlineWidget", "easy_widgets.ContentWidget"],
            "default_widgets": [],
            "dimensions": _dimensions({"mobile": 640, "tablet": 760, "desktop": 880}),
        },
        "actions": {
            "label": "Helpful Actions",
            "description": "Links and widgets that help visitors recover.",
            "order": 30,
            "max_widgets": None,
            "collapse_behavior": "any",
            "disallowed_widget_types": [
                "easy_widgets.FooterWidget",
                "easy_widgets.HeaderWidget",
                "easy_widgets.NavbarWidget",
            ],
            "default_widgets": [],
            "dimensions": _dimensions({"mobile": 640, "tablet": 760, "desktop": 880}),
        },
    }
    card = _node(
        "error/card",
        "section",
        class_names=["error-layout-card"],
        styles={
            "base": {
                "width": "100%",
                "max_width": "880px",
                "display": "grid",
                "grid_template_columns": "1fr",
                "gap": "24px",
                "padding": "32px 24px",
                "background_color": "#ffffff",
                "border": "1px solid #e5e7eb",
                "border_radius": "24px",
            },
            "md": {
                "grid_template_columns": "minmax(220px, 0.8fr) minmax(0, 1.2fr)",
                "padding": "56px",
                "gap": "48px",
            },
        },
        children=[
            _node(
                "error/visual-column",
                "column",
                styles={"base": {"display": "flex", "align_items": "center", "justify_content": "center"}},
                children=[_slot_node("error", "visual")],
            ),
            _node(
                "error/content-column",
                "column",
                styles={"base": {"display": "flex", "flex_direction": "column", "justify_content": "center"}},
                children=[_slot_node("error", "message"), _slot_node("error", "actions")],
            ),
        ],
    )
    return {
        "id": _stable_uuid("layout/error_layout"),
        "key": "error_layout",
        "label": "Error Page",
        "description": "A reusable, accessible layout for site-owned HTTP error pages.",
        "status": "active",
        "root": _node(
            "error/root",
            "semantic",
            tag="main",
            class_names=["error-layout-container"],
            styles={
                "base": {
                    "min_height": "100vh",
                    "display": "flex",
                    "align_items": "center",
                    "justify_content": "center",
                    "padding": "24px",
                    "background_color": "#f3f4f6",
                }
            },
            children=[card],
        ),
        "slots": slots,
    }


def error_theme_layout():
    """Return a fresh copy of the required error-page layout."""
    return _error_layout()


def default_theme_layouts():
    """Return a fresh default document suitable for JSONField defaults and migrations."""
    return {
        "schema_version": SCHEMA_VERSION,
        "default_layout_key": "main_layout",
        "items": [_main_layout(), _landing_layout(), _error_layout()],
    }


def legacy_compatibility_layout(key, slot_keys=None):
    """Build a safe React seed for a referenced registry layout outside the standard seeds."""
    if not isinstance(key, str) or not LAYOUT_KEY.fullmatch(key):
        raise ValidationError(f"Legacy layout key {key!r} cannot be represented by the layout schema.")
    known_slots = {
        "error_403": ["branding", "error_message", "helpful_content"],
        "error_404": ["branding", "error_message", "helpful_content"],
        "error_500": ["branding", "error_message", "helpful_content"],
        "error_503": ["branding", "error_message", "helpful_content"],
    }
    keys = sorted(set(slot_keys or known_slots.get(key) or ["main"]))
    if any(not isinstance(slot_key, str) or not LAYOUT_KEY.fullmatch(slot_key) for slot_key in keys):
        raise ValidationError(f"Legacy layout '{key}' contains a slot key that cannot be represented safely.")
    slots = {
        slot_key: {
            "label": slot_key.replace("_", " ").title(),
            "description": "Migrated compatibility slot",
            "order": (index + 1) * 10,
            "max_widgets": 1 if slot_key == "branding" else None,
            "collapse_behavior": "never",
            "default_widgets": [],
        }
        for index, slot_key in enumerate(keys)
    }
    return {
        "id": _stable_uuid(f"layout/{key}"),
        "key": key,
        "label": key.replace("_", " ").title(),
        "description": "Migrated from the legacy code-layout registry.",
        "status": "active",
        "root": _node(
            f"{key}/root",
            "semantic",
            tag="main",
            class_names=["legacy-layout-compatibility", f"layout-{key.replace('_', '-')}"],
            styles={"base": {"width": "100%", "display": "flex", "flex_direction": "column"}},
            children=[_slot_node(key, slot_key) for slot_key in keys],
        ),
        "slots": slots,
    }


def _validate_string_list(value, path):
    if not isinstance(value, list) or any(not isinstance(item, str) or not item for item in value):
        raise ValidationError(f"{path} must be a list of non-empty strings.")


def validate_theme_layouts(document):
    """Validate a theme layout document without executing or accepting presentation code."""
    if not isinstance(document, dict):
        raise ValidationError("Layouts must be an object.")
    if document.get("schema_version") != SCHEMA_VERSION:
        raise ValidationError(f"layouts.schema_version must be {SCHEMA_VERSION}.")
    items = document.get("items")
    if not isinstance(items, list) or not items or len(items) > MAX_LAYOUTS:
        raise ValidationError(f"layouts.items must contain between 1 and {MAX_LAYOUTS} layouts.")

    layout_keys = set()
    layout_ids = set()
    active_keys = set()
    for index, layout in enumerate(items):
        path = f"layouts.items[{index}]"
        if not isinstance(layout, dict):
            raise ValidationError(f"{path} must be an object.")
        key = layout.get("key")
        if not isinstance(key, str) or not LAYOUT_KEY.fullmatch(key):
            raise ValidationError(f"{path}.key must use lowercase letters, numbers, and underscores.")
        if key in layout_keys:
            raise ValidationError(f"Duplicate layout key: {key}.")
        layout_keys.add(key)
        try:
            layout_id = str(uuid.UUID(str(layout.get("id"))))
        except (TypeError, ValueError, AttributeError) as exc:
            raise ValidationError(f"{path}.id must be a UUID.") from exc
        if layout_id in layout_ids:
            raise ValidationError(f"Duplicate layout id: {layout_id}.")
        layout_ids.add(layout_id)
        if layout.get("status", "active") not in {"active", "archived"}:
            raise ValidationError(f"{path}.status must be active or archived.")
        if layout.get("status", "active") == "active":
            active_keys.add(key)
        for field in ("label", "description"):
            if not isinstance(layout.get(field, ""), str):
                raise ValidationError(f"{path}.{field} must be text.")

        slots = layout.get("slots")
        if not isinstance(slots, dict):
            raise ValidationError(f"{path}.slots must be an object.")
        for slot_key, slot in slots.items():
            slot_path = f"{path}.slots.{slot_key}"
            if not LAYOUT_KEY.fullmatch(str(slot_key)) or not isinstance(slot, dict):
                raise ValidationError(f"{slot_path} is not a valid slot definition.")
            for list_field in ("allowed_widget_types", "disallowed_widget_types", "inheritable_types"):
                if list_field in slot:
                    _validate_string_list(slot[list_field], f"{slot_path}.{list_field}")
            if "allowed_widget_types" in slot and "disallowed_widget_types" in slot:
                raise ValidationError(f"{slot_path} cannot define both allowed and disallowed widget types.")
            if slot.get("collapse_behavior", "never") not in COLLAPSE_BEHAVIORS:
                raise ValidationError(f"{slot_path}.collapse_behavior is invalid.")
            maximum = slot.get("max_widgets")
            if maximum is not None and (not isinstance(maximum, int) or maximum < 1):
                raise ValidationError(f"{slot_path}.max_widgets must be null or a positive integer.")

        node_ids = set()
        node_slots = []
        node_count = 0

        def visit(node, depth):
            nonlocal node_count
            if depth > MAX_DEPTH:
                raise ValidationError(f"{path}.root exceeds the maximum depth of {MAX_DEPTH}.")
            if not isinstance(node, dict):
                raise ValidationError(f"{path}.root contains a non-object node.")
            node_count += 1
            if node_count > MAX_NODES:
                raise ValidationError(f"{path}.root exceeds the maximum of {MAX_NODES} nodes.")
            try:
                node_id = str(uuid.UUID(str(node.get("id"))))
            except (TypeError, ValueError, AttributeError) as exc:
                raise ValidationError(f"{path}.root node id must be a UUID.") from exc
            if node_id in node_ids:
                raise ValidationError(f"{path}.root contains duplicate node id {node_id}.")
            node_ids.add(node_id)
            node_type = node.get("type")
            if node_type not in NODE_TYPES:
                raise ValidationError(f"{path}.root contains unsupported node type {node_type!r}.")
            if node_type == "semantic" and node.get("tag", "div") not in SEMANTIC_TAGS:
                raise ValidationError(f"{path}.root contains an unsupported semantic tag.")
            label = node.get("label", "")
            if not isinstance(label, str) or len(label) > 100:
                raise ValidationError(f"{path}.root node label must be text no longer than 100 characters.")
            presentation_color = node.get("presentation_color")
            if presentation_color is not None and (
                node_type not in EXTERNALLY_EDITABLE_NODE_TYPES
                or not isinstance(presentation_color, str)
                or not re.fullmatch(r"#[0-9A-Fa-f]{6}", presentation_color)
            ):
                raise ValidationError(
                    f"{path}.root presentation_color must be a six-digit hex colour on a container, semantic, or slot."
                )
            editable_parameters = node.get("editable_parameters", [])
            if editable_parameters:
                _validate_string_list(editable_parameters, f"{path}.root node editable_parameters")
                if node_type not in EXTERNALLY_EDITABLE_NODE_TYPES:
                    raise ValidationError(
                        f"{path}.root only container, semantic, and slot nodes can expose editable parameters."
                    )
                if any(parameter not in STYLE_PROPERTIES for parameter in editable_parameters):
                    raise ValidationError(f"{path}.root node exposes an unsupported editable parameter.")
            class_names = node.get("class_names", [])
            if not isinstance(class_names, list) or any(
                not re.fullmatch(r"[A-Za-z_][\w-]*", str(name)) for name in class_names
            ):
                raise ValidationError(f"{path}.root class_names are invalid.")
            styles = node.get("styles", {})
            if not isinstance(styles, dict) or any(bp not in BREAKPOINTS for bp in styles):
                raise ValidationError(f"{path}.root contains unsupported responsive styles.")
            for breakpoint, values in styles.items():
                if not isinstance(values, dict) or any(prop not in STYLE_PROPERTIES for prop in values):
                    raise ValidationError(f"{path}.root styles at {breakpoint} contain unsupported properties.")
                if any(not isinstance(value, (str, int, float)) for value in values.values()):
                    raise ValidationError(f"{path}.root style values must be strings or numbers.")
                for value in values.values():
                    text = str(value).strip()
                    if len(text) > 160 or re.search(r"[;{}<>]|url\s*\(|expression\s*\(|@import", text, re.IGNORECASE):
                        raise ValidationError(f"{path}.root contains an unsafe structured style value.")
            children = node.get("children", [])
            if not isinstance(children, list):
                raise ValidationError(f"{path}.root node children must be a list.")
            if node_type == "slot":
                slot_key = node.get("slot_key")
                if children or slot_key not in slots:
                    raise ValidationError(f"{path}.root slot nodes must be leaves referencing declared slots.")
                node_slots.append(slot_key)
            child_contains_slot = False
            for child in children:
                child_contains_slot = visit(child, depth + 1) or child_contains_slot
            contains_slot = node_type == "slot" or child_contains_slot
            if contains_slot and any(
                str(values.get("display", "")).strip().lower() == "none" for values in styles.values()
            ):
                raise ValidationError(f"{path}.root cannot hide a node that contains a slot.")
            return contains_slot

        visit(layout.get("root"), 1)
        if len(node_slots) != len(set(node_slots)) or set(node_slots) != set(slots):
            raise ValidationError(f"{path} must contain exactly one node for every declared slot.")

    missing_required = REQUIRED_LAYOUT_KEYS - layout_keys
    if missing_required:
        raise ValidationError(f"Required layouts cannot be removed: {', '.join(sorted(missing_required))}.")

    default_key = document.get("default_layout_key")
    if default_key not in active_keys:
        raise ValidationError("layouts.default_layout_key must reference an active layout.")
    return document


def validate_layout_widgets(theme, layout_key, widgets):
    """Enforce persisted slot limits and widget allow/deny policies."""
    if not theme or not layout_key or not isinstance(widgets, dict):
        return widgets
    layout = next(
        (item for item in (theme.layouts or {}).get("items", []) if item.get("key") == layout_key),
        None,
    )
    if not layout:
        return widgets

    def matches(widget_type, patterns):
        return any(
            pattern == "*"
            or widget_type == pattern
            or (pattern.endswith(".*") and widget_type.startswith(pattern[:-1]))
            for pattern in patterns
        )

    errors = []
    slots = layout.get("slots", {})
    for slot_key, items in widgets.items():
        if not isinstance(items, list):
            errors.append(f"Slot '{slot_key}' widgets must be a list.")
            continue
        if not items:
            continue
        policy = slots.get(slot_key)
        if policy is None:
            errors.append(f"Slot '{slot_key}' is not declared by layout '{layout_key}'.")
            continue
        maximum = policy.get("max_widgets")
        if maximum is not None and len(items) > maximum:
            errors.append(f"Slot '{slot_key}' allows at most {maximum} widgets.")
        allowed = policy.get("allowed_widget_types")
        disallowed = policy.get("disallowed_widget_types") or []
        for widget in items:
            widget_type = widget.get("type") if isinstance(widget, dict) else None
            if not isinstance(widget_type, str) or not widget_type.strip():
                errors.append(f"Every widget in slot '{slot_key}' must have a type.")
                continue
            if allowed and not matches(widget_type, allowed):
                errors.append(f"Widget type '{widget_type}' is not allowed in slot '{slot_key}'.")
            elif disallowed and matches(widget_type, disallowed):
                errors.append(f"Widget type '{widget_type}' is not allowed in slot '{slot_key}'.")
    if errors:
        raise ValidationError(errors)
    return widgets


def theme_layout_usage(theme):
    """Return conservative usage counts for layout and slot compatibility checks."""
    from django.db.models import Q

    from webpages.models import PageDataSchema, PageVersion

    usage = {}
    default_theme = type(theme).get_default_theme(tenant=theme.tenant)
    versions = PageVersion.objects.filter(page__tenant=theme.tenant).filter(Q(theme=theme) | Q(theme__isnull=True))
    for version in versions.only("page_id", "layout_key", "code_layout", "widgets"):
        effective_theme = version.theme
        if effective_theme is None:
            current = version.page.parent
            include_parent_drafts = not version.is_published()
            while current and effective_theme is None:
                parent_version = (
                    current.get_latest_version() if include_parent_drafts else current.get_current_published_version()
                )
                effective_theme = parent_version.theme if parent_version and parent_version.theme else None
                current = current.parent
            effective_theme = effective_theme or default_theme
        if effective_theme is None or effective_theme.pk != theme.pk:
            continue
        key = version.layout_key or version.code_layout
        current = version.page.parent
        include_parent_drafts = not version.is_published()
        while not key and current:
            parent_version = (
                current.get_latest_version() if include_parent_drafts else current.get_current_published_version()
            )
            key = (parent_version.layout_key or parent_version.code_layout) if parent_version else ""
            current = current.parent
        if not key:
            key = (effective_theme.layouts or {}).get("default_layout_key")
        if not key:
            continue
        entry = usage.setdefault(key, {"page_ids": set(), "version_count": 0, "schema_count": 0, "slots": {}})
        entry["page_ids"].add(version.page_id)
        entry["version_count"] += 1
        if isinstance(version.widgets, dict):
            for slot_key, widgets in version.widgets.items():
                if widgets:
                    entry["slots"][slot_key] = entry["slots"].get(slot_key, 0) + 1
    schemas = PageDataSchema.objects.filter(scope=PageDataSchema.SCOPE_LAYOUT, is_active=True)
    for schema in schemas.only("layout_key", "layout_name"):
        key = schema.layout_key or schema.layout_name
        if key:
            usage.setdefault(key, {"page_ids": set(), "version_count": 0, "schema_count": 0, "slots": {}})[
                "schema_count"
            ] += 1
    return {
        key: {
            "page_count": len(value["page_ids"]),
            "page_ids": sorted(str(page_id) for page_id in value["page_ids"]),
            "version_count": value["version_count"],
            "schema_count": value["schema_count"],
            "slots": value["slots"],
        }
        for key, value in usage.items()
    }


def validate_layout_compatibility(theme, updated_document):
    """Block destructive key/slot changes while referenced content still exists."""
    validate_theme_layouts(updated_document)
    previous = {item["id"]: item for item in (theme.layouts or {}).get("items", []) if isinstance(item, dict)}
    updated = {item["id"]: item for item in updated_document.get("items", [])}
    updated_by_key = {item["key"]: item for item in updated_document.get("items", [])}
    usage = theme_layout_usage(theme)
    errors = []
    for layout_id, old_layout in previous.items():
        current = updated.get(layout_id)
        old_key = old_layout.get("key")
        if old_key in updated_by_key and updated_by_key[old_key].get("id") != layout_id:
            errors.append(f"Layout '{old_key}' must keep its immutable id.")
        counts = usage.get(old_key, {})
        reference_count = counts.get("version_count", 0) + counts.get("schema_count", 0)
        if current is None and reference_count:
            errors.append(
                f"Layout '{old_key}' is used by {reference_count} version/schema references and cannot be deleted."
            )
            continue
        if current is None:
            continue
        if current.get("key") != old_key and reference_count:
            errors.append(f"Layout key '{old_key}' is in use and cannot be renamed.")
        removed_slots = set((old_layout.get("slots") or {})) - set((current.get("slots") or {}))
        for slot_key in sorted(removed_slots):
            slot_count = counts.get("slots", {}).get(slot_key, 0)
            if slot_count:
                errors.append(
                    f"Slot '{old_key}.{slot_key}' contains content in {slot_count} versions and cannot be removed."
                )
    if errors:
        raise ValidationError(errors)
    return updated_document
