import copy

from django.db import migrations


def _walk(node):
    if not isinstance(node, dict):
        return
    yield node
    for child in node.get("children") or []:
        yield from _walk(child)


def transfer_document(document):
    if not isinstance(document, dict):
        return document, False
    result = copy.deepcopy(document)
    changed = False
    for layout in result.get("items") or []:
        if not isinstance(layout, dict) or layout.get("key") not in {"main_layout", "landing_page"}:
            continue
        for node in _walk(layout.get("root")):
            classes = set(node.get("class_names") or [])
            base = node.setdefault("styles", {}).setdefault("base", {})
            if "main-layout-main" in classes:
                for name, value in {"min_width": "0", "padding": "0"}.items():
                    if name not in base:
                        base[name] = value
                        changed = True
            if "slot-footer" in classes:
                for name, value in {
                    "min_height": "310px",
                    "display": "flex",
                    "flex_direction": "column",
                    "flex_grow": "1",
                }.items():
                    if name not in base:
                        base[name] = value
                        changed = True
            if classes.intersection({"slot-main", "slot-landing-page", "slot-landingPage"}):
                if base.get("height") == "310px":
                    del base["height"]
                    base.setdefault("min_height", "310px")
                    changed = True
    return result, changed


def transfer_legacy_layout_styles(apps, schema_editor):
    PageTheme = apps.get_model("webpages", "PageTheme")
    ThemeDesignerDraft = apps.get_model("webpages", "ThemeDesignerDraft")

    for theme in PageTheme.objects.all().iterator():
        layouts, changed = transfer_document(theme.layouts)
        if changed:
            PageTheme.objects.filter(pk=theme.pk).update(layouts=layouts)

    for draft in ThemeDesignerDraft.objects.all().iterator():
        snapshot = copy.deepcopy(draft.snapshot) if isinstance(draft.snapshot, dict) else {}
        layouts, changed = transfer_document(snapshot.get("layouts"))
        if changed:
            snapshot["layouts"] = layouts
            ThemeDesignerDraft.objects.filter(pk=draft.pk).update(snapshot=snapshot)


class Migration(migrations.Migration):
    dependencies = [("webpages", "0084_themeremoteconnection_credential_scheme")]

    operations = [migrations.RunPython(transfer_legacy_layout_styles, migrations.RunPython.noop)]
