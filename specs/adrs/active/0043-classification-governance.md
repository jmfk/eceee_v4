---
id: ADR-0043
title: Classification governance and staged cutover
status: accepted
date: 2026-10-22
related_prds:
  - PRD-0031
supersedes: []
superseded_by: []
---

# ADR-0043: Classification governance and staged cutover

## Context

ADR-0005 established UUID taxonomy and parallel relations. PRD-0031 extends that boundary to hierarchical classification without replacing the existing Django/React architecture or changing PRD-0004.

## Decision

Keep Tag UUIDs and legacy mappings. Add namespace-owned classification definitions, explicit grants, revisioned term operations, proposals and immutable before/after operation records. Serialize structural changes by locking the definition before locking terms; approval repeats authorization and revision checks inside the same transaction. Merge retains source identities and moves children without rewriting version assignments. Undo checks every affected revision before restoring any state.

Assignments belong to concrete content versions or media resources, preserve order, and never grant content editing access. Proposed terms may occur in drafts only. API fields use Python snake_case with explicit frontend camelCase adapters.

Keep legacy fields authoritative in expansion. Do not switch readers or remove legacy tables until resumable transfer and reconciliation pass locally and in staging. No production mutation is implied. Existing database-backed TagBackfillRun/TagBackfillUnit remain the checkpoint mechanism.

## Rationale

This extends the project's established storage and workflow boundaries. A separate service or replacement document framework would add migration risk without meeting a current need.

## Consequences

- Structural mutations need a current revision and named permissions.
- Owners and superusers administer; ordinary members can use and propose.
- The legacy cutover remains an explicit operational milestone, never an automatic schema migration.
- ADR-0005 remains active for its expansion and checkpoint decisions; this ADR defines the additional governance contract.

## Alternatives Considered

- Replace legacy storage at migration time: rejected because reconciliation must precede cutover.
- Rewrite historical assignments on merge: rejected because stable references and undo would be lost.

## Links

- [PRD-0031](../../prds/0031-shared-classification.md)
- [ADR-0005](0005-canonical-typed-tag-taxonomy.md)
