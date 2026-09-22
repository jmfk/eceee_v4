---
id: ADR-0001
title: Canonical page version workflow
status: accepted
date: 2026-09-22
related_prds:
  - PRD-0001
supersedes: []
superseded_by: []
---

# ADR-0001: Canonical Page Version Workflow

## Context

The page editor currently treats a selected `PageVersion` as both an editable document and a publication record. Multiple UI surfaces independently infer "current", "latest", and publication state, and several actions publish the latest version rather than a version the user explicitly reviewed.

## Decision

`PageVersion` remains the storage and history model. For each page, one canonical editable version is derived as the highest-numbered version whose publication state is draft or scheduled. Only that version may be changed.

Published, expired, superseded, and older draft versions are immutable history. If no editable version exists, an idempotent workflow operation creates one by copying the live version or, for an unpublished page, the latest historical content. Publish, schedule, cancel schedule, unpublish, restore, and bulk publication target explicit version IDs. Aggregate workflow state is computed by one backend service and returned to all editing clients.

Existing extra drafts and schedules are preserved. They are surfaced as legacy conflicts rather than silently deleted or cancelled.

## Rationale

This separates editing from publication, gives Save a stable meaning, prevents accidental mutation of live content, and makes the target of every publication operation auditable. Explicit version references also provide a safe boundary for a future persistent release-packet model.

## Consequences

- Ordinary authors no longer create or select arbitrary versions.
- Existing clients may continue reading legacy endpoints temporarily, but mutations are subject to the canonical workflow rules.
- Legacy pages can have conflicts that require manual resolution before a new schedule is accepted.
- Scheduled content remains editable and therefore changes up to its effective time are intentional changes to the scheduled release.
- Multi-page operations remain non-atomic until a separate packet design is implemented.

## Alternatives Considered

- Mutate the published version directly: rejected because Save could change public output.
- Create a new version on every save: rejected because it exposes storage mechanics and produces noisy history.
- Add a persistent `working_version` foreign key: rejected for this iteration because time-based scheduled transitions would make the pointer stale and require a separate transition worker.
- Delete or normalize legacy drafts and schedules: rejected because the migration would be destructive.

## Links

- Related PRDs: [PRD-0001](../../prds/0001-simplified-page-versioning.md)
