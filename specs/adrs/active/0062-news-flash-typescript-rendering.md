---
id: ADR-0062
title: TypeScript News Flash with existing CMS registration
status: accepted
date: 2026-11-06
related_prds:
  - PRD-0044
supersedes: []
superseded_by: []
---

# ADR-0062: TypeScript News Flash with Existing CMS Registration

## Decision

Add a distinct News Flash widget. Keep its public rendering and preview data selection in TypeScript, using the existing published-object reader and news-preview endpoint. Reuse the existing render manifest, image/link primitives and theme variables.

The current CMS validates and discovers built-in widget types through Python/Pydantic. Use a small registration adapter rather than replacing that boundary or introducing a widget framework. No new Python news-query business logic is required.

The supported data-resolved surfaces are the CMS React preview, Designer and public Next publisher. A Django markup fallback accepts already resolved `news_items`; it does not implement a second priority/news selection query. Raw legacy Django page rendering does not resolve this new TypeScript-owned feed.

Use widget-container width for responsive presentation so the same rules work in narrow slots and preview frames. Render each story once in a single ordered structure; CSS changes placement without duplicating stories for different screen sizes.

## Consequences

- The widget is TypeScript-led, but adding a selectable CMS type is not completely Python-free in the current architecture.
- Existing widgets, publication rules and tenant scope remain intact.
- Layout and configuration must be covered by the existing editor/render/fixture parity checks.

## Links

- [PRD-0044](../../prds/0044-news-flash-widget.md)
