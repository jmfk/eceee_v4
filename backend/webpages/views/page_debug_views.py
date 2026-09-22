"""Read-only page diagnostics for authenticated editors."""

from urllib.parse import urlsplit, urlunsplit

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from content_import.models import ImportLog

from ..models import WebPage


def _user_reference(user):
    if not user:
        return None
    return {"id": user.id, "username": user.get_username()}


def _sanitized_source_url(value):
    if not value:
        return value
    parsed = urlsplit(value)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


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


class PageDebugExportView(APIView):
    """Export page, version, and import diagnostics without modifying data."""

    permission_classes = [IsAuthenticated]

    def get(self, request, page_id):
        page_queryset = WebPage.objects.select_related(
            "created_by",
            "last_modified_by",
            "current_published_version",
            "latest_version",
        ).filter(is_deleted=False)
        tenant = getattr(request, "tenant", None)
        if tenant:
            page_queryset = page_queryset.filter(tenant=tenant)
        page = get_object_or_404(page_queryset, id=page_id)

        versions = page.versions.select_related("created_by", "theme").order_by("-version_number")

        try:
            requested_import_limit = int(request.query_params.get("import_limit", 100))
        except (TypeError, ValueError):
            requested_import_limit = 100
        import_limit = max(1, min(requested_import_limit, 250))

        import_logs = ImportLog.objects.filter(page_id=page.id).select_related("created_by", "namespace")
        import_log_count = import_logs.count()

        payload = {
            "schema_version": 1,
            "generated_at": timezone.now(),
            "generated_by": _user_reference(request.user),
            "privacy": {
                "excluded_import_log_fields": [
                    "html_content",
                    "ip_address",
                    "errors",
                ],
                "redacted_source_url_parts": ["query", "fragment"],
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
            "versions": [
                {
                    "id": version.id,
                    "version_number": version.version_number,
                    "version_title": version.version_title,
                    "change_summary": version.change_summary,
                    "publication_status": version.get_publication_status(),
                    "is_current_published": (version.id == page.current_published_version_id),
                    "effective_date": version.effective_date,
                    "expiry_date": version.expiry_date,
                    "created_at": version.created_at,
                    "updated_at": version.updated_at,
                    "created_by": _user_reference(version.created_by),
                    "meta_title": version.meta_title,
                    "meta_description": version.meta_description,
                    "code_layout": version.code_layout,
                    "theme_id": version.theme_id,
                    "tags": version.tags,
                    "page_data": version.page_data,
                    "widgets": version.widgets,
                    "widget_summary": _widget_summary(version.widgets),
                    "page_css_variables": version.page_css_variables,
                    "page_custom_css": version.page_custom_css,
                    "enable_css_injection": version.enable_css_injection,
                }
                for version in versions
            ],
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
                        "error_count": len(log.errors or []),
                        "stats": log.stats,
                        "has_html_content": bool(log.html_content),
                        "html_content_length": len(log.html_content or ""),
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
