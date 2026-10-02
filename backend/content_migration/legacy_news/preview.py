"""Create the idempotent local page used to review migrated News samples."""

from __future__ import annotations

from django.db import transaction

from webpages.models import PageVersion, WebPage
from webpages.services.page_version_workflow import PageVersionWorkflowService

PREVIEW_HOSTNAME = "migration-preview.localhost"


@transaction.atomic
def ensure_news_preview_page(*, tenant, user, news_object_type_id: int) -> WebPage:
    site_root, _ = WebPage.objects.get_or_create(
        tenant=tenant,
        parent=None,
        slug="migration-preview-site",
        is_deleted=False,
        defaults={
            "title": "Migration preview site",
            "description": "Local-only migration review site",
            "created_by": user,
            "last_modified_by": user,
            "hostnames": [PREVIEW_HOSTNAME],
        },
    )
    site_hostnames = site_root.hostnames or []
    if PREVIEW_HOSTNAME not in site_hostnames:
        site_root.hostnames = [*site_hostnames, PREVIEW_HOSTNAME]
        site_root.last_modified_by = user
        site_root.save(update_fields=["hostnames", "last_modified_by", "updated_at"])

    root = WebPage.objects.filter(
        tenant=tenant,
        parent=site_root,
        slug="migration-preview",
        is_deleted=False,
    ).first()
    if root is None:
        # PR #170 originally created this page as an unreachable hostname-less
        # site root. Reparent it when a dev database already contains samples.
        root = WebPage.objects.filter(
            tenant=tenant,
            parent=None,
            slug="migration-preview",
            is_deleted=False,
        ).first()
    if root is None:
        root = WebPage.objects.create(
            tenant=tenant,
            parent=site_root,
            slug="migration-preview",
            title="Migration preview",
            description="Local-only migration review pages",
            created_by=user,
            last_modified_by=user,
            hostnames=[],
        )
    elif root.parent_id != site_root.id or root.hostnames:
        root.parent = site_root
        root.hostnames = []
        root.last_modified_by = user
        root.save(update_fields=["parent", "hostnames", "last_modified_by", "updated_at"])

    detail, _ = WebPage.objects.get_or_create(
        tenant=tenant,
        parent=root,
        slug="news",
        is_deleted=False,
        defaults={
            "title": "Legacy News migration preview",
            "description": "Golden sample News detail renderer",
            "created_by": user,
            "last_modified_by": user,
            "path_pattern_key": "news_slug",
        },
    )
    if detail.path_pattern_key != "news_slug":
        detail.path_pattern_key = "news_slug"
        detail.last_modified_by = user
        detail.save(update_fields=["path_pattern_key", "last_modified_by", "updated_at"])

    _ensure_version(site_root, user, widgets={})
    _ensure_version(root, user, widgets={})
    _ensure_version(
        detail,
        user,
        widgets={
            "main": [
                {
                    "id": "legacy-news-migration-preview-detail",
                    "type": "easy_widgets.NewsDetailWidget",
                    "name": "Legacy News golden sample",
                    "order": 0,
                    "config": {
                        "slugVariableName": "news_slug",
                        "objectTypes": [news_object_type_id],
                        "showMetadata": True,
                        "showFeaturedImage": True,
                        "showObjectType": True,
                        "renderObjectWidgets": True,
                        "emptyMessage": "Select a golden sample by opening its article slug under this preview URL.",
                    },
                }
            ]
        },
    )
    detail.refresh_from_db()
    return detail


def _ensure_version(page, user, *, widgets):
    current = page.get_current_published_version()
    if current and current.widgets == widgets:
        return current
    number = (page.versions.order_by("-version_number").values_list("version_number", flat=True).first() or 0) + 1
    version = PageVersion.objects.create(
        page=page,
        version_number=number,
        version_title="Legacy News migration preview",
        meta_title=page.title,
        meta_description=page.description,
        code_layout="main_layout",
        page_data={
            "page_attributes": {
                "title": page.title,
                "description": page.description,
                "slug": page.slug,
                "path_pattern_key": page.path_pattern_key,
                "hostnames": page.hostnames,
            }
        },
        widgets=widgets,
        created_by=user,
    )
    return PageVersionWorkflowService(page, user).publish(version)
