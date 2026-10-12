---
id: ADR-0022
title: Serialize legacy News imports and use replayable media keys
status: accepted
date: 2026-10-12
related_prds:
  - PRD-0012
supersedes: []
superseded_by: []
---

# ADR-0022: Serialize Legacy News Imports and Use Replayable Media Keys

## Context

PRD-0012 requires legacy News imports to be resumable and idempotent. URL and content-hash reconciliation prevents duplicate database records during normal reruns, but concurrent writers could still race. A process interruption after object-storage upload but before `MediaFile` creation could also leave a new UUID-named object on every retry.

## Decision

Allow only one write-mode legacy News import at a time. The management command acquires a process-local lock and a PostgreSQL session advisory lock before sample or database writes. A competing writer exits without importing; dry runs remain concurrent and read-only.

Derive each new legacy media object-storage key deterministically from the complete source URL while preserving a bounded file extension. Replaying an interrupted import overwrites the same key rather than allocating another object. If `MediaFile` creation raises after upload, make a best-effort deletion of that exact key before propagating the error.

Continue to reconcile existing media first by legacy source URL and then by content hash. Resume mode retries placeholders and overwrites the existing media path so object and widget references retain the same media ID.

## Rationale

The advisory lock removes the supported command's check-then-create race without adding migration-job infrastructure. Deterministic storage keys close the practical crash window between object storage and PostgreSQL: a hard interruption may temporarily leave an unreferenced object, but the next run converges on that same key. Exception cleanup handles ordinary database failures immediately.

## Consequences

- Write-mode sample and database imports are deliberately serialized across tenants and namespaces.
- A stopped process releases the PostgreSQL advisory lock with its database session.
- Replaying a source URL converges on one storage key and one media record.
- Object storage and PostgreSQL are not a distributed transaction; temporary unreferenced bytes can exist until the next replay if the process is killed at the upload boundary.
- Existing UUID-named legacy media remains valid and is reused through its metadata; only newly created media adopts deterministic keys.

## Alternatives Considered

- Add a persistent per-row migration checkpoint model: rejected because replaying the deterministic source set already provides progress recovery with less state.
- Depend only on content-hash uniqueness: rejected because it does not prevent concurrent source-URL races or repeated orphan uploads.
- Wrap object storage and PostgreSQL in one atomic transaction: unavailable because the two systems do not share a transaction coordinator.

## Links

- Related PRDs: PRD-0012
