"""
Celery tasks for the webpages app.

This module contains background tasks for page management and maintenance.
"""

import logging
import tempfile
import zipfile

from celery import shared_task
from celery.exceptions import Retry
from django.core.files import File
from django.core.management import call_command
from django.db import transaction
from django.db.models import F, IntegerField, OuterRef, Q, Subquery
from django.utils import timezone

logger = logging.getLogger(__name__)


def refresh_publication_caches(now=None):
    """Refresh pages whose time-based publication boundary has changed."""
    from webpages.models import PageVersion, WebPage
    from webpages.services.page_version_workflow import PageAttributeConflictError, PageVersionWorkflowService
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

    def reject_scheduled_activation(page, error):
        expected_version_id = page._expected_current_version_id
        if not expected_version_id:
            return
        with transaction.atomic():
            PageVersionWorkflowService.lock_hostname_namespace()
            locked_page = WebPage.objects.select_for_update().get(pk=page.pk)
            blocked_version = PageVersion.objects.select_for_update().get(
                pk=expected_version_id,
                page=locked_page,
            )
            PageVersionWorkflowService(locked_page, now=now).fail_scheduled_activation(
                blocked_version,
                reason=error,
            )
            update_page_publication_cache(locked_page, now=now)

    updated_count = 0
    for page in stale_pages.iterator():
        try:
            with transaction.atomic():
                PageVersionWorkflowService.lock_hostname_namespace()
                locked_page = WebPage.objects.select_for_update().get(pk=page.pk)
                previous_version_id = locked_page.current_published_version_id
                expected_version_id = page._expected_current_version_id
                if expected_version_id and expected_version_id != previous_version_id:
                    published_version = PageVersion.objects.select_for_update().get(pk=expected_version_id)
                    PageVersionWorkflowService(locked_page).assert_page_attributes_publishable(
                        published_version,
                        lock_namespace=True,
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
        except PageAttributeConflictError as error:
            logger.error("Scheduled publication blocked for page %s: %s", page.pk, error)
            reject_scheduled_activation(page, error)
            continue
        except Exception as error:
            logger.exception("Scheduled publication failed for page %s", page.pk)
            reject_scheduled_activation(page, error)
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


@shared_task(bind=True, max_retries=120)
def import_remote_site_package(self, job_id):
    """Export a remote site, stream its package locally, then run the normal importer."""
    from file_manager.storage import S3MediaStorage
    from webpages.models import SitePackageJob, ThemeRemoteConnection
    from webpages.services.site_package import SitePackageImporter
    from webpages.services.theme_remote import remote_site_request

    job = SitePackageJob.objects.get(id=job_id)
    options = job.options or {}
    connection = ThemeRemoteConnection.objects.get(id=options["connection_id"], tenant_id=options["tenant_id"])
    try:
        if job.status == SitePackageJob.STATUS_PENDING:
            job.mark_running()
        remote_job_id = (job.progress or {}).get("remote_job_id")
        if not remote_job_id:
            remote_job = remote_site_request(
                connection,
                "POST",
                "exports/",
                {"stableKey": options["remote_site_key"]},
            )
            remote_job_id = str(remote_job["id"])
            job.progress = {**(job.progress or {}), "phase": "remote_export", "remote_job_id": remote_job_id}
            job.save(update_fields=["progress", "updated_at"])
            raise self.retry(countdown=2)

        remote_job = remote_site_request(connection, "GET", f"exports/{remote_job_id}/")
        if remote_job.get("status") in {"pending", "running"}:
            job.progress = {**(job.progress or {}), "phase": "remote_export"}
            job.save(update_fields=["progress", "updated_at"])
            raise self.retry(countdown=min(15, 2 + self.request.retries // 10))
        if remote_job.get("status") != "completed":
            errors = remote_job.get("errors") or ["The remote site export failed."]
            raise ValueError(errors[-1])

        job.progress = {**(job.progress or {}), "phase": "downloading"}
        job.save(update_fields=["progress", "updated_at"])
        response = remote_site_request(connection, "GET", f"exports/{remote_job_id}/download/", stream=True)
        package_file = tempfile.SpooledTemporaryFile(max_size=25 * 1024 * 1024)
        total_size = 0
        try:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if not chunk:
                    continue
                total_size += len(chunk)
                if total_size > 2 * 1024 * 1024 * 1024:
                    raise ValueError("The remote site package exceeds the 2 GB transfer limit.")
                package_file.write(chunk)
        finally:
            response.close()
        package_file.seek(0)
        with zipfile.ZipFile(package_file, "r") as package:
            members = [item for item in package.infolist() if not item.is_dir()]
            if len(members) > 20000 or sum(item.file_size for item in members) > 2 * 1024 * 1024 * 1024:
                raise ValueError("The remote site package exceeds safety limits.")
            if package.testzip() is not None:
                raise ValueError("The remote site package is corrupt.")
        package_file.seek(0)

        object_key = f"site-packages/imports/{job.id}.zip"
        storage = S3MediaStorage()
        try:
            storage._save(object_key, File(package_file, name=f"{job.id}.zip"))
        finally:
            package_file.close()
        job.object_key = object_key
        job.progress = {**(job.progress or {}), "phase": "importing", "downloaded_bytes": total_size}
        job.save(update_fields=["object_key", "progress", "updated_at"])
        return SitePackageImporter(job, storage=storage).run()
    except Retry:
        raise
    except Exception as error:
        if job.status != SitePackageJob.STATUS_FAILED:
            job.mark_failed(error)
        logger.error("Remote site import %s failed: %s", job_id, error)
        raise


@shared_task(bind=True, max_retries=1)
def export_designer_theme(self, job_id):
    """Create a designer ZIP package and store it for download."""
    from webpages.models import ThemeDesignerExportJob
    from webpages.services.designer_export import ThemeDesignerExporter

    job = ThemeDesignerExportJob.objects.select_related("theme").get(id=job_id)
    try:
        return ThemeDesignerExporter(job).run()
    except Exception as error:
        logger.error("Designer theme export %s failed: %s", job_id, error)
        raise


@shared_task
def cleanup_expired_designer_exports():
    """Remove expired Designer ZIP objects and snapshots in bounded batches."""
    from webpages.services.designer_export import cleanup_expired_designer_exports as cleanup

    return cleanup()


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
