from django.db import migrations


LABELS = {
    "main_layout": ("Main layout", "Main"),
    "landing_page": ("Landing page", "Landing Page"),
}


def normalize_document(document):
    if not isinstance(document, dict):
        return document, False
    changed = False
    for layout in document.get("items", []):
        if not isinstance(layout, dict) or layout.get("key") not in LABELS:
            continue
        old_label, new_label = LABELS[layout["key"]]
        if layout.get("label") == old_label:
            layout["label"] = new_label
            changed = True
    return document, changed


def normalize_required_layout_labels(apps, schema_editor):
    PageTheme = apps.get_model("webpages", "PageTheme")
    ThemeDesignerDraft = apps.get_model("webpages", "ThemeDesignerDraft")

    for theme in PageTheme.objects.all().iterator():
        document, changed = normalize_document(theme.layouts)
        if changed:
            PageTheme.objects.filter(pk=theme.pk).update(layouts=document)

    for draft in ThemeDesignerDraft.objects.all().iterator():
        snapshot = draft.snapshot
        if not isinstance(snapshot, dict):
            continue
        layouts, changed = normalize_document(snapshot.get("layouts"))
        if changed:
            snapshot["layouts"] = layouts
            ThemeDesignerDraft.objects.filter(pk=draft.pk).update(snapshot=snapshot)


class Migration(migrations.Migration):
    dependencies = [("webpages", "0080_theme_owned_layouts")]

    operations = [migrations.RunPython(normalize_required_layout_labels, migrations.RunPython.noop)]
