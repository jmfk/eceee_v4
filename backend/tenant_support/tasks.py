"""Durable outbox: claim before external IO; ambiguous outcomes are never blindly resent."""

from contextlib import suppress
from datetime import timedelta
from urllib.parse import urlencode, urlsplit

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMessage, get_connection
from django.db import transaction
from django.utils import timezone

from .access import can_read_thread
from .models import EmailDelivery


def deliver_one(pk):
    with transaction.atomic():
        delivery = (
            EmailDelivery.objects.select_for_update(of=("self",))
            .select_related("entry__user", "entry__tenant", "entry__thread__tenant", "entry__instruction")
            .get(pk=pk)
        )
        if delivery.state != "pending" or delivery.next_attempt_at > timezone.now():
            return
        entry = delivery.entry
        allowed = entry.user.is_active and entry.tenant.is_active and entry.tenant.user_has_access(entry.user)
        allowed = allowed and (
            can_read_thread(entry.user, entry.thread) if entry.thread_id else not entry.instruction.withdrawn
        )
        if not allowed:
            delivery.state = "skipped"
            delivery.error_code = "access_revoked"
            delivery.save(update_fields=["state", "error_code"])
            return
        if not entry.user.email:
            delivery.state = "failed"
            delivery.error_code = "missing_email"
            delivery.save(update_fields=["state", "error_code"])
            return
        base = settings.SUPPORT_APP_URL.rstrip("/")
        parts = urlsplit(base)
        if (
            parts.username
            or parts.query
            or parts.fragment
            or parts.scheme not in {"http", "https"}
            or not parts.netloc
            or (not settings.DEBUG and parts.scheme != "https")
        ):
            delivery.error_code = "app_url_not_configured"
            delivery.save(update_fields=["error_code"])
            return  # A configuration repair makes this pending job sendable.
        delivery.state = "sending"
        delivery.attempts += 1
        delivery.next_attempt_at = timezone.now()
        delivery.save(update_fields=["state", "attempts", "next_attempt_at"])
        destination = f"threads/{entry.thread_id}" if entry.thread_id else f"instructions/{entry.instruction_id}"
        link = f"{base}/inbox/{destination}?{urlencode({'tenant': entry.tenant.identifier})}"
        message = EmailMessage(
            subject="Nytt meddelande i ECEEE",
            body=(
                f"{delivery.summary}\n\nLäs i systemet:\n{link}\n\n"
                "Logga in för att läsa och svara. Svara inte på detta e-postmeddelande."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[entry.user.email],
            headers={"Message-ID": f"<support-{delivery.pk}@{parts.hostname}>"},
        )
    connection = None
    try:
        # Failures before the provider call are safe to retry. Once send begins,
        # an exception may mean accepted-but-response-lost, so require inspection.
        connection = get_connection(timeout=15)
        connection.open()
        message.connection = connection
    except Exception:
        if connection:
            with suppress(Exception):
                connection.close()
        state, code = ("pending", "backend_unavailable") if delivery.attempts < 5 else ("failed", "backend_unavailable")
        EmailDelivery.objects.filter(pk=pk, state="sending").update(
            state=state, error_code=code, next_attempt_at=timezone.now() + timedelta(minutes=2**delivery.attempts)
        )
        return
    try:
        accepted = message.send(fail_silently=False)
        if accepted != 1:
            raise RuntimeError("not_accepted")
    except Exception:
        EmailDelivery.objects.filter(pk=pk, state="sending").update(
            state="uncertain", error_code="provider_outcome_unknown"
        )
        return
    finally:
        with suppress(Exception):
            connection.close()
    EmailDelivery.objects.filter(pk=pk, state="sending").update(state="sent", sent_at=timezone.now(), error_code="")


@shared_task(ignore_result=True)
def deliver_pending():
    if not settings.SUPPORT_EMAIL_ENABLED:
        return
    # A worker lost after the external side effect cannot safely be retried.
    EmailDelivery.objects.filter(state="sending", next_attempt_at__lt=timezone.now() - timedelta(minutes=10)).update(
        state="uncertain", error_code="worker_interrupted"
    )
    ids = list(
        EmailDelivery.objects.filter(state="pending", next_attempt_at__lte=timezone.now())
        .order_by("next_attempt_at")
        .values_list("pk", flat=True)[:100]
    )
    for pk in ids:
        deliver_one(pk)
