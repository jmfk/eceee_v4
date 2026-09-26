---
id: PRD-0008
title: Theme-owned preview content
status: completed
locked: true
created: 2026-09-26
related_adrs:
  - ADR-0009
---

# PRD-0008: Theme-Owned Preview Content

## Problem

Theme previews are currently small metadata records with hand-edited text overrides. They cannot be authored like normal pages or objects, and copying representative content from an existing site leaves no complete, independent example that can travel with the theme.

## Goals

- Let a theme contain complete preview pages and preview objects.
- Let those previews be edited with the same content fields and widget-building interactions used by normal pages and objects.
- Let an editor copy an existing page or object from any site in the current tenant into a theme preview.
- Make imported preview content independent of its source site and copy its images into the theme image library.
- Keep preview content inside theme versioning, export, import, comparison, and remote transfer.

## Non-Goals

- Publish theme preview content as a live site page or object.
- Preserve page hierarchy, hostnames, routes, publication schedules, workflow state, or inheritance after import.
- Keep imported previews synchronized with their source content.
- Copy an entire source site or recursively clone referenced pages and objects.

## Users and Use Cases

- A theme editor creates an empty preview page, chooses a layout, adds widgets, and fills it with representative content.
- A theme editor creates a preview object from an object type and fills its schema fields and widget slots.
- A theme editor imports a page or object from any site in the current tenant, then changes the copied content without changing the source.
- A designer chooses one of the theme-owned examples while evaluating the theme.

## Requirements

- Each preview has a stable identifier, visible name, kind (`page` or `object`), and a complete theme-owned content snapshot.
- Page snapshots contain their layout, page data, and widget slots without site, route, parent, inheritance, publication, or live-version identity.
- Object snapshots contain an object-type schema snapshot, object data, and widget slots without source-instance hierarchy, publication, or live-version identity.
- Source pickers list pages and objects only from the current tenant and identify their site or object type clearly.
- Import is a copy operation. Later source changes do not affect the preview and preview edits do not affect the source.
- Images found in imported content are copied into the destination theme's image library and content references are rewritten to the copied files.
- Existing legacy preview text metadata remains readable during migration, but new previews use complete content snapshots.
- Preview content is saved as part of the theme and follows existing theme permissions and tenant isolation.

## Acceptance Criteria

- An editor can add, rename, edit, and remove a theme preview page without creating a `WebPage`.
- An editor can add, rename, edit, and remove a theme preview object without creating an `ObjectInstance`.
- A page copied from a tenant site renders from copied layout, page data, and widgets after the source page is changed or deleted.
- An object copied from the tenant renders and edits from copied schema, data, and widgets after the source object is changed or deleted.
- Imported content contains no source hostname, route, parent, site, publication, or database-version identifiers.
- Referenced imported images resolve from `theme_images/<theme-id>/library/`.
- A user cannot list or import sources from another tenant.
- Theme export/import and remote theme transfer retain the preview content and its library images.

## Constraints

- Reuse the existing page/object editing primitives; do not fork separate widget or schema editors for theme previews.
- The source records remain read-only throughout import.
- Image copying must use bounded, validated storage operations and must not fetch arbitrary external URLs server-side.
- Theme previews do not participate in page/object publishing workflows.

## Implementation Notes

- 2026-09-26: Implementation started on `codex/shared-admin-render-layer` as part of the existing Theme/Designer workflow batch.
- 2026-09-26: Preview pages and objects are stored as detached documents in `PageTheme.designer_preview`; imports copy managed images into the theme library and the Designer render adapter consumes the stored widget slots.
- 2026-09-26: Designer no longer synthesizes demo documents from layouts. Empty sources render an explicit empty state, while theme documents and tenant pages/objects are selected through searchable comboboxes.

## Linked ADRs

- [ADR-0009: Store preview documents in the theme snapshot](../adrs/active/0009-theme-preview-documents.md)

## Completion Evidence

- Backend: 31 focused Django tests passed for preview import, tenant isolation, Designer workspace contracts, image copying, and package URL rewriting.
- Frontend: 27 focused Vitest tests passed for Theme Editor authoring, searchable page/object selection, empty Designer states, Designer rendering, and render-frame behavior.
- Production frontend build passed; touched backend files passed Black, isort, and Flake8.
- Local browser review confirmed that pages from both tenant sites are available, the combined selector filters by site/content text, a new preview page opens the normal layout/widget editor, and the controls match the existing Theme Editor layout.
