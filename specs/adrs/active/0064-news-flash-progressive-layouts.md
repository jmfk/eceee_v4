---
id: ADR-0064
title: News Flash counted layouts and bounded progressive feed
status: accepted
created: 2026-11-06
related_prds:
  - PRD-0045
---

# News Flash counted layouts and bounded progressive feed

## Decision

Use three nonnegative integer counts, defaulting to 1 full, 2 half and 0 third-width cards. Counts describe consecutive positions rather than a repeating pattern. Zero hides that group. Counts have no small fixed cap; requests and placeholder creation are bounded to batches of 12. All-zero renders an empty section.

Extend the existing host/site-bound public news endpoint with an offset. Promote the latest active priority only once and exclude it from the ordinary feed before applying offsets. Preserve the latest-priority expiry rule; older priorities do not revive. Client deduplication tolerates live publishing between batches; this is a live feed rather than a permanent database snapshot.

Keep API loading in adapters and share only layout normalization and presentation primitives across separate editor and public implementations. The editor shows labeled layout placeholders without fetching unpublished content. Public loading, empty and error states preserve the configured visible card positions. A manual load/retry button supports browsers without IntersectionObserver. Do not allocate all configured placeholders at once.

## Consequences

The legacy Django fallback remains presentation-only as recorded in ADR-0062. This supersedes the three-item restriction in PRD-0044, while retaining its default appearance and ADR-0063 priority semantics.
