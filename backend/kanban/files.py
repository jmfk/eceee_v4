"""Private attachments and explicit copies through destination validation."""

import hashlib
import uuid
from contextlib import contextmanager
from pathlib import PurePath
from tempfile import TemporaryFile

from django.core.files.uploadedfile import UploadedFile
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework.exceptions import PermissionDenied, ValidationError

from content.models import Namespace
from file_manager.models import MediaFile
from file_manager.security import FileUploadValidator, filter_media_files_for_user, user_can_access_namespace
from file_manager.serializers import MediaFileApprovalSerializer
from file_manager.storage import checkpoint_storage, storage
from webpages.services.designer_theme import DesignerDraftConflict, replace_designer_asset

from .models import AttachmentImport
from .services import Conflict, event
from .upload_validation import CHUNK_SIZE, KanbanUploadValidator

# Private bucket; no URL is ever returned to clients.
attachment_storage = checkpoint_storage
IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_TYPES = {
    mime: extensions
    for mime, extensions in FileUploadValidator.ALLOWED_MIME_TYPES.items()
    if not mime.startswith("video/") or mime in {"video/mp4", "video/webm"}
}


def validate_upload(upload):
    if upload.content_type not in ALLOWED_TYPES:
        raise ValidationError("Unsupported file format. Videos must be MP4 or WebM.")
    if upload.size > max(FileUploadValidator.MAX_FILE_SIZES.values()):
        raise ValidationError("File exceeds the maximum upload size.")
    result = KanbanUploadValidator.validate_file(upload)
    upload.seek(0)
    if not result["is_valid"]:
        raise ValidationError(result["errors"])
    actual = result["metadata"].get("actual_mime_type", upload.content_type)
    if actual not in ALLOWED_TYPES:
        raise ValidationError("Unsupported file format. Videos must be MP4 or WebM.")
    upload.content_type = actual
    return result


def validate_image(upload):
    if not upload or upload.size > 10 * 1024 * 1024:
        raise ValidationError("Choose an image smaller than 10 MB.")
    validate_upload(upload)
    if upload.content_type not in IMAGE_TYPES:
        raise ValidationError("Choose a JPEG, PNG, GIF or WebP image.")


def save_upload(tenant, upload):
    validate_upload(upload)
    suffix = PurePath(upload.name).suffix.lower()
    path = f"tenants/{tenant.pk}/kanban/{uuid.uuid4()}{suffix}"
    attachment_storage.save_private(path, upload)
    return path


def matches_upload(upload, attachment):
    """Compare a same-sized stored attachment without buffering it in memory."""
    result = attachment_storage.client.get_object(
        Bucket=attachment_storage.bucket_name, Key=attachment_storage._get_key(attachment.path)
    )
    body = result["Body"]
    upload.seek(0)
    try:
        for chunk in upload.chunks(chunk_size=CHUNK_SIZE):
            if chunk != body.read(len(chunk)):
                return False
        return not body.read(1)
    finally:
        upload.seek(0)
        body.close()


@contextmanager
def prepared_attachment(attachment):
    if not attachment.approved_at:
        raise ValidationError("Approve this attachment before importing it.")
    # S3 storage.open() buffers the whole object. Spool bounded reads directly
    # from S3 to a temporary file instead, before acquiring the tenant write lock.
    result = attachment_storage.client.get_object(
        Bucket=attachment_storage.bucket_name, Key=attachment_storage._get_key(attachment.path)
    )
    body = result["Body"]
    with TemporaryFile() as temporary:
        size = 0
        digest = hashlib.sha256()
        try:
            while chunk := body.read(CHUNK_SIZE):
                size += len(chunk)
                if size > attachment.size:
                    raise ValidationError("Stored attachment size no longer matches its record.")
                digest.update(chunk)
                temporary.write(chunk)
        finally:
            body.close()
        if size != attachment.size:
            raise ValidationError("Stored attachment size no longer matches its record.")
        temporary.seek(0)
        upload = UploadedFile(file=temporary, name=attachment.filename, content_type=attachment.content_type, size=size)
        validation = validate_upload(upload)
        validation.setdefault("metadata", {})["file_hash"] = digest.hexdigest()
        yield upload, validation


def import_attachment(tenant, actor, attachment, data, prepared=None):
    if not attachment.approved_at:
        raise ValidationError("Approve this attachment before importing it.")
    if prepared is None:
        with prepared_attachment(attachment) as prepared:
            return import_attachment(tenant, actor, attachment, data, prepared=prepared)
    upload, validation = prepared
    if data["destination"] == "designer":
        from webpages.models import PageTheme

        get_object_or_404(PageTheme, pk=data["theme_id"], tenant=tenant)
        try:
            replace_designer_asset(
                data["theme_id"],
                tenant,
                actor,
                data["asset_key"],
                upload,
                data["draft_version"],
                target_breakpoint=data.get("target_breakpoint"),
            )
        except DesignerDraftConflict as exc:
            raise Conflict(str(exc)) from exc
        except PermissionError as exc:
            raise PermissionDenied("Designer access is required.") from exc
        destination_id = str(data["theme_id"])
        destination_label = data["asset_key"]
    else:
        namespace = get_object_or_404(Namespace, pk=data["namespace"], tenant=tenant, kind=Namespace.KIND_CONTENT)
        if not user_can_access_namespace(actor, namespace):
            raise PermissionDenied("Media namespace access is required.")
        approval_data = {
            "title": data.get("title") or attachment.filename,
            "access_level": "members",
        }
        if "classification_ids" in data:
            approval_data["classification_ids"] = data["classification_ids"]
        else:
            approval_data["tag_ids"] = data.get("tag_ids", [])
        approval = MediaFileApprovalSerializer(
            data=approval_data,
            context={"namespace": namespace, "user": actor},
        )
        approval.is_valid(raise_exception=True)
        from types import SimpleNamespace

        from taxonomy.assignments import classification_ids, replace_assignments
        from taxonomy.projections import legacy_media_ids

        selected_ids = approval.validated_data.get("classification_ids")
        if selected_ids is None:
            selected_ids = legacy_media_ids(
                SimpleNamespace(namespace=namespace), approval.validated_data["tag_ids"], actor
            )
        Namespace.objects.select_for_update().get(pk=namespace.pk)
        digest = validation["metadata"]["file_hash"]
        # The existing media schema has a globally unique content hash. Never
        # reuse or disclose a different tenant's record, or hard-delete a tombstone.
        existing = MediaFile.objects.with_deleted().filter(file_hash=digest).first()
        if existing:
            if existing.tenant_id != tenant.pk or existing.is_deleted or existing.namespace_id != namespace.pk:
                raise Conflict(
                    "This content cannot be copied into this namespace under the current media deduplication rules."
                )
            if not filter_media_files_for_user(MediaFile.objects.filter(pk=existing.pk), actor, tenant=tenant).exists():
                raise Conflict("This content cannot be copied under the current media access rules.")
            media = existing
            replace_assignments(media, list(dict.fromkeys([*classification_ids(media), *selected_ids])), actor)
        else:
            media_id = uuid.uuid4()
            path = f"uploads/{tenant.pk}/kanban-imports/{media_id}/{attachment.filename}"
            saved = storage.save(path, upload)
            try:
                metadata = {"kanban": {"attachment_id": str(attachment.pk), "card_id": str(attachment.card_id)}}
                media = MediaFile.objects.create(
                    id=media_id,
                    tenant=tenant,
                    namespace=namespace,
                    title=approval.validated_data["title"],
                    slug=f"{slugify(attachment.filename)[:150]}-{media_id.hex[:8]}",
                    original_filename=attachment.filename,
                    file_path=saved,
                    file_url=storage.url(saved),
                    file_size=attachment.size,
                    width=(validation or {}).get("metadata", {}).get("width"),
                    height=(validation or {}).get("metadata", {}).get("height"),
                    content_type=attachment.content_type,
                    file_hash=digest,
                    uploaded_by=actor,
                    created_by=actor,
                    last_modified_by=actor,
                    file_type=storage.get_file_type(attachment.content_type),
                    access_level="members",
                    metadata=metadata,
                )
                replace_assignments(media, selected_ids, actor)
            except Exception:
                storage.delete(saved)
                raise
        destination_id = str(media.pk)
        destination_label = media.title
    record = AttachmentImport.objects.create(
        tenant=tenant,
        attachment=attachment,
        destination=data["destination"],
        destination_id=destination_id,
        destination_label=destination_label,
        imported_by=actor,
    )
    event(
        tenant,
        actor,
        attachment.card,
        "attachment.imported",
        f"Imported {attachment.filename} to {data['destination']}",
        {"attachment_id": str(attachment.pk), "import_id": str(record.pk), "destination_id": destination_id},
    )
    return record
