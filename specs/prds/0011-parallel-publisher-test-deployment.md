---
id: PRD-0011
title: Parallel publisher test deployment
status: started
locked: true
created: 2026-09-29
related_adrs:
  - ADR-0011
  - ADR-0012
---

# PRD-0011: Parallel Publisher Test Deployment

## Problem

The standalone TypeScript publisher cannot be validated with production-shaped content and networking until it runs beside the existing Django public renderer. Sending current public hostnames directly to an unproven renderer would make parity defects and deployment mistakes user-facing.

## Goals

- Run the TypeScript publisher as an independently health-checked production service.
- Expose one isolated test hostname without changing existing public traffic.
- Render the content currently owned by an existing public hostname while keeping browser navigation and form redirects on the test hostname.
- Provision and verify the publisher's read-only and form-write database boundaries repeatably.

## Non-Goals

- Move an existing public hostname from Django to the TypeScript publisher.
- Resolve the remaining media, navigation, dynamic-route, preview, cache, or widget parity gaps.
- Store database credentials in Git.
- Add another PostgreSQL server or database.

## Users and Use Cases

- A site owner compares the same published paths through Django and the TypeScript publisher.
- An operator deploys or rolls back the parallel publisher with the existing production workflow.
- A developer verifies native public form behavior through the real reverse proxy and database roles.

## Requirements

- The production Compose stack builds and runs the publisher as a non-root Node service.
- Caddy routes only the configured test hostname to the publisher and marks its responses as non-indexable.
- The application maps the exact configured test hostname to one configured source hostname for content lookup only.
- The browser-facing host remains unchanged for relative links, form actions, and redirects.
- Existing Django public routes remain unchanged.
- Deployment applies migrations before idempotently provisioning separate rendering and form PostgreSQL roles.
- Deployment fails before backup or migration if either generated publisher password is absent or malformed.
- Readiness verifies the Django backend, publisher liveness, and a rendered test-host root page.

## Acceptance Criteria

- The publisher image builds from a clean repository Docker context and its health endpoint returns HTTP 200.
- Requests for `publisher-test-eceee.colliberty.com` resolve content from `summerstudy.eceee.org` without changing the response host.
- Requests for other hostnames are not aliased.
- The rendering role can select the three required publishing tables and cannot insert.
- The form role can select only rate-limit metadata, insert submission columns, and cannot select payload data or page tables.
- Running role provisioning more than once preserves the same privilege boundary.
- Production Compose and shell configuration pass local parsing and static checks.

## Constraints

- DNS for `publisher-test-eceee.colliberty.com` is controlled outside this repository and must point to the existing VPS before Caddy can obtain a certificate.
- Django remains the CMS, schema migration owner, and current public renderer for all existing production hostnames.
- Real credentials stay in the protected production `deploy/.env` file.

## Implementation Notes

- 2026-09-29: Implementation started on `codex/publisher-test-deploy`, stacked on the public-form branch until PR #167 is merged.
- 2026-09-29: The test host is mapped inside the application instead of rewriting the upstream Host header, preserving same-origin form redirects.

## Linked ADRs

- [ADR-0011: Validate published forms and write through a dedicated PostgreSQL role](../adrs/active/0011-public-form-write-boundary.md)
- [ADR-0012: Validate the publisher through an isolated hostname alias](../adrs/active/0012-isolated-publisher-test-host.md)

## Completion Evidence

- 2026-09-29: Publisher unit tests, lint, typecheck, production build, clean Docker build, container health probe, Compose parsing, shell parsing, ShellCheck, and Python formatting/lint checks pass locally.
- 2026-09-29: PostgreSQL 17 clean migration through `0077`, first and repeated role provisioning, and privilege probes passed in an isolated no-host-port test container.
- DNS, merge, deployment, TLS issuance, and browser parity inspection remain operational completion steps.

