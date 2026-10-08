import copy
import uuid

from django.db import migrations
from django.utils import timezone

import webpages.theme_layouts
from webpages.error_page_defaults import ERROR_PAGE_CONTENT, error_page_widgets


LEGACY_ERROR_LAYOUTS = {"error_403", "error_404", "error_500", "error_503"}


def normalize_layout_document(document):
    if not isinstance(document, dict):
        document = webpages.theme_layouts.default_theme_layouts()
    result = copy.deepcopy(document)
    items = [
        item
        for item in result.get("items", [])
        if isinstance(item, dict) and item.get("key") not in LEGACY_ERROR_LAYOUTS and item.get("key") != "error_layout"
    ]
    items.append(webpages.theme_layouts.error_theme_layout())
    result["items"] = items
    return result


def normalize_widgets(widgets):
    if not isinstance(widgets, dict):
        return widgets
    result = copy.deepcopy(widgets)
    mappings = {"branding": "visual", "error_message": "message", "helpful_content": "actions"}
    for old_key, new_key in mappings.items():
        values = result.pop(old_key, None)
        if values:
            result[new_key] = [*(result.get(new_key) or []), *values]
    return result


def consolidate_error_layouts(apps, schema_editor):
    PageTheme = apps.get_model("webpages", "PageTheme")
    ThemeDesignerDraft = apps.get_model("webpages", "ThemeDesignerDraft")
    PageVersion = apps.get_model("webpages", "PageVersion")
    PageDataSchema = apps.get_model("webpages", "PageDataSchema")
    WebPage = apps.get_model("webpages", "WebPage")

    for theme in PageTheme.objects.all().iterator():
        PageTheme.objects.filter(pk=theme.pk).update(layouts=normalize_layout_document(theme.layouts))
    for draft in ThemeDesignerDraft.objects.all().iterator():
        snapshot = copy.deepcopy(draft.snapshot) if isinstance(draft.snapshot, dict) else {}
        snapshot["layouts"] = normalize_layout_document(snapshot.get("layouts"))
        ThemeDesignerDraft.objects.filter(pk=draft.pk).update(snapshot=snapshot)

    for version in PageVersion.objects.filter(layout_key__in=LEGACY_ERROR_LAYOUTS).iterator():
        version.layout_key = "error_layout"
        version.code_layout = "error_layout"
        version.widgets = normalize_widgets(version.widgets)
        version.save(update_fields=["layout_key", "code_layout", "widgets"])
    PageVersion.objects.filter(layout_key="", code_layout__in=LEGACY_ERROR_LAYOUTS).update(
        layout_key="error_layout", code_layout="error_layout"
    )

    schemas = list(PageDataSchema.objects.filter(scope="layout", layout_key__in=LEGACY_ERROR_LAYOUTS).order_by("id"))
    keeper = PageDataSchema.objects.filter(scope="layout", layout_key="error_layout", is_active=True).first()
    for schema in schemas:
        if schema.is_active:
            if keeper is not None:
                schema.is_active = False
            else:
                keeper = schema
        schema.layout_key = "error_layout"
        schema.layout_name = "error_layout"
        schema.save(update_fields=["layout_key", "layout_name", "is_active"])

    now = timezone.now()
    for root in WebPage.objects.filter(parent__isnull=True, is_deleted=False).iterator():
        for index, (status_code, (title, explanation)) in enumerate(ERROR_PAGE_CONTENT.items()):
            page = WebPage.objects.filter(
                parent_id=root.id, tenant_id=root.tenant_id, slug=str(status_code), is_deleted=False
            ).first()
            if page is None:
                page = WebPage.objects.create(
                    stable_key=uuid.uuid4(),
                    parent_id=root.id,
                    tenant_id=root.tenant_id,
                    title=f"{status_code} — {title}",
                    description=explanation,
                    slug=str(status_code),
                    sort_order=9000 + index,
                    cached_path=f"{(root.cached_path or '/').rstrip('/')}/{status_code}/",
                    cached_root_id=root.id,
                    cached_root_hostnames=root.hostnames or [],
                    created_by_id=root.created_by_id,
                    last_modified_by_id=root.last_modified_by_id,
                )
            if not PageVersion.objects.filter(page_id=page.id).exists():
                version = PageVersion.objects.create(
                    page_id=page.id,
                    version_number=1,
                    version_title="Default error page",
                    change_summary={"summary": "Created with the site error-page defaults"},
                    meta_title=f"{status_code} — {title}",
                    meta_description=explanation,
                    code_layout="error_layout",
                    layout_key="error_layout",
                    page_data={"error_code": status_code},
                    widgets=error_page_widgets(root.id, status_code),
                    effective_date=now,
                    created_by_id=root.created_by_id,
                    last_edited_by_id=root.last_modified_by_id,
                )
                WebPage.objects.filter(pk=page.pk).update(
                    is_currently_published=True,
                    current_published_version_id=version.id,
                    latest_version_id=version.id,
                    cached_effective_date=now,
                )


class Migration(migrations.Migration):
    dependencies = [("webpages", "0081_normalize_required_layout_labels")]

    operations = [migrations.RunPython(consolidate_error_layouts, migrations.RunPython.noop)]
