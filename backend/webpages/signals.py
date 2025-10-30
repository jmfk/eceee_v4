"""
Widget Inheritance Cache Invalidation Signals

Automatically invalidates inheritance tree caches when pages or widgets change.
"""

from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from .models import WebPage, PageVersion
from .inheritance_cache import InheritanceTreeCache


@receiver(post_save, sender=WebPage)
def invalidate_page_tree_on_save(sender, instance, created, **kwargs):
    """Invalidate inheritance tree cache when page is saved and update children paths"""

    # Always invalidate the page and its descendants
    invalidated = InheritanceTreeCache.invalidate_page(instance.id)

    # If parent changed, invalidate old and new hierarchies
    if hasattr(instance, "_old_parent_id"):
        old_parent_id = instance._old_parent_id
        new_parent_id = instance.parent_id

        if old_parent_id != new_parent_id:
            # Invalidate old parent hierarchy
            if old_parent_id:
                InheritanceTreeCache.invalidate_hierarchy(old_parent_id)

            # Invalidate new parent hierarchy
            if new_parent_id:
                InheritanceTreeCache.invalidate_hierarchy(new_parent_id)

    # Update children cached_path if this page's path changed
    if hasattr(instance, "_skip_children_path_update"):
        return

    old_path = getattr(instance, "_old_cached_path", None)
    if old_path and old_path != instance.cached_path:
        # Path changed - update all children recursively
        for child in instance.children.all():
            child._skip_children_path_update = True
            child.save(
                update_fields=["cached_path", "cached_root_id", "cached_root_hostnames"]
            )
            delattr(child, "_skip_children_path_update")


@receiver(pre_save, sender=WebPage)
def track_parent_changes(sender, instance, **kwargs):
    """Track parent changes for cache invalidation and update cached_path"""
    # Track old parent for cache invalidation
    if instance.pk:
        try:
            old_instance = WebPage.objects.get(pk=instance.pk)
            instance._old_parent_id = old_instance.parent_id
            instance._old_cached_path = old_instance.cached_path
        except WebPage.DoesNotExist:
            instance._old_parent_id = None
            instance._old_cached_path = None

    # Calculate and update cached_path
    if instance.parent:
        parent_path = instance.parent.cached_path or instance.parent.get_absolute_url()
        slug_part = (instance.slug or "").strip("/")
        instance.cached_path = f"{parent_path.rstrip('/')}/{slug_part}/"
    else:
        # Root page
        if instance.hostnames:
            instance.cached_path = "/"
        else:
            slug_part = (instance.slug or "").strip("/")
            instance.cached_path = f"/{slug_part}/"

    # Calculate and update cached root information
    root_page = (
        instance.get_root_page()
        if instance.pk
        else (instance if not instance.parent else None)
    )
    if root_page:
        instance.cached_root_id = root_page.id if root_page.pk else None
        instance.cached_root_hostnames = root_page.hostnames or []
    elif not instance.parent:
        # This is a new root page being created
        instance.cached_root_id = None  # Will be set after save
        instance.cached_root_hostnames = instance.hostnames or []
    else:
        instance.cached_root_id = None
        instance.cached_root_hostnames = []


@receiver(post_save, sender=PageVersion)
def invalidate_version_tree_on_save(sender, instance, created, **kwargs):
    """Invalidate inheritance tree cache when page version is saved"""

    # Invalidate page and all descendants (they inherit from this page)
    invalidated = InheritanceTreeCache.invalidate_page(instance.page_id)

    # Update publication cache for the page
    update_page_publication_cache(instance.page)


@receiver(post_delete, sender=WebPage)
def invalidate_tree_on_page_delete(sender, instance, **kwargs):
    """Invalidate inheritance tree cache when page is deleted"""

    # Invalidate entire hierarchy (parent and all descendants)
    invalidated = InheritanceTreeCache.invalidate_hierarchy(instance.id)


@receiver(post_delete, sender=PageVersion)
def invalidate_tree_on_version_delete(sender, instance, **kwargs):
    """Invalidate inheritance tree cache when page version is deleted"""

    # Invalidate page and descendants
    invalidated = InheritanceTreeCache.invalidate_page(instance.page_id)

    # Update publication cache for the page
    try:
        page = WebPage.objects.get(id=instance.page_id)
        update_page_publication_cache(page)
    except WebPage.DoesNotExist:
        pass  # Page was deleted, nothing to update


def update_page_publication_cache(page):
    """
    Update all cached publication fields for a page.
    Called whenever versions change.
    """
    from django.utils import timezone
    from django.db.models import Q

    now = timezone.now()

    # Find current published version
    published_version = (
        page.versions.filter(effective_date__lte=now)
        .filter(Q(expiry_date__isnull=True) | Q(expiry_date__gt=now))
        .order_by("-version_number")
        .first()
    )

    # Find latest version (any status)
    latest = page.versions.order_by("-version_number").first()

    # Update cached fields
    page.is_currently_published = published_version is not None
    page.current_published_version = published_version
    page.latest_version = latest

    if published_version:
        page.cached_effective_date = published_version.effective_date
        page.cached_expiry_date = published_version.expiry_date
    else:
        page.cached_effective_date = None
        page.cached_expiry_date = None

    # Save without triggering signals recursively
    page.save(
        update_fields=[
            "is_currently_published",
            "current_published_version",
            "latest_version",
            "cached_effective_date",
            "cached_expiry_date",
            "cache_updated_at",
        ]
    )


# Utility functions for manual cache management


def invalidate_inheritance_cache_for_page(page_id: int) -> int:
    """Manually invalidate inheritance cache for a page"""
    return InheritanceTreeCache.invalidate_page(page_id)


def warm_inheritance_cache_for_page(page_id: int) -> bool:
    """Manually warm inheritance cache for a page"""
    return InheritanceTreeCache.warm_cache(page_id)


def get_inheritance_cache_stats() -> dict:
    """Get cache statistics for monitoring"""
    return InheritanceTreeCache.get_cache_stats()
