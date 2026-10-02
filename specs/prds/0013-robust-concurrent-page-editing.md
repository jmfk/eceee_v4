---
id: PRD-0013
title: Robust concurrent page editing
status: completed
locked: true
created: 2026-10-02
related_adrs:
  - ADR-0015
---

# PRD-0013: Robust Concurrent Page Editing

## Problem

The canonical working-copy workflow prevents silent overwrites, but concurrent editors still depend on timestamp equality and array-position diffs. Independent widget changes can therefore produce unnecessary conflicts, reordered arrays can be merged incorrectly, WebSocket updates can arrive out of order, and editors cannot see who else is active on the page.

## Goals

- Let editors safely save independent changes to one canonical working copy.
- Reject or explicitly resolve overlapping changes without losing either editor's work.
- Make concurrency ordering independent of wall-clock timestamps.
- Show non-blocking page-editor presence to reduce accidental overlap.

## Non-Goals

- Character-level collaborative rich-text editing with CRDT or OT.
- User-owned page branches or multiple working copies per page.
- Blocking page, section, or widget leases.
- A new Redis service or persistent presence model.

## Users and Use Cases

- Two tenant editors change different page fields or widgets and both changes are saved.
- Two editors change the same field and choose the intended value in a conflict dialog.
- An editor sees who else has the page open and which editor area they are using.
- A client that missed WebSocket updates still detects and safely rebases at save time.

## Requirements

- Each working version has a server-controlled monotonic edit revision and last-editor identity.
- New clients submit the last observed revision for every reviewed working-copy mutation.
- Timestamp-based clients remain safe during an additive compatibility period.
- Three-way merge uses stable object identities, not array indexes, whenever identities are available.
- Unidentified arrays and one rich-text value are atomic conflict units.
- WebSocket updates are sent only after database commit and carry their edit revision.
- Page-editor WebSocket access is tenant-authorized before joining a page group.
- Presence reports active editors and editor areas but never blocks editing or broadcasts page content.
- Published and historical snapshots remain immutable.

## Acceptance Criteria

- Independent page, widget, nested-slot, and metadata edits merge without silent data loss.
- Same-leaf, delete-versus-edit, and incompatible ordering changes require explicit resolution.
- Stale and out-of-order events cannot replace newer local or server state.
- Three rapid conflict-free races retry at most three times before requiring user action.
- Unauthorized users receive no page update or presence metadata.
- Legacy timestamp saves remain conflict-checked while new clients use revisions.
- Presence recovers after reconnect and expires abandoned sessions.
- Editor preview continues to show unsaved state while standalone rendering uses saved state.

## Constraints

- The complete working-copy endpoint remains the only ordinary page-editor write boundary.
- Widget identifiers must remain presentation-neutral and compatible with existing renderers.
- Historical PageVersion JSON is not bulk-rewritten to add widget identifiers.

## Implementation Notes

- 2026-10-02: Implementation started as one backend, frontend, migration, documentation, and verification batch.
- 2026-10-02: Added revision-checked workflow mutations, UUID-normalized widget identity, ID-aware three-way merge, post-commit update events, tenant-authorized advisory presence, bounded rebase/retry, and explicit field conflict resolution.

## Linked ADRs

- [ADR-0015: Revision-based optimistic page collaboration](../adrs/active/0015-revision-based-page-collaboration.md)

## Completion Evidence

- Backend: 97 focused Django workflow and WebSocket consumer tests passed, including row-locked revision checks, legacy timestamp compatibility, failed-transaction broadcasts, authorization, and presence metadata.
- Frontend: 202 focused Vitest and render-parity tests passed across merge behavior, WebSocket ordering/presence, dirty-state preservation, publishing/history, registry, editor preview, iframe preview, standalone rendering, and runtime adapters.
- Browser: all 11 page-editor Playwright regression tests passed, including two-browser-context automatic merge, same-rich-text conflict choice, and advisory presence.
- Migration `0078_pageversion_edit_revision` passed `makemigrations --check --dry-run` with no model drift.
- Touched backend files passed Black, isort, and Flake8; targeted frontend lint passed with zero errors and existing warnings; the production frontend build completed successfully.
- Specification validation and whitespace checks passed.
