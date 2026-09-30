"""Optional cost-capped visual tagging for already imported legacy News media."""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass

from django.conf import settings
from django.utils.text import slugify
from openai import OpenAI

from file_manager.models import MediaFile, MediaTag
from file_manager.storage import storage

PROMPT_VERSION = "legacy-news-image-tags-v1"
INPUT_USD_PER_MILLION = 0.10
OUTPUT_USD_PER_MILLION = 0.50
MAX_RESERVED_USD_PER_CALL = 0.005


@dataclass(frozen=True)
class PilotResult:
    considered: int = 0
    called: int = 0
    cached: int = 0
    failed: int = 0
    tagged: int = 0
    spent_usd: float = 0.0
    budget_exhausted: bool = False


class LegacyNewsAITagger:
    def __init__(
        self,
        *,
        tenant,
        user,
        model="gpt-6-luna",
        budget_usd=1.0,
        limit=100,
        client=None,
    ):
        self.tenant = tenant
        self.user = user
        self.model = model
        self.budget_usd = max(0.0, float(budget_usd))
        self.limit = max(0, min(int(limit), 100))
        api_key = getattr(settings, "OPENAI_API_KEY", "")
        self.client = client or (OpenAI(api_key=api_key) if api_key else None)

    def run(self) -> PilotResult:
        counters = {
            "considered": 0,
            "called": 0,
            "cached": 0,
            "failed": 0,
            "tagged": 0,
            "spent_usd": 0.0,
            "budget_exhausted": False,
        }
        media_files = (
            MediaFile.objects.filter(tenant=self.tenant, tags__slug="legacy")
            .filter(tags__slug="news")
            .exclude(tags__slug="migration-placeholder")
            .distinct()
            .order_by("created_at")[: self.limit]
        )
        for media in media_files:
            counters["considered"] += 1
            cache = (media.metadata or {}).get("legacy_ai_tagging", {})
            if (
                cache.get("file_hash") == media.file_hash
                and cache.get("model") == self.model
                and cache.get("prompt_version") == PROMPT_VERSION
            ):
                counters["cached"] += 1
                self._apply_tags(media, cache.get("tags", []))
                continue
            if not self.client:
                counters["failed"] += 1
                continue
            if counters["spent_usd"] + MAX_RESERVED_USD_PER_CALL > self.budget_usd:
                counters["budget_exhausted"] = True
                break
            try:
                tags, cost = self._classify(media)
            except Exception:
                counters["failed"] += 1
                continue
            counters["called"] += 1
            counters["spent_usd"] += cost
            tags = self._normalize_tags(tags)[:5]
            self._apply_tags(media, tags)
            metadata = dict(media.metadata or {})
            metadata["legacy_ai_tagging"] = {
                "file_hash": media.file_hash,
                "model": self.model,
                "prompt_version": PROMPT_VERSION,
                "tags": tags,
                "cost_usd": round(cost, 8),
            }
            media.metadata = metadata
            media.ai_generated_tags = tags
            media.save(update_fields=["metadata", "ai_generated_tags", "updated_at"])
            counters["tagged"] += 1
        return PilotResult(**counters)

    def _classify(self, media: MediaFile) -> tuple[list[str], float]:
        content = storage.get_file_content(media.file_path)
        encoded = base64.b64encode(content).decode("ascii")
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "Return JSON with one key, tags. Choose at most five concise, factual, "
                                "lowercase English tags describing this ECEEE News image. Do not include "
                                "legacy, news, guesses about identity, or sensitive attributes."
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{media.content_type};base64,{encoded}",
                                "detail": "low",
                            },
                        },
                    ],
                }
            ],
            response_format={"type": "json_object"},
            max_tokens=120,
            temperature=0,
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        usage = response.usage
        input_tokens = getattr(usage, "prompt_tokens", 0) or 0
        output_tokens = getattr(usage, "completion_tokens", 0) or 0
        cost = (input_tokens * INPUT_USD_PER_MILLION + output_tokens * OUTPUT_USD_PER_MILLION) / 1_000_000
        return payload.get("tags", []), cost

    def _apply_tags(self, media, names):
        tags = []
        for name in self._normalize_tags(names)[:5]:
            tag, _ = MediaTag.objects.get_or_create(
                name=name,
                namespace=media.namespace,
                defaults={"slug": slugify(name)[:50], "created_by": self.user},
            )
            tags.append(tag)
        if tags:
            media.tags.add(*tags)

    @staticmethod
    def _normalize_tags(names):
        result = []
        seen = set()
        for raw in names if isinstance(names, list) else []:
            name = " ".join(str(raw).strip().lower().split())[:50]
            slug = slugify(name)
            if not name or not slug or slug in {"legacy", "news", "migration-placeholder"} or slug in seen:
                continue
            seen.add(slug)
            result.append(name)
        return result
