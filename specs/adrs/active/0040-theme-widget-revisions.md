---
id: ADR-0040
title: Theme-owned append-only widget releases
status: accepted
date: 2026-10-21
related_prds:
  - PRD-0029
supersedes: []
superseded_by: []
---

# ADR-0040: Theme-owned Append-only Widget Releases

## Context

Database-authored widget types must work without deployments while existing content retains its schema and presentation.

## Decision

Store a format-versioned widget document on PageTheme. Each type has a UUID, mutable display metadata, immutable numbered releases and a draft-only working definition. Bind instances through type=theme_widgets.<uuid> and type_version, explicitly adapted to typeVersion in JavaScript. User field keys are frontend-owned camelCase and preserved verbatim.

Resolve types per effective theme and tenant, never through mutation of the global code registry. Publish working definitions from ThemeDesignerDraft atomically with the full theme. Published definitions contain validated schema/template/source CSS and server-compiled scoped CSS. Existing releases cannot be changed or removed. Archival hides the type in new-instance selection. Exact revision lookup remains available for existing reads, edits and copies.

Use the existing jsonschema, Bleach, tinycss2 and Mustache infrastructure. HTML is sanitized after substitution; templates have no executable functions or external partials. CSS accepts ordinary scoped selectors and media queries, with external resources and global at-rules rejected. Missing references fail explicitly rather than choosing latest.

Theme saves and page/object version writes share the tenant publication lock, so compatibility checks and new pinned references cannot race. Objects carry the default theme's widget definitions into nested rendering; page-wide fonts, colors and other shared tokens still use the rendering page theme. Ordinary theme CRUD cannot write releases; Designer publication and validated import/sync paths own that mutation. Themes with releases cannot be deleted. Inherited scheduled references are checked across known ancestor activation/expiry boundaries during their active intervals, including replacement or rescheduling of an ancestor version.

## Rationale

A JSON field reuses the existing theme transaction, history and portability boundary without creating a second version store. Pinned releases permit breaking future schemas without rewriting existing data.

## Consequences

- Theme documents retain all published releases; v1 has no release garbage collection.
- Shared theme tokens are intentionally not pinned.
- Restores/imports cannot remove or mutate released history. A compatible recovery merges retained releases while selecting the restored active revision.
- Global widget endpoints need explicit theme context for dynamic types.

## Alternatives Considered

- Mutable live definitions: rejected because existing content would silently change.
- Arbitrary stored React code: rejected because it adds executable-code isolation and build infrastructure.
- Separate revision tables: deferred until concrete query or size requirements justify them.

## Links

- Related PRD: [PRD-0029](../../prds/0029-theme-widget-types.md)
