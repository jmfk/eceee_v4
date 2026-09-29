---
id: ADR-0011
title: Validate published forms and write through a dedicated PostgreSQL role
status: accepted
date: 2026-09-29
related_prds:
  - PRD-0010
supersedes: []
superseded_by: []
---

# ADR-0011: Validate Published Forms and Write through a Dedicated PostgreSQL Role

## Context

The public publisher currently uses a read-only PostgreSQL connection. Public forms require a write path, but forwarding visitor-controlled data to arbitrary widget URLs would create SSRF, tenancy, validation, and operational risks. Reusing the broad read credential for writes would also weaken the publisher's existing safety boundary.

## Decision

Add a publisher-owned POST endpoint that re-resolves the hostname and current published page through the existing read-only snapshot, locates the form widget recursively, validates submitted values against that published widget configuration, and inserts only the validated payload through a separate `PUBLISHER_FORM_DATABASE_URL` connection. Django owns the corresponding schema migration but is not called at request time.

The first iteration stores submissions only. It rejects file fields and does not deliver email, webhooks, or arbitrary `submit_url` destinations. Native POST plus same-origin redirect is the baseline interaction; editor and preview modes remain inert.

## Rationale

This is the smallest complete submission journey that preserves the established direct-database publisher architecture. Re-resolving published content makes the server authoritative, while a distinct write credential allows production grants to be limited to insertion into one table.

## Consequences

- Deployment needs a second PostgreSQL credential with narrowly scoped `SELECT` and `INSERT` grants on the submission table; the UUID primary key requires no sequence grant.
- The endpoint performs a published-page read before each accepted write.
- Existing `submit_url`, email, webhook, CAPTCHA, and file configuration is intentionally not honored by the public publisher yet.
- Stored JSON is bounded and schema-validated but can contain personal data; retention and operator access remain follow-up work.

## Alternatives Considered

- Django/DRF submission endpoint: rejected because the public publisher is intended to operate without Python request APIs.
- Browser submission directly to configured external URLs: rejected because it trusts mutable destinations and creates CORS, privacy, and SSRF-adjacent operational risks.
- Reuse the publisher read credential with broader grants: rejected because it expands the blast radius of every public page request.

## Links

- Related PRDs: PRD-0010
