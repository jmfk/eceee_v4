"""Promote reviewed article illustrations into the tenant's media library."""

import mimetypes
import re

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response

from content.models import Namespace
from core.roles import permissions_for
from file_manager.models import MediaFile
from file_manager.security import filter_media_files_for_user, user_can_access_namespace
from file_manager.serializers import MediaFileListSerializer
from file_manager.storage import checkpoint_storage, storage
from kanban.files import validate_image
from taxonomy.assignments import replace_assignments, validate_media_selection
from taxonomy.media_origin import ORIGIN_TYPE, system_ai_term
from taxonomy.models import Tag

from ..models import ArticleImageCandidate
from .article_image_candidates import require_article_image_access

MAX_BYTES = 10 * 1024 * 1024


class CandidateMediaInput(serializers.Serializer):
    classification_ids = serializers.ListField(child=serializers.UUIDField(), required=False, default=list)


def suggested_media_terms(article, text):
    namespace = article_media_namespace(article)
    words = re.findall(r"\w+", text.casefold())
    normalized = f" {' '.join(words)} "
    approved = Tag.objects.filter(namespace=namespace, tenant=article.tenant, status="approved").select_related(
        "classification_type"
    )
    terms = []
    for term in approved.iterator():
        definition = term.classification_type
        if not definition or definition.key == ORIGIN_TYPE or "media_files" not in definition.allowed_uses:
            continue
        labels = [term.name, *term.alternative_names]
        if any(
            f" {' '.join(parts)} " in normalized
            for label in labels
            if isinstance(label, str) and (parts := re.findall(r"\w+", label.casefold()))
        ):
            terms.append(str(term.pk))
            if len(terms) >= 8:
                break
    return terms


def article_media_namespace(article):
    namespace = article.object_type.namespace
    if namespace and namespace.tenant_id == article.tenant_id:
        return namespace
    return Namespace.get_default(tenant=article.tenant)


def candidate_media_response(request, article, candidate_id):
    require_article_image_access(request, article)
    if "media.write" not in permissions_for(request.user, request.tenant):
        raise PermissionDenied("Saving an AI image requires media editing access.")
    namespace = article_media_namespace(article)
    if namespace.is_hidden or not user_can_access_namespace(request.user, namespace):
        raise PermissionDenied("This media namespace is unavailable.")
    inputs = CandidateMediaInput(data=request.data)
    inputs.is_valid(raise_exception=True)

    path = None
    try:
        with transaction.atomic():
            # Keep the same namespace-before-media lock order as taxonomy edits.
            Namespace.objects.select_for_update().get(pk=namespace.pk)
            candidate = (
                ArticleImageCandidate.objects.select_for_update()
                .filter(
                    Q(expires_at__gt=timezone.now()) | Q(saved_media__isnull=False), pk=candidate_id, article=article
                )
                .first()
            )
            if candidate is None:
                raise NotFound("This image variant has expired or no longer exists.")
            if candidate.saved_media_id:
                media = (
                    filter_media_files_for_user(MediaFile.objects.all(), request.user, article.tenant)
                    .filter(
                        pk=candidate.saved_media_id, tenant=article.tenant, namespace=namespace, is_ai_generated=True
                    )
                    .first()
                )
                if media is None:
                    raise NotFound("The saved image is no longer available.")
            else:
                source = article.versions.filter(pk=candidate.source_version_id).first()
                title = source.content_title if source else article.title
                term = system_ai_term(namespace)
                selected = inputs.validated_data["classification_ids"]
                ids = validate_media_selection(namespace, request.user, selected) if selected else []
                ids.append(str(term.pk))
                with checkpoint_storage._open(candidate.file_path) as source:
                    image_bytes = source.read(MAX_BYTES + 1)
                upload = SimpleUploadedFile("article-illustration.png", image_bytes, content_type="image/png")
                validate_image(upload)
                suffix = mimetypes.guess_extension(upload.content_type) or ".png"
                upload.name = f"article-illustration{suffix}"
                result = storage.upload_file(upload, f"{namespace.slug}/ai-illustrations")
                path = result.pop("file_path")
                media = MediaFile.create_with_hash_cleanup(
                    **result,
                    title=f"{title[:238]} – AI illustration",
                    original_filename=upload.name,
                    file_path=path,
                    file_url=storage.get_public_url(path),
                    file_type="image",
                    is_ai_generated=True,
                    namespace=namespace,
                    tenant=article.tenant,
                    uploaded_by=request.user,
                    created_by=request.user,
                    last_modified_by=request.user,
                )
                replace_assignments(media, ids, request.user)
                candidate.saved_media = media
                candidate.save(update_fields=["saved_media"])
    except Exception:
        if path:
            storage.delete(path)
        raise
    return Response(MediaFileListSerializer(media, context={"request": request}).data)
