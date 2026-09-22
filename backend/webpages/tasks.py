"""
Celery tasks for the webpages app.

This module contains background tasks for page management and maintenance.
"""

import logging

from celery import shared_task
from django.core.management import call_command
from django.db import transaction
from django.db.models import F, IntegerField, OuterRef, Q, Subquery
from django.utils import timezone

logger = logging.getLogger(__name__)


def refresh_publication_caches(now=None):
    """Refresh pages whose time-based publication boundary has changed."""
    from webpages.models import PageVersion, WebPage
    from webpages.services.page_version_workflow import PageVersionWorkflowService, SlugConflictError
    from webpages.signals import update_page_publication_cache

    now = now or timezone.now()
    expected_current_version = (
        PageVersion.objects.filter(page_id=OuterRef("pk"), effective_date__lte=now)
        .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
        .order_by("-effective_date", "-version_number")
        .values("pk")[:1]
    )
    stale_pages = WebPage.objects.annotate(
        _expected_current_version_id=Subquery(
            expected_current_version,
            output_field=IntegerField(),
        )
    ).filter(
        Q(
            _expected_current_version_id__isnull=True,
            current_published_version_id__isnull=False,
        )
        | Q(
            _expected_current_version_id__isnull=True,
            is_currently_published=True,
        )
        | (
            Q(_expected_current_version_id__isnull=False)
            & (~Q(current_published_version_id=F("_expected_current_version_id")) | Q(is_currently_published=False))
        )
    )

    updated_count = 0
    for page in stale_pages.iterator():
        try:
            with transaction.atomic():
                locked_page = WebPage.objects.select_for_update().get(pk=page.pk)
                previous_version_id = locked_page.current_published_version_id
                expected_version_id = page._expected_current_version_id
                if expected_version_id and expected_version_id != previous_version_id:
                    published_version = PageVersion.objects.select_for_update().get(pk=expected_version_id)
                    PageVersionWorkflowService(locked_page).assert_page_attributes_publishable(
                        published_version,
                        lock_slug_namespace=True,
                    )
                update_page_publication_cache(locked_page, now=now)
                if (
                    locked_page.current_published_version_id
                    and locked_page.current_published_version_id != previous_version_id
                ):
                    published_version = locked_page.current_published_version
                    published_version.page = locked_page
                    published_version._apply_version_data()
                    locked_page.save()
        except SlugConflictError as error:
            logger.error("Scheduled publication blocked for page %s: %s", page.pk, error)
            continue
        updated_count += 1
    return updated_count


@shared_task
def refresh_scheduled_publication_caches():
    """Apply scheduled publications and expirations to the public cache."""
    return refresh_publication_caches()


@shared_task(bind=True, max_retries=1)
def export_site_package(self, job_id):
    """Create a site ZIP export package in object storage."""
    from webpages.models import SitePackageJob
    from webpages.services.site_package import SitePackageExporter

    job = SitePackageJob.objects.get(id=job_id)
    try:
        return SitePackageExporter(job).run()
    except Exception as e:
        logger.error(f"Site package export {job_id} failed: {e}")
        raise


@shared_task(bind=True, max_retries=1)
def import_site_package(self, job_id):
    """Import a staged site ZIP package from object storage."""
    from webpages.models import SitePackageJob
    from webpages.services.site_package import SitePackageImporter

    job = SitePackageJob.objects.get(id=job_id)
    try:
        return SitePackageImporter(job).run()
    except Exception as e:
        logger.error(f"Site package import {job_id} failed: {e}")
        raise


@shared_task(bind=True, max_retries=3)
def send_duplicate_page_report(self, period="day"):
    """
    Send duplicate page report to administrators.

    This task runs the send_duplicate_page_report management command
    which queries unresolved duplicate page logs and emails a summary
    to configured administrators.

    Args:
        period: Report period ('day', 'week', or 'all')

    Returns:
        str: Status message
    """
    try:
        logger.info(f"Starting duplicate page report for period: {period}")

        # Call the management command
        call_command("send_duplicate_page_report", period=period)

        logger.info("Duplicate page report sent successfully")
        return f"Duplicate page report sent for period: {period}"

    except Exception as e:
        logger.error(f"Failed to send duplicate page report: {e}")
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (2**self.request.retries))
