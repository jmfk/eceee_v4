import copy

from django.db import migrations


NODE_LABELS = {
    "main-layout-container": ("Viewport background", {"", "Root", "Container", "container"}),
    "landing-page-container": ("Viewport background", {"", "Root", "Container", "container"}),
    "main-layout-wrapper": ("Page surface", {"", "Wrapper", "Container", "container"}),
    "landing-page-wrapper": ("Page surface", {"", "Wrapper", "Container", "container"}),
    "main-layout-grid": ("Content grid", {"", "Grid", "grid"}),
    "main-layout-main": ("Main content", {"", "Main", "Semantic", "semantic"}),
    "landing-page-main": ("Main content", {"", "Main", "Semantic", "semantic"}),
    "main-layout-aside": ("Sidebar", {"", "Aside", "Semantic", "semantic"}),
    "main-layout-footer": ("Footer wrapper", {"", "Footer", "Semantic", "semantic"}),
    "landing-page-footer": ("Footer wrapper", {"", "Footer", "Semantic", "semantic"}),
    "error-layout-container": ("Error page", {"", "Root", "Main", "Semantic", "semantic"}),
}
FOOTER_CLASSES = {"main-layout-footer", "landing-page-footer"}


def normalize_node(node):
    if not isinstance(node, dict):
        return False
    changed = False
    classes = set(node.get("class_names") or [])
    for class_name, (label, replaceable_labels) in NODE_LABELS.items():
        if class_name in classes and str(node.get("label") or "") in replaceable_labels:
            node["label"] = label
            changed = True
            break
    if classes & FOOTER_CLASSES and node.get("type") == "semantic" and node.get("tag", "div") == "footer":
        node["type"] = "container"
        node.pop("tag", None)
        changed = True
    for child in node.get("children") or []:
        changed = normalize_node(child) or changed
    return changed


def normalize_document(document):
    if not isinstance(document, dict):
        return document, False
    result = copy.deepcopy(document)
    changed = False
    for layout in result.get("items") or []:
        if isinstance(layout, dict):
            changed = normalize_node(layout.get("root")) or changed
    return result, changed


def clarify_layout_structure(apps, schema_editor):
    PageTheme = apps.get_model("webpages", "PageTheme")
    ThemeDesignerDraft = apps.get_model("webpages", "ThemeDesignerDraft")

    for theme in PageTheme.objects.all().iterator():
        layouts, changed = normalize_document(theme.layouts)
        if changed:
            PageTheme.objects.filter(pk=theme.pk).update(layouts=layouts)

    for draft in ThemeDesignerDraft.objects.all().iterator():
        snapshot = copy.deepcopy(draft.snapshot) if isinstance(draft.snapshot, dict) else {}
        layouts, changed = normalize_document(snapshot.get("layouts"))
        if changed:
            snapshot["layouts"] = layouts
            ThemeDesignerDraft.objects.filter(pk=draft.pk).update(snapshot=snapshot)


class Migration(migrations.Migration):
    dependencies = [("webpages", "0082_consolidate_error_layouts")]

    operations = [migrations.RunPython(clarify_layout_structure, migrations.RunPython.noop)]
