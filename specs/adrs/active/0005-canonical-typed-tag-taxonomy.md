---
id: ADR-0005
title: Canonical typed tag taxonomy
status: accepted
date: 2026-09-25
related_prds:
  - PRD-0004
supersedes: []
superseded_by: []
---

# ADR-0005: Canonical Typed Tag Taxonomy

## Context

Content tags and media tags are separate database models, while page versions store only ordered tag-name strings. Media API consumers also rely on legacy media-tag UUIDs. Replacing these structures in one migration would make rollback difficult and risk visible API changes.

## Decision

Create a small `taxonomy` Django app containing the canonical UUID-based `Tag` model, durable legacy mappings, and database-backed backfill run/work-unit state.

Add parallel canonical tag relations to page versions, media files, and media collections. Preserve page tag order with an explicit through model. During the expansion phase, existing tag fields and API representations remain authoritative.

Backfill existing content and media tags as `general` tags. Canonical identity is scoped by tenant, namespace, tag type, and slug. Widget discovery keywords and unapproved AI suggestions remain separate because they are not editorial taxonomy assignments.

## Rationale

A dedicated taxonomy boundary avoids making either the content or file-manager app the owner of a cross-domain concept. Parallel storage supports verification, rollback, and a later read cutover without downtime. Database-backed checkpoints survive process or host interruption and remain colocated with the data being migrated.

## Consequences

- Existing product behavior remains unchanged during the backfill phase.
- The transition temporarily maintains legacy and canonical tag structures together.
- A later contract phase must introduce dual-write/read cutover before legacy fields can be removed.
- Existing ambiguous or conflicting tags remain `general` until explicitly classified.

## Alternatives Considered

- Extend `content.Tag`: rejected because it would make the content app own media taxonomy and retain an integer identity incompatible with the media API's UUID-oriented contract.
- Promote `MediaTag`: rejected because it would make the file-manager app own page taxonomy.
- Replace legacy models immediately: rejected because it creates avoidable downtime, rollback, and compatibility risk.
- Store typed page tags as JSON: rejected because it would preserve duplicate sources of truth and weak referential integrity.

## Links

- Related PRDs: PRD-0004
