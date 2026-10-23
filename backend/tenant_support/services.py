from django.db.models import Max, Q
from django.utils import timezone

from .access import has_role, members, support_users
from .models import EmailDelivery, InboxEntry, SupportThread


def visible_entries(user, tenant):
    entries = InboxEntry.objects.filter(tenant=tenant, user=user)
    instructions = Q(instruction__isnull=False)
    if not has_role(user, tenant, "can_publish"):
        instructions &= Q(instruction__withdrawn=False)
    threads = Q(thread__creator=user) | Q(thread__participants=user)
    if has_role(user, tenant, "can_support"):
        threads |= Q(thread__support_target=True)
    return entries.filter(instructions | threads).distinct().select_related("instruction", "thread")


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
    users = {u.pk: u for u in members(thread.tenant).filter(private_threads=thread)}
    if thread.support_target:
        users.update({u.pk: u for u in support_users(thread.tenant)})
    if thread.creator.is_active and thread.tenant.user_has_access(thread.creator):
        users[thread.creator_id] = thread.creator
    for user in users.values():
        if user.pk != sender.pk:
            receive(
                thread.tenant,
                user,
                thread=thread,
                event_key=f"message:{message.pk}",
                summary="Du har fått ett nytt meddelande i ECEEE. Läs och svara i din inbox.",
            )
    # The sender sees their conversation but receives no email or unread event.
    InboxEntry.objects.get_or_create(
        tenant=thread.tenant,
        user=sender,
        thread=thread,
        defaults={"activity_at": message.created_at, "read_at": timezone.now()},
    )


def sync_support_inbox(tenant, user):
    """Restore current activity when support is granted, without historical mail."""
    # Serialize catch-up with replies so activity cannot move backwards.
    list(
        SupportThread.objects.select_for_update()
        .filter(tenant=tenant, support_target=True)
        .values_list("pk", flat=True)
    )
    threads = SupportThread.objects.filter(tenant=tenant, support_target=True).annotate(
        latest=Max("messages__created_at")
    )
    existing = {
        entry.thread_id: entry for entry in InboxEntry.objects.filter(tenant=tenant, user=user, thread__isnull=False)
    }
    create, update = [], []
    for thread in threads:
        activity = thread.latest or thread.created_at
        entry = existing.get(thread.pk)
        if entry is None:
            create.append(InboxEntry(tenant=tenant, user=user, thread=thread, activity_at=activity))
        elif entry.activity_at < activity:
            entry.activity_at, entry.read_at, entry.archived = activity, None, False
            update.append(entry)
    InboxEntry.objects.bulk_create(create, ignore_conflicts=True)
    InboxEntry.objects.bulk_update(update, ["activity_at", "read_at", "archived"])
