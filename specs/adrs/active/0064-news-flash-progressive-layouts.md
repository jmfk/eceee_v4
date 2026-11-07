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

## Local dev unavailable-state follow-up (2026-11-07)

The unavailable/editor placeholder must use the approved white card and solid outside outline, with an explicit blue image area and no skeleton bars. Availability labels remain available to assistive technology; feed errors retain the widget-level visible status/retry. This replaces the previous gray/dashed placeholder treatment.

When editing on localhost, news preview prefers an explicitly configured `.localhost` site hostname over external aliases, preserving hostname order and production preview behavior. This keeps local preview queries on the local publisher when a root site has mixed external/local hostnames. Local page 249 was given the `eceee.localhost` alias alongside its two existing aliases, and its current saved working version was published locally to make that route live. No production data changed.

Real published stories without an image retain the same decorative blue image area instead of dropping the image column. Title links explicitly inherit their heading font so generic theme link rules cannot shrink a real headline relative to the editor placeholder. The three currently selected local published articles contain no image fields; no Article content was changed to fill that gap.

Verified the actual page 249 Content and Preview screens and `http://eceee.localhost:11615/`: Content has white solid-outline cards with blue image areas; Preview and the public site resolve the same three published stories; real headline links compute to 40px and image areas to 245×140px. The published-news endpoint returns HTTP 200 for site 249. Focused tests (including mixed-host preview and missing story image regressions), typecheck, frontend build, manifest/spec checks and the strict 51-case comparison pass.


## Follow-up: real content in the slot editor

The slot editor now reads the same host/site-scoped published News Flash feed as preview and public rendering. It shows real Article titles, summaries and images, retaining placeholders for missing stories and suppressing article navigation inside editing. Designer fixtures without a page/site context retain deterministic placeholders. Shared presentation and the feed adapter remain independent of editor state.

For imported Articles, an explicit featured image takes precedence; otherwise the first image in the published article body or Image widget supplies the card photograph. Referenced media IDs resolve through the current tenant's public-media lookup; missing/private media stays unavailable. Article records and content are not rewritten. The local import has seven Articles with embedded photos; the three currently selected Articles have no saved photo and therefore retain their decorative image placeholders.

Verified actual page 249 content in Chrome, a twelve-item public feed containing an imported photograph, and HTTP 200 image delivery. Focused editor/preview/render tests and publisher feed/route tests passed, along with publisher typecheck/lint and frontend build.

## Follow-up: supplied typography source

The owner supplied `eceee 2025_web_Full_651_Typo_SOURCE.pdf` (1280px design). Its named news style supersedes the earlier regular 40px headline: Source Sans 3 semibold 600 at 41px with 44px leading. Body text is light 300 at 16px with 22px leading. Keep the existing theme-supplied Source Sans 3 font, 30px card insets/gutters, outside outline and parent-owned outer spacing. Reserve 88px for a two-line headline and 22px before the body, retaining the 310px minimum card height. Compact cards use 22px/26px headings and their existing 16px side insets.

Chrome computed styles match on page 249 in the slot editor and public local homepage. At a 390px viewport the cards are 330px wide with no content overflow. Twenty focused editor/render/registry tests and the unchanged 51-case contract comparison pass.

## Follow-up: fixed card height and ellipsis

The owner clarified that 310px is a fixed card height, superseding the previous minimum-height/growing-content behavior. Constrain grid tracks so long text cannot expand a card. Headlines reserve two lines and use CSS line clamping; body text uses six 22px desktop lines with ellipsis, or one line in compact stacked-image cards so the image remains contained. Full text remains in the document and stored Article content is unchanged. Outside outlines and focus treatment remain.

Chrome verified all three real cards at exactly 310px in the editor and public page, visible summary ellipses, and 330px-wide compact cards with contained images and no horizontal overflow.

## Follow-up: mobile lead and compact rows

The owner supplied a separate mobile News Flash reference, superseding identical 310px stacked mobile cards. Below an 800px widget width, full-width stories become square leads with 6.25% insets and a bottom-aligned 3:1 image. Half/third-width stories become compact rows at a 3.4:1 card ratio (minimum 88px high), with a 32%-wide image flush to the right/top/bottom edge. Mobile summaries are hidden and titles retain two-line ellipsis. The configured desktop square/landscape image choice remains in effect on desktop; mobile image geometry follows the new reference. Named container queries isolate the mobile layout from individual desktop cards.

Chrome verified a 330×330px lead with a 288.75×96.25px inset image and 330×97.05px supporting rows with edge-aligned thumbnails, without horizontal overflow. Desktop full/half cards remain 310px high.
