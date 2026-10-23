"""Bounded per-user server error metadata, without bodies, headers or log text."""
import uuid
from django.core.cache import cache
from django.utils import timezone


def key(request):
    return f"support-diagnostics:{request.tenant.pk}:{request.user.pk}"


def record(request, response):
    if response.status_code < 500 or not getattr(request, 'tenant', None) or not request.user.is_authenticated:
        return
    event = {
        'time': timezone.now().isoformat(),
        'status': response.status_code,
        'view': str(getattr(getattr(request, 'resolver_match', None), 'view_name', '') or '')[:150],
        'request_id': str(uuid.uuid4()),
    }
    try:
        events = cache.get(key(request), [])
        cache.set(key(request), (events + [event])[-20:], 3600)
    except Exception:
        pass  # Diagnostic capture must never break the original request.


def recent(request):
    try:
        return cache.get(key(request), [])
    except Exception:
        return []
