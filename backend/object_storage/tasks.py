"""Background work for remote object packages."""

import logging
import tempfile
import zipfile

import requests
from celery import shared_task
from celery.exceptions import Retry
from django.core.files import File
from django.utils import timezone

from file_manager.storage import S3MediaStorage
from object_storage.models import ObjectTransferJob
from object_storage.services.object_transfer import (
    MAX_ARCHIVE_BYTES,
    ObjectPackageExporter,
    ObjectPackageImporter,
    validate_package,
)
from webpages.services.theme_remote import RemoteTransportError, remote_object_request

logger = logging.getLogger(__name__)


def _stream_package_response(response, destination):
    total = 0
    for chunk in response.iter_content(chunk_size=1024 * 1024):
        if not chunk:
            continue
        total += len(chunk)
        if total > MAX_ARCHIVE_BYTES:
            raise ValueError("The remote object package exceeds the safe archive download limit.")
        destination.write(chunk)
    return total


@shared_task
def cleanup_expired_object_packages(batch_size=100):
    storage = S3MediaStorage()
    jobs = (
        ObjectTransferJob.objects.filter(expires_at__lt=timezone.now())
        .exclude(object_key="")
        .order_by("expires_at")[:batch_size]
    )
    cleaned = 0
    for job in jobs:
        storage.delete(job.object_key)
        job.object_key = ""
        job.save(update_fields=["object_key", "updated_at"])
        cleaned += 1
    return cleaned


@shared_task(bind=True, max_retries=1)
def export_object_package(self, job_id):
    job = ObjectTransferJob.objects.get(id=job_id)
    try:
        return ObjectPackageExporter(job).run()
    except Exception as exc:
        logger.error("Object export %s failed: %s", job_id, exc)
        raise


@shared_task(bind=True, max_retries=120)
def import_remote_object_package(self, job_id):
    job = ObjectTransferJob.objects.select_related("connection").get(id=job_id)
    if job.status in {ObjectTransferJob.STATUS_COMPLETED, ObjectTransferJob.STATUS_FAILED}:
        return job.progress
    try:
        if job.status == ObjectTransferJob.STATUS_PENDING:
            job.mark_running(phase="remote_export")
        if job.object_key and (job.progress or {}).get("phase") == "importing":
            return ObjectPackageImporter(job, storage=S3MediaStorage()).run()
        remote_job_id = (job.progress or {}).get("remote_job_id")
        if not remote_job_id:
            remote = remote_object_request(
                job.connection,
                "POST",
                "exports/",
                {"root_ids": job.options["root_ids"]},
            )
            remote_job_id = remote["id"]
            job.progress = {**job.progress, "remote_job_id": remote_job_id, "phase": "remote_export"}
            job.save(update_fields=["progress", "updated_at"])
            raise self.retry(countdown=2)
        remote = remote_object_request(job.connection, "GET", f"exports/{remote_job_id}/")
        if remote["status"] in {"pending", "running"}:
            raise self.retry(countdown=min(15, 2 + self.request.retries // 10))
        if remote["status"] != "completed":
            raise ValueError((remote.get("errors") or ["The remote object export failed."])[-1])

        job.mark_running(phase="downloading")
        response = remote_object_request(job.connection, "GET", f"exports/{remote_job_id}/download/", stream=True)
        package_file = tempfile.SpooledTemporaryFile(max_size=25 * 1024 * 1024)
        try:
            try:
                total = _stream_package_response(response, package_file)
            finally:
                response.close()
            package_file.seek(0)
            with zipfile.ZipFile(package_file, "r") as package:
                validate_package(package)
            package_file.seek(0)
            storage = S3MediaStorage()
            key = f"object-transfers/imports/{job.id}.zip"
            storage._save(key, File(package_file, name=f"{job.id}.zip"))
        finally:
            package_file.close()
        job.object_key = key
        job.progress = {**job.progress, "phase": "importing", "downloaded_bytes": total}
        job.save(update_fields=["object_key", "progress", "updated_at"])
        return ObjectPackageImporter(job, storage=storage).run()
    except Retry:
        raise
    except (RemoteTransportError, requests.RequestException) as exc:
        if self.request.retries >= self.max_retries:
            job.mark_failed(exc)
            raise
        countdown = min(60, 2 ** min(self.request.retries + 1, 6))
        raise self.retry(exc=exc, countdown=countdown)
    except Exception as exc:
        if job.status != ObjectTransferJob.STATUS_FAILED:
            job.mark_failed(exc)
        logger.error("Remote object import %s failed: %s", job_id, exc)
        raise
