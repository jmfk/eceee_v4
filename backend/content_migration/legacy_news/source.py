"""Source-neutral records returned by an ECEEE legacy migration adapter."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class LegacyNewsRecord:
    legacy_id: int
    title: str
    slug: str
    summary: str
    content: str
    presentational_publishing_date: object
    source_date: object
    publish_date: object
    expiry_date: object
    external_url: str
    featured: bool
    taxonomy: dict[str, list[str]]
