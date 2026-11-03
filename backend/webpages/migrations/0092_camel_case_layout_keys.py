"""Rename persisted layout identifiers without changing layout or widget identities."""

import copy

from django.db import migrations


LAYOUT_KEYS = {"main_layout": "mainLayout", "landing_page": "landingPage", "error_layout": "errorLayout"}


def rename_preview(preview):
    if not isinstance(preview, dict):
        return preview
    result = copy.deepcopy(preview)
    for view in result.get("views", []):
        if not isinstance(view, dict):
            continue
        if "layout" in view:
            view["layout"] = LAYOUT_KEYS.get(view["layout"], view["layout"])
        content = view.get("content")
        if isinstance(content, dict) and "codeLayout" in content:
            content["codeLayout"] = LAYOUT_KEYS.get(content["codeLayout"], content["codeLayout"])
    return result


def rename_layouts(document):
    if not isinstance(document, dict):
        return document
    result = copy.deepcopy(document)
    items = result.get("items", [])
    keys = {item.get("key") for item in items if isinstance(item, dict)}
    for old, new in LAYOUT_KEYS.items():
        if old in keys and new in keys:
            raise RuntimeError(f"Both {old} and {new} exist in one theme; reconcile them before migrating.")
    for item in items:
        if not isinstance(item, dict):
            continue
        old = item.get("key")
        item["key"] = LAYOUT_KEYS.get(old, old)
        if item["key"] != "landingPage":
            continue
        slots = item.get("slots")
        if isinstance(slots, dict) and "landing_page" in slots:
            if "landingPage" in slots:
                raise RuntimeError("Both landing_page and landingPage slots exist in one layout.")
            slots["landingPage"] = slots.pop("landing_page")

        def rename_node(node):
            if not isinstance(node, dict):
                return
            if node.get("slot_key") == "landing_page":
                node["slot_key"] = "landingPage"
            for child in node.get("children", []):
                rename_node(child)

        rename_node(item.get("root"))
    if "default_layout_key" in result:
        result["default_layout_key"] = LAYOUT_KEYS.get(result["default_layout_key"], result["default_layout_key"])
    for page in result.get("special_pages", []):
        if isinstance(page, dict):
            if "layout_key" in page:
                page["layout_key"] = LAYOUT_KEYS.get(page["layout_key"], page["layout_key"])
            if page.get("layout_key") == "landingPage":
                page["widgets"] = rename_landing_widgets(page.get("widgets"))
    return result


def rename_landing_widgets(widgets):
    if not isinstance(widgets, dict) or "landing_page" not in widgets:
        return widgets
    result = copy.deepcopy(widgets)
    old = result.pop("landing_page")
    if not isinstance(old, list) or not isinstance(result.get("landingPage", []), list):
        raise RuntimeError("Landing page widgets must be lists before renaming their slot.")
    result["landingPage"] = [*old, *(result.get("landingPage") or [])]
    return result


def rename_snapshot(snapshot):
    if not isinstance(snapshot, dict):
        return snapshot
    result = copy.deepcopy(snapshot)
    if "layouts" in result:
        result["layouts"] = rename_layouts(result["layouts"])
    if "designer_preview" in result:
        result["designer_preview"] = rename_preview(result["designer_preview"])
    return result


def migrate_layout_keys(apps, schema_editor):
    db = schema_editor.connection.alias
    PageTheme = apps.get_model("webpages", "PageTheme")
    ThemeDesignerDraft = apps.get_model("webpages", "ThemeDesignerDraft")
    PageVersion = apps.get_model("webpages", "PageVersion")
    PageDataSchema = apps.get_model("webpages", "PageDataSchema")

    for theme in PageTheme.objects.using(db).only("id", "layouts", "designer_preview").iterator(chunk_size=500):
        layouts = rename_layouts(theme.layouts)
        preview = rename_preview(theme.designer_preview)
        if layouts != theme.layouts or preview != theme.designer_preview:
            PageTheme.objects.using(db).filter(pk=theme.pk).update(layouts=layouts, designer_preview=preview)
    for draft in ThemeDesignerDraft.objects.using(db).only("id", "snapshot").iterator(chunk_size=500):
        snapshot = rename_snapshot(draft.snapshot)
        if snapshot != draft.snapshot:
            ThemeDesignerDraft.objects.using(db).filter(pk=draft.pk).update(snapshot=snapshot)
    for version in (
        PageVersion.objects.using(db).only("id", "layout_key", "code_layout", "widgets").iterator(chunk_size=500)
    ):
        layout_key = LAYOUT_KEYS.get(version.layout_key, version.layout_key)
        code_layout = LAYOUT_KEYS.get(version.code_layout, version.code_layout)
        widgets = rename_landing_widgets(version.widgets) if layout_key == "landingPage" else version.widgets
        if (layout_key, code_layout, widgets) != (version.layout_key, version.code_layout, version.widgets):
            PageVersion.objects.using(db).filter(pk=version.pk).update(
                layout_key=layout_key, code_layout=code_layout, widgets=widgets
            )
    for schema in (
        PageDataSchema.objects.using(db)
        .filter(scope="layout")
        .only("id", "layout_key", "layout_name")
        .iterator(chunk_size=500)
    ):
        layout_key = LAYOUT_KEYS.get(schema.layout_key, schema.layout_key)
        layout_name = LAYOUT_KEYS.get(schema.layout_name, schema.layout_name)
        if (layout_key, layout_name) != (schema.layout_key, schema.layout_name):
            PageDataSchema.objects.using(db).filter(pk=schema.pk).update(layout_key=layout_key, layout_name=layout_name)


class Migration(migrations.Migration):
    dependencies = [("webpages", "0091_backfill_designer_image_series")]
    operations = [migrations.RunPython(migrate_layout_keys, migrations.RunPython.noop)]
