---
id: PRD-0012
title: Legacy News golden samples and migration
status: started
locked: true
created: 2026-09-30
related_adrs:
  - ADR-0013
---

# PRD-0012: Legacy News Golden Samples and Migration

## Problem

ECEEE v4 needs to preserve the public News archive from the legacy CMS. The legacy records mix structured metadata, copied HTML, taxonomies, and media references, while v4 renders typed objects and widget content. Importing the full database before validating that mapping would make content defects and duplicate objects expensive to diagnose.

## Goals

- Validate the News object contract with four representative public articles and one labelled synthetic edge case.
- Use one extraction, sanitization, widget, media, and placeholder pipeline for public samples and the later database import.
- Preserve publish gates, source identity, taxonomy relationships, links, and semantic body order without importing legacy page chrome.
- Make every import resumable and idempotent.
- Keep optional AI media tagging cost-capped and non-blocking.

## Non-Goals

- Final thumbnail design or population of every `featuredImage`.
- Inferring authoritative taxonomy assignments from public HTML.
- Writing to or changing the legacy database.
- Running the production migration as part of implementing the tooling.

## Requirements

- A manifest identifies the four approved public URLs and their expected structural traits without storing copied article bodies.
- Public fetching is restricted to manifest entries, identifies the importer, waits at least ten seconds between requests, and uses bounded retries.
- The canonical `news` definition supports summary, presentational publishing date, source date, external URL, optional featured image, and references to news type, category, source, topic, and keyword objects.
- Object definitions are configured through the React application and persisted in PostgreSQL. Migration code treats them as read-only, validates the required contract before writing content, and never creates or overwrites them.
- Article title and slug remain on `ObjectInstance`; body content is stored as ContentWidget and TableWidget blocks.
- Import metadata records canonical source URL, legacy identity, and deterministic source/transformation checksums.
- The extractor uses only `.mainContentColumn`, removes share controls and external-link icon media, parses the leading source/date prefix, extracts the final external-link section, and sanitizes remaining semantic HTML.
- Imported images become `MediaFile` records tagged `legacy` and `news`. Unavailable images become deterministic 1200x675 informative placeholders also tagged `migration-placeholder`.
- Sample reruns enrich the same canonical-slug objects instead of creating duplicates. Resume mode retries placeholder media.
- A local migration preview renders News details at `/migration-preview/news/<slug>/` through the normal path parameter contract.
- Django, standalone React, editor preview, lists, top-news, and sidebar render summary and external-link fields consistently and do not render body content twice.
- The database importer connects through a loopback-only tunnel on reserved port 10110 using a non-superuser role with `CONNECT`, schema `USAGE`, and `SELECT` only.
- Database dry-run compares counts, statuses, dates, taxonomy assignments, and media references before writes. Only legacy `status=2` records are eligible for import.
- Optional image tagging is disabled for golden samples. Its pilot is limited to 100 unique image hashes, GPT-6 Luna low-detail input, five applied tags per image, a persistent cache, and a default USD 1.00 hard budget. Import continues if tagging fails or reaches the budget.

## Acceptance Criteria

- Golden samples preserve expected titles, summaries, dates, body order, links, and external URLs while excluding social/sidebar media.
- The synthetic list and table render correctly; its valid image resolves to a `MediaFile` and failed image to an informative placeholder.
- Django, standalone React, and editor previews have equivalent content structure apart from documented presentation differences at desktop and mobile sizes.
- Sample and database reruns create no duplicate objects, versions, widgets, media, tags, or taxonomy terms.
- A missing, inactive, wrong-namespace, or incompatible News definition stops the import without mutating object definitions.
- Every migrated source image reconciles to a real `MediaFile` or placeholder.
- Focused extractor, sanitizer, media, importer, render-parity, and idempotency tests pass before a production import is authorized.

## Operational Gate

The full database import must not begin until the golden sample evidence is accepted. Provisioning the read-only legacy role and executing the production import remain operator actions outside normal application deployment.

## Linked ADRs

- [ADR-0013: Gate the legacy News migration through canonical golden samples](../adrs/active/0013-legacy-news-golden-sample-gate.md)

## Implementation Notes

- 2026-09-30: Implementation started on `codex/legacy-news-migration`.
- The originally requested PRD-0010 identifier was already assigned. After synchronization with `main`,
  PRD-0011 was also assigned, so repository numbering continues with PRD-0012.
- 2026-09-30: The bounded live manifest validated all four public pages and the synthetic fixture; full database import remains gated on local visual acceptance and legacy read-role provisioning.
- 2026-09-30: Added a 40-capture desktop/mobile harness covering Django public, standalone React, editor render-frame, and Designer surfaces.
