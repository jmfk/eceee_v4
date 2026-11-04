"""Move known legacy slot keys in live layouts, previews, and page versions."""

import copy
import re

from django.db import migrations


SLOT_KEYS = {
    "landing_page": "landingPage",
    "content_grid": "contentGrid",
    "secondary_sidebar": "secondarySidebar",
}
GENERATED_SLOT_KEY = re.compile(r"^slot_([0-9]+)$")


def canonical_slot_key(key):
    if not isinstance(key, str):
        return key
    match = GENERATED_SLOT_KEY.fullmatch(key)
    return SLOT_KEYS.get(key, f"slot{match.group(1)}" if match else key)


def rename_widgets(widgets, allowed_slots=None):
    if not isinstance(widgets, dict):
        return widgets
    result = copy.deepcopy(widgets)
    for old in list(result):
        new = canonical_slot_key(old)
        if old == new or (allowed_slots is not None and new not in allowed_slots):
            continue
        previous = result.pop(old)
        current = result.get(new, [])
        if not isinstance(previous, list) or not isinstance(current, list):
            raise RuntimeError(f"Widget slots {old} and {new} must contain lists before migration.")
        result[new] = [*previous, *current]
    return result


def rename_layouts(document):
    if not isinstance(document, dict):
        return document
    result = copy.deepcopy(document)
    items = result.get("items", [])
    for layout in items:
        if not isinstance(layout, dict) or not isinstance(layout.get("slots"), dict):
            continue
        slots = layout["slots"]
        for old in list(slots):
            new = canonical_slot_key(old)
            if old == new:
                continue
            if new in slots:
                raise RuntimeError(f"Layout {layout.get('key')} declares both {old} and {new}; reconcile before migration.")
            slots[new] = slots.pop(old)

        def visit(node):
            if not isinstance(node, dict):
                return
            old_key = node.get("slot_key")
            if isinstance(old_key, str) and canonical_slot_key(old_key) != old_key:
                node["slot_key"] = canonical_slot_key(old_key)
            for child in node.get("children", []):
                visit(child)

        visit(layout.get("root"))

    by_key = {
        item.get("key"): set(item["slots"])
        for item in items
        if isinstance(item, dict) and isinstance(item.get("slots"), dict)
    }
    for page in result.get("special_pages", []):
        if isinstance(page, dict) and isinstance(page.get("widgets"), dict):
            page["widgets"] = rename_widgets(page["widgets"], by_key.get(page.get("layout_key"), set()))
    return result


def rename_preview(preview, layouts):
    if not isinstance(preview, dict):
        return preview
    result = copy.deepcopy(preview)
    by_key = {
        item.get("key"): set(item["slots"])
        for item in layouts.get("items", [])
        if isinstance(item, dict) and isinstance(item.get("slots"), dict)
    } if isinstance(layouts, dict) else {}
    default_key = layouts.get("default_layout_key") if isinstance(layouts, dict) else None
    for view in result.get("views", []):
        if not isinstance(view, dict):
            continue
        content = view.get("content")
        if not isinstance(content, dict) or not isinstance(content.get("widgets"), dict):
            continue
        key = content.get("codeLayout") or view.get("layout") or default_key
        content["widgets"] = rename_widgets(content["widgets"], by_key.get(key, set()))
    return result


def rename_snapshot(snapshot):
    if not isinstance(snapshot, dict):
        return snapshot
    result = copy.deepcopy(snapshot)
    if "layouts" in result:
        result["layouts"] = rename_layouts(result["layouts"])
    if "designer_preview" in result:
        result["designer_preview"] = rename_preview(result["designer_preview"], result.get("layouts"))
    return result


def migrate_slot_keys(apps, schema_editor):
    db = schema_editor.connection.alias
    PageTheme = apps.get_model("webpages", "PageTheme")
    ThemeDesignerDraft = apps.get_model("webpages", "ThemeDesignerDraft")
    PageVersion = apps.get_model("webpages", "PageVersion")
    for theme in PageTheme.objects.using(db).only("id", "layouts", "designer_preview").iterator(chunk_size=500):
        layouts = rename_layouts(theme.layouts)
        preview = rename_preview(theme.designer_preview, layouts)
        if layouts != theme.layouts or preview != theme.designer_preview:
            PageTheme.objects.using(db).filter(pk=theme.pk).update(layouts=layouts, designer_preview=preview)

    for draft in ThemeDesignerDraft.objects.using(db).only("id", "snapshot").iterator(chunk_size=500):
        snapshot = rename_snapshot(draft.snapshot)
        if snapshot != draft.snapshot:
            ThemeDesignerDraft.objects.using(db).filter(pk=draft.pk).update(snapshot=snapshot)

    for version in PageVersion.objects.using(db).only("id", "widgets").iterator(chunk_size=500):
        widgets = rename_widgets(version.widgets)
        if widgets != version.widgets:
            PageVersion.objects.using(db).filter(pk=version.pk).update(widgets=widgets)


class Migration(migrations.Migration):
    dependencies = [("webpages", "0092_camel_case_layout_keys")]
    operations = [migrations.RunPython(migrate_slot_keys, migrations.RunPython.noop)]
