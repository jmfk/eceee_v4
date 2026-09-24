"""Restricted theme editing helpers used by the Designer workspace."""

import copy
import io
import logging
import os
import re
import uuid
import xml.etree.ElementTree as ET

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils.text import slugify
from PIL import Image, ImageDraw, ImageFont
from rest_framework.exceptions import ValidationError

from file_manager.storage import system_storage
from webpages.models import (
    PageTheme,
    ThemeDesignerAssignment,
    ThemeDesignerDraft,
    ThemeDesignerExportJob,
    ThemeDesignerRevision,
)
from webpages.serializers.theme import PageThemeSerializer

TYPE_PROPERTIES = {
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "lineHeight",
    "letterSpacing",
}
SPACING_PROPERTIES = {
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
}
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 16_777_216
REVISION_LIMIT = 20
RASTER_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
IMAGE_TYPES = RASTER_TYPES | {"image/svg+xml"}
CSS_VALUE_FORBIDDEN = re.compile(r"[;{}<>]|url\s*\(|expression\s*\(|@import", re.IGNORECASE)
COLOR_VALUE = re.compile(r"^(?:#[0-9a-fA-F]{3,8}|(?:rgb|hsl)a?\([0-9.%+,\-\s/]+\)|[a-zA-Z]+)$")
logger = logging.getLogger(__name__)


def _camel_to_snake(value):
    return re.sub(r"(?<!^)(?=[A-Z])", "_", value).lower()


def _theme_property_value(values, property_name):
    if property_name in values:
        return values[property_name]
    return values.get(_camel_to_snake(property_name), "")


def _set_theme_property(values, property_name, value):
    snake_name = _camel_to_snake(property_name)
    if value in (None, ""):
        values.pop(property_name, None)
        values.pop(snake_name, None)
        return
    stored_name = snake_name if snake_name in values and property_name not in values else property_name
    values[stored_name] = value


def _humanize_identifier(value):
    value = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", str(value or ""))
    value = re.sub(r"[^a-zA-Z0-9]+", " ", value).strip()
    return value[:1].upper() + value[1:] if value else "Element"


def _designer_group_label(group, widget):
    slots = group.get("slots") or ([group.get("slot")] if group.get("slot") else [])
    if widget:
        label = widget.name
        if slots:
            label += f" · {_humanize_identifier(slots[0])}"
        return label
    name = group.get("name") or "Design group"
    if str(name).lower() in {"default", "global", "system default"}:
        return "Global content"
    return _humanize_identifier(str(name).lstrip("."))


def _designer_element_label(element):
    labels = {
        "a": "Link",
        "a:hover": "Link on hover",
        "p": "Body text",
        "em": "Emphasised text",
        "strong": "Strong text",
        "blockquote": "Quotation",
        "ul": "Bullet list",
        "ol": "Numbered list",
        "li": "List item",
        "pre": "Code block",
        "code": "Inline code",
    }
    if element in labels:
        return labels[element]
    if re.fullmatch(r"h[1-6]", str(element)):
        return f"Heading {str(element)[1:]}"
    return _humanize_identifier(element)


def _normalized_layout_parts(source):
    normalized = {}
    for part_name, config in (source or {}).items():
        if isinstance(config, str):
            config = {"label": config}
        elif not isinstance(config, dict):
            config = {}
        normalized[part_name] = {
            "label": config.get("label") or _humanize_identifier(part_name),
            "properties": config.get("properties"),
        }
    return normalized


def _collect_color_names(value, available_colors):
    found = set()
    if isinstance(value, dict):
        for child in value.values():
            found.update(_collect_color_names(child, available_colors))
    elif isinstance(value, list):
        for child in value:
            found.update(_collect_color_names(child, available_colors))
    elif isinstance(value, str) and value in available_colors:
        found.add(value)
    return found


def build_designer_catalog(theme, assets):
    """Build semantic preview metadata without exposing selectors to the Designer UI."""
    from webpages.layout_autodiscovery import autodiscover_layouts
    from webpages.layout_registry import layout_registry
    from webpages.widget_registry import widget_type_registry

    available_colors = set((theme.colors or {}).keys())
    groups = []
    for group_index, group in enumerate((theme.design_groups or {}).get("groups", [])):
        widget_types = group.get("widgetTypes") or group.get("widget_types") or []
        if not widget_types:
            single_widget = group.get("widgetType") or group.get("widget_type")
            widget_types = [single_widget] if single_widget else []
        widget = widget_type_registry.get_widget_type_flexible(widget_types[0]) if widget_types else None
        widget_parts = _normalized_layout_parts(getattr(widget, "layout_parts", {}))
        slots = group.get("slots") or ([group.get("slot")] if group.get("slot") else [])
        elements = [
            {
                "id": f"group:{group_index}:element:{element}",
                "element": element,
                "label": _designer_element_label(element),
            }
            for element in (group.get("elements") or {})
        ]
        part_map = {}
        for part, breakpoint, _values in _iter_layout_properties(group):
            entry = part_map.setdefault(
                part,
                {
                    "id": f"group:{group_index}:part:{part}",
                    "part": part,
                    "label": widget_parts.get(part, {}).get("label") or _humanize_identifier(part),
                    "breakpoints": [],
                },
            )
            entry["breakpoints"].append(breakpoint)
        group_assets = [asset["assetKey"] for asset in assets if asset.get("groupIndex") == group_index]
        groups.append(
            {
                "id": f"group:{group_index}",
                "groupIndex": group_index,
                "label": _designer_group_label(group, widget),
                "description": (
                    getattr(widget, "description", "") if widget else "Theme styling shown with demo content."
                ),
                "widgetName": getattr(widget, "name", None),
                "slots": slots,
                "elements": elements,
                "parts": list(part_map.values()),
                "assetKeys": group_assets,
                "colorNames": sorted(_collect_color_names(group, available_colors)),
            }
        )

    component_styles = [
        {
            "key": key,
            "label": style.get("name") or _humanize_identifier(key),
            "description": style.get("description", ""),
            "template": style.get("template", "{{{content}}}"),
        }
        for key, style in (theme.component_styles or {}).items()
        if isinstance(style, dict)
    ]

    autodiscover_layouts()
    layouts = []
    for layout in layout_registry.list_layouts(active_only=True):
        slots = sorted(layout.slot_configuration.get("slots", []), key=lambda slot: slot.get("order", 999))
        layouts.append(
            {
                "key": layout.name,
                "label": _humanize_identifier(layout.name),
                "description": layout.description,
                "slots": [
                    {
                        "name": slot.get("name"),
                        "label": slot.get("title") or _humanize_identifier(slot.get("name")),
                        "description": slot.get("description", ""),
                    }
                    for slot in slots
                    if slot.get("name")
                ],
                "parts": [
                    {"id": f"layout:{layout.name}:part:{name}", "part": name, **config}
                    for name, config in _normalized_layout_parts(getattr(layout, "layout_parts", {})).items()
                ],
            }
        )
    return {"designGroups": groups, "componentStyles": component_styles, "layouts": layouts}


class DesignerDraftConflict(Exception):
    """Raised when a draft or its live base changed since the client loaded it."""


def user_can_design_theme(user, theme: PageTheme) -> bool:
    if not user or not user.is_authenticated:
        return False
    if theme.tenant.user_has_access(user):
        return True
    return ThemeDesignerAssignment.objects.filter(theme=theme, tenant=theme.tenant, user=user).exists()


def designer_theme_queryset(user, tenant):
    queryset = PageTheme.objects.filter(tenant=tenant)
    if tenant.user_has_access(user):
        return queryset
    return queryset.filter(designer_assignments__user=user).distinct()


def theme_designer_snapshot(theme):
    return {
        "colors": copy.deepcopy(theme.colors),
        "fonts": copy.deepcopy(theme.fonts),
        "design_groups": copy.deepcopy(theme.design_groups),
        "image": theme.image.name if theme.image else None,
        "site_icon": theme.site_icon.name if theme.site_icon else None,
    }


def designer_snapshot_asset_paths(snapshot, theme_id):
    """Return immutable Designer draft object keys referenced by a snapshot."""
    prefix = f"theme_images/{theme_id}/designer_drafts/"
    paths = set()

    def collect(value):
        if isinstance(value, dict):
            for child in value.values():
                collect(child)
        elif isinstance(value, list):
            for child in value:
                collect(child)
        elif isinstance(value, str) and prefix in value:
            path = value[value.index(prefix) :].split("?", 1)[0].split("#", 1)[0]
            paths.add(path)

    collect(snapshot)
    return paths


def delete_unreferenced_designer_assets(theme_id, candidate_paths):
    """Delete immutable draft objects only after every persisted reference is gone."""
    prefix = f"theme_images/{theme_id}/designer_drafts/"
    candidates = {path for path in candidate_paths if path and path.startswith(prefix)}
    if not candidates:
        return 0

    referenced = set()
    theme = PageTheme.objects.filter(id=theme_id).first()
    if theme:
        referenced.update(designer_snapshot_asset_paths(theme_designer_snapshot(theme), theme_id))
    for snapshot in ThemeDesignerDraft.objects.filter(theme_id=theme_id).values_list("snapshot", flat=True):
        referenced.update(designer_snapshot_asset_paths(snapshot, theme_id))
    for snapshot in ThemeDesignerRevision.objects.filter(theme_id=theme_id).values_list("snapshot", flat=True):
        referenced.update(designer_snapshot_asset_paths(snapshot, theme_id))
    for snapshot in ThemeDesignerExportJob.objects.filter(theme_id=theme_id).values_list("snapshot", flat=True):
        referenced.update(designer_snapshot_asset_paths(snapshot, theme_id))

    deleted = 0
    for path in candidates - referenced:
        try:
            if system_storage.exists(path):
                system_storage.delete(path)
                deleted += 1
        except Exception:
            logger.exception("Could not remove unreferenced Designer asset %s", path)
    return deleted


def _cleanup_designer_assets_after_commit(theme_id, snapshots):
    candidates = set()
    for snapshot in snapshots:
        candidates.update(designer_snapshot_asset_paths(snapshot, theme_id))
    if candidates:
        transaction.on_commit(lambda: delete_unreferenced_designer_assets(theme_id, candidates))


def apply_designer_snapshot(theme, snapshot):
    theme.colors = copy.deepcopy(snapshot.get("colors", {}))
    theme.fonts = copy.deepcopy(snapshot.get("fonts", {}))
    theme.design_groups = copy.deepcopy(snapshot.get("design_groups", {}))
    theme.image.name = snapshot.get("image") or ""
    theme.site_icon.name = snapshot.get("site_icon") or ""
    return theme


def theme_from_designer_draft(theme, draft):
    draft_theme = copy.deepcopy(theme)
    return apply_designer_snapshot(draft_theme, draft.snapshot)


def get_or_create_designer_draft(theme, user):
    draft, _ = ThemeDesignerDraft.objects.get_or_create(
        theme=theme,
        defaults={
            "created_by": user,
            "updated_by": user,
            "base_sync_version": theme.sync_version,
            "snapshot": theme_designer_snapshot(theme),
        },
    )
    return draft


def build_draft_workspace(theme, draft):
    workspace = build_workspace(theme_from_designer_draft(theme, draft))
    workspace.update(
        {
            "liveSyncVersion": theme.sync_version,
            "draftVersion": draft.version,
            "hasDraftChanges": draft.has_changes,
            "draftUpdatedAt": draft.updated_at,
            "draftUpdatedBy": draft.updated_by.username,
            "draftIsStale": draft.base_sync_version != theme.sync_version,
        }
    )
    return workspace


def _iter_layout_properties(group):
    for key in ("layoutProperties", "layout_properties"):
        layout = group.get(key)
        if not isinstance(layout, dict):
            continue
        for part, breakpoints in layout.items():
            if not isinstance(breakpoints, dict):
                continue
            for breakpoint, values in breakpoints.items():
                if isinstance(values, dict):
                    yield part, breakpoint, values


def _image_url(value):
    if not isinstance(value, dict):
        return None
    for key in ("url", "fileUrl", "file_url", "publicUrl", "public_url", "imgproxyBaseUrl", "imgproxy_base_url"):
        if value.get(key):
            return value[key]
    return None


def _asset_spec(value):
    value = value if isinstance(value, dict) else {}
    return {
        "displayName": value.get("displayName") or value.get("display_name") or value.get("filename"),
        "requiredWidth": value.get("requiredWidth") or value.get("required_width"),
        "requiredHeight": value.get("requiredHeight") or value.get("required_height"),
        "dpr": value.get("dpr", 2),
        "isPlaceholder": bool(value.get("isPlaceholder") or value.get("is_placeholder")),
    }


def _walk_usage(value, needle, path=""):
    usages = []
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}" if path else str(key)
            usages.extend(_walk_usage(child, needle, child_path))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            usages.extend(_walk_usage(child, needle, f"{path}[{index}]"))
    elif isinstance(value, str) and needle and str(needle) in value:
        usages.append(path)
    return usages


def _field_dimensions(field):
    try:
        return field.width, field.height
    except Exception:
        return None, None


def _stored_asset_metadata(path):
    try:
        size = system_storage.size(path)
        with system_storage.open(path, "rb") as source:
            image = Image.open(source)
            return image.width, image.height, size
    except Exception:
        try:
            return None, None, system_storage.size(path)
        except Exception:
            return None, None, None


def collect_designer_assets(theme: PageTheme):
    assets = []
    referenced_filenames = set()

    if theme.image:
        width, height = _field_dimensions(theme.image)
        assets.append(
            {
                "assetKey": "preview",
                "displayName": "Theme preview",
                "filename": os.path.basename(theme.image.name),
                "url": theme.image.url,
                "usage": ["Theme listing preview"],
                "kind": "preview",
                "replaceable": True,
                "isPlaceholder": False,
                "width": width,
                "height": height,
            }
        )
    if theme.site_icon:
        width, height = _field_dimensions(theme.site_icon)
        assets.append(
            {
                "assetKey": "site-icon",
                "displayName": "Site icon",
                "filename": os.path.basename(theme.site_icon.name),
                "url": theme.site_icon.url,
                "usage": ["Browser and application icon"],
                "kind": "site-icon",
                "replaceable": True,
                "isPlaceholder": False,
                "width": width,
                "height": height,
            }
        )

    groups = (theme.design_groups or {}).get("groups", [])
    breakpoints = theme.get_breakpoints()
    for group_index, group in enumerate(groups):
        group_name = group.get("name") or f"Group {group_index + 1}"
        for part, breakpoint, values in _iter_layout_properties(group):
            candidates = []
            for property_name, value in values.items():
                if property_name == "images" and isinstance(value, dict):
                    candidates.extend(value.items())
                elif isinstance(value, dict) and (
                    _image_url(value) or value.get("isPlaceholder") or value.get("requiredWidth")
                ):
                    candidates.append((property_name, value))
            for property_name, value in candidates:
                if not isinstance(value, dict):
                    continue
                spec = _asset_spec(value)
                inferred_width = None
                if not spec["requiredWidth"] and breakpoint in breakpoints:
                    inferred_width = int(breakpoints[breakpoint]) * int(spec["dpr"] or 2)
                filename = value.get("filename") or os.path.basename(str(_image_url(value) or ""))
                if filename:
                    referenced_filenames.add(filename)
                assets.append(
                    {
                        "assetKey": f"design:{group_index}:{part}:{breakpoint}:{property_name}",
                        "displayName": spec["displayName"] or f"{group_name} {property_name}",
                        "filename": filename,
                        "url": _image_url(value),
                        "width": value.get("width"),
                        "height": value.get("height"),
                        "requiredWidth": spec["requiredWidth"],
                        "requiredHeight": spec["requiredHeight"],
                        "recommendedWidth": inferred_width,
                        "requirementSource": (
                            "explicit" if spec["requiredWidth"] or spec["requiredHeight"] else "inferred"
                        ),
                        "dpr": spec["dpr"],
                        "isPlaceholder": spec["isPlaceholder"],
                        "usage": [f"{group_name} / {part} / {breakpoint} / {property_name}"],
                        "kind": "design-group",
                        "replaceable": True,
                        "groupIndex": group_index,
                        "part": part,
                        "breakpoint": breakpoint,
                        "property": property_name,
                        "validation": {
                            "status": (
                                "error"
                                if (
                                    spec["requiredWidth"]
                                    and value.get("width")
                                    and int(value["width"]) < int(spec["requiredWidth"])
                                )
                                or (
                                    spec["requiredHeight"]
                                    and value.get("height")
                                    and int(value["height"]) < int(spec["requiredHeight"])
                                )
                                else (
                                    "warning"
                                    if inferred_width and value.get("width") and int(value["width"]) < inferred_width
                                    else "ok"
                                )
                            ),
                            "message": (
                                "Uploaded image is smaller than the explicit requirement."
                                if (
                                    spec["requiredWidth"]
                                    and value.get("width")
                                    and int(value["width"]) < int(spec["requiredWidth"])
                                )
                                or (
                                    spec["requiredHeight"]
                                    and value.get("height")
                                    and int(value["height"]) < int(spec["requiredHeight"])
                                )
                                else (
                                    f"Recommended width is {inferred_width}px; height is not specified."
                                    if inferred_width
                                    else "No explicit dimensions are configured."
                                )
                            ),
                        },
                    }
                )

    for filename in sorted(theme.list_library_images()):
        if filename in referenced_filenames:
            continue
        path = f"theme_images/{theme.id}/library/{filename}"
        width, height, size = _stored_asset_metadata(path)
        assets.append(
            {
                "assetKey": f"library:{filename}",
                "displayName": filename,
                "filename": filename,
                "url": system_storage.url(path),
                "usage": ["Unused theme library asset"],
                "kind": "library",
                "replaceable": False,
                "isPlaceholder": False,
                "width": width,
                "height": height,
                "size": size,
            }
        )
    return assets


def build_workspace(theme: PageTheme):
    groups = (theme.design_groups or {}).get("groups", [])
    typography = []
    spacing = []
    for group_index, group in enumerate(groups):
        group_name = group.get("name") or f"Group {group_index + 1}"
        for element, values in (group.get("elements") or {}).items():
            if not isinstance(values, dict):
                continue
            typography.append(
                {
                    "targetId": f"group:{group_index}:element:{element}",
                    "groupIndex": group_index,
                    "groupName": group_name,
                    "element": element,
                    "values": {key: _theme_property_value(values, key) for key in TYPE_PROPERTIES},
                }
            )
            spacing.append(
                {
                    "targetId": f"group:{group_index}:element:{element}",
                    "scope": "element",
                    "groupIndex": group_index,
                    "groupName": group_name,
                    "element": element,
                    "values": {key: _theme_property_value(values, key) for key in SPACING_PROPERTIES},
                }
            )
        for part, breakpoint, values in _iter_layout_properties(group):
            spacing.append(
                {
                    "targetId": f"group:{group_index}:part:{part}",
                    "scope": "layout",
                    "groupIndex": group_index,
                    "groupName": group_name,
                    "part": part,
                    "breakpoint": breakpoint,
                    "values": {key: _theme_property_value(values, key) for key in SPACING_PROPERTIES},
                }
            )

    colors = []
    for name, value in (theme.colors or {}).items():
        colors.append(
            {
                "name": name,
                "value": value,
                "usage": _walk_usage(theme.design_groups or {}, name),
            }
        )

    font_data = copy.deepcopy(theme.fonts or {})
    fonts = font_data.get("google_fonts") or font_data.get("googleFonts") or []
    for font in fonts:
        font["usage"] = _walk_usage(theme.design_groups or {}, font.get("family"))

    assets = collect_designer_assets(theme)
    return {
        "id": theme.id,
        "name": theme.name,
        "syncVersion": theme.sync_version,
        "colors": colors,
        "fonts": fonts,
        "typography": typography,
        "spacing": spacing,
        "assets": assets,
        "catalog": build_designer_catalog(theme, assets),
        "canUndo": theme.designer_revisions.exists(),
        "constraints": {
            "editableTypographyProperties": sorted(TYPE_PROPERTIES),
            "editableSpacingProperties": sorted(SPACING_PROPERTIES),
            "maxImageBytes": MAX_IMAGE_BYTES,
        },
    }


def create_revision(theme, user, summary):
    revision = ThemeDesignerRevision.objects.create(
        theme=theme,
        created_by=user,
        summary=summary,
        snapshot={
            "colors": copy.deepcopy(theme.colors),
            "fonts": copy.deepcopy(theme.fonts),
            "design_groups": copy.deepcopy(theme.design_groups),
            "image": theme.image.name if theme.image else None,
            "site_icon": theme.site_icon.name if theme.site_icon else None,
        },
    )
    old_ids = list(theme.designer_revisions.values_list("id", flat=True)[REVISION_LIMIT:])
    if old_ids:
        old_snapshots = list(ThemeDesignerRevision.objects.filter(id__in=old_ids).values_list("snapshot", flat=True))
        ThemeDesignerRevision.objects.filter(id__in=old_ids).delete()
        _cleanup_designer_assets_after_commit(theme.id, old_snapshots)
    return revision


def _safe_css_value(value, property_name):
    value = str(value).strip()
    if len(value) > 160 or CSS_VALUE_FORBIDDEN.search(value):
        raise ValidationError(f"Unsafe {property_name} value.")
    if not re.fullmatch(r"[\w\s.,%+\-'\"()/]+", value, re.UNICODE):
        raise ValidationError(f"Unsupported {property_name} value.")
    return value


def _integer(value, field_name):
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"{field_name} must be an integer.") from exc


def apply_designer_patch(theme: PageTheme, payload: dict, *, validate_version=True):
    if not isinstance(payload, dict):
        raise ValidationError("Designer patch must be an object.")
    allowed_top = {"sync_version", "colors", "fonts", "typography", "spacing"}
    unknown = set(payload) - allowed_top
    if unknown:
        raise ValidationError(f"Unsupported designer fields: {', '.join(sorted(unknown))}")
    if validate_version and _integer(payload.get("sync_version", -1), "syncVersion") != theme.sync_version:
        raise ValueError("stale")

    if "colors" in payload:
        colors = payload["colors"]
        if not isinstance(colors, dict):
            raise ValidationError("Colors must be an object.")
        if len(colors) > 200:
            raise ValidationError("The palette contains too many colors.")
        colors = {str(name): str(value).strip() for name, value in colors.items()}
        if set(colors) != set(theme.colors or {}):
            raise ValidationError(
                "Designer access can change existing color values but cannot add, remove, or rename colors."
            )
        if any(not name or len(name) > 100 or not COLOR_VALUE.fullmatch(value) for name, value in colors.items()):
            raise ValidationError(
                "Designer colors must be CSS color values such as #123456, rgb(), hsl(), or a named color."
            )
        serializer = PageThemeSerializer(theme, data={"colors": colors}, partial=True)
        serializer.is_valid(raise_exception=True)
        theme.colors = colors

    if "fonts" in payload:
        fonts = payload["fonts"]
        if not isinstance(fonts, list):
            raise ValidationError("Fonts must be a list.")
        if len(fonts) > 30 or any(not isinstance(font, dict) for font in fonts):
            raise ValidationError("Fonts must contain at most 30 font definitions.")
        if any(not isinstance(font.get("variants", ["400"]), list) for font in fonts):
            raise ValidationError("Font variants must be a list.")
        font_payload = {
            "google_fonts": [
                {
                    "family": str(font.get("family", "")).strip(),
                    "variants": list(font.get("variants") or ["400"]),
                    "display": font.get("display", "swap"),
                }
                for font in fonts
            ]
        }
        if any(not font["family"] for font in font_payload["google_fonts"]):
            raise ValidationError("Every font needs a family name.")
        for font in font_payload["google_fonts"]:
            if not re.fullmatch(r"[\w .&+\-]{1,100}", font["family"], re.UNICODE):
                raise ValidationError("Font family names contain unsupported characters.")
            if len(font["variants"]) > 20 or any(
                not re.fullmatch(r"(?:[1-9]00)(?:italic)?|italic|regular", str(variant)) for variant in font["variants"]
            ):
                raise ValidationError("Font variants must use Google Fonts values such as 400, 700, or 400italic.")
            if font["display"] not in {"auto", "block", "swap", "fallback", "optional"}:
                raise ValidationError("Unsupported font display strategy.")
        serializer = PageThemeSerializer(theme, data={"fonts": font_payload}, partial=True)
        serializer.is_valid(raise_exception=True)
        theme.fonts = font_payload

    design_groups = copy.deepcopy(theme.design_groups or {"groups": []})
    groups = design_groups.get("groups", [])
    typography = payload.get("typography", [])
    spacing = payload.get("spacing", [])
    if not isinstance(typography, list) or not isinstance(spacing, list):
        raise ValidationError("Typography and spacing must be lists.")
    for item in typography:
        if not isinstance(item, dict):
            raise ValidationError("Typography entries must be objects.")
        group_index = _integer(item.get("group_index", -1), "groupIndex")
        element = item.get("element")
        if group_index < 0 or group_index >= len(groups) or element not in (groups[group_index].get("elements") or {}):
            raise ValidationError("Typography target no longer exists.")
        target = groups[group_index]["elements"][element]
        incoming = item.get("values", {})
        if not isinstance(incoming, dict):
            raise ValidationError("Typography values must be an object.")
        unknown = set(incoming) - TYPE_PROPERTIES
        if unknown:
            raise ValidationError(f"Unsupported typography properties: {', '.join(sorted(unknown))}")
        for key in TYPE_PROPERTIES:
            if key in incoming:
                value = incoming[key]
                _set_theme_property(target, key, None if value in (None, "") else _safe_css_value(value, key))

    for item in spacing:
        if not isinstance(item, dict):
            raise ValidationError("Spacing entries must be objects.")
        group_index = _integer(item.get("group_index", -1), "groupIndex")
        if group_index < 0 or group_index >= len(groups):
            raise ValidationError("Spacing target no longer exists.")
        if item.get("scope") == "element":
            target = (groups[group_index].get("elements") or {}).get(item.get("element"))
        elif item.get("scope") == "layout":
            target = None
            for part, breakpoint, values in _iter_layout_properties(groups[group_index]):
                if part == item.get("part") and breakpoint == item.get("breakpoint"):
                    target = values
                    break
        else:
            raise ValidationError("Unsupported spacing scope.")
        if target is None:
            raise ValidationError("Spacing target no longer exists.")
        incoming = item.get("values", {})
        if not isinstance(incoming, dict):
            raise ValidationError("Spacing values must be an object.")
        unknown = set(incoming) - SPACING_PROPERTIES
        if unknown:
            raise ValidationError(f"Unsupported spacing properties: {', '.join(sorted(unknown))}")
        for key in SPACING_PROPERTIES:
            if key in incoming:
                value = incoming[key]
                _set_theme_property(target, key, None if value in (None, "") else _safe_css_value(value, key))
    theme.design_groups = design_groups
    return theme


def save_designer_draft(theme_id, tenant, user, payload):
    with transaction.atomic():
        theme = PageTheme.objects.select_for_update().get(id=theme_id, tenant=tenant)
        if not user_can_design_theme(user, theme):
            raise PermissionError
        draft = get_or_create_designer_draft(theme, user)
        draft = ThemeDesignerDraft.objects.select_for_update().get(pk=draft.pk)
        if draft.base_sync_version != theme.sync_version:
            raise DesignerDraftConflict("The live theme changed after this draft was started.")
        if _integer(payload.get("draft_version", -1), "draftVersion") != draft.version:
            raise DesignerDraftConflict("The Designer draft changed after you opened it.")
        patch = {key: value for key, value in payload.items() if key != "draft_version"}
        draft_theme = theme_from_designer_draft(theme, draft)
        apply_designer_patch(draft_theme, patch, validate_version=False)
        draft.snapshot = theme_designer_snapshot(draft_theme)
        draft.version += 1
        draft.has_changes = True
        draft.updated_by = user
        draft.save(update_fields=["snapshot", "version", "has_changes", "updated_by", "updated_at"])
        return theme, draft


def publish_designer_draft(theme_id, tenant, user, draft_version):
    with transaction.atomic():
        theme = PageTheme.objects.select_for_update().get(id=theme_id, tenant=tenant)
        if not user_can_design_theme(user, theme):
            raise PermissionError
        draft = ThemeDesignerDraft.objects.select_for_update().filter(theme=theme).first()
        if not draft:
            raise DesignerDraftConflict("There is no Designer draft to publish.")
        if draft.version != _integer(draft_version, "draftVersion"):
            raise DesignerDraftConflict("The Designer draft changed after you opened it.")
        if draft.base_sync_version != theme.sync_version:
            raise DesignerDraftConflict("The live theme changed after this draft was started.")
        if not draft.has_changes:
            raise DesignerDraftConflict("There are no draft changes to publish.")

        create_revision(theme, user, "Publish Designer draft")
        apply_designer_snapshot(theme, draft.snapshot)
        theme.sync_source = "web"
        theme.save(
            update_fields=[
                "colors",
                "fonts",
                "design_groups",
                "image",
                "site_icon",
                "sync_source",
                "sync_version",
                "updated_at",
            ]
        )
        draft.snapshot = theme_designer_snapshot(theme)
        draft.base_sync_version = theme.sync_version
        draft.version += 1
        draft.has_changes = False
        draft.updated_by = user
        draft.save(
            update_fields=[
                "snapshot",
                "base_sync_version",
                "version",
                "has_changes",
                "updated_by",
                "updated_at",
            ]
        )
        return theme, draft


def undo_designer_publish(theme_id, tenant, user, draft_version, live_sync_version):
    """Restore the latest pre-publish snapshot without overwriting draft work."""
    with transaction.atomic():
        theme = PageTheme.objects.select_for_update().get(id=theme_id, tenant=tenant)
        if not user_can_design_theme(user, theme):
            raise PermissionError
        draft = ThemeDesignerDraft.objects.select_for_update().filter(theme=theme).first()
        if not draft:
            raise DesignerDraftConflict("There is no Designer draft to restore.")
        if draft.version != _integer(draft_version, "draftVersion"):
            raise DesignerDraftConflict("The Designer draft changed after you opened it.")
        if theme.sync_version != _integer(live_sync_version, "liveSyncVersion"):
            raise DesignerDraftConflict("The live theme changed after you opened it.")
        if draft.base_sync_version != theme.sync_version:
            raise DesignerDraftConflict("The live theme changed after this draft was started.")
        if draft.has_changes:
            raise DesignerDraftConflict("Publish or discard the saved draft before restoring a revision.")

        revision = ThemeDesignerRevision.objects.select_for_update().filter(theme=theme).first()
        if not revision:
            raise DesignerDraftConflict("There is no Designer revision to restore.")

        replaced_snapshot = theme_designer_snapshot(theme)
        apply_designer_snapshot(theme, revision.snapshot)
        theme.sync_source = "web"
        theme.save(
            update_fields=[
                "colors",
                "fonts",
                "design_groups",
                "image",
                "site_icon",
                "sync_source",
                "sync_version",
                "updated_at",
            ]
        )
        revision.delete()
        draft.snapshot = theme_designer_snapshot(theme)
        draft.base_sync_version = theme.sync_version
        draft.version += 1
        draft.has_changes = False
        draft.updated_by = user
        draft.save(
            update_fields=[
                "snapshot",
                "base_sync_version",
                "version",
                "has_changes",
                "updated_by",
                "updated_at",
            ]
        )
        _cleanup_designer_assets_after_commit(theme.id, [replaced_snapshot])
        return theme, draft


def discard_designer_draft(theme_id, tenant, user, draft_version):
    with transaction.atomic():
        theme = PageTheme.objects.select_for_update().get(id=theme_id, tenant=tenant)
        if not user_can_design_theme(user, theme):
            raise PermissionError
        draft = get_or_create_designer_draft(theme, user)
        draft = ThemeDesignerDraft.objects.select_for_update().get(pk=draft.pk)
        if draft.version != _integer(draft_version, "draftVersion"):
            raise DesignerDraftConflict("The Designer draft changed after you opened it.")
        discarded_snapshot = draft.snapshot
        draft.snapshot = theme_designer_snapshot(theme)
        draft.base_sync_version = theme.sync_version
        draft.version += 1
        draft.has_changes = False
        draft.updated_by = user
        draft.save(
            update_fields=[
                "snapshot",
                "base_sync_version",
                "version",
                "has_changes",
                "updated_by",
                "updated_at",
            ]
        )
        _cleanup_designer_assets_after_commit(theme.id, [discarded_snapshot])
        return theme, draft


def validate_image_upload(upload):
    if upload.size > MAX_IMAGE_BYTES:
        raise ValidationError("Image exceeds the 10 MB limit.")
    content_type = upload.content_type or ""
    if content_type not in IMAGE_TYPES:
        raise ValidationError("Use a PNG, JPEG, GIF, WebP, or SVG image.")
    content = upload.read()
    upload.seek(0)
    if content_type == "image/svg+xml":
        text = content.decode("utf-8", errors="ignore").lower()
        forbidden = ("<!doctype", "<!entity", "<script", "javascript:", "@import", "expression(")
        if "<svg" not in text[:1000] or any(marker in text for marker in forbidden):
            raise ValidationError("Unsafe SVG content was rejected.")
        try:
            root = ET.fromstring(content)
        except ET.ParseError as exc:
            raise ValidationError("The uploaded SVG is not valid XML.") from exc
        if root.tag.rsplit("}", 1)[-1].lower() != "svg":
            raise ValidationError("The uploaded file is not an SVG image.")
        blocked_tags = {"script", "style", "foreignobject", "iframe", "object", "embed"}
        for element in root.iter():
            if element.tag.rsplit("}", 1)[-1].lower() in blocked_tags:
                raise ValidationError("Unsafe SVG content was rejected.")
            for raw_name, raw_value in element.attrib.items():
                name = raw_name.rsplit("}", 1)[-1].lower()
                value = str(raw_value).strip().lower()
                safe_embedded_image = value.startswith(
                    ("data:image/png", "data:image/jpeg", "data:image/gif", "data:image/webp")
                )
                if name.startswith("on") or (
                    name in {"href", "xlink:href"} and value and not (value.startswith("#") or safe_embedded_image)
                ):
                    raise ValidationError("Unsafe SVG content was rejected.")
                if name == "style" and CSS_VALUE_FORBIDDEN.search(value):
                    raise ValidationError("Unsafe SVG content was rejected.")
        opening_tag = text[text.find("<svg") : text.find(">", text.find("<svg")) + 1]
        width_match = re.search(r"\bwidth=[\"']?(\d+(?:\.\d+)?)", opening_tag)
        height_match = re.search(r"\bheight=[\"']?(\d+(?:\.\d+)?)", opening_tag)
        if width_match and height_match:
            return content, (int(float(width_match.group(1))), int(float(height_match.group(1))))
        view_box = re.search(r"\bviewbox=[\"']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)", opening_tag)
        return content, (int(float(view_box.group(1))), int(float(view_box.group(2)))) if view_box else (None, None)
    try:
        image = Image.open(io.BytesIO(content))
        if image.width * image.height > MAX_IMAGE_PIXELS:
            raise ValidationError("Images cannot exceed 16 megapixels.")
        detected_type = Image.MIME.get(image.format)
        if detected_type != content_type and {detected_type, content_type} != {"image/jpeg", "image/jpg"}:
            raise ValidationError("The uploaded content does not match its declared image type.")
        image.verify()
        return content, image.size
    except ValidationError:
        raise
    except Exception as exc:
        raise ValidationError("The uploaded file is not a valid image.") from exc


def _find_asset(theme, asset_key):
    return next((asset for asset in collect_designer_assets(theme) if asset["assetKey"] == asset_key), None)


def _replace_shared_image_references(value, old_url, old_filename, replacement):
    if isinstance(value, dict):
        current_url = _image_url(value)
        current_filename = value.get("filename")
        same_source = current_url == old_url if old_url else bool(old_filename and current_filename == old_filename)
        if same_source:
            value.update(replacement)
            value.pop("fileUrl", None)
            value.pop("file_url", None)
        for child in value.values():
            _replace_shared_image_references(child, old_url, old_filename, replacement)
    elif isinstance(value, list):
        for child in value:
            _replace_shared_image_references(child, old_url, old_filename, replacement)


def replace_designer_asset(theme_id, tenant, user, asset_key, upload, draft_version, placeholder_metadata=None):
    content, (width, height) = validate_image_upload(upload)
    saved_path = None
    try:
        with transaction.atomic():
            theme = PageTheme.objects.select_for_update().get(id=theme_id, tenant=tenant)
            if not user_can_design_theme(user, theme):
                raise PermissionError
            draft = get_or_create_designer_draft(theme, user)
            draft = ThemeDesignerDraft.objects.select_for_update().get(pk=draft.pk)
            if draft.base_sync_version != theme.sync_version:
                raise DesignerDraftConflict("The live theme changed after this draft was started.")
            if draft.version != _integer(draft_version, "draftVersion"):
                raise DesignerDraftConflict("The Designer draft changed after you opened it.")

            draft_theme = theme_from_designer_draft(theme, draft)
            previous_snapshot = draft.snapshot
            asset = _find_asset(draft_theme, asset_key)
            if not asset:
                raise ValidationError("Asset slot was not found.")
            if asset_key.startswith("library:"):
                raise ValidationError("Unused library assets cannot be replaced from the Designer draft.")
            required_width = asset.get("requiredWidth")
            required_height = asset.get("requiredHeight")
            if width and required_width and width < int(required_width):
                raise ValidationError(f"Image must be at least {required_width}px wide.")
            if height and required_height and height < int(required_height):
                raise ValidationError(f"Image must be at least {required_height}px high.")
            extension = {
                "image/jpeg": ".jpg",
                "image/png": ".png",
                "image/gif": ".gif",
                "image/webp": ".webp",
                "image/svg+xml": ".svg",
            }[upload.content_type]
            safe_name = slugify(os.path.splitext(asset.get("displayName") or upload.name)[0]) or "asset"
            filename = f"{safe_name}-{uuid.uuid4().hex[:10]}{extension}"
            path = f"theme_images/{theme.id}/designer_drafts/{draft.id}/{filename}"
            saved_path = system_storage.save(path, ContentFile(content))

            if asset_key == "preview":
                draft_theme.image.name = saved_path
            elif asset_key == "site-icon":
                draft_theme.site_icon.name = saved_path
            else:
                url = system_storage.url(saved_path)
                if asset_key.startswith("design:"):
                    _, group_index, part, breakpoint, property_name = asset_key.split(":", 4)
                    groups = copy.deepcopy((draft_theme.design_groups or {}).get("groups", []))
                    target = None
                    for candidate_part, candidate_breakpoint, values in _iter_layout_properties(
                        groups[int(group_index)]
                    ):
                        if candidate_part == part and candidate_breakpoint == breakpoint:
                            target = values.get(property_name)
                            if target is None and isinstance(values.get("images"), dict):
                                target = values["images"].get(property_name)
                            break
                    if not isinstance(target, dict):
                        raise ValidationError("Asset slot was not found.")
                    replacement = {
                        "url": url,
                        "filename": filename,
                        "size": len(content),
                        "width": width,
                        "height": height,
                        "isPlaceholder": bool(placeholder_metadata),
                    }
                    if placeholder_metadata:
                        replacement.update(placeholder_metadata)
                    _replace_shared_image_references(
                        groups,
                        _image_url(target),
                        target.get("filename"),
                        replacement,
                    )
                    target.update(replacement)
                    draft_theme.design_groups = {**(draft_theme.design_groups or {}), "groups": groups}

            draft.snapshot = theme_designer_snapshot(draft_theme)
            draft.version += 1
            draft.has_changes = True
            draft.updated_by = user
            draft.save(update_fields=["snapshot", "version", "has_changes", "updated_by", "updated_at"])
            _cleanup_designer_assets_after_commit(theme.id, [previous_snapshot])
            return theme, draft
    except Exception:
        if saved_path:
            try:
                if system_storage.exists(saved_path):
                    system_storage.delete(saved_path)
            except Exception:
                logger.exception("Could not remove rolled-back Designer asset %s", saved_path)
        raise


def generate_placeholder_png(display_name, usage, width, height):
    width = int(width)
    height = int(height)
    if width < 16 or height < 16 or width > 8000 or height > 8000 or width * height > MAX_IMAGE_PIXELS:
        raise ValidationError("Placeholder dimensions must be between 16px and 8000px and at most 16 megapixels.")
    image = Image.new("RGB", (width, height), "#e5e7eb")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=max(12, min(width, height) // 18))
    lines = [display_name, usage, f"{width} x {height} px"]
    y = height // 2 - (len(lines) * (font.size + 8)) // 2
    for line in lines:
        box = draw.textbbox((0, 0), line, font=font)
        draw.text(((width - (box[2] - box[0])) // 2, y), line, fill="#111827", font=font)
        y += font.size + 8
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()
