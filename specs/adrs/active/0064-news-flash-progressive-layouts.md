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

## Owner-provided layout measurements (2026-11-06)

Use a centered maximum outer width of 1280px, with 40px side insets and 30px gutters on wide widget containers. This gives a 1200px grid of six 175px modules: full-width stories span 1200px, half-width stories 585px and third-width stories 380px. Cards have a minimum height of 310px (two 140px units plus 30px); supporting images use a 175px by 140px module. Longer text may grow cards rather than clip content.

The search/header area above the grid in the reference is outside News Flash. Apply 30px top/bottom grid spacing. Below an 800px widget-container width, stack stories with 16px insets/gaps and 140px compact supporting rows, retaining a 310px lead. Measurements and responsive rules are shared by editor placeholders and public cards through the render catalog.

Chrome DOM measurements verified 1200/585/380px cards, 310px card heights, 175×140px supporting images, matching editor placeholders, and stacked 288px cards inside a 320px container with no horizontal overflow. Focused widget/registry checks and frontend build passed. Live published data was not rechecked for this CSS-only update.
