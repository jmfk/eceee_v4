from django.db import transaction

from core.models import Tenant

from .models import MessageLabel

DEFAULT_LABELS = (
    ("question", "Question"),
    ("suggestion", "Suggestion"),
    ("content", "Content"),
    ("bug", "Bug Report"),
)


def ensure_message_labels(tenant):
    if MessageLabel.objects.filter(tenant=tenant).exists():
        return
    with transaction.atomic():
        Tenant.objects.select_for_update().get(pk=tenant.pk)
        if MessageLabel.objects.filter(tenant=tenant).exists():
            return
        for position, (key, name) in enumerate(DEFAULT_LABELS):
            MessageLabel.objects.create(tenant=tenant, name=name, key=key, position=position)
