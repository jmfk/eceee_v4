---
id: ADR-0009
title: Store preview documents in the theme snapshot
status: accepted
date: 2026-09-26
related_prds:
  - PRD-0008
supersedes: []
superseded_by: []
---

# ADR-0009: Store Preview Documents in the Theme Snapshot

## Context

Theme previews must be editable with normal page/object content controls, survive theme versioning and remote transfer, and remain independent of live site records. Creating hidden `WebPage` or `ObjectInstance` rows would retain tenant/site workflow coupling and would require special rules throughout routing, publishing, hierarchy, search, and deletion.

## Decision

Represent each preview as a self-contained document inside `PageTheme.designer_preview`.

A page document stores copied page data, layout, and widget slots. An object document stores copied object data and widgets plus an immutable snapshot of the object type information required by the editor. The Theme Editor reuses the existing page layout/widget and object schema/widget editing primitives against these document values, but it does not invoke normal publication or version APIs.

Imports strip source identity, hierarchy, routing, inheritance, and publication fields. Images that already belong to managed local storage are copied to immutable, uniquely named files in the theme library and references in the document are rewritten. Arbitrary remote URLs are not downloaded by the server.

## Rationale

Keeping preview documents in the theme snapshot makes theme ownership explicit and automatically includes the content in theme comparison, versions, export/import, and remote transfer. Reusing editor primitives preserves authoring parity without pretending that preview examples are publishable content records.

## Consequences

- Preview documents travel with the theme and have no lifecycle dependency on their source records.
- Editing shares page/object content controls but intentionally excludes routing, hierarchy, publishing, scheduling, and version history.
- Object type changes do not silently alter existing examples because imports retain a schema snapshot.
- Theme JSON can grow with representative content; source listing and import endpoints must apply tenant permissions and bounded payload rules.
- Library files copied for an import may remain unused if an unsaved preview is discarded and can be removed with the existing image-library tools.

## Alternatives Considered

- Hidden pages and objects in a synthetic demo site: rejected because it preserves the coupling the feature is intended to remove and leaks preview records into normal content workflows.
- Store only source IDs and render the live source: rejected because previews would change or break with source content and could cross site boundaries at render time.
- Build separate preview-only editors: rejected because page/object authoring behavior would drift from the normal editors.

## Links

- Related PRDs: PRD-0008
