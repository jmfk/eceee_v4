---
id: PRD-0045
title: Configurable News Flash layouts and progressive loading
status: completed
locked: true
created: 2026-11-06
related_adrs:
  - ADR-0064
---

# Configurable News Flash layouts and progressive loading

## Requirements

- Fix the object type selector so published Article news can be selected by saved name or ID.
- Replace the fixed three-story limit with nonnegative full-width, half-width and third-width story counts, in that order. Each count may be zero and has no small editorial upper limit.
- Default to one full-width and two half-width stories, preserving saved widgets.
- Show clearly identified placeholder cards for configured news positions when news cannot load, including in the slot editor.
- Load long lists progressively as the reader scrolls, with an accessible manual fallback and retry on failure.
- Preserve published-only, tenant-scoped access and the existing priority/expiry rule.

## Implementation Notes

This owner-requested expansion replaces the fixed count and empty-state requirements of PRD-0044. See ADR-0064.

## Completion Evidence

- Focused editor, selector, layout, preview adapter, scrolling and retry tests pass; publisher tests cover priority paging, tenant-bound endpoint validation and parameterized SQL offsets/exclusion.
- CMS registration/configuration checks and render-contract manifest checks pass. Frontend production build and publisher typecheck pass.
- Regular Chrome verified the live Article selector, visible 1/2/0 defaults, slot placeholders and full/half/third layouts at 820px and 280px widths.
- A read-only request to the local publisher for page 249 returned Site not found; real published news for that site was not verified. No publishing or tenant data was changed. The legacy Django fallback remains presentation-only.
