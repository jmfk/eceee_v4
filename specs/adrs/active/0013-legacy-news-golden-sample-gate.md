---
id: ADR-0013
title: Gate the legacy News migration through canonical golden samples
status: accepted
date: 2026-09-30
related_prds:
  - PRD-0012
supersedes: []
superseded_by: []
---

# ADR-0013: Gate the Legacy News Migration through Canonical Golden Samples

## Context

Legacy News combines Mezzanine-era HTML, metadata, generic taxonomies, and media URLs. Public pages are useful rendering evidence but do not reveal authoritative taxonomy assignments. A direct full-database import would combine schema, transformation, rendering, and operational risks in one irreversible validation step.

## Decision

Use four named public articles and one labelled synthetic article as a golden sample gate. Both sample and database modes call the same transformer, sanitizer, widget builder, media importer, placeholder generator, and idempotent object upsert. Database taxonomy data becomes authoritative only after a read-only tunnel dry-run.

Store semantic article body content as object-version widgets; keep identity and publish routing on `ObjectInstance`, typed fields on `ObjectVersion.data`, and legacy IDs/checksums in metadata. Model News facets as five object types: `news_type`, `news_category`, `news_source`, `news_topic`, and `news_keyword`.

Treat PostgreSQL definitions configured through the React object-type editor as authoritative. The migration has a read-only definition preflight: all six types must be active in the selected namespace and the News fields and main slot must match the migration contract. The importer does not create, update, or repair object definitions.

Unavailable images receive deterministic informative placeholders instead of aborting the article. All imported media are tagged `legacy` and `news`; placeholders also receive `migration-placeholder`. Resume mode may replace a placeholder when its original becomes available.

Connect to legacy PostgreSQL only through `127.0.0.1:10110` using a separately provisioned SELECT-only role. Keep AI tagging out of sample acceptance and make any later pilot cached, capped, and non-blocking.

## Rationale

The sample gate isolates transformation and rendering defects before database scale and taxonomy complexity are introduced. A shared pipeline prevents sample-only behavior from becoming false confidence. Deterministic identities and placeholders make reruns safe and allow failed media to be repaired later.

## Consequences

- Public HTML remains evidence for presentation, not authoritative taxonomy data.
- Import code must explicitly reconcile source identities and hashes on every run.
- Operators must configure compatible definitions before importing; schema changes remain visible product configuration rather than hidden Python-side migration behavior.
- Operators must provision and rotate the legacy read credential outside the repository.
- Screenshot evidence depends on a running local stack and is produced after fixture import, not checked in as copied legacy content.
- AI enrichment can improve discoverability later without becoming a migration dependency.

## Alternatives Considered

- Import the entire database first and repair problems in place: rejected because schema and renderer errors would be multiplied across the archive.
- Store legacy HTML as one opaque field: rejected because it bypasses the v4 widget object system and preserves unsafe/presentational markup.
- Omit failed images: rejected because silent loss makes reconciliation impossible and degrades affected articles unpredictably.
- Infer all taxonomies from public pages: rejected because the public representation is incomplete.

## Links

- Related PRDs: PRD-0012
- Reserved local tunnel port: 10110 (`legacy-postgres-tunnel`)
