"""
Performance optimization utilities for the media management system.
"""

import time
import functools
import logging
from typing import Dict, Any, Optional, Callable
from django.core.cache import cache
from django.conf import settings
from django.db import connection
from django.utils import timezone
from datetime import timedelta
import hashlib
import json

logger = logging.getLogger(__name__)


class CacheManager:
    """
    Centralized cache management for media system.
    """

    # Cache key prefixes
    MEDIA_FILE_PREFIX = "media_file"
    THUMBNAIL_PREFIX = "thumbnail"
    SEARCH_PREFIX = "search"
    AI_ANALYSIS_PREFIX = "ai_analysis"
    USER_PERMISSIONS_PREFIX = "user_perms"

    # Cache timeouts (in seconds)
    TIMEOUTS = {
        "media_file": 3600,  # 1 hour
        "thumbnail": 86400,  # 24 hours
        "search": 300,  # 5 minutes
        "ai_analysis": 7200,  # 2 hours
        "user_permissions": 1800,  # 30 minutes
        "file_metadata": 3600,  # 1 hour
    }

    @classmethod
    def get_cache_key(cls, prefix: str, *args) -> str:
        """Generate cache key from prefix and arguments."""
        key_parts = [prefix] + [str(arg) for arg in args]
        return ":".join(key_parts)

    @classmethod
    def cache_media_file(
        cls, media_file_id: str, data: Dict, timeout: Optional[int] = None
    ) -> None:
        """Cache media file data."""
        key = cls.get_cache_key(cls.MEDIA_FILE_PREFIX, media_file_id)
        timeout = timeout or cls.TIMEOUTS["media_file"]
        cache.set(key, data, timeout)

    @classmethod
    def get_cached_media_file(cls, media_file_id: str) -> Optional[Dict]:
        """Get cached media file data."""
        key = cls.get_cache_key(cls.MEDIA_FILE_PREFIX, media_file_id)
        return cache.get(key)

    @classmethod
    def cache_search_results(
        cls, search_hash: str, results: Dict, timeout: Optional[int] = None
    ) -> None:
        """Cache search results."""
        key = cls.get_cache_key(cls.SEARCH_PREFIX, search_hash)
        timeout = timeout or cls.TIMEOUTS["search"]
        cache.set(key, results, timeout)

    @classmethod
    def get_cached_search_results(cls, search_params: Dict) -> Optional[Dict]:
        """Get cached search results."""
        search_hash = cls._hash_search_params(search_params)
        key = cls.get_cache_key(cls.SEARCH_PREFIX, search_hash)
        return cache.get(key)

    @classmethod
    def cache_user_permissions(
        cls, user_id: int, namespace_id: str, permissions: Dict
    ) -> None:
        """Cache user permissions for namespace."""
        key = cls.get_cache_key(cls.USER_PERMISSIONS_PREFIX, user_id, namespace_id)
        cache.set(key, permissions, cls.TIMEOUTS["user_permissions"])

    @classmethod
    def get_cached_user_permissions(
        cls, user_id: int, namespace_id: str
    ) -> Optional[Dict]:
        """Get cached user permissions."""
        key = cls.get_cache_key(cls.USER_PERMISSIONS_PREFIX, user_id, namespace_id)
        return cache.get(key)

    @classmethod
    def invalidate_media_file_cache(cls, media_file_id: str) -> None:
        """Invalidate all cache entries for a media file."""
        patterns = [
            cls.get_cache_key(cls.MEDIA_FILE_PREFIX, media_file_id),
            cls.get_cache_key(cls.THUMBNAIL_PREFIX, media_file_id, "*"),
            cls.get_cache_key(cls.AI_ANALYSIS_PREFIX, media_file_id),
        ]

        for pattern in patterns:
            if "*" in pattern:
                # Delete pattern-based keys (requires Redis)
                try:
                    cache.delete_pattern(pattern)
                except AttributeError:
                    # Fallback for non-Redis caches
                    pass
            else:
                cache.delete(pattern)

    @classmethod
    def invalidate_search_cache(cls) -> None:
        """Invalidate all search cache entries."""
        try:
            cache.delete_pattern(f"{cls.SEARCH_PREFIX}:*")
        except AttributeError:
            # Fallback for non-Redis caches
            pass

    @classmethod
    def _hash_search_params(cls, params: Dict) -> str:
        """Generate hash for search parameters."""
        # Sort params for consistent hashing
        sorted_params = json.dumps(params, sort_keys=True)
        return hashlib.md5(sorted_params.encode()).hexdigest()


def cache_result(timeout: int = 3600, key_func: Optional[Callable] = None):
    """
    Decorator to cache function results.

    Args:
        timeout: Cache timeout in seconds
        key_func: Function to generate cache key from arguments
    """

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                # Default key generation
                key_parts = [func.__name__] + [str(arg) for arg in args]
                if kwargs:
                    key_parts.extend([f"{k}:{v}" for k, v in sorted(kwargs.items())])
                cache_key = hashlib.md5(":".join(key_parts).encode()).hexdigest()

            # Try to get from cache
            result = cache.get(cache_key)
            if result is not None:
                return result

            # Execute function and cache result
            result = func(*args, **kwargs)
            cache.set(cache_key, result, timeout)
            return result

        return wrapper

    return decorator


class PerformanceMonitor:
    """
    Performance monitoring and optimization utilities.
    """

    @staticmethod
    def monitor_query_performance(func):
        """Decorator to monitor database query performance."""

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            queries_before = len(connection.queries)
            start_time = time.time()

            result = func(*args, **kwargs)

            end_time = time.time()
            queries_after = len(connection.queries)

            execution_time = end_time - start_time
            query_count = queries_after - queries_before

            if execution_time > 1.0:  # Log slow operations
                logger.warning(
                    f"Slow operation detected: {func.__name__} took {execution_time:.2f}s "
                    f"with {query_count} queries"
                )

            return result

        return wrapper

    @staticmethod
    def monitor_memory_usage(func):
        """Decorator to monitor memory usage."""

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            import psutil
            import os

            process = psutil.Process(os.getpid())
            memory_before = process.memory_info().rss / 1024 / 1024  # MB

            result = func(*args, **kwargs)

            memory_after = process.memory_info().rss / 1024 / 1024  # MB
            memory_diff = memory_after - memory_before

            if memory_diff > 50:  # Log significant memory increases
                logger.warning(
                    f"High memory usage detected: {func.__name__} used {memory_diff:.2f}MB"
                )

            return result

        return wrapper


class DatabaseOptimizer:
    """
    Database optimization utilities.
    """

    @staticmethod
    def optimize_media_queries():
        """Optimize common media file queries."""
        from django.db import connection

        optimizations = [
            # Index for file type and namespace filtering
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mediafile_namespace_type_created 
            ON file_manager_mediafile (namespace_id, file_type, created_at DESC);
            """,
            # Index for search functionality
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mediafile_search_vector 
            ON file_manager_mediafile USING GIN (
                to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(ai_extracted_text, ''))
            );
            """,
            # Index for access level filtering
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mediafile_access_user 
            ON file_manager_mediafile (access_level, created_by_id, namespace_id);
            """,
            # Partial index for recent files
            """
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mediafile_recent 
            ON file_manager_mediafile (created_at DESC) 
            WHERE created_at > NOW() - INTERVAL '30 days';
            """,
        ]

        with connection.cursor() as cursor:
            for optimization in optimizations:
                try:
                    cursor.execute(optimization)
                    logger.info(
                        f"Applied database optimization: {optimization[:50]}..."
                    )
                except Exception as e:
                    logger.error(f"Failed to apply optimization: {e}")

    @staticmethod
    def analyze_query_performance():
        """Analyze and log query performance statistics."""
        from django.db import connection

        queries = [
            # Most expensive queries
            """
            SELECT query, calls, total_time, mean_time, rows
            FROM pg_stat_statements 
            WHERE query LIKE '%file_manager_mediafile%'
            ORDER BY total_time DESC 
            LIMIT 10;
            """,
            # Index usage statistics
            """
            SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
            FROM pg_stat_user_indexes 
            WHERE tablename = 'file_manager_mediafile'
            ORDER BY idx_tup_read DESC;
            """,
        ]

        with connection.cursor() as cursor:
            for query in queries:
                try:
                    cursor.execute(query)
                    results = cursor.fetchall()
                    logger.info(f"Query performance analysis: {results}")
                except Exception as e:
                    logger.error(f"Failed to analyze query performance: {e}")


class FileProcessingOptimizer:
    """
    Optimize file processing operations.
    """

    @staticmethod
    def optimize_image_processing():
        """Optimize image processing settings."""
        try:
            from PIL import Image

            # Set optimal PIL settings
            Image.MAX_IMAGE_PIXELS = 200000000  # 200MP limit

            # Enable SIMD optimizations if available
            from PIL import features

            if features.check("libjpeg_turbo"):
                logger.info("JPEG Turbo optimization enabled")

        except ImportError:
            logger.warning("PIL not available for image optimization")

    @staticmethod
    def batch_thumbnail_generation(media_files, batch_size: int = 10):
        """Generate thumbnails in optimized batches."""
        from .storage import S3MediaStorage

        storage = S3MediaStorage()

        for i in range(0, len(media_files), batch_size):
            batch = media_files[i : i + batch_size]

            for media_file in batch:
                try:
                    if media_file.file_type == "image" and not hasattr(
                        media_file, "thumbnails"
                    ):
                        storage.generate_thumbnails(media_file)
                except Exception as e:
                    logger.error(
                        f"Thumbnail generation failed for {media_file.id}: {e}"
                    )

            # Small delay between batches to prevent overwhelming the system
            time.sleep(0.1)


class APIOptimizer:
    """
    API performance optimization utilities.
    """

    @staticmethod
    def optimize_serializer_queries(queryset, serializer_class):
        """Optimize queryset for serializer performance."""
        # Add select_related and prefetch_related based on serializer fields
        if hasattr(serializer_class, "Meta") and hasattr(
            serializer_class.Meta, "model"
        ):
            model = serializer_class.Meta.model

            # Common optimizations for MediaFile
            if model.__name__ == "MediaFile":
                queryset = queryset.select_related(
                    "namespace", "created_by", "last_modified_by"
                ).prefetch_related("tags", "collections")

        return queryset

    @staticmethod
    def paginate_efficiently(queryset, page_size: int = 20):
        """Implement efficient pagination."""
        # Use cursor pagination for large datasets
        if queryset.count() > 10000:
            # Implement cursor-based pagination
            return queryset.order_by("-created_at")[:page_size]
        else:
            # Use standard pagination for smaller datasets
            return queryset


class BackgroundTaskOptimizer:
    """
    Optimize background task processing.
    """

    @staticmethod
    def optimize_ai_analysis_queue():
        """Optimize AI analysis task queue."""
        from celery import current_app

        # Configure optimal queue settings
        current_app.conf.update(
            task_routes={
                "file_manager.tasks.analyze_media_file": {"queue": "ai_analysis"},
                "file_manager.tasks.generate_thumbnails": {"queue": "thumbnails"},
                "file_manager.tasks.cleanup_files": {"queue": "maintenance"},
            },
            worker_prefetch_multiplier=1,
            task_acks_late=True,
            worker_max_tasks_per_child=1000,
        )

    @staticmethod
    def batch_ai_analysis(media_files, batch_size: int = 5):
        """Process AI analysis in optimized batches."""
        from .tasks import analyze_media_file

        for i in range(0, len(media_files), batch_size):
            batch = media_files[i : i + batch_size]

            # Submit batch for processing
            for media_file in batch:
                analyze_media_file.delay(media_file.id)

            # Rate limiting to prevent API overload
            time.sleep(1)


# Performance monitoring context manager
class PerformanceContext:
    """Context manager for performance monitoring."""

    def __init__(self, operation_name: str):
        self.operation_name = operation_name
        self.start_time = None
        self.queries_before = None

    def __enter__(self):
        self.start_time = time.time()
        self.queries_before = len(connection.queries)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        end_time = time.time()
        queries_after = len(connection.queries)

        execution_time = end_time - self.start_time
        query_count = queries_after - self.queries_before

        logger.info(
            f"Performance: {self.operation_name} completed in {execution_time:.2f}s "
            f"with {query_count} queries"
        )

        # Log performance warnings
        if execution_time > 5.0:
            logger.warning(
                f"Slow operation: {self.operation_name} took {execution_time:.2f}s"
            )

        if query_count > 50:
            logger.warning(
                f"High query count: {self.operation_name} executed {query_count} queries"
            )


# Utility functions for common optimizations
def warm_cache():
    """Warm up cache with frequently accessed data."""
    from .models import MediaFile

    # Cache recent files
    recent_files = MediaFile.objects.filter(
        created_at__gte=timezone.now() - timedelta(days=7)
    ).select_related("namespace", "created_by")[:100]

    for media_file in recent_files:
        CacheManager.cache_media_file(
            str(media_file.id),
            {
                "title": media_file.title,
                "file_type": media_file.file_type,
                "file_size": media_file.file_size,
                "created_at": media_file.created_at.isoformat(),
            },
        )


def cleanup_expired_cache():
    """Clean up expired cache entries."""
    try:
        # This would require Redis-specific commands
        cache.delete_pattern("*:expired:*")
    except AttributeError:
        # Fallback for non-Redis caches
        pass
