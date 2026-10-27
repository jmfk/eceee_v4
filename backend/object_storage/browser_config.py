"""Validated, tenant-scoped configuration for searching and filtering Objects."""

import json
from uuid import UUID

from django.db.models import Q
from rest_framework import serializers

from taxonomy.models import ClassificationType, Tag
from taxonomy.services import matching_term_ids

SYSTEM_FILTERS = {
    "created_at": ("Created in CMS", "date"),
    "effective_date": ("Publication date", "date"),
    "expiry_date": ("Expiry date", "date"),
}
DEFAULT_LIST_FIELDS = ["status", "created_at", "publish_date"]
SYSTEM_LIST_FIELDS = {
    "status": ("Status", "status"),
    "created_at": ("Created in CMS", "date"),
    "updated_at": ("Last updated", "date"),
    "publish_date": ("Publish date", "date"),
    "unpublish_date": ("Unpublish date", "date"),
}
TEXT_COMPONENTS = {"text", "textarea", "url", "email", "select"}
CONTROLS = {
    "date": {"date_range"},
    "boolean": {"checklist"},
    "reference": {"searchable_multi"},
    "tag": {"searchable_multi"},
    "choice": {"searchable_multi", "checklist"},
}


def default_control(kind):
    return "date_range" if kind == "date" else "checklist" if kind == "boolean" else "searchable_multi"


def field_kind(field):
    component = field.get("componentType") or field.get("field_type") or field.get("type")
    if component in {"date", "datetime", "datetime-local"}:
        return "date"
    if component == "boolean" or field.get("type") == "boolean":
        return "boolean"
    if component == "object_reference":
        return "reference"
    if component in TEXT_COMPONENTS or (not component and field.get("type") == "string"):
        return "choice"
    return None


def browser_config(definition):
    value = (definition.metadata or {}).get("browser", {})
    return value if isinstance(value, dict) else {}


def available_filters(definition, tenant):
    result = {key: {"key": key, "label": label, "kind": kind} for key, (label, kind) in SYSTEM_FILTERS.items()}
    for key, field in (definition.schema or {}).get("properties", {}).items():
        kind = field_kind(field)
        if kind:
            result[f"field:{key}"] = {
                "key": f"field:{key}",
                "label": field.get("title") or key,
                "kind": kind,
                **(
                    {"multiple": bool(field.get("multiple") or field.get("type") == "array")}
                    if kind == "reference"
                    else {}
                ),
            }
    for classification in ClassificationType.objects.filter(tenant=tenant).order_by("sort_order", "name"):
        if f"object:{definition.pk}" in classification.allowed_uses:
            result[f"tag:{classification.pk}"] = {
                "key": f"tag:{classification.pk}",
                "label": classification.name,
                "kind": "tag",
            }
    return result


def available_list_fields(definition):
    result = {key: {"key": key, "label": label, "kind": kind} for key, (label, kind) in SYSTEM_LIST_FIELDS.items()}
    for key, field in (definition.schema or {}).get("properties", {}).items():
        kind = field_kind(field)
        if kind in {"choice", "date", "boolean"}:
            result[f"field:{key}"] = {
                "key": f"field:{key}",
                "label": field.get("title") or key,
                "kind": kind,
            }
    return result


def validate_browser_config(definition, tenant, value):
    if (
        not isinstance(value, dict)
        or not {"search_fields", "filters"} <= set(value)
        or set(value) - {"search_fields", "filters", "list_fields"}
    ):
        raise serializers.ValidationError("Expected search_fields, filters and optional list_fields.")
    fields = (definition.schema or {}).get("properties", {})
    search_fields = value["search_fields"]
    filters = value["filters"]
    if (
        not isinstance(search_fields, list)
        or len(search_fields) > 20
        or len(search_fields) != len(set(map(str, search_fields)))
    ):
        raise serializers.ValidationError({"search_fields": "Choose at most 20 distinct fields."})
    for key in search_fields:
        if not isinstance(key, str) or key not in fields or field_kind(fields[key]) != "choice":
            raise serializers.ValidationError({"search_fields": f"{key} is not a searchable text field."})
    if not isinstance(filters, list) or len(filters) > 30:
        raise serializers.ValidationError({"filters": "Choose at most 30 filters."})
    list_fields = value.get("list_fields", DEFAULT_LIST_FIELDS)
    allowed_list_fields = available_list_fields(definition)
    if (
        not isinstance(list_fields, list)
        or len(list_fields) > 8
        or any(not isinstance(key, str) or key not in allowed_list_fields for key in list_fields)
        or len(list_fields) != len(set(list_fields))
    ):
        raise serializers.ValidationError({"list_fields": "Choose at most 8 distinct available list fields."})
    allowed = available_filters(definition, tenant)
    seen = set()
    for entry in filters:
        if (
            not isinstance(entry, dict)
            or not {"key", "label", "overview"} <= set(entry)
            or set(entry) - {"key", "label", "overview", "control", "quick"}
        ):
            raise serializers.ValidationError({"filters": "Each filter needs key, label and overview."})
        key, label = entry["key"], entry["label"]
        if key not in allowed or key in seen:
            raise serializers.ValidationError({"filters": f"{key} is unavailable or duplicated."})
        if (
            not isinstance(label, str)
            or not label.strip()
            or len(label) > 80
            or not isinstance(entry["overview"], bool)
        ):
            raise serializers.ValidationError({"filters": f"{key} needs a short label and overview choice."})
        if entry.get("control", default_control(allowed[key]["kind"])) not in CONTROLS[allowed[key]["kind"]]:
            raise serializers.ValidationError({"filters": f"{key} has an incompatible control."})
        if "quick" in entry and not isinstance(entry["quick"], bool):
            raise serializers.ValidationError({"filters": f"{key} needs a yes/no quick button choice."})
        seen.add(key)
    return {
        "search_fields": search_fields,
        "list_fields": list_fields,
        "filters": [
            {
                **entry,
                "label": entry["label"].strip(),
                "control": entry.get("control", default_control(allowed[entry["key"]]["kind"])),
                "quick": entry.get("quick", allowed[entry["key"]]["kind"] == "date"),
            }
            for entry in filters
        ],
    }


def searchable_query(definitions, query):
    """Search only explicitly selected text fields, plus the Object title and slug."""
    result = Q(title__icontains=query) | Q(slug__icontains=query)
    for definition in definitions:
        for key in browser_config(definition).get("search_fields", []):
            if key in (definition.schema or {}).get("properties", {}):
                result |= Q(object_type_id=definition.pk, **{f"current_version__data__{key}__icontains": query})
    return result


def parse_browser_filters(request, definition):
    raw = request.query_params.get("browser_filters")
    if not raw:
        return []
    if len(raw) > 6000:
        raise serializers.ValidationError({"browser_filters": "Filter request is too long."})
    try:
        items = json.loads(raw)
    except ValueError as exc:
        raise serializers.ValidationError({"browser_filters": "Invalid filter request."}) from exc
    if not isinstance(items, list) or len(items) > 30:
        raise serializers.ValidationError({"browser_filters": "Expected a list of at most 30 filters."})
    configured = {item["key"] for item in browser_config(definition).get("filters", [])}
    available = available_filters(definition, request.tenant)
    parsed = []
    seen = set()
    for item in items:
        if not isinstance(item, dict) or set(item) != {"key", "values"}:
            raise serializers.ValidationError({"browser_filters": "Each filter needs key and values."})
        key, values = item["key"], item["values"]
        if key not in configured or key not in available or key in seen:
            raise serializers.ValidationError({"browser_filters": f"Filter {key} is unavailable."})
        if (
            not isinstance(values, list)
            or not 1 <= len(values) <= 100
            or any(not isinstance(v, str) or len(v) > 255 for v in values)
        ):
            raise serializers.ValidationError({"browser_filters": f"Filter {key} needs 1–100 values."})
        seen.add(key)
        parsed.append((available[key], values))
    return parsed


def apply_browser_filters(request, queryset, definition):
    for option, values in parse_browser_filters(request, definition):
        key, kind = option["key"], option["kind"]
        if kind == "date":
            if len(values) != 2:
                raise serializers.ValidationError({"browser_filters": f"{key} needs a from and to date."})
            from django.utils.dateparse import parse_date

            if any(value and not parse_date(value) for value in values):
                raise serializers.ValidationError({"browser_filters": f"{key} needs ISO dates."})
            path = {
                "created_at": "created_at__date",
                "effective_date": "current_version__effective_date__date",
                "expiry_date": "current_version__expiry_date__date",
            }.get(key, f"current_version__data__{key[6:]}")
            if values[0]:
                queryset = queryset.filter(**{f"{path}__gte": values[0]})
            if values[1]:
                queryset = queryset.filter(**{f"{path}__lte": values[1]})
            continue
        if kind == "tag":
            try:
                ids = [UUID(value) for value in values]
            except ValueError as exc:
                raise serializers.ValidationError({"browser_filters": f"{key} needs term IDs."}) from exc
            terms = Tag.objects.filter(
                pk__in=ids, tenant=request.tenant, classification_type_id=key[4:], status="approved"
            )
            if terms.count() != len(set(ids)):
                raise serializers.ValidationError({"browser_filters": f"{key} contains unavailable terms."})
            matches = matching_term_ids(ids, tenant=request.tenant)
            queryset = queryset.filter(current_version__canonical_tag_links__tag_id__in=matches).distinct()
            continue
        if kind == "boolean":
            if any(value not in {"true", "false"} for value in values):
                raise serializers.ValidationError({"browser_filters": f"{key} needs true or false."})
            queryset = queryset.filter(
                **{f"current_version__data__{key[6:]}__in": [value == "true" for value in values]}
            )
            continue
        path = f"current_version__data__{key[6:]}"
        alternatives = Q()
        for value in values:
            if kind == "reference":
                try:
                    reference_id = int(value)
                except ValueError as exc:
                    raise serializers.ValidationError({"browser_filters": f"{key} needs Object IDs."}) from exc
                if not 0 < reference_id <= 2**63 - 1:
                    raise serializers.ValidationError({"browser_filters": f"{key} needs valid Object IDs."})
                alternatives |= (
                    Q(**{f"{path}__contains": [reference_id]}) if option.get("multiple") else Q(**{path: reference_id})
                )
            else:
                alternatives |= Q(**{f"{path}__iexact": value})
        queryset = queryset.filter(alternatives)
    return queryset
