"""Idempotent, revision-checked search indexing and deadline repair."""

from celery import shared_task
from django.db import transaction
from django.db.models import F, Q

from core.models import Tenant

from .models import Card
from .search import embed, embedding_model, search_text
from .services import broadcast, deadline_notifications


@shared_task(ignore_result=True)
def index_card(card_id):
    card = Card.objects.filter(pk=card_id).first()
    if not card:
        return
    revision = card.revision
    model = embedding_model()
    if card.embedding_revision == revision and card.embedding_model == model:
        return
    vector = embed(search_text(card))
    if vector:
        Card.objects.filter(pk=card_id, revision=revision).update(
            embedding=vector,
            embedding_revision=revision,
            embedding_model=model,
        )


@shared_task(ignore_result=True)
def maintain_kanban():
    # Iterate all due cards; tenant locks serialize deduplication against edits.
    from datetime import timedelta

    from django.utils import timezone

    due = Card.objects.filter(
        deadline__gte=timezone.now(), deadline__lte=timezone.now() + timedelta(days=1), archived=False
    )
    for card_id, tenant_id in due.values_list("pk", "tenant_id").iterator():
        with transaction.atomic():
            Tenant.objects.select_for_update().get(pk=tenant_id)
            card = Card.objects.select_related("tenant", "column__board").get(pk=card_id)
            deadline_notifications(card)
            transaction.on_commit(lambda tenant_id=tenant_id: broadcast(str(tenant_id)))
    stale = Card.objects.filter(~Q(embedding_revision=F("revision")) | ~Q(embedding_model=embedding_model()))
    for card_id in stale.order_by("updated_at").values_list("pk", flat=True)[:100]:
        index_card.delay(str(card_id))
