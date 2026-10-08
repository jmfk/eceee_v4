"""Create editable, site-owned HTTP error pages with useful starter content."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from webpages.error_page_defaults import ERROR_PAGE_CONTENT, error_page_widgets
from webpages.models import PageVersion, WebPage


@transaction.atomic
def ensure_site_error_pages(root_page: WebPage, user=None, *, publish=True) -> list[WebPage]:
    """Create missing 403/404/500/503 children without replacing customized pages."""
    if root_page.parent_id is not None:
        raise ValueError("Error pages can only be provisioned for a root page.")
    owner = user or root_page.created_by
    pages = []
    for index, (status_code, (title, explanation)) in enumerate(ERROR_PAGE_CONTENT.items()):
        page, created = WebPage.objects.get_or_create(
            parent=root_page,
            tenant=root_page.tenant,
            slug=str(status_code),
            is_deleted=False,
            defaults={
                "title": f"{status_code} — {title}",
                "description": explanation,
                "sort_order": 9000 + index,
                "created_by": owner,
                "last_modified_by": owner,
            },
        )
        if created or not page.versions.exists():
            PageVersion.objects.create(
                page=page,
                version_number=1,
                version_title="Default error page",
                change_summary={"summary": "Created with the site error-page defaults"},
                meta_title=f"{status_code} — {title}",
                meta_description=explanation,
                code_layout="error_layout",
                layout_key="error_layout",
                page_data={"error_code": status_code},
                widgets=error_page_widgets(root_page.id, status_code),
                effective_date=timezone.now() if publish else None,
                created_by=owner,
                last_edited_by=owner,
            )
        pages.append(page)
    return pages
