"""Cache operations that remain inside ECEEE's shared-Redis namespace."""

from __future__ import annotations

from django.core.cache import cache


def clear_project_cache(cache_backend=None) -> int:
    """Delete only keys produced through this configured Django cache."""
    backend = cache_backend or cache
    redis_client = getattr(backend, "_cache", None)
    if redis_client is not None and hasattr(redis_client, "get_client"):
        client = redis_client.get_client(None, write=True)
        keys = list(client.scan_iter(match=backend.make_key("*"), count=500))
        if keys:
            client.delete(*keys)
        return len(keys)

    backend_module = backend.__class__.__module__
    if backend_module.startswith("django.core.cache.backends.locmem"):
        backend.clear()
        return 0
    raise RuntimeError("cache backend does not support namespace-scoped clearing")
