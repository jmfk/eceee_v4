"""Conservative, tenant-scoped preview and cleanup of superseded image objects."""

import logging

from django.db import models, transaction
from django.utils import timezone

from core.models import Tenant
from file_manager.models import MediaFile, MediaFileVersion, PendingMediaFile
from file_manager.storage import S3MediaStorage, system_storage
from object_storage.models import ObjectInstance, ObjectVersion
from webpages.models import (
    DesignerImageVersion,
    PageTheme,
    PageVersion,
    ThemeDesignerDraft,
    ThemeDesignerExportJob,
    ThemeDesignerRevision,
    ThemeVersion,
    WebPage,
)

logger = logging.getLogger(__name__)


def _cutoff(years):
    if isinstance(years, bool) or not isinstance(years, int) or not 1 <= years <= 100:
        raise ValueError("years must be between 1 and 100")
    now = timezone.now()
    try:
        return now.replace(year=now.year - years)
    except ValueError:
        return now.replace(year=now.year - years, day=28)


def _content_sources(tenant):
    return (
        PageVersion.objects.filter(page__tenant=tenant),
        WebPage.objects.filter(tenant=tenant),
        ObjectVersion.objects.filter(object_instance__tenant=tenant),
        ObjectInstance.objects.filter(tenant=tenant),
        PageTheme.objects.filter(tenant=tenant),
        ThemeDesignerDraft.objects.filter(theme__tenant=tenant),
        ThemeDesignerRevision.objects.filter(theme__tenant=tenant),
        ThemeVersion.objects.filter(theme__tenant=tenant),
        ThemeDesignerExportJob.objects.filter(theme__tenant=tenant),
    )


def _referenced_paths(tenant, paths):
    """Scan persisted content rather than relying on logical media reference_count."""
    found = set()
    if not paths:
        return found
    for queryset in _content_sources(tenant):
        fields = [
            field.name
            for field in queryset.model._meta.concrete_fields
            if isinstance(field, (models.JSONField, models.TextField, models.CharField, models.FileField))
        ]
        for row in queryset.values_list(*fields).iterator(chunk_size=200):
            value = " ".join(str(item) for item in row if item)
            found.update(path for path in paths - found if path in value)
            if found == paths:
                return found
    return found


def cleanup_candidates(tenant, years):
    cutoff = _cutoff(years)
    media = list(
        MediaFileVersion.objects.filter(
            media_file__tenant=tenant,
            media_file__protected_from_cleanup=False,
            superseded_at__lt=cutoff,
        ).select_related("media_file")
    )
    designer = list(
        DesignerImageVersion.objects.filter(
            series__theme__tenant=tenant,
            series__protected_from_cleanup=False,
            superseded_at__lt=cutoff,
        ).select_related("series__theme")
    )
    paths = {version.file_path for version in [*media, *designer]}
    referenced = _referenced_paths(tenant, paths)
    return [version for version in [*media, *designer] if _eligible(tenant, version, cutoff, referenced)]


def _eligible(tenant, version, cutoff, referenced=None):
    if version.superseded_at is None or version.superseded_at >= cutoff:
        return False
    if isinstance(version, MediaFileVersion):
        if version.media_file.tenant_id != tenant.pk or version.media_file.protected_from_cleanup:
            return False
    elif version.series.theme.tenant_id != tenant.pk or version.series.protected_from_cleanup:
        return False
    path = version.file_path
    if path in (referenced if referenced is not None else _referenced_paths(tenant, {path})):
        return False
    if MediaFile.objects.with_deleted().filter(file_path=path).exists():
        return False
    if PendingMediaFile.objects.filter(file_path=path).exists():
        return False
    media_owners = MediaFileVersion.objects.filter(file_path=path)
    if isinstance(version, MediaFileVersion):
        media_owners = media_owners.exclude(pk=version.pk)
    if media_owners.exists():
        return False
    designer_owners = DesignerImageVersion.objects.filter(file_path=path)
    if isinstance(version, DesignerImageVersion):
        designer_owners = designer_owners.exclude(pk=version.pk)
    return not designer_owners.exists()


def preview_cleanup(tenant, years):
    candidates = cleanup_candidates(tenant, years)
    return {
        "years": years,
        "count": len(candidates),
        "bytes": sum(item.file_size for item in candidates),
        "candidates": [
            {
                "kind": "media" if isinstance(item, MediaFileVersion) else "designer",
                "id": str(item.pk),
                "version_number": item.version_number,
                "file_size": item.file_size,
                "superseded_at": item.superseded_at,
                "image": item.media_file.title if isinstance(item, MediaFileVersion) else item.series.theme.name,
            }
            for item in candidates
        ],
        "notice": "External direct links to storage objects cannot be detected.",
    }


def execute_cleanup(tenant, years):
    from object_storage.services.transfer_checkpoints import tenant_transfer_lock

    deleted = 0
    errors = 0
    with tenant_transfer_lock(tenant.pk):
        candidate_ids = [(type(item), item.pk) for item in cleanup_candidates(tenant, years)]
        for model, pk in candidate_ids:
            try:
                with transaction.atomic():
                    Tenant.objects.select_for_update().get(pk=tenant.pk)
                    version = model.objects.select_for_update().filter(pk=pk).first()
                    if not version:
                        continue
                    if not _eligible(tenant, version, _cutoff(years)):
                        continue
                    storage = S3MediaStorage() if model is MediaFileVersion else system_storage
                    storage.delete(version.file_path)
                    version.delete()
                    deleted += 1
            except Exception:
                errors += 1
                logger.exception("Failed to purge image version %s", pk)
    return {"deleted": deleted, "errors": errors}
