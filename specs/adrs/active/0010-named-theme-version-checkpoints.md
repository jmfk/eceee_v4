---
id: ADR-0010
title: Numbered snapshots with mutable display names
status: accepted
date: 2026-09-26
related_prds:
  - PRD-0009
supersedes: []
superseded_by: []
---

# ADR-0010: Numbered Snapshots with Mutable Display Names

## Context

`ThemeVersion` already provides append-only snapshots and local sequence numbers. Designers also need durable, recognizable milestones, but treating names as separate themes or replacing numbers with free-form identifiers would weaken ordering, restore behavior, and remote lineage.

## Decision

Keep the local `version_number` as the canonical chronological identifier and add an optional display `name` to each immutable snapshot. Creating a named checkpoint force-appends the current theme snapshot with the next number. A version name may be changed independently as metadata; the snapshot and its content hash remain immutable.

## Rationale

This preserves the existing history and restore invariants while adding the smallest useful release-management layer. Designers get recognizable milestones, and integrations can continue to rely on stable numeric ordering and hashes.

## Consequences

- Existing versions migrate as unnamed versions without data rewriting.
- Multiple numbered versions may intentionally contain identical snapshots.
- Snapshot immutability excludes the mutable display name.
- Version names are local metadata in this iteration and are not cross-installation lineage identifiers.

## Alternatives Considered

- Semantic versions as the canonical identifier: rejected because parsing, ordering, uniqueness, and branching policy are not yet validated needs.
- Separate theme rows for named designs: rejected because it breaks lineage and page references.
- Immutable names assigned only at creation: rejected because important automatic versions often need to be labeled after inspection.

## Links

- Related PRDs: PRD-0009
