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

## Image shapes and spacing ownership clarification (2026-11-06)

The owner's follow-up image reference replaces the previous edge-aligned image layout. Headings span the card above the summary/image row, reserving two lines while allowing longer content to grow. Offer square (1:1) and landscape (7:4) image shapes in widget settings; landscape is the default. Images are inset, aligned beside the summary, and cropped with object-fit cover. Editor placeholders use the same geometry. Narrow slots stack the summary and image to avoid squeezing text.

The owner clarified that outer padding comes from surrounding layouts. Inspection confirms main_layout.py provides 40px horizontal and 30px vertical padding and landing_page.py provides 30px around main content. Remove News Flash's own outer padding, max-width and centering: it fills its slot. The earlier 1280px outer-width/inset responsibility recorded above is superseded by this clarification. In a 1200px content slot, 30px gutters still give 585px half and 380px third-width cards. Card-internal padding is retained.

Chrome verified square 140×140px and landscape 245×140px images inside 585×310px cards, full-width headlines, and a 320px mobile card without horizontal overflow. The live landing-page slot has one 30px padding wrapper and zero News Flash outer padding. Focused render/editor/configuration checks, publisher typecheck and frontend build passed.

## Review correction: stable priority decision during progressive loading

The first resolved page now carries its promoted priority ID (or null for none). Subsequent host/site-validated public feed requests must carry that decision with their offset. They exclude the same ID and preserve the promotion offset even if its priority expires or is replaced during scrolling. This prevents a deterministic skipped ordinary story at an expiry boundary. Every batch still queries currently published versions; the decision does not grant access to expired, future or cross-tenant content. Reloading the feed reevaluates priority. The general feed remains live, so other publishing changes between batches can reorder ordinary stories, with client deduplication retained.

## Banner-aligned outside border (2026-11-07)

Use Banner's 1px outside outline and zero border width for each News Flash card, preserving the full content-box dimensions and slot alignment. Keep square corners and no shadow. Cards use 30px inner padding; the headline retains its two-line area with a regular weight and the image/summary row aligns to the bottom inside that padding. The compact-slot padding rule remains. Placeholder cards use a dashed outside outline. Page/slot outer padding stays owned by the surrounding layout.

Verified in Chrome against the real Banner renderer: both boxes have a 1px rgba(0,0,0,0.3) outline, zero border width and identical left alignment. News Flash remains 585×310px with a 245×140px image inset 30px from the right and bottom, and a 40px regular headline. The 280px narrow view and editor placeholders remain contained. Focused widget/registry tests, the unchanged 51-case contract comparison, manifest/spec validation and frontend build passed.
