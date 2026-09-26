---
id: PRD-0009
title: Named theme versions
status: completed
locked: true
created: 2026-09-26
related_adrs:
  - ADR-0010
---

# PRD-0009: Named Theme Versions

## Problem

Theme history has automatic local sequence numbers, but designers cannot mark meaningful milestones or recognize important versions without interpreting timestamps and technical source labels.

## Goals

- Keep an automatic, immutable numbered history for every theme.
- Let designers create named checkpoints from the current theme.
- Let designers add or change the display name of an existing version without changing its saved design.
- Make numbered and named versions easy to distinguish in the Theme overview.

## Non-Goals

- Replace automatic snapshot creation with manual releases.
- Add semantic-version parsing, branches, tags, approval workflows, or automatic conflict merging.
- Make version names part of theme rendering or stable cross-installation identity.
- Delete or rewrite historical theme snapshots.

## Users and Use Cases

- A designer saves the current theme as “Approved 2027” before starting a redesign.
- A designer names an automatically created historical version “Before rebrand”.
- A designer identifies and restores a version by both its local number and its human-readable name.

## Requirements

- Every theme version retains its immutable, monotonically increasing local version number.
- A version may have an optional human-readable name.
- Creating a named checkpoint always appends a new snapshot, even when its content matches the current version.
- Changing a version name changes metadata only and does not alter the snapshot, hash, number, source, author, or timestamp.
- Empty names remove the human-readable name.
- Version creation and naming use existing Designer theme permissions and tenant isolation.
- Restore continues to append a new numbered version instead of rewriting history.

## Acceptance Criteria

- Version history displays `v<number>` for every entry and the name when present.
- A designer can create a named checkpoint of the current theme from the Theme overview.
- A designer can add, change, or remove a version name from the Theme overview.
- A named checkpoint with unchanged content receives the next local number.
- A version renamed by a user retains the same snapshot and content hash.
- Another tenant cannot create or rename versions for the theme.

## Constraints

- Version names are presentation metadata and are not included in the theme snapshot hash.
- Existing versions remain valid and unnamed after migration.
- `sync_version` remains the optimistic-concurrency counter and is not replaced by the history number.

## Implementation Notes

- 2026-09-26: Implementation started on `codex/shared-admin-render-layer` as part of the existing Theme/Designer workflow batch.
- 2026-09-26: Added optional version names, explicit named checkpoints, metadata-only renaming, and numbered/name-aware Theme overview controls.

## Linked ADRs

- [ADR-0010: Numbered snapshots with mutable display names](../adrs/active/0010-named-theme-version-checkpoints.md)

## Completion Evidence

- Backend: 41 focused Django tests passed across theme versions, Designer contracts, and theme-owned preview content.
- Frontend: 31 focused Vitest tests passed across the Theme overview, Designer workspace, preview content editor, and render adapter.
- Migration `0076_themeversion_name` applied successfully to the local development database; `makemigrations --check` reported no drift.
- Frontend lint and production build passed with the repository's existing warnings; touched backend files passed Black, isort, and Flake8.
- Local browser review confirmed numbered history, current-version marking, checkpoint naming, and rename controls in the existing Theme card design.
