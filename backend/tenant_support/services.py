from django.db.models import Q
from django.utils import timezone

from .access import has_role, support_users
from .models import EmailDelivery, InboxEntry


def visible_entries(user, tenant):
    entries = InboxEntry.objects.filter(tenant=tenant, user=user)
    instructions = Q(instruction__isnull=False)
    if not has_role(user, tenant, "can_publish"):
        instructions &= Q(instruction__withdrawn=False)
    threads = Q(thread__creator=user)
    if has_role(user, tenant, "can_support"):
        threads = Q(thread__isnull=False)
    return entries.filter(instructions | threads).select_related("instruction", "thread")


def receive(tenant, user, *, instruction=None, thread=None, event_key, summary):
    entry, _ = InboxEntry.objects.get_or_create(
        tenant=tenant,
        user=user,
        instruction=instruction,
        thread=thread,
        defaults={"activity_at": timezone.now()},
    )
    _, created = EmailDelivery.objects.get_or_create(
        event_key=f"{event_key}:{user.pk}",
        defaults={"entry": entry, "summary": summary, "next_attempt_at": timezone.now()},
    )
    if created:
        entry.activity_at = timezone.now()
        entry.read_at = None
        entry.archived = False
        entry.save(update_fields=["activity_at", "read_at", "archived"])
    return entry


def notify_thread(thread, sender, message):
    users = {u.pk: u for u in support_users(thread.tenant)}
    if thread.creator.is_active and thread.tenant.user_has_access(thread.creator):
        users[thread.creator_id] = thread.creator
    for user in users.values():
        if user.pk != sender.pk:
            receive(
                thread.tenant,
                user,
                thread=thread,
                event_key=f"message:{message.pk}",
                summary="Du har fått ett nytt meddelande i en supporttråd. Läs och svara i ECEEE.",
            )
    # The sender sees their conversation but receives no email or unread event.
    InboxEntry.objects.get_or_create(
        tenant=thread.tenant,
        user=sender,
        thread=thread,
        defaults={"activity_at": message.created_at, "read_at": timezone.now()},
    )
