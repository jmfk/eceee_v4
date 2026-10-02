---
id: PRD-0011
title: Parallel publisher test deployment
status: started
locked: true
created: 2026-09-29
related_adrs:
  - ADR-0011
  - ADR-0012
  - ADR-0014
---

# PRD-0011: Parallel Publisher Test Deployment

## Problem

The standalone TypeScript publisher cannot be validated with production-shaped content and networking until it runs beside the existing Django public renderer. Sending current public hostnames directly to an unproven renderer would make parity defects and deployment mistakes user-facing.

## Goals

- Run the TypeScript publisher as an independently health-checked production service.
- Expose three isolated test hostnames without changing existing public traffic.
- Render the content currently owned by the three public sites while keeping browser navigation and form redirects on their test hostnames.
- Provision and verify the publisher's read-only and form-write database boundaries repeatably.

## Non-Goals

- Move an existing public hostname from Django to the TypeScript publisher.
- Resolve the remaining media, navigation, dynamic-route, preview, cache, or widget parity gaps.
- Store database credentials in Git.
- Add another PostgreSQL server or database.

## Users and Use Cases

- A site owner compares the same published paths for ECEEE, Summer Study, and Industry through Django and the TypeScript publisher.
- An operator deploys or rolls back the parallel publisher with the existing production workflow.
- A developer verifies native public form behavior through the real reverse proxy and database roles.

## Requirements

- The production Compose stack builds and runs the publisher as a non-root Node service.
- Caddy routes only the three configured test hostnames to the publisher and marks their responses as non-indexable.
- The application maps each exact configured test hostname to its configured source hostname for content lookup only.
- The browser-facing host remains unchanged for relative links, form actions, and redirects.
- Existing Django public routes remain unchanged.
- Deployment applies migrations before idempotently provisioning separate rendering and form PostgreSQL roles.
- Deployment fails before backup or migration if either generated publisher password is absent or malformed.
- Readiness verifies the Django backend, publisher liveness, direct rendering, and the public HTTPS route through Caddy for every configured test host.

## Acceptance Criteria

- The publisher image builds from a clean repository Docker context and its health endpoint returns HTTP 200.
- Requests for `eceee-test.colliberty.com`, `summerstudy-test.colliberty.com`, and `industry-test.colliberty.com` resolve content from `eceee.org`, `summerstudy.eceee.org`, and `industry.eceee.org` respectively without changing the response host.
- Requests for other hostnames are not aliased.
- The rendering role can select the three required publishing tables and cannot insert.
- The form role can select only rate-limit metadata, insert submission columns, and cannot select payload data or page tables.
- Re-provisioning removes stale direct column and sequence grants plus role memberships in either direction before applying the intended grants.
- Running role provisioning more than once preserves the same privilege boundary.
- Production Compose and shell configuration pass local parsing and static checks.

## Constraints

- DNS for all three `*-test.colliberty.com` hostnames is controlled outside this repository and must point to the existing VPS before Caddy can obtain certificates.
- Django remains the CMS, schema migration owner, and current public renderer for all existing production hostnames.
- Real credentials stay in the protected production `deploy/.env` file.

## Implementation Notes

- 2026-09-29: Implementation started on `codex/publisher-test-deploy`, stacked on the public-form branch until PR #167 is merged.
- 2026-09-29: The test host is mapped inside the application instead of rewriting the upstream Host header, preserving same-origin form redirects.
- 2026-09-30: Scope expanded to three site-specific test hosts; their Linode DNS A records point to the existing VPS.
- 2026-10-02: ADR-0014 superseded deployment-owned hostname mappings with exact aliases on the intended CMS root pages; rendered-host verification remains an operational acceptance step.

## Linked ADRs

- [ADR-0011: Validate published forms and write through a dedicated PostgreSQL role](../adrs/active/0011-public-form-write-boundary.md)
- [ADR-0012: Validate the publisher through an isolated hostname alias (superseded)](../adrs/archive/0012-isolated-publisher-test-host.md)
- [ADR-0014: Resolve publisher test hosts through CMS root aliases](../adrs/active/0014-cms-root-hostname-aliases.md)

## Completion Evidence

- 2026-09-29: Publisher unit tests, lint, typecheck, production build, clean Docker build, container health probe, Compose parsing, shell parsing, ShellCheck, and Python formatting/lint checks pass locally.
- 2026-09-29: PostgreSQL 17 clean migration through `0077`, first and repeated role provisioning, and privilege probes passed in an isolated no-host-port test container.
- Merge, deployment, TLS issuance, and browser parity inspection remain operational completion steps.
