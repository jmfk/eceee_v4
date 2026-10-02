---
id: ADR-0015
title: Revision-based optimistic page collaboration
status: accepted
date: 2026-10-02
related_prds:
  - PRD-0013
supersedes: []
superseded_by: []
---

# ADR-0015: Revision-Based Optimistic Page Collaboration

## Context

ADR-0001 and ADR-0002 establish one canonical editable version and one complete-snapshot write boundary. Timestamp comparison protects data, but it is not an explicit ordering token, and the current client merge treats ordered JSON arrays by position. Robust concurrent editing needs stronger ordering and identity semantics without introducing page branches, partial mutation endpoints, or real-time text synchronization.

## Decision

Each PageVersion carries a monotonic `edit_revision` and nullable `last_edited_by`. New clients submit `expected_revision`; the server compares it while holding the existing page-then-version row locks, increments it once for each committed mutation, and returns the current snapshot on conflict. `client_updated_at` remains a deprecated safe fallback during an additive compatibility period.

The client retains a base snapshot, local draft, and latest server snapshot. It performs a three-way merge keyed by `id` or `_id` for identified collections and treats unidentified arrays as atomic values. Independent edits are rebased and retried a bounded number of times; overlapping edits require explicit resolution. Rich-text values remain atomic.

WebSocket update events are emitted on transaction commit and include the revision. The page editor also carries ephemeral, tenant-authorized presence messages. Presence is advisory and maintained by join, announce, heartbeat, and leave messages rather than a persistent store.

## Rationale

An integer revision is unambiguous under row locking, stable widget identities avoid index-shift corruption, and client-side rebasing preserves the validated full-snapshot backend boundary. Ephemeral presence reuses the existing Channels connection without adding an operational dependency or a blocking lock lifecycle.

## Consequences

- A small non-destructive PageVersion migration is required.
- New clients get deterministic ordering and richer conflict responses.
- Old clients remain safe but do not gain revision ordering until upgraded.
- Array reordering and delete-versus-edit cases remain deliberately conservative.
- Presence disappears when the WebSocket path is unavailable, while save safety remains intact.

## Alternatives Considered

- Section leases: rejected because they reintroduce lock ownership, expiry, and takeover behavior while still not merging edits.
- Server-side operation logs or per-save snapshots: rejected as unnecessary storage and lifecycle complexity for save-based collaboration.
- CRDT/OT: rejected because character-level co-editing is outside the current product need.

## Links

- Related PRD: [PRD-0013](../../prds/0013-robust-concurrent-page-editing.md)
- Extends [ADR-0001](0001-canonical-page-version-workflow.md) and [ADR-0002](0002-single-page-workflow-mutation-boundary.md).
