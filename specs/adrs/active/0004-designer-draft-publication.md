---
id: ADR-0004
title: Theme-scoped Designer draft and atomic reference publication
status: accepted
date: 2026-09-24
related_prds:
  - PRD-0003
supersedes: []
superseded_by: []
---

# ADR-0004: Theme-Scoped Designer Draft and Atomic Reference Publication

## Context

Designer value edits and asset uploads must be reviewed together before they affect a live theme. Database changes can be transactional, but S3-compatible object storage cannot join that transaction.

## Decision

Maintain one shared `ThemeDesignerDraft` per theme. The draft stores the approved editable theme snapshot, its live base version, and an optimistic draft version. Uploaded assets are written to immutable draft-specific object keys and referenced only by the draft snapshot.

Publish locks the live theme and draft, verifies both versions, records one pre-publication revision, copies all draft fields onto `PageTheme`, and saves the theme once inside a database transaction. The already-uploaded immutable objects require no move or overwrite during publication.

## Rationale

This is the smallest model that provides persistent reviewable work, prevents partial live updates, supports multiple assigned designers without hidden private branches, and gives database publication a clear atomic boundary.

## Consequences

- All assigned designers for a theme see the same draft and receive conflicts for stale edits.
- Staged objects may need later lifecycle cleanup when drafts are discarded or assets are replaced.
- Unused library assets remain read-only in the first version because replacing a fixed object key cannot satisfy the atomic publication boundary.
- Advanced live-theme edits make an existing draft stale; the designer must discard or explicitly rebase in a future workflow.

## Alternatives Considered

- Per-user drafts: rejected because publication ownership and collaboration become ambiguous without a broader branching product model.
- Overwrite live object keys at publish time: rejected because object storage writes cannot be rolled back with the database transaction.
- Keep changes only in browser memory: rejected because uploads and longer review sessions require durable state.

## Links

- Related PRDs: PRD-0003
