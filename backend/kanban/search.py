"""Hybrid search, scoped before lexical or vector ranking."""

import math
import re

from django.conf import settings
from django.core.cache import cache
from django.db.models import Q


def embedding_model():
    return getattr(settings, "KANBAN_EMBEDDING_MODEL", "text-embedding-3-small")


def embed(text):
    from openai import OpenAI

    key = getattr(settings, "OPENAI_API_KEY", None)
    if not key:
        return None
    # Keep provider errors/credentials/text out of logs. Lexical search survives.
    try:
        client = OpenAI(api_key=key, timeout=5, max_retries=0)
        # A Unicode codepoint occupies at most four UTF-8 bytes. 1500-character
        # chunks therefore stay below the model's 8192-token limit even for
        # unusually token-dense input. Index all text rather than truncating it.
        chunks = [text[index : index + 1500] for index in range(0, len(text), 1500)]
        if not chunks:
            return None
        total = None
        weight = 0
        for offset in range(0, len(chunks), 16):
            batch = chunks[offset : offset + 16]
            result = client.embeddings.create(model=embedding_model(), input=batch, dimensions=512)
            for item in result.data:
                count = len(batch[item.index])
                if total is None:
                    total = [0.0] * len(item.embedding)
                total = [left + right * count for left, right in zip(total, item.embedding)]
                weight += count
        return [value / weight for value in total] if weight else None
    except Exception:
        return None


def search_text(card):
    return "\n".join(
        [
            card.title,
            card.description,
            *[item.get("text", "") for item in card.checklist],
            *card.comments.values_list("body", flat=True),
            *card.attachments.values_list("filename", flat=True),
        ]
    )


def cosine(left, right):
    if not left or len(left) != len(right):
        return 0
    denominator = math.sqrt(sum(v * v for v in left) * sum(v * v for v in right))
    return sum(a * b for a, b in zip(left, right)) / denominator if denominator else 0


def search_cards(queryset, query, semantic=True):
    lexical = queryset.filter(
        Q(title__icontains=query)
        | Q(description__icontains=query)
        | Q(comments__body__icontains=query)
        | Q(attachments__filename__icontains=query)
        | Q(checklist__icontains=query)
    ).distinct()
    exact = re.fullmatch(r"TASK-(\d+)", query.upper())
    exact_id = int(exact[1]) if exact else None
    ids = set(lexical.values_list("pk", flat=True))
    vector = None
    if semantic:
        # Cache scope includes tenant to avoid sharing user queries across tenants.
        import hashlib

        tenant_id = queryset.first().tenant_id if queryset.exists() else "empty"
        cache_key = f"kanban-search:{tenant_id}:{embedding_model()}:{hashlib.sha256(query.encode()).hexdigest()}"
        vector = cache.get(cache_key)
        if vector is None:
            vector = embed(query)
            if vector:
                cache.set(cache_key, vector, 300)
    ranked = []
    for card in queryset.iterator(chunk_size=200):
        is_exact = card.number == exact_id
        lexical_match = card.pk in ids
        score = (
            cosine(vector, card.embedding)
            if (vector and card.embedding_revision == card.revision and card.embedding_model == embedding_model())
            else 0
        )
        if is_exact or lexical_match or score >= 0.20:
            ranked.append((int(is_exact), int(lexical_match) + score, card))
    ranked.sort(key=lambda item: (item[0], item[1], item[2].updated_at), reverse=True)
    return [item[2] for item in ranked[:100]], bool(vector)
