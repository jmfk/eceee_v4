---
id: ADR-0034
title: Banner presentation overrides
status: superseded
date: 2026-10-21
related_prds:
  - PRD-0026
supersedes: []
superseded_by:
  - ADR-0035
---

# ADR-0034: Banner Presentation Overrides

## Decision

Keep the existing `text_color` / `textColor` and `background_color` / `backgroundColor` fields. Add `text_outline` / `textOutline` with `none` (default), `dark`, and `light` choices. Render outlines as a one-pixel text-shadow contour, without changing text layout or storing styling inside rich-text HTML.

Banner presentation explicitly controls the color of its text, including nested headings and links. Use scoped banner CSS variables so theme typography does not replace a selected banner color. Theme palette names resolve through the existing theme CSS variables; direct CSS colors retain their meaning.

Use compact icon controls for the banner's existing and new inline actions. Reuse the theme color selector and preserve canonical field updates and editor lifecycles. Keep the existing side-panel color fields compatible.

Apply the same compact actions to all widget WYSIWYG toolbars, following the owner's scope clarification. Preserve names and keyboard access, use help text to describe actions, and keep menu choices readable. Table text styles use a compact icon over the native select control.

## Rationale

This fixes the missing palette lookup and descendant-color inheritance without changing persisted color values, page mutation ownership or render/editor boundaries. Explicit light/dark outline choices work without runtime color measurement or added libraries.

## Consequences

- Existing banners remain outline-free.
- Widget colors deliberately override theme text colors only inside banner text.
- Custom templates continue to own their markup and can use the existing banner classes and configuration values.

## Links

- [PRD-0026](../../prds/0026-inline-banner-styling.md)
