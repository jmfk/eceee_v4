"""
Widget Inheritance Tree Caching

Provides efficient caching for inheritance trees with smart invalidation.
"""

import hashlib
from typing import Optional
from django.core.cache import cache
from django.utils import timezone
from .models import WebPage
from .inheritance_tree import InheritanceTreeBuilder
from .inheritance_types import InheritanceTreeNode


class InheritanceTreeCache:
    """Caching manager for inheritance trees"""

    CACHE_PREFIX = "inheritance_tree"
    DEFAULT_TIMEOUT = 3600  # 1 hour

    @classmethod
    def get_cache_key(cls, page_id: int) -> str:
        """Generate cache key for a page's inheritance tree"""
        version_hash = cls._get_version_hash(page_id)
        return f"{cls.CACHE_PREFIX}:{page_id}:{version_hash}"

    @classmethod
    def _get_version_hash(cls, page_id: int) -> str:
        """Generate hash based on page and all ancestor versions"""
        try:
            page = WebPage.objects.get(id=page_id)
            version_data = []

            # Collect version data from entire inheritance chain
            current = page
            while current:
                version = (
                    current.get_current_published_version()
                    or current.get_latest_version()
                )
                if version:
                    # Include version timestamp and widget data hash
                    version_data.append(
                        {
                            "page_id": current.id,
                            "version_id": version.id,
                            "updated_at": (
                                version.updated_at.isoformat()
                                if version.updated_at
                                else ""
                            ),
                            "widgets_hash": hashlib.md5(
                                str(version.widgets).encode()
                                if version.widgets
                                else b""
                            ).hexdigest(),
                        }
                    )
                current = current.parent

            # Create hash from all version data
            version_string = str(sorted(version_data, key=lambda x: x["page_id"]))
            return hashlib.md5(version_string.encode()).hexdigest()[:16]

        except WebPage.DoesNotExist:
            # Return timestamp-based hash if page not found
            return hashlib.md5(str(timezone.now().timestamp()).encode()).hexdigest()[
                :16
            ]

    @classmethod
    def get_tree(cls, page_id: int, force_rebuild: bool = False) -> InheritanceTreeNode:
        """
        Get inheritance tree from cache or build if not cached.

        Args:
            page_id: Page ID to get tree for
            force_rebuild: Skip cache and rebuild tree

        Returns:
            InheritanceTreeNode: Cached or newly built tree
        """
        if not force_rebuild:
            cache_key = cls.get_cache_key(page_id)
            cached_tree = cache.get(cache_key)

            if cached_tree:
                return cached_tree

        # Build new tree
        try:
            page = WebPage.objects.select_related("parent").get(id=page_id)
            builder = InheritanceTreeBuilder()
            tree = builder.build_tree(page)

            # Cache the tree
            cache_key = cls.get_cache_key(page_id)
            cache.set(cache_key, tree, cls.DEFAULT_TIMEOUT)

            return tree

        except WebPage.DoesNotExist:
            raise ValueError(f"Page with ID {page_id} not found")

    @classmethod
    def invalidate_page(cls, page_id: int) -> int:
        """
        Invalidate cache for a page and all its descendants.

        Args:
            page_id: Page ID to invalidate

        Returns:
            Number of cache keys invalidated
        """
        invalidated_count = 0

        try:
            page = WebPage.objects.get(id=page_id)

            # Invalidate this page
            cache_key = cls.get_cache_key(page_id)
            cache.delete(cache_key)
            invalidated_count += 1

            # Invalidate all descendants recursively
            invalidated_count += cls._invalidate_descendants(page)

        except WebPage.DoesNotExist:
            pass

        return invalidated_count

    @classmethod
    def _invalidate_descendants(cls, page: WebPage) -> int:
        """Recursively invalidate all descendant pages"""
        count = 0

        # Get direct children
        children = WebPage.objects.filter(parent=page)

        for child in children:
            # Invalidate child
            cache_key = cls.get_cache_key(child.id)
            cache.delete(cache_key)
            count += 1

            # Recursively invalidate child's descendants
            count += cls._invalidate_descendants(child)

        return count

    @classmethod
    def invalidate_hierarchy(cls, page_id: int) -> int:
        """
        Invalidate cache for entire page hierarchy (ancestors + descendants).

        Args:
            page_id: Page ID to start invalidation from

        Returns:
            Number of cache keys invalidated
        """
        invalidated_count = 0

        try:
            page = WebPage.objects.select_related("parent").get(id=page_id)

            # Invalidate ancestors (they might inherit from changed page)
            current = page
            while current:
                cache_key = cls.get_cache_key(current.id)
                cache.delete(cache_key)
                invalidated_count += 1
                current = current.parent

            # Invalidate descendants (they inherit from this page)
            invalidated_count += cls._invalidate_descendants(page)

        except WebPage.DoesNotExist:
            pass

        return invalidated_count

    @classmethod
    def warm_cache(cls, page_id: int) -> bool:
        """
        Warm cache by pre-building tree for a page.

        Args:
            page_id: Page ID to warm cache for

        Returns:
            True if cache was warmed successfully
        """
        try:
            cls.get_tree(page_id, force_rebuild=True)
            return True
        except Exception:
            return False

    @classmethod
    def get_cache_stats(cls) -> dict:
        """Get cache statistics for monitoring"""
        # This would require Redis info or custom tracking
        # For now, return basic info
        return {
            "cache_prefix": cls.CACHE_PREFIX,
            "default_timeout": cls.DEFAULT_TIMEOUT,
            "timestamp": timezone.now().isoformat(),
        }


# Convenience functions
def get_cached_tree(page_id: int) -> InheritanceTreeNode:
    """Get inheritance tree with caching"""
    return InheritanceTreeCache.get_tree(page_id)


def invalidate_page_tree(page_id: int) -> int:
    """Invalidate tree cache for page and descendants"""
    return InheritanceTreeCache.invalidate_page(page_id)
