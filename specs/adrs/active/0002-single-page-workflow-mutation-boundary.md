---
id: ADR-0002
title: Single page workflow mutation boundary
status: accepted
date: 2026-09-22
related_prds:
  - PRD-0001
  - PRD-0002
supersedes: []
superseded_by: []
---

# ADR-0002: Single Page Workflow Mutation Boundary

## Context

Direct page updates, granular version endpoints, implicit subtree publication, and legacy bulk operations bypass parts of the reviewed-version contract. Keeping compatibility behavior creates multiple subtly different concurrency models.

## Decision

The complete working-copy save endpoint is the only page-editor write boundary. It requires the last observed version timestamp, validates the whole submitted state, and cannot change the owning page. Publication and scheduling use the workflow service and an explicit reviewed version timestamp. Multi-page actions accept explicit page/version/timestamp items. Legacy mutation and implicit subtree endpoints return HTTP 410.

Restoring history into an existing working copy uses the same last-observed timestamp rule. A stale restore returns a conflict instead of replacing newer editor work, and the client reloads the returned working-copy snapshot after a confirmed restore.

Version-controlled `WebPage` attributes (`title`, `description`, `slug`, `path_pattern_key`, and `hostnames`) cannot be changed through the ordinary page update endpoint. Tree affordances for these attributes route to the page settings editor, while structural page-tree fields remain directly writable.

When a scheduled version cannot activate because its slug has become unavailable, the workflow restores the previous live version's expiry and converts the rejected schedule back into a working draft with failure metadata.

Frontend deployment reloads are gated by the existing Unified Data Context dirty metadata for page, theme, and object editing. The reload guard is read-only: editors remain responsible for setting and clearing their own dirty state, while the guard defers a detected-version reload until every dirty signal is clean.

## Rationale

One boundary makes optimistic locking, schema validation, authorization, and public-state transitions consistent and testable. A clean breaking change is safer than preserving endpoints whose semantics cannot satisfy the invariant.

## Consequences

- Old web clients must reload before they can save or publish.
- External legacy mutation clients must migrate to workflow endpoints.
- Descendant publication is temporarily unavailable rather than operating on unreviewed inferred versions.
- Scheduled activation failures remain recoverable and do not leave contradictory dates.
- A newly deployed frontend does not automatically discard unsaved page, theme, or object edits; the pending reload resumes after save or undo makes the shared editor state clean.

## Alternatives Considered

- Keep compatibility endpoints and route them internally: rejected because partial payloads lack a single reviewed snapshot and timestamp contract.
- Silently retry stale saves using the latest timestamp: rejected because it can overwrite another editor's changes.
- Leave failed schedules pending: rejected because the predecessor may already have been expired.

## Links

- Related PRDs: [PRD-0001](../../prds/0001-simplified-page-versioning.md), [PRD-0002](../../prds/0002-page-workflow-invariant-hardening.md)
