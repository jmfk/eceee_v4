---
id: PRD-0026
title: Inline banner styling
status: completed
locked: true
created: 2026-10-21
related_adrs:
  - ADR-0034
  - ADR-0035
---

# PRD-0026: Inline Banner Styling

## Requirements

- Edit banner text color, background color and optional text outline directly in WYSIWYG mode.
- Keep banner controls compact: icon buttons with descriptive help and accessible names, including existing mode, image and image-size actions.
- Show selected theme palette colors and direct colors consistently in the editor, preview, standalone React publisher and supported Django banner template.
- Keep nested widget updates isolated and retain text selection/editor instances while changing presentation.
- Preserve existing saved colors and use no outline by default for existing banners.

## Acceptance Criteria

- Cover text/header modes, named/direct colors, outline choices, external updates and nested sibling isolation.
- Verify real browser computed colors, compact toolbar layout, keyboard/help behavior and save/reload.
- Run relevant frontend/backend tests, rendering parity, lint, build and publisher checks.

## Implementation Notes

- Owner scope update, 2026-10-21: use clean text without outline now; remove the outline control and defer theme-managed outline styles. ADR-0035 supersedes the initial outline decision.

- Continued on PR #257, alongside its nested media-picker correction.
- Owner clarification on 2026-10-21: compact icon buttons and help apply to every widget's WYSIWYG toolbar, including text formatting, image controls and table actions. Popup choices retain readable labels.

## Linked ADRs

- [ADR-0034](../adrs/archive/0034-banner-presentation-overrides.md)

- [ADR-0035](../adrs/active/0035-plain-banner-text.md)

## Completion Evidence

- Implemented in PR #257: inline colors with clean text, theme-aware rendering, compact icon actions across text/image/table widget toolbars, and preserved active rich-text selection through palette interactions.
- Frontend: 1,758 Vitest tests across 166 files passed in the consolidated gate; the plain-text revision passed 228 focused tests. Browser checks cover light/dark colors, desktop/mobile controls, clean text despite stored outline values, save/reload, sibling isolation and continued formatting after palette selection.
- A focus-scroll regression was reproduced in the CI Playwright Linux image and corrected; its full 43-case suite passed. In the final plain-text browser run, 42 cases passed and one reload timed out while loading; that reload passed twice on focused rerun.
- Backend: seven banner tests passed. Publisher typecheck and six render/theme tests passed. Generated manifest matches the canonical backend export.
- Frontend lint passed with existing warnings; production build, specs governance and diff checks passed. No database migration is required.
