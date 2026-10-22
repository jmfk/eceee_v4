"""Read-only reconciliation report and explicit, guarded namespace activation."""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import ClassificationRollout, LegacyTagMapping, TagBackfillRun
from .services import resolve_term


def reconciliation_report(namespace):
    from file_manager.models import MediaCollection, MediaFile

    errors = []
    counts = {}
    for kind, objects in (
        ("media_files", MediaFile.objects.filter(namespace=namespace)),
        ("media_collections", MediaCollection.objects.filter(namespace=namespace)),
    ):
        counts[kind] = objects.count()
        for obj in objects.prefetch_related(
            "classification_links__tag__classification_type", "tags", "canonical_tags"
        ).iterator(chunk_size=200):
            links = list(obj.classification_links.all())
            if not links:
                errors.append({"kind": kind, "id": str(obj.pk), "error": "missing_required_classification"})
                continue
            resolved = []
            for link in links:
                term = resolve_term(link.tag)
                if (
                    term.namespace_id != namespace.pk
                    or term.tenant_id != namespace.tenant_id
                    or not term.classification_type_id
                    or term.classification_type.namespace_id != namespace.pk
                    or term.classification_type.tenant_id != namespace.tenant_id
                    or term.classification_type.key != term.tag_type
                    or term.status not in {"approved", "archived"}
                ):
                    errors.append({"kind": kind, "id": str(obj.pk), "error": "invalid_classification_scope_or_status"})
                resolved.append(str(term.pk))
            legacy = LegacyTagMapping.objects.filter(
                source_kind="media", source_id__in=[str(tag.pk) for tag in obj.tags.all()]
            ).select_related("canonical_tag")
            if legacy.count() != len(list(obj.tags.all())):
                errors.append({"kind": kind, "id": str(obj.pk), "error": "unmapped_legacy_tag"})
            legacy_ids = {str(resolve_term(mapping.canonical_tag).pk) for mapping in legacy}
            if set(resolved) != legacy_ids or set(resolved) != {
                str(resolve_term(tag).pk) for tag in obj.canonical_tags.all()
            }:
                errors.append({"kind": kind, "id": str(obj.pk), "error": "compatibility_projection_mismatch"})
    return {
        "namespace_id": namespace.pk,
        "tenant_id": str(namespace.tenant_id),
        "counts": counts,
        "errors": errors,
        "ready": not errors,
    }


@transaction.atomic
def activate(namespace, user, run_id):
    # All content serializers and assignment writers take the same namespace lock.
    from content.models import Namespace

    namespace = Namespace.objects.select_for_update().get(pk=namespace.pk)
    if not (user.is_superuser or namespace.tenant.created_by_id == user.pk):
        from rest_framework.exceptions import PermissionDenied

        raise PermissionDenied("Only the tenant owner may activate the classification cutover.")
    run = TagBackfillRun.objects.get(pk=run_id, status="complete")
    import os

    from .management.commands.reconcile_classifications import Command

    command = Command()
    command._assert_legacy_coverage()
    command.batch_size = 500
    fingerprint, total = command._source_fingerprint()
    command._assert_run_identity(
        run,
        fingerprint,
        command._config_fingerprint(),
        os.environ.get("APP_VERSION") or os.environ.get("GIT_COMMIT_HASH") or "unknown",
    )
    command._verify(run, total)
    report = reconciliation_report(namespace)
    if not report["ready"]:
        raise ValidationError(report)
    rollout, _ = ClassificationRollout.objects.update_or_create(
        namespace=namespace,
        defaults={
            "phase": "canonical",
            "verified_run": run,
            "activated_by": user,
            "activated_at": timezone.now(),
        },
    )
    return report
