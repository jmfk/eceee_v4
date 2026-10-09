---
id: ADR-0021
title: Destination-owned transfer checkpoints
status: accepted
date: 2026-10-09
related_prds:
  - PRD-0019
supersedes: []
superseded_by: []
---

# ADR-0021: Destination-Owned Transfer Checkpoints

## Context

Remote transfers can change database rows and owned files across objects, pages, media, and themes. A source-side export is not a reliable rollback point because it describes incoming state rather than the destination state being replaced. Database and object storage also cannot participate in one atomic transaction.

## Decision

Every transfer mutation is wrapped by a destination-owned checkpoint adapter. The adapter resolves the exact destination scope from the validated, assessed transfer package, persists a private immutable manifest and any required owned binaries before mutation starts, and records the identifiers created by the completed mutation. A checkpoint failure aborts the write.

Each transfer domain owns serialization and restoration of its records behind the shared checkpoint lifecycle. Restoration is tenant-scoped, asynchronous where required, and creates a new checkpoint of the state it is about to replace. Transfer endpoints cannot opt out of the guard.

The first adapter covers bounded object-package imports from PRD-0018. Page, theme, and mapped-branch publishing adopt the same lifecycle as their write paths are introduced.

## Rationale

The destination is the only authority that can capture the state that must be restored. Domain adapters keep snapshots explicit and testable without building a speculative universal serializer, while a shared lifecycle gives administrators one durable audit and restore model.

## Consequences

- A transfer cannot start while its checkpoint data is incomplete.
- Checkpoint storage grows until an administrator explicitly deletes it.
- Every new transfer domain must implement and test capture, mutation recording, and restoration.
- Binary capture must finish before the database mutation transaction begins.

## Alternatives Considered

- Reuse the incoming transfer package as the rollback artifact: rejected because it contains source state, not the destination state.
- Depend only on database or infrastructure backups: rejected because they are too broad and do not provide tenant-scoped operation rollback.
- Build a generic model serializer for every resource type: rejected because domain invariants and object-storage ownership require explicit adapters.

## Links

- Related PRDs: PRD-0019
- Builds on [ADR-0020](0020-bounded-remote-object-packages.md).
