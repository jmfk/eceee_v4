---
id: PRD-0044
title: Responsive homepage News Flash widget
status: completed
locked: true
created: 2026-11-06
related_adrs:
  - ADR-0062
  - ADR-0063
---

# PRD-0044: Responsive homepage News Flash widget

## Requirements

- Add News Flash as a separate selectable widget, preserving existing news widgets.
- Display three news stories in the same order in every responsive mode. The sketch's “Current widget” is News 1, followed by News 2 and News 3.
- Wide: one full-width lead story above two secondary stories side by side. Narrow: a large lead story above two compact rows with images on the right.
- Use real story titles, images and links, with safe handling of missing images, long titles, loading, empty and error states. Show available stories without fabricating content when fewer than three are published.
- Reuse existing tenant-scoped published-news access and theme styling. No drafts or unpublished future content may appear publicly.
- Implement new presentation and selection behavior in TypeScript, with only the minimal registration needed by the existing Django CMS.
- Keep CMS preview, Designer fixtures and public Next rendering aligned. No new dependency, migration or production mutation.

## Implementation Notes

- Confirmed selection: latest three published stories, with an optional priority lead and expiry fields on the news object-type definition; see ADR-0063 for the owner's clarification.
- Source screenshots are layout references; their colored rectangles represent story imagery.

## Acceptance Criteria

- Three distinct fixture stories remain visible and ordered at wide and narrow widths.
- The new type can be selected and saved through the existing widget contract.
- Focused widget, adapter, public-data and registry-parity checks pass, and the frontend builds.

## Completion Evidence

- 27 focused frontend tests, 68 publisher tests, 7 CMS widget-contract tests, 9 Node contract tests and 10 content-definition helper tests passed.
- Frontend build, publisher TypeScript check, manifest drift check and specs validation passed.
- Chrome fixture rendering verified three stories once each, in the same order, at 680px and 280px container widths. The wide layout has a lead spanning two columns; the narrow layout has compact supporting rows.
- Local Article definition 8 in workspace `eceee-production-copy` now contains the two priority fields. Saved through the authenticated CMS editor after the narrower machine key refused definition writes; API readback verified all existing property values remained intact. No object instances were changed or published.
- Production deployment and definition changes are not included. Full legacy Django feed resolution is intentionally not added; see ADR-0062.
