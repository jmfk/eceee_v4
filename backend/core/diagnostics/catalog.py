"""Reviewed diagnostic projections. Every unlisted field/table is excluded, including future schema."""

from django.apps import apps

# Tuples: model label, plain diagnostic columns, constant-masked columns, tenant ownership path.
# Text is never exposed by guessing from a field's name/type. These are deliberate projections.
PROJECTIONS = (
    ("core.Tenant", ("id", "is_active", "created_at", "updated_at"), ("name", "identifier"), "id"),
    (
        "auth.User",
        ("id", "is_active", "date_joined", "last_login"),
        ("username", "first_name", "last_name", "email"),
        None,
    ),
    ("content.Namespace", ("id", "created_at", "updated_at"), ("name",), "tenant_id"),
    (
        "webpages.WebPage",
        (
            "id",
            "stable_key",
            "parent_id",
            "tenant_id",
            "is_deleted",
            "is_currently_published",
            "latest_version_id",
            "current_published_version_id",
            "created_at",
            "updated_at",
        ),
        ("title", "slug", "description", "cached_path"),
        "tenant_id",
    ),
    (
        "webpages.PageVersion",
        ("id", "page_id", "version_number", "theme_id", "effective_date", "expiry_date", "created_at"),
        ("version_title", "meta_title", "meta_description"),
        "page.tenant_id",
    ),
    (
        "webpages.PageTheme",
        ("id", "tenant_id", "is_active", "is_default", "sync_version", "created_at", "updated_at"),
        ("name", "description"),
        "tenant_id",
    ),
    ("webpages.PublicFormSubmission", ("id", "tenant_id", "page_id", "submitted_at"), (), "tenant_id"),
    (
        "object_storage.ObjectInstance",
        (
            "id",
            "tenant_id",
            "object_type_id",
            "parent_id",
            "current_version_id",
            "version",
            "publish_date",
            "unpublish_date",
            "created_at",
            "updated_at",
        ),
        ("title", "slug"),
        "tenant_id",
    ),
    (
        "object_storage.ObjectVersion",
        (
            "id",
            "object_instance_id",
            "version_number",
            "effective_date",
            "expiry_date",
            "is_featured",
            "created_at",
            "updated_at",
        ),
        ("title", "change_description"),
        "object_instance.tenant_id",
    ),
    (
        "file_manager.MediaFile",
        ("id", "namespace_id", "created_at", "updated_at"),
        ("title", "description"),
        "namespace.tenant_id",
    ),
)


def projections():
    result = {}
    for label, plain, masked, tenant_path in PROJECTIONS:
        try:
            model = apps.get_model(label)
        except LookupError:
            continue
        fields = {f.column: f for f in model._meta.concrete_fields}
        # Missing reviewed columns indicate a schema change, not an excuse to broaden a view.
        selected = {name: "readable" for name in plain if name in fields}
        selected.update({name: "masked" for name in masked if name in fields})
        if tenant_path:
            selected.setdefault("tenant_id", "readable")
        result[model._meta.db_table] = {
            "model": model,
            "columns": selected,
            "fields": fields,
            "tenant_path": tenant_path,
            "global": tenant_path is None,
        }
    return result


def inventory(include_global=False):
    reviewed = projections()
    tables = []
    for model in sorted(apps.get_models(include_auto_created=True), key=lambda m: m._meta.db_table):
        table = model._meta.db_table
        projection = reviewed.get(table)
        if projection and projection["global"] and not include_global:
            continue
        classifications = projection["columns"] if projection else {}
        fields = []
        for field in model._meta.concrete_fields:
            item = {
                "name": field.column,
                "classification": classifications.get(field.column, "excluded"),
                "type": field.get_internal_type(),
            }
            if field.is_relation and field.related_model:
                item["relation"] = {"table": field.related_model._meta.db_table, "column": field.target_field.column}
            fields.append(item)
        if projection and not projection["global"] and "tenant_id" not in projection["fields"]:
            fields.append({"name": "tenant_id", "classification": "readable", "type": "UUIDField"})
        tables.append(
            {
                "table": table,
                "queryable": bool(projection),
                "global": bool(projection and projection["global"]),
                "columns": fields,
            }
        )
    return tables
