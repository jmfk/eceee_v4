"""Conservative diagnostic events: no messages, arguments, locals, headers or bodies."""

import hashlib
import hmac
import json
import logging
import re
import traceback
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from pathlib import Path

PREFIX = "ECEEE_DIAGNOSTIC_V1 "
TENANT = ContextVar("diagnostic_tenant", default=None)
REQUEST_ID = ContextVar("diagnostic_request_id", default=None)
ERRORS = frozenset(
    {
        "Exception",
        "ValueError",
        "TypeError",
        "KeyError",
        "AttributeError",
        "IndexError",
        "RuntimeError",
        "PermissionError",
        "FileNotFoundError",
        "TimeoutError",
        "ConnectionError",
        "OSError",
        "AssertionError",
        "IntegrityError",
        "OperationalError",
        "DatabaseError",
        "DataError",
        "ProgrammingError",
        "ValidationError",
        "DoesNotExist",
        "MultipleObjectsReturned",
        "Http404",
        "PermissionDenied",
        "SuspiciousOperation",
        "DisallowedHost",
        "TemplateDoesNotExist",
        "TemplateSyntaxError",
        "ImproperlyConfigured",
        "ImportError",
        "ModuleNotFoundError",
        "NotImplementedError",
        "UnicodeDecodeError",
        "OverflowError",
        "ZeroDivisionError",
    }
)
LEVELS = {"ERROR", "CRITICAL", "WARNING", "INFO"}
SERVICES = (
    "backend",
    "publisher",
    "celery-worker",
    "celery-beat",
    "caddy",
    "frontend",
    "db",
    "redis",
    "imgproxy",
    "playwright",
)
# Only repository-relative Python paths are allowed. Installed-library and home paths are omitted.
ROOTS = {
    "core",
    "webpages",
    "config",
    "content",
    "object_storage",
    "file_manager",
    "tenant_support",
    "utils",
    "kanban",
    "ai_tracking",
    "content_migration",
    "taxonomy",
}


def uuid_text(value):
    try:
        return str(uuid.UUID(str(value)))
    except (ValueError, TypeError, AttributeError):
        return None


def safe_frame(filename, lineno, function):
    if not isinstance(filename, str):
        return None
    parts = Path(filename).parts
    indexes = [i for i, part in enumerate(parts) if part in ROOTS]
    if not indexes:
        return None
    filename = "/".join(parts[indexes[0] :])
    if len(filename) > 180 or not re.fullmatch(r"[a-zA-Z0-9_/]+\.py", filename):
        return None
    if not isinstance(lineno, int) or not 0 < lineno < 1000000:
        return None
    # Function names can contain dynamically supplied text; retain only conventional symbols.
    function = (
        function if isinstance(function, str) and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]{0,79}", function) else "unknown"
    )
    return {"file": filename, "line": lineno, "function": function}


def sanitize_event(raw, service, *, trusted=False):
    if service not in SERVICES or not isinstance(raw, dict):
        return None
    try:
        when = datetime.fromisoformat(raw["time"].replace("Z", "+00:00"))
        if when.tzinfo is None:
            return None
    except (KeyError, ValueError, TypeError, AttributeError):
        return None
    error = raw.get("error_class")
    if not isinstance(error, str) or error not in ERRORS:
        error = "Exception"
    frames = []
    for item in raw.get("frames", [])[:20] if isinstance(raw.get("frames", []), list) else []:
        if isinstance(item, dict):
            frame = safe_frame(item.get("file", ""), item.get("line"), item.get("function"))
            if frame:
                frames.append(frame)
    group = hashlib.sha256(json.dumps([error, frames], sort_keys=True).encode()).hexdigest()[:24]
    event = {
        "time": when.astimezone(timezone.utc).isoformat(),
        "service": service,
        "level": raw.get("level") if isinstance(raw.get("level"), str) and raw["level"] in LEVELS else "ERROR",
        "error_class": error,
        "message": f"{error} (message withheld)",
        "frames": frames,
        "tenant_id": uuid_text(raw.get("tenant_id")) if trusted else None,
        "request_id": uuid_text(raw.get("request_id")) if trusted else None,
        "group_id": group,
    }
    # A signed random event ID distinguishes repeated identical exceptions.
    identity = uuid_text(raw.get("event_id")) if trusted else None
    event["id"] = hashlib.sha256(json.dumps([event, identity], sort_keys=True).encode()).hexdigest()
    return event


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def decode_signed(line, service, signing_key):
    if not line.startswith(PREFIX) or len(line) > 32768 or not signing_key:
        return None
    try:
        envelope = json.loads(line[len(PREFIX) :])
        payload = envelope["event"]
        signature = hmac.new(signing_key, canonical(payload), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, envelope["signature"]):
            return None
        return sanitize_event(payload, service, trusted=True)
    except (KeyError, TypeError, ValueError, AttributeError):
        return None


class DiagnosticHandler(logging.Handler):
    """Emit signed metadata only; a collector can authenticate tenant attribution."""

    def emit(self, record):
        try:
            import sys

            from django.conf import settings

            if not getattr(settings, "DIAGNOSTICS_ENABLED", False) or not record.exc_info:
                return
            key = getattr(settings, "DIAGNOSTICS_LOG_SIGNING_KEY", "").encode()
            if len(key) < 32:
                return
            frames = []
            for frame in traceback.extract_tb(record.exc_info[2])[-20:]:
                safe = safe_frame(frame.filename, frame.lineno, frame.name)
                if safe:
                    frames.append(safe)
            payload = {
                "time": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
                "level": record.levelname,
                "error_class": record.exc_info[0].__name__,
                "tenant_id": TENANT.get(),
                "request_id": REQUEST_ID.get(),
                "event_id": str(uuid.uuid4()),
                "frames": frames,
            }
            event = sanitize_event(payload, "backend", trusted=True)
            event["event_id"] = payload["event_id"]
            envelope = {"event": event, "signature": hmac.new(key, canonical(event), hashlib.sha256).hexdigest()}
            sys.stderr.write(PREFIX + canonical(envelope).decode() + "\n")
        except Exception:
            # Diagnostic emission must never change the application's outcome or print raw exceptions.
            return


class AuditFormatter(logging.Formatter):
    def format(self, record):
        metadata = getattr(record, "diagnostic_audit", {})
        return json.dumps({"event": "diagnostic_operation", **metadata}, sort_keys=True)
