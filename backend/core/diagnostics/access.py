"""Machine-only authorization independent of CMS fallback tenants and human roles."""

import hashlib
import json
import uuid
from datetime import timedelta
from datetime import timezone as datetime_timezone

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.utils import timezone
from rest_framework import exceptions, permissions
from rest_framework.throttling import SimpleRateThrottle

from core.machine_api_keys import DIAGNOSTICS_GLOBAL_READ, _required_scope
from core.models import MachineAPIKey


class Unavailable(exceptions.APIException):
    status_code = 503
    default_detail = "Diagnostics unavailable or not provisioned."


class Gone(exceptions.APIException):
    status_code = 410
    default_detail = "Diagnostic cursor or history expired; restart the search."


class DiagnosticPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if not getattr(settings, "DIAGNOSTICS_ENABLED", False):
            raise Unavailable()
        return (
            isinstance(request.auth, MachineAPIKey)
            and request.user.is_active
            and _required_scope(request) in request.auth.scopes
        )


class DiagnosticThrottle(SimpleRateThrottle):
    rate = "30/min"
    scope = "diagnostics"

    def get_cache_key(self, request, view):
        if not isinstance(request.auth, MachineAPIKey):
            return None
        return self.cache_format % {"scope": self.scope, "ident": str(request.auth.pk)}


def tenants_for(request, value):
    allowed = set(str(pk) for pk in request.auth.tenants.filter(is_active=True).values_list("pk", flat=True))
    if value == "all_allowed":
        selected = allowed
    elif isinstance(value, list) and 0 < len(value) <= 100:
        selected = set(value) if all(isinstance(v, str) for v in value) else set()
    elif isinstance(value, str) and value:
        selected = {value}
    else:
        raise exceptions.ValidationError({"tenants": "Select tenant UUIDs or all_allowed explicitly."})
    if not selected or not selected <= allowed:
        raise exceptions.PermissionDenied("Tenant selection is not permitted.")
    return sorted(selected)


def global_allowed(request):
    return DIAGNOSTICS_GLOBAL_READ in request.auth.scopes


def require_global(request):
    if not global_allowed(request):
        raise exceptions.PermissionDenied("Explicit global diagnostic access is required.")


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def read_cursor(token, request, query):
    if not token:
        return None
    try:
        identifier = signing.loads(token, salt="eceee.diagnostics.v1", max_age=3600)
        identifier = str(uuid.UUID(identifier))
        state = cache.get("diagnostic-cursor:" + identifier)
        if not isinstance(state, dict):
            raise ValueError()
        if state["key"] != str(request.auth.pk) or state["query"] != fingerprint(query):
            raise ValueError()
        return state
    except (signing.BadSignature, ValueError, KeyError, TypeError):
        raise Gone() from None


def make_cursor(request, query, **state):
    # Opaque cursors do not reveal scan offsets/counts for other tenants or global records.
    identifier = str(uuid.uuid4())
    cache.set(
        "diagnostic-cursor:" + identifier,
        {"key": str(request.auth.pk), "query": fingerprint(query), **state},
        timeout=3600,
    )
    return signing.dumps(identifier, salt="eceee.diagnostics.v1")


def time_window(start, end):
    end = end or timezone.now()
    start = start or end - timedelta(hours=1)
    if start > end or end - start > timedelta(hours=24):
        raise exceptions.ValidationError("Search interval must be between zero and 24 hours.")
    return start.astimezone(datetime_timezone.utc).isoformat(), end.astimezone(datetime_timezone.utc).isoformat()
