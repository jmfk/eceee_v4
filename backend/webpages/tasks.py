"""
Celery tasks for the webpages app.

This module contains background tasks for page management and maintenance.
"""

import logging
from celery import shared_task
from django.core.management import call_command

logger = logging.getLogger(__name__)


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
