"""Read-only page diagnostics for staff users."""

from urllib.parse import urlsplit, urlunsplit

from django.db.models import Func, IntegerField
from django.db.models.functions import Length, Substr
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from content_import.models import ImportLog

from ..models import WebPage

DEFAULT_EXPORT_LIMIT = 100
MAX_EXPORT_LIMIT = 250
VERSION_TITLE_SUMMARY_LENGTH = 500
META_TITLE_SUMMARY_LENGTH = 500
META_DESCRIPTION_SUMMARY_LENGTH = 1000


class JsonArrayLength(Func):
    output_field = IntegerField()
    template = (
        "CASE WHEN jsonb_typeof(%(expressions)s) = 'array' " "THEN jsonb_array_length(%(expressions)s) ELSE 0 END"
    )


def _user_reference(user):
    if not user:
        return None
    return {"id": user.id, "username": user.get_username()}


def _sanitized_source_url(value):
    if not value:
        return value
    try:
        parsed = urlsplit(value)
        hostname = parsed.hostname
        port = parsed.port
    except ValueError:
        return ""

    if not hostname:
        safe_netloc = ""
    else:
        safe_hostname = f"[{hostname}]" if ":" in hostname else hostname
        safe_netloc = f"{safe_hostname}:{port}" if port is not None else safe_hostname

    return urlunsplit((parsed.scheme, safe_netloc, parsed.path, "", ""))


def _bounded_limit(query_params, name):
    try:
        requested_limit = int(query_params.get(name, DEFAULT_EXPORT_LIMIT))
    except (TypeError, ValueError):
        requested_limit = DEFAULT_EXPORT_LIMIT
    return max(1, min(requested_limit, MAX_EXPORT_LIMIT))


def _widget_summary(widgets):
    if isinstance(widgets, dict):
        return {
            "format": "slots",
            "slot_count": len(widgets),
            "top_level_widget_count": sum(len(items) for items in widgets.values() if isinstance(items, list)),
            "is_empty": not any(widgets.values()),
        }
    if isinstance(widgets, list):
        return {
            "format": "list",
            "slot_count": None,
            "top_level_widget_count": len(widgets),
            "is_empty": len(widgets) == 0,
        }
    return {
        "format": type(widgets).__name__,
        "slot_count": None,
        "top_level_widget_count": None,
        "is_empty": not bool(widgets),
    }


def _summary_text(version, field_name):
    summary_name = f"{field_name}_summary"
    length_name = f"{field_name}_length"
    if hasattr(version, summary_name):
        value = getattr(version, summary_name)
        original_length = getattr(version, length_name)
        return value, original_length > len(value)
    return getattr(version, field_name), False


def _version_summary(version, current_published_version_id):
    version_title, version_title_truncated = _summary_text(version, "version_title")
    meta_title, meta_title_truncated = _summary_text(version, "meta_title")
    meta_description, meta_description_truncated = _summary_text(version, "meta_description")
    return {
        "id": version.id,
        "version_number": version.version_number,
        "version_title": version_title,
        "version_title_truncated": version_title_truncated,
        "publication_status": version.get_publication_status(),
        "is_current_published": version.id == current_published_version_id,
        "effective_date": version.effective_date,
        "expiry_date": version.expiry_date,
        "created_at": version.created_at,
        "updated_at": version.updated_at,
        "created_by": _user_reference(version.created_by),
        "meta_title": meta_title,
        "meta_title_truncated": meta_title_truncated,
        "meta_description": meta_description,
        "meta_description_truncated": meta_description_truncated,
        "code_layout": version.code_layout,
        "theme_id": version.theme_id,
        "tags": version.tags,
        "enable_css_injection": version.enable_css_injection,
    }


def _version_detail(version, current_published_version_id):
    return {
        **_version_summary(version, current_published_version_id),
        "change_summary": version.change_summary,
        "page_data": version.page_data,
        "widgets": version.widgets,
        "widget_summary": _widget_summary(version.widgets),
        "page_css_variables": version.page_css_variables,
        "page_custom_css": version.page_custom_css,
    }


class PageDebugExportThrottle(UserRateThrottle):
    scope = "page_debug_export"
    rate = "10/min"


class PageDebugExportView(APIView):
    """Export page, version, and import diagnostics without modifying data."""

    permission_classes = [IsAdminUser]
    throttle_classes = [PageDebugExportThrottle]

    def get(self, request, page_id):
        page_queryset = WebPage.objects.select_related("created_by", "last_modified_by").filter(is_deleted=False)
        tenant = getattr(request, "tenant", None)
        if tenant:
            page_queryset = page_queryset.filter(tenant=tenant)
        page = get_object_or_404(page_queryset, id=page_id)

        versions = (
            page.versions.select_related("created_by")
            .defer(
                "change_summary",
                "page_data",
                "widgets",
                "page_css_variables",
                "page_custom_css",
                "version_title",
                "meta_title",
                "meta_description",
            )
            .annotate(
                version_title_summary=Substr("version_title", 1, VERSION_TITLE_SUMMARY_LENGTH),
                version_title_length=Length("version_title"),
                meta_title_summary=Substr("meta_title", 1, META_TITLE_SUMMARY_LENGTH),
                meta_title_length=Length("meta_title"),
                meta_description_summary=Substr("meta_description", 1, META_DESCRIPTION_SUMMARY_LENGTH),
                meta_description_length=Length("meta_description"),
            )
            .order_by("-version_number")
        )
        version_limit = _bounded_limit(request.query_params, "version_limit")
        version_count = versions.count()

        selected_version = None
        selected_version_id = request.query_params.get("version_id")
        if selected_version_id is not None:
            try:
                selected_version_id = int(selected_version_id)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "version_id must be an integer."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            selected_version = get_object_or_404(
                page.versions.select_related("created_by"),
                id=selected_version_id,
            )

        import_limit = _bounded_limit(request.query_params, "import_limit")

        import_logs = (
            ImportLog.objects.filter(
                page_id=page.id,
                namespace__tenant_id=page.tenant_id,
            )
            .select_related("created_by", "namespace")
            .defer("html_content", "errors", "extracted_element_info")
            .annotate(
                error_count_value=JsonArrayLength("errors"),
                html_content_length_value=Length("html_content"),
            )
        )
        import_log_count = import_logs.count()

        payload = {
            "schema_version": 2,
            "generated_at": timezone.now(),
            "generated_by": _user_reference(request.user),
            "privacy": {
                "excluded_import_log_fields": [
                    "html_content",
                    "ip_address",
                    "errors",
                ],
                "redacted_source_url_parts": [
                    "username",
                    "password",
                    "query",
                    "fragment",
                ],
                "excluded_user_fields": ["email", "first_name", "last_name"],
            },
            "page": {
                "id": page.id,
                "tenant_id": page.tenant_id,
                "parent_id": page.parent_id,
                "title": page.title,
                "description": page.description,
                "slug": page.slug,
                "sort_order": page.sort_order,
                "cached_path": page.cached_path,
                "hostnames": page.hostnames,
                "cached_root_id": page.cached_root_id,
                "cached_root_hostnames": page.cached_root_hostnames,
                "path_pattern_key": page.path_pattern_key,
                "is_currently_published": page.is_currently_published,
                "current_published_version_id": page.current_published_version_id,
                "latest_version_id": page.latest_version_id,
                "cached_effective_date": page.cached_effective_date,
                "cached_expiry_date": page.cached_expiry_date,
                "cache_updated_at": page.cache_updated_at,
                "enable_css_injection": page.enable_css_injection,
                "page_css_variables": page.page_css_variables,
                "page_custom_css": page.page_custom_css,
                "is_deleted": page.is_deleted,
                "deleted_at": page.deleted_at,
                "created_at": page.created_at,
                "updated_at": page.updated_at,
                "created_by": _user_reference(page.created_by),
                "last_modified_by": _user_reference(page.last_modified_by),
            },
            "versions": {
                "total_count": version_count,
                "returned_count": min(version_count, version_limit),
                "truncated": version_count > version_limit,
                "limit": version_limit,
                "items": [
                    _version_summary(version, page.current_published_version_id) for version in versions[:version_limit]
                ],
            },
            "selected_version": (
                _version_detail(selected_version, page.current_published_version_id) if selected_version else None
            ),
            "import_logs": {
                "total_count": import_log_count,
                "returned_count": min(import_log_count, import_limit),
                "truncated": import_log_count > import_limit,
                "limit": import_limit,
                "items": [
                    {
                        "id": log.id,
                        "source_url": _sanitized_source_url(log.source_url),
                        "slot_name": log.slot_name,
                        "page_id": log.page_id,
                        "namespace_id": log.namespace_id,
                        "namespace_slug": log.namespace.slug,
                        "mode": log.mode,
                        "status": log.status,
                        "widgets_created": log.widgets_created,
                        "media_files_imported": log.media_files_imported,
                        "error_count": log.error_count_value,
                        "stats": log.stats,
                        "has_html_content": log.html_content_length_value > 0,
                        "html_content_length": log.html_content_length_value,
                        "created_at": log.created_at,
                        "updated_at": log.updated_at,
                        "completed_at": log.completed_at,
                        "created_by": _user_reference(log.created_by),
                    }
                    for log in import_logs[:import_limit]
                ],
            },
        }

        response = Response(payload)
        response["Cache-Control"] = "no-store"
        response["X-Content-Type-Options"] = "nosniff"
        if request.query_params.get("download", "").lower() in {"1", "true", "yes"}:
            response["Content-Disposition"] = f'attachment; filename="page-{page.id}-debug.json"'
        return response
