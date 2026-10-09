---
id: PRD-0016
title: Assessed site imports with selectable dependencies
status: completed
locked: true
created: 2026-10-09
related_adrs:
  - ADR-0018
---

# PRD-0016: Assessed Site Imports with Selectable Dependencies

## Problem

Site imports start before administrators can see which themes and media the site depends on. ZIP imports cannot supplement missing theme packages, and the current copy/update choices do not express the intended Update, Clone, and Replace workflows across site content, media, and themes.

## Goals

- Assess every remote or ZIP import before changing workspace data.
- Show the site, referenced themes, and referenced media that are available or missing.
- Let administrators select site content, media, themes, or any combination for import.
- Support Update, Clone, and Replace behavior with explicit, safe semantics.
- Retrieve selected dependencies from a remote site or accept optional theme ZIP files for a local import.
- Complete an import with warnings when an optional dependency package is unavailable.

## Non-Goals

- Delete unrelated workspace themes, media, namespaces, or sites.
- Reconcile arbitrary changes between two themes field by field.
- Preserve source hostnames on cloned sites.
- Make missing binary assets fatal when the remaining selected content is valid.

## Users and Use Cases

- An administrator selects a remote site, reviews its dependencies, and imports the site plus selected themes and media.
- An administrator selects a site ZIP, sees which referenced themes are included or missing, and supplies zero or more theme ZIPs before continuing.
- An administrator updates a previously imported site while preserving mapped local identifiers.
- An administrator creates a separate clone and optionally places imported media in a new namespace.
- An administrator replaces the previously bound site graph while leaving unrelated workspace data untouched.

## Requirements

- Import is a two-step flow: assess, then review and start.
- Assessment must not mutate pages, themes, media, bindings, or namespaces.
- Assessment reports package identity, counts, referenced themes, included dependencies, missing dependencies, and matching local targets.
- Site, media, and themes are independently selectable. At least one resource type must be selected.
- One selected mode applies to the selected resource types:
  - Update adds new records and applies changed package data to existing stable-key/bound records while preserving local identifiers.
  - Clone creates independent records. Site hostnames are removed. The user may create a separate media namespace for cloned media.
  - Replace makes the selected imported graph match the source package. Deletion is limited to records previously bound to that imported graph; unrelated workspace records remain untouched.
- Remote assessment and import use the saved remote connection. Remote export includes only the selected dependency types.
- ZIP assessment accepts a site package. The review step accepts optional theme ZIP supplements for missing referenced themes.
- An absent, unreadable, or mismatched optional theme ZIP produces an assessment/import warning and does not prevent valid selected resources from importing.
- Page versions whose theme is unavailable remain importable and fall back through the existing effective/default-theme behavior with a warning.
- Existing tenant authorization, ZIP safety limits, remote capability checks, immutable published-version rules, and background job behavior remain enforced.

## Acceptance Criteria

- Selecting a site ZIP shows an assessment before the Import action is enabled.
- Selecting a remote site shows an assessment before the Import action is enabled.
- The review identifies every referenced theme as included, locally matched, remotely available, supplied, or missing.
- Administrators can select any non-empty combination of Site, Media, and Themes.
- Update preserves mapped page/theme identifiers and local unbound additions.
- Clone creates a separate hostname-free root and can place imported media in a newly named namespace.
- Replace removes stale bound pages for the selected site but does not remove unrelated workspace content.
- Missing optional theme ZIPs result in warnings rather than a failed job.
- Focused backend and frontend tests cover assessment, selection, modes, namespace choice, missing dependencies, and authorization.

## Constraints

- Replace is scoped by stable keys and import bindings; it is not a tenant-wide reset.
- Theme and media selection can leave references unresolved, so warnings must remain visible on the completed import job.
- The existing site package remains the canonical transport. Supplemental theme ZIPs are normalized into that import pipeline rather than creating a second site importer.

## Implementation Notes

- 2026-10-09: Implementation started from `main` in `codex/site-import-modes` using an isolated worktree.

## Linked ADRs

- [ADR-0018: Assess imports and scope replacement to imported bindings](../adrs/active/0018-assessed-import-plans.md)

## Completion Evidence

- Added a read-only site-package assessment API and matching remote assessment payloads.
- Added an assessment-first import review with selectable Site, Media, and Themes scopes, Update/Clone/Replace modes, optional clone media namespaces, and optional theme ZIP supplements.
- Added binding-scoped replacement, stable-key theme updates, dependency-only imports, and non-fatal missing-theme warnings.
- Verified the complete backend site-package module (71 tests), the focused frontend workflow suite (23 tests), frontend production build, backend formatting/lint, frontend lint, and spec validation on 2026-10-09.
