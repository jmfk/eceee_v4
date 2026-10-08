from django.db import migrations, models

import webpages.theme_layouts


def backfill_layout_keys(apps, schema_editor):
    PageTheme = apps.get_model("webpages", "PageTheme")
    PageVersion = apps.get_model("webpages", "PageVersion")
    PageDataSchema = apps.get_model("webpages", "PageDataSchema")
    PageVersion.objects.filter(layout_key="").exclude(code_layout="").update(layout_key=models.F("code_layout"))
    PageDataSchema.objects.filter(layout_key="").exclude(layout_name="").update(layout_key=models.F("layout_name"))

    referenced_by_tenant = {}
    for tenant_id, layout_key, widgets in PageVersion.objects.exclude(layout_key="").values_list(
        "page__tenant_id", "layout_key", "widgets"
    ):
        referenced_by_tenant.setdefault(tenant_id, {}).setdefault(layout_key, set()).update(
            (widgets or {}).keys() if isinstance(widgets, dict) else []
        )
    schema_keys = set()
    for layout_key in (
        PageDataSchema.objects.filter(scope="layout").exclude(layout_key="").values_list("layout_key", flat=True)
    ):
        schema_keys.add(layout_key)

    for theme in PageTheme.objects.all().iterator():
        document = theme.layouts or webpages.theme_layouts.default_theme_layouts()
        existing = {item.get("key") for item in document.get("items", []) if isinstance(item, dict)}
        referenced_slots = {key: set(slots) for key, slots in referenced_by_tenant.get(theme.tenant_id, {}).items()}
        for key in schema_keys:
            referenced_slots.setdefault(key, set())
        additions = [
            webpages.theme_layouts.legacy_compatibility_layout(key, slots)
            for key, slots in sorted(referenced_slots.items())
            if key not in existing
        ]
        if additions:
            document = {**document, "items": [*document.get("items", []), *additions]}
            PageTheme.objects.filter(pk=theme.pk).update(layouts=document)


class Migration(migrations.Migration):
    dependencies = [("webpages", "0079_remote_site_transfer")]

    operations = [
        migrations.AddField(
            model_name="pagetheme",
            name="layouts",
            field=models.JSONField(
                blank=True,
                default=webpages.theme_layouts.default_theme_layouts,
                help_text="Versioned, validated React layout definitions owned by this theme",
            ),
        ),
        migrations.AddField(
            model_name="pageversion",
            name="layout_key",
            field=models.CharField(
                blank=True,
                help_text="Portable layout key in the effective theme. Leave blank to inherit from parent.",
                max_length=64,
            ),
        ),
        migrations.AddField(
            model_name="pagedataschema",
            name="layout_key",
            field=models.CharField(
                blank=True,
                help_text="Portable theme layout key this schema applies to (scope=layout)",
                max_length=64,
            ),
        ),
        migrations.RunPython(backfill_layout_keys, migrations.RunPython.noop),
        migrations.AddIndex(
            model_name="pagedataschema",
            index=models.Index(fields=["scope", "layout_key", "is_active"], name="pds_scope_key_active_idx"),
        ),
        migrations.AddConstraint(
            model_name="pagedataschema",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_active", True), ("scope", "layout")),
                fields=("scope", "layout_key"),
                name="unique_active_layout_key_schema",
            ),
        ),
    ]
