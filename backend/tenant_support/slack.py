"""Opt-in Slack notices. Only allowlisted metadata can leave the application."""

import hashlib
import json
import logging
import re
import time
import traceback
from datetime import timedelta
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from core.diagnostics.events import ERRORS, REQUEST_ID, TENANT, safe_frame, uuid_text

SERVICES = {"backend", "celery-worker", "celery-beat", "publisher"}
WEBHOOK = re.compile(r"https://hooks\.slack\.com/services/[A-Za-z0-9]+/[A-Za-z0-9]+/[A-Za-z0-9]+\Z")


def enabled(category):
    name = "SLACK_REPORTS_ENABLED" if category == "report" else "SLACK_SERVER_ERRORS_ENABLED"
    return bool(getattr(settings, name, False))


def release_name():
    value = str(getattr(settings, "APP_VERSION", "unknown"))
    return value if re.fullmatch(r"[A-Za-z0-9._-]{1,80}", value) else "unknown"


def environment_name():
    value = getattr(settings, "SLACK_ENVIRONMENT", "development")
    return value if value in {"development", "staging", "production"} else "unknown"


def queue_report(thread):
    # Called inside the report transaction, after labels and recipients have been resolved.
    if not enabled("report") or not thread.support_target or thread.kind != "bug":
        return
    from .models import SlackDelivery

    SlackDelivery.objects.get_or_create(
        event_key=f"report:{thread.pk}",
        defaults={"category": "report", "thread": thread, "next_attempt_at": timezone.now()},
    )


def server_metadata(raw):
    """Revalidate at the queue and delivery boundaries; discard every unreviewed field."""
    service = raw.get("service")
    if service not in SERVICES:
        raise ValueError("invalid_service")
    error_class = raw.get("error_class")
    error_class = error_class if isinstance(error_class, str) and error_class in ERRORS else "Exception"
    frames = []
    for frame in raw.get("frames", [])[:5] if isinstance(raw.get("frames"), list) else []:
        if isinstance(frame, dict):
            safe = safe_frame(frame.get("file"), frame.get("line"), frame.get("function"))
            if safe:
                frames.append(safe)
    return {
        "service": service,
        "error_class": error_class,
        "frames": frames,
        "tenant_id": uuid_text(raw.get("tenant_id")),
        "request_id": uuid_text(raw.get("request_id")),
        "release": (
            raw["release"]
            if isinstance(raw.get("release"), str) and re.fullmatch(r"[A-Za-z0-9._-]{1,80}", raw["release"])
            else release_name()
        ),
        "environment": (
            raw["environment"]
            if raw.get("environment") in ("development", "staging", "production")
            else environment_name()
        ),
    }


def queue_server_error(raw):
    if not enabled("server"):
        return
    from .models import SlackDelivery

    metadata = server_metadata(raw)
    digest = error_group(metadata)
    bucket = int(timezone.now().timestamp()) // 600
    SlackDelivery.objects.get_or_create(
        event_key=f"server:{digest}:{bucket}",
        defaults={"category": "server", "metadata": metadata, "next_attempt_at": timezone.now()},
    )


def error_group(metadata):
    # Group by tenant as well as code location. Request IDs do not split a repeated error.
    group = {key: value for key, value in metadata.items() if key != "request_id"}
    return hashlib.sha256(json.dumps(group, sort_keys=True).encode()).hexdigest()[:24]


class SlackErrorHandler(logging.Handler):
    """Queue without formatting LogRecord messages, arguments, exception values or request data."""

    def __init__(self):
        super().__init__()
        self._enqueuing = False
        self._recent = {}

    def emit(self, record):
        if record.levelno < logging.ERROR or self._enqueuing or not enabled("server"):
            return
        from django.apps import apps

        if not apps.ready:
            return
        self._enqueuing = True
        group = None
        try:
            from .tasks import enqueue_slack_server_error

            frames = []
            if record.exc_info and record.exc_info[2]:
                for frame in traceback.extract_tb(record.exc_info[2])[-5:]:
                    safe = safe_frame(frame.filename, frame.lineno, frame.name)
                    if safe:
                        frames.append(safe)
            else:
                frame = safe_frame(record.pathname, record.lineno, record.funcName)
                if frame:
                    frames.append(frame)
            metadata = server_metadata(
                {
                    "service": getattr(settings, "SLACK_SERVICE_NAME", "backend"),
                    "error_class": record.exc_info[0].__name__ if record.exc_info else "Exception",
                    "frames": frames,
                    "tenant_id": TENANT.get(),
                    "request_id": REQUEST_ID.get(),
                    "release": release_name(),
                    "environment": environment_name(),
                }
            )
            group = error_group(metadata)
            now = time.monotonic()
            if self._recent.get(group, 0) > now:
                return
            self._recent = {key: until for key, until in self._recent.items() if until > now}
            if len(self._recent) >= 1000:
                return
            # Suppress before broker IO, not only after tasks reach the database.
            self._recent[group] = now + 600
            enqueue_slack_server_error.apply_async(args=[metadata], queue="default", retry=False, expires=300)
        except Exception:
            # The original log/request must survive an unavailable broker. Never log this failure recursively.
            if group is not None:
                self._recent[group] = time.monotonic() + 30
            return
        finally:
            self._enqueuing = False


def payload(delivery):
    common = f"Miljö: {environment_name()} · Version: {release_name()}"
    if delivery.category == "report":
        thread = delivery.thread
        base = getattr(settings, "SUPPORT_APP_URL", "").rstrip("/")
        parts = urlsplit(base)
        if (
            parts.scheme != "https"
            or not parts.hostname
            or parts.username
            or parts.password
            or parts.query
            or parts.fragment
            or parts.path
            or any(char in base for char in "<>\r\n")
        ):
            raise ValueError("app_url_not_configured")
        link = f"{base}/inbox/threads/{thread.pk}?{urlencode({'tenant': thread.tenant.identifier})}"
        text = f"Ny felrapport i ECEEE\n{common}"
        blocks = [
            {"type": "section", "text": {"type": "plain_text", "text": text}},
            {
                "type": "actions",
                "elements": [{"type": "button", "text": {"type": "plain_text", "text": "Öppna i ECEEE"}, "url": link}],
            },
        ]
    else:
        metadata = server_metadata(delivery.metadata)
        common = f"Miljö: {metadata['environment']} · Version: {metadata['release']}"
        text = f"ECEEE serverfel · {metadata['service']} · {metadata['error_class']}\n{common}"
        text += f"\nReferens: {delivery.event_key}"
        for frame in metadata["frames"]:
            text += f"\n{frame['file']}:{frame['line']} ({frame['function']})"
        if metadata["request_id"]:
            text += f"\nRequest: {metadata['request_id']}"
        blocks = [{"type": "section", "text": {"type": "plain_text", "text": text}}]
    return {"text": text, "blocks": blocks, "unfurl_links": False, "unfurl_media": False}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def post_webhook(url, message):
    """Return bounded states only. A timeout may mean accepted; never blindly resend it."""
    request = Request(
        url, data=json.dumps(message).encode(), headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with build_opener(NoRedirect(), ProxyHandler({})).open(request, timeout=5) as response:
            if response.status == 200 and response.read(32) == b"ok":
                return "sent", "", 0
            return "uncertain", "unexpected_response", 0
    except HTTPError as error:
        if error.code == 429:
            retry_after = error.headers.get("Retry-After", "60")
            delay = min(3600, max(1, int(retry_after))) if re.fullmatch(r"\d{1,6}", retry_after) else 60
            return "pending", "rate_limited", delay
        if 300 <= error.code < 500 and error.code != 408:
            return "failed", "webhook_rejected", 0
        return "uncertain", "provider_outcome_unknown", 0
    except Exception:
        return "uncertain", "provider_outcome_unknown", 0


def deliver_one(pk):
    from .models import SlackDelivery

    with transaction.atomic():
        delivery = SlackDelivery.objects.select_for_update(of=("self",)).select_related("thread__tenant").get(pk=pk)
        if delivery.state != "pending" or delivery.next_attempt_at > timezone.now() or not enabled(delivery.category):
            return
        url = getattr(
            settings, "SLACK_REPORTS_WEBHOOK_URL" if delivery.category == "report" else "SLACK_SERVER_WEBHOOK_URL", ""
        )
        reports_url = getattr(settings, "SLACK_REPORTS_WEBHOOK_URL", "")
        server_url = getattr(settings, "SLACK_SERVER_WEBHOOK_URL", "")
        if not WEBHOOK.fullmatch(url) or reports_url and reports_url == server_url:
            delivery.error_code = "webhook_not_configured_or_not_separate"
            delivery.save(update_fields=["error_code"])
            return
        if delivery.category == "report" and (
            not delivery.thread
            or not delivery.thread.tenant.is_active
            or not delivery.thread.support_target
            or delivery.thread.kind != "bug"
        ):
            delivery.state = "skipped"
            delivery.error_code = "report_no_longer_eligible"
            delivery.save(update_fields=["state", "error_code"])
            return
        try:
            message = payload(delivery)
        except (ValueError, TypeError, AttributeError):
            delivery.error_code = "payload_not_configured"
            delivery.save(update_fields=["error_code"])
            return
        delivery.state = "sending"
        delivery.attempts += 1
        delivery.next_attempt_at = timezone.now()
        delivery.save(update_fields=["state", "attempts", "next_attempt_at"])
    state, code, delay = post_webhook(url, message)
    if state == "pending" and delivery.attempts >= 5:
        state, code = "failed", "rate_limit_exhausted"
    SlackDelivery.objects.filter(pk=pk, state="sending").update(
        state=state,
        error_code=code,
        sent_at=timezone.now() if state == "sent" else None,
        next_attempt_at=timezone.now() + timedelta(seconds=delay),
    )


def deliver_pending():
    from .models import SlackDelivery

    categories = [category for category in ("report", "server") if enabled(category)]
    if not categories:
        return
    SlackDelivery.objects.filter(state="sending", next_attempt_at__lt=timezone.now() - timedelta(minutes=10)).update(
        state="uncertain", error_code="worker_interrupted"
    )
    ids = list(
        SlackDelivery.objects.filter(state="pending", category__in=categories, next_attempt_at__lte=timezone.now())
        .order_by("next_attempt_at")
        .values_list("pk", flat=True)[:10]
    )
    for pk in ids:
        deliver_one(pk)
