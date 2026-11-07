---
id: ADR-0069
title: Columnist card metadata and profile reading columns
status: accepted
created: 2026-11-07
related_prds:
  - PRD-0048
---

# Columnist card metadata and profile reading columns

The owner revised the overview after PRD-0048 implementation: show latest published column, organisation affiliation, title when present and website instead of biography text in each columnist card. Reuse the existing affiliation, prefix and homePage fields; do not invent missing metadata or rewrite stored profiles. Resolve the latest Article-kind column per displayed published author, using its published authors reference and effective publication date, with tenant and publication filters. Each bounded directory batch performs at most one latest-column lookup per profile; this avoids incorrectly truncating a mixed-author feed before grouping.

Cards keep the existing font sizes and fixed height. Align their text block and portrait with the bottom padding. Interpret the owner's subsequent two-plus-one-column suggestion as the profile detail page: the reading area (biography and portrait) uses the left two thirds, and the same metadata uses the right third. Stack the areas on mobile. This interpretation was stated while the optional clarification was pending; further owner steering should update this decision rather than the locked PRD requirements.

Public directory payloads contain only explicit presentation fields and resolved public images. Raw photo references, unrelated object fields, hidden/scheduled widgets and unpublished column data must not be serialized. The existing object-widget publication filter is reused for directory images and detail bodies. Directory offsets advance by received records even when deduplication removes visible duplicates.
