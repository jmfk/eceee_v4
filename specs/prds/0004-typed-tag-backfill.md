---
id: PRD-0004
title: Typed tag backfill
status: completed
locked: true
created: 2026-09-25
related_adrs:
  - ADR-0005
---

# PRD-0004: Typed Tag Backfill

## Problem

ECEEE stores content tags, media tags, page-version tag names, widget discovery tags, and AI tag suggestions in different formats. Content and media therefore cannot share one typed taxonomy without a safe migration path.

## Goals

- Introduce one tenant- and namespace-scoped canonical tag model with a type.
- Backfill content tags, media tags, page-version tags, media-file tags, and media-collection tags without interrupting existing behavior.
- Make the backfill idempotent, resumable, auditable, and independently verifiable.
- Preserve existing API contracts during the expansion and backfill phase.

## Non-Goals

- Switching production reads to the canonical tag model in this change.
- Removing existing content or media tag storage.
- Migrating widget discovery keywords or unapproved AI suggestions.
- Automatically inferring semantic tag types beyond the `general` default.

## Users and Use Cases

- Editors continue tagging pages and media without a changed workflow during migration.
- Operators can run, interrupt, resume, and verify the backfill safely.
- Future features can classify canonical tags as topics, people, organizations, places, events, or other configured types.

## Requirements

- Canonical tags use UUID identifiers and belong to exactly one tenant and namespace.
- Tag identity is unique by tenant, namespace, type, and normalized slug.
- Existing tag names and presentation metadata are preserved where available.
- Page-version tag order is preserved.
- Legacy-to-canonical mappings are durable and unique per source record.
- Each independently processed source object has a stable work-unit identifier and durable completion record.
- Reusing a run identifier with a different effective configuration or source fingerprint must fail closed.
- Existing fields and API representations remain available and unchanged.

## Acceptance Criteria

- Schema migrations add canonical tags and parallel relations without deleting legacy data.
- A management command can backfill all supported legacy sources in bounded batches.
- Re-running or resuming the command does not duplicate tags, relations, mappings, or completion records.
- Verification reports missing, extra, or inconsistent canonical relations and returns a failure status for discrepancies.
- Automated tests cover a complete run, interruption/resume, idempotency, and fingerprint mismatch.
- Existing focused tag and page-version tests continue to pass.

## Constraints

- Production database changes must go through repository migrations and deployment scripts.
- Tenant and namespace boundaries must never be crossed when merging tags.
- The expansion phase must remain reversible by returning reads to legacy storage.

## Implementation Notes

- 2026-09-25: Implementation started with an expand-only schema and database-backed resumable backfill.
- 2026-09-25: Added the operator runbook at `docs/TYPED_TAG_BACKFILL.md`.

## Linked ADRs

- [ADR-0005: Canonical typed tag taxonomy](../adrs/active/0005-canonical-typed-tag-taxonomy.md)

## Completion Evidence

- Canonical taxonomy schema and parallel page/media relations are defined in migrations.
- `backfill_typed_tags` provides database-backed checkpoints, cooperative interruption, resume, source/config fingerprints, and verification.
- PostgreSQL verification: 92 focused taxonomy, content, media-model, and page-version workflow tests passed on 2026-09-25.
- Django system checks and migration drift checks passed on 2026-09-25.
- Specs governance validation passed on 2026-09-25.
