"""Allowlisted, bounded diagnostics; never collect request bodies or unrestricted logs."""

import json
import re
import uuid

from django.utils import timezone

from .models import MessageAttachment


def redact(value):
    value = str(value)[:1000]
    value = re.sub(r"bearer\s+\S+", "[redacted]", value, flags=re.IGNORECASE)
    value = re.sub(r"https?://[^\s]+", "[URL]", value)
    value = re.sub(
        r"[\w-]*(?:password|secret|token|api[_-]?key|authorization|cookie)[\w-]*[\"']?\s*[:=]\s*"
        r"(?:\"(?:\\[\s\S]?|[^\"\\])*(?:\"|$)|'(?:\\[\s\S]?|[^'\\])*(?:'|$)|[^\s,;}]+)",
        "[redacted]",
        value,
        flags=re.IGNORECASE,
    )
    value = re.sub(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b", "[redacted]", value)
    value = re.sub(r"\bsk-[A-Za-z0-9_-]+\b", "[redacted]", value)
    return value


def attach_diagnostics(request, message, supplied):
    supplied = supplied if isinstance(supplied, dict) else {}
    logs = supplied.get("errors", [])
    # Stack traces, local storage, cookies, headers and arbitrary console arguments are excluded.
    errors = (
        [
            {key: redact(row.get(key, "")) for key in ("name", "message", "time")}
            for row in logs[:20]
            if isinstance(row, dict)
        ]
        if isinstance(logs, list)
        else []
    )
    from .system_diagnostics import recent

    data = {
        "captured_at": timezone.now().isoformat(),
        "browser_errors": errors,
        "system_errors": recent(request),
        "system": {"request_id": str(uuid.uuid4()), "component": "tenant_support", "operation": "thread.created"},
        "limits": (
            "Only errors captured in this browser session and this request metadata are available. "
            "No unrestricted server logs are collected."
        ),
    }
    text = json.dumps(data, ensure_ascii=False, indent=2)
    MessageAttachment.objects.create(
        tenant=request.tenant,
        owner=request.user,
        message=message,
        filename="diagnostics.json",
        inline_text=text,
        storage_key=f"inline:{uuid.uuid4()}",
        content_type="application/json",
        byte_size=len(text.encode()),
    )
