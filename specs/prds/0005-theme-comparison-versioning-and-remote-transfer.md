---
id: PRD-0005
title: Theme comparison, versioning, and remote transfer
status: completed
locked: true
created: 2026-09-26
related_adrs:
  - ADR-0006
  - ADR-0008
---

# PRD-0005: Theme Comparison, Versioning, and Remote Transfer

## Problem

Theme administrators cannot reliably tell whether two themes are identical, which one changed most recently, or what differs. Theme import, export, and remote synchronization also overwrite or duplicate mutable themes without presenting a coherent version history.

## Goals

- Compare two themes and clearly report identity, differences, and recency.
- Keep immutable versions of a theme so earlier designs remain inspectable and restorable.
- Let an administrator connect to another ECEEE installation and list, download, or upload themes.
- Record each remote download or upload as a new version at its destination.

## Non-Goals

- Merge conflicting theme values automatically.
- Persist remote passwords or API tokens.
- Synchronize pages, content, users, or settings outside a theme package.
- Replace the existing Designer draft and publish workflow.

## Users and Use Cases

- An administrator selects two themes, sees whether they are identical, sees their differing fields, and sees which was updated most recently.
- An administrator opens a theme's version history and restores an earlier design as a new current version.
- An administrator supplies a remote site, workspace, and short-lived access token, then downloads a remote theme into local version history.
- An administrator uploads a local theme to a remote installation, where it becomes a new current version.

## Requirements

- Each theme has a stable lineage identifier that survives transfer between installations.
- Theme versions are immutable snapshots with a sequential local version number, source, timestamp, author when known, and content hash.
- Saving a materially changed theme records a version; metadata-only saves with identical theme content do not create noise.
- Explicit remote downloads create a version even when the downloaded content matches an existing snapshot.
- Restoring an old version creates a new version instead of rewriting history.
- Comparison ignores operational metadata and reports changed theme paths plus the newer current theme.
- Remote access reuses the authenticated theme-sync protocol, remains scoped to the selected workspace, validates the remote URL, and never persists the supplied token.
- Only users with full workspace access may perform remote transfer.

## Acceptance Criteria

- Two current themes can be selected from the Designer theme list and reported as identical or different.
- A difference report includes the changed top-level areas and detailed paths.
- Every theme card exposes version count and a version history.
- Restoring a historical version changes the current theme and appends another history entry.
- A remote connection can list remote themes without saving its token.
- Downloading adds a local version under the matching lineage, or creates a new local theme when the lineage is unknown.
- Uploading updates or creates the matching remote theme and the remote installation records a new version.
- Tenant/workspace boundaries and existing Designer permissions remain enforced.

## Constraints

- Theme assets continue to be represented by their existing stored references in the first version of remote transfer; binary asset replication remains governed by existing package/export behavior.
- Remote operations are synchronous and intended for administrator-triggered transfers, not continuous background synchronization.
- The existing `sync_version` remains the optimistic concurrency counter; human-facing version history is separate.

## Implementation Notes

- 2026-09-26: Implementation started on `codex/shared-admin-render-layer` as an extension of the Designer theme overview.
- 2026-09-26: Implemented stable theme lineage, immutable snapshots, comparison, restore, and request-scoped remote pull/push in the Designer theme overview.

## Linked ADRs

- [ADR-0006: Immutable theme snapshots with request-scoped remote credentials](../adrs/archive/0006-theme-version-lineage.md) (superseded)
- [ADR-0008: Encrypted workspace-scoped remote theme connections](../adrs/active/0008-encrypted-workspace-remote-connections.md)

## Completion Evidence

- Backend: 24 focused Designer and theme-version tests passed against PostgreSQL.
- Frontend: 2 focused theme-overview tests passed; ESLint passed.
- Production build: Vite build passed with the existing bundle-size and mixed-import warnings.
- Database: migrations `0072` and `0073` applied successfully to the local development database, including duplicate-lineage repair for existing rows.
- Visual verification: compared two real local themes, confirmed the newer-theme and changed-path report, version controls, and the request-scoped remote-site panel.
