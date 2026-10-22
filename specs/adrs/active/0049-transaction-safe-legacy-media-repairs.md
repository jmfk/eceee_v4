---
id: ADR-0049
title: Replayable legacy media with transaction-safe placeholder repairs
status: accepted
date: 2026-10-22
related_prds:
  - PRD-0012
  - PRD-0034
supersedes:
  - ADR-0022
superseded_by: []
---

# ADR-0049: Replayable Legacy Media with Transaction-Safe Placeholder Repairs

## Context

PRD-0012 requires legacy News imports to be resumable and idempotent. URL and content-hash reconciliation prevents duplicate database records during normal reruns, but concurrent writers could still race. A process interruption after object-storage upload but before `MediaFile` creation could also leave a new UUID-named object on every retry.

The owner approved preserving the MediaFile ID while changing its file URL for placeholder repairs. ADR-0022’s in-place replacement can mutate referenced object-store bytes even when a surrounding editorial import transaction rolls back. This ADR supersedes ADR-0022 and retains its serialization, initial-key, reconciliation and remote-transport rules.

## Decision

Allow only one write-mode legacy News import at a time. The management command acquires a process-local lock and a PostgreSQL session advisory lock before sample or database writes. A competing writer exits without importing; dry runs remain concurrent and read-only.

Derive each new legacy media object-storage key deterministically from the target tenant ID, namespace ID, and complete source URL without incorporating the fetched filename, media type, or placeholder state. Replaying an interrupted import overwrites the same scoped key rather than allocating another object. If `MediaFile` creation raises after upload, make a best-effort deletion of that exact key before propagating the error.

Continue to reconcile existing media first by legacy source URL and then by content hash. Resume mode retries placeholders and retains the existing MediaFile ID. Write a repaired image to a deterministic key containing the target tenant, namespace, full source URL digest and repaired content digest. Update the MediaFile path, URL, hash, dimensions and placeholder metadata in the caller’s database transaction. Never overwrite or delete the previously referenced placeholder object during repair.

If later item work fails or the process exits before commit, the database continues to reference the untouched placeholder. A retry with the same repaired bytes converges on the same new key. A successful commit switches the record to the repaired key. No automatic rewrite of other saved HTML or published versions is performed.

Fetch remote media only through DNS-pinned HTTP(S) connections. Reject every resolved address that is not globally routable, including CGNAT, multicast, and IPv6 site-local ranges; preserve the original Host header and TLS identity; repeat validation after every redirect; and bound the response body before image validation.

## Rationale

The advisory lock removes the supported command's check-then-create race without adding migration-job infrastructure. Deterministic storage keys close the practical crash window between object storage and PostgreSQL: a hard interruption may temporarily leave an unreferenced object, but the next run converges on that same key. Exception cleanup handles ordinary database failures immediately.

## Consequences

- The original News command’s write-mode sample and database imports remain serialized across tenants and namespaces. Editorial import uses its namespace lock under ADR-0047.
- A stopped process releases the PostgreSQL advisory lock with its database session.
- New source uploads converge on one initial key. Repairs converge on one key per repaired content digest while retaining one media record, without crossing tenant or namespace boundaries.
- Existing HTML with the old literal file URL continues to use that object until explicitly refreshed/reimported; references by media ID retain identity.
- Superseded placeholder bytes remain available. Removal requires a separate reviewed reference-aware cleanup; it is not an import side effect.
- Object storage and PostgreSQL are not a distributed transaction; temporary unreferenced bytes can exist until the next replay if the process is killed at the upload boundary.
- Existing UUID-named legacy media remains valid and is reused through its metadata. Repairing such a placeholder also adopts a deterministic repair key while retaining its media ID.
- Imported image URLs cannot redirect or rebind onto loopback, private, shared, site-local, multicast, reserved, or otherwise non-global networks.

## Alternatives Considered

- Keep overwriting the referenced placeholder path: rejected because database rollback cannot restore external bytes.
- Delete the old object after repair: rejected because saved HTML may still reference it.
- Write the repaired bytes in an on-commit callback: rejected because callback failure can leave committed metadata pointing at unchanged placeholder bytes.
- Add a persistent per-row migration checkpoint model: rejected because replaying the deterministic source set already provides progress recovery with less state.
- Depend only on content-hash uniqueness: rejected because it does not prevent concurrent source-URL races or repeated orphan uploads.
- Wrap object storage and PostgreSQL in one atomic transaction: unavailable because the two systems do not share a transaction coordinator.

## Links

- [PRD-0012](../../prds/0012-legacy-news-migration.md)
- [PRD-0034](../../prds/0034-simplified-legacy-content-import.md)
- [Superseded ADR-0022](../archive/0022-replayable-legacy-news-media-imports.md)
