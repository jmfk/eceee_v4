---
id: ADR-0035
title: Plain banner text
status: accepted
date: 2026-10-21
related_prds:
  - PRD-0026
supersedes:
  - ADR-0034
superseded_by: []
---

# Plain banner text

## Decision

The owner narrowed the scope to clean banner text without an outline. Remove the new outline field and toolbar action; ignore any stored outline choices from the initial implementation. Explicitly render banner text without a text shadow, including nested headings and links.

Keep text and background color controls in the WYSIWYG toolbar. Palette colors resolve through theme variables, and the banner's explicit text color overrides theme typography within its text area. Retain the compact icon actions and descriptive help across all widget text, image and table toolbars.

Preserve canonical config updates, editor instances and text selection through color palette interactions. Custom templates continue to own their markup. An exact passthrough template uses canonical React output directly.

## Rationale

This is the smallest complete solution for the current need. Theme-defined outline styles, additional color logic and their management UI are deferred until the owner chooses to revisit them. No theme storage changes, data rewrite or database migration are needed.

## Links

- [PRD-0026](../../prds/0026-inline-banner-styling.md)
- [Superseded ADR-0034](../archive/0034-banner-presentation-overrides.md)
