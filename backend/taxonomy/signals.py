"""Compatibility writers converge on the same assignment boundary."""

from django.db.models.signals import m2m_changed, post_save
from rest_framework.exceptions import PermissionDenied

from .context import current_actor, projecting, projection_context
from .models import ClassificationRollout


def canonical_phase(namespace_id):
    return ClassificationRollout.objects.filter(namespace_id=namespace_id, phase="canonical").exists()


def media_changed(sender, instance, action, reverse, model, pk_set, **kwargs):
    if projecting() or not action.startswith("post_"):
        return
    if reverse:
        # Reverse relation mutations are supported, with the same actor gate.
        if pk_set is None:
            return  # reverse clear is blocked in pre_clear below after activation
        for resource in model.objects.filter(pk__in=pk_set):
            media_changed(sender, resource, action, False, type(instance), set(), **kwargs)
        return
    user = current_actor()
    if not user or not user.is_authenticated:
        if canonical_phase(instance.namespace_id):
            raise PermissionDenied("Classification writes require an explicit actor.")
        return
    from .projections import sync_legacy_media

    canonical = sender in {instance.canonical_tags.through}
    with projection_context():
        sync_legacy_media(instance, user, canonical=canonical)


def reverse_clear(sender, instance, action, reverse, **kwargs):
    if reverse and action == "pre_clear" and not projecting():
        if canonical_phase(instance.namespace_id):
            raise PermissionDenied("Remove assignments through the content API so mandatory classification is checked.")


def version_saved(sender, instance, raw=False, **kwargs):
    if raw or projecting():
        return
    if (
        instance._meta.label_lower == "webpages.pageversion"
        and not instance.tags
        and not instance.canonical_tag_links.exists()
    ):
        return
    user = current_actor()
    if user and user.is_authenticated:
        from .projections import sync_legacy_version

        with projection_context():
            sync_legacy_version(instance, user)


def connect():
    from file_manager.models import MediaCollection, MediaFile
    from object_storage.models import ObjectVersion
    from webpages.models import PageVersion

    for model in (MediaFile, MediaCollection):
        for field in ("tags", "canonical_tags"):
            through = getattr(model, field).through
            m2m_changed.connect(media_changed, sender=through, dispatch_uid=f"taxonomy-{model._meta.label}-{field}")
            m2m_changed.connect(
                reverse_clear, sender=through, dispatch_uid=f"taxonomy-clear-{model._meta.label}-{field}"
            )
    for model in (PageVersion, ObjectVersion):
        post_save.connect(version_saved, sender=model, dispatch_uid=f"taxonomy-version-{model._meta.label}")
