"""Transform extracted News records into canonical widget and object payloads."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from html import escape
from typing import Mapping, Sequence

from bs4 import BeautifulSoup

from content_import.services.content_parser import ContentParser
from content_import.services.widget_creator import create_widgets

from .extractor import ExtractedNews

WIDGET_NAMESPACE = uuid.UUID("d9105e60-c95e-4cd0-beb3-05858aefcdef")


@dataclass(frozen=True)
class LegacyNewsPayload:
    title: str
    slug: str
    data: dict
    widgets: dict
    metadata: dict
    taxonomy: Mapping[str, Sequence[str]] = field(default_factory=dict)


def media_insert(media, alt: str) -> str:
    url = media.file_url or media.get_file_url()
    return (
        '<div class="media-insert media-width-full media-align-center" '
        'data-media-insert="true" data-media-type="image" '
        f'data-media-id="{media.id}" data-width="full" data-align="center">'
        f'<img src="{escape(url, quote=True)}" alt="{escape(alt, quote=True)}"></div>'
    )


def build_payload(article: ExtractedNews, *, media_by_url: Mapping[str, object], taxonomy=None) -> LegacyNewsPayload:
    soup = BeautifulSoup(article.body_html, "html.parser")
    replacements = {}
    for image in soup.find_all("img", src=True):
        source_url = image["src"]
        media = media_by_url.get(source_url)
        if media:
            replacements[source_url] = media_insert(media, image.get("alt", ""))

    segments = ContentParser().parse(str(soup))
    widgets = create_widgets(segments, replacements)
    for index, widget in enumerate(widgets):
        widget["id"] = (
            f"widget-{uuid.uuid5(WIDGET_NAMESPACE, f'{article.source_url}:{index}:{article.content_checksum}')}"
        )
        widget["order"] = index

    taxonomy = taxonomy or {}
    data = {
        "summary": article.summary,
        "presentationalPublishingDate": article.source_date.isoformat() if article.source_date else None,
        "sourceDate": article.source_date.isoformat() if article.source_date else None,
        "externalUrl": article.external_url,
        "featuredImage": None,
        "types": list(taxonomy.get("types", [])),
        "categories": list(taxonomy.get("categories", [])),
        "sources": list(taxonomy.get("sources", [])),
        "topics": list(taxonomy.get("topics", [])),
        "keywords": list(taxonomy.get("keywords", [])),
    }
    metadata = {
        "legacy": True,
        "legacy_source_url": article.source_url,
        "legacy_source_checksum": article.source_checksum,
        "legacy_content_checksum": article.content_checksum,
    }
    return LegacyNewsPayload(
        title=article.title,
        slug=article.slug,
        data=data,
        widgets={"main": widgets},
        metadata=metadata,
        taxonomy=taxonomy,
    )
