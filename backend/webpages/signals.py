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
    """Invalidate inheritance tree cache when page is saved"""

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


@receiver(pre_save, sender=WebPage)
def track_parent_changes(sender, instance, **kwargs):
    """Track parent changes for cache invalidation"""
    if instance.pk:
        try:
            old_instance = WebPage.objects.get(pk=instance.pk)
            instance._old_parent_id = old_instance.parent_id
        except WebPage.DoesNotExist:
            instance._old_parent_id = None


@receiver(post_save, sender=PageVersion)
def invalidate_version_tree_on_save(sender, instance, created, **kwargs):
    """Invalidate inheritance tree cache when page version is saved"""

    # Invalidate page and all descendants (they inherit from this page)
    invalidated = InheritanceTreeCache.invalidate_page(instance.page_id)


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
