---
id: PRD-0021
title: Read-only legacy migration API
status: started
locked: true
created: 2026-10-14
related_adrs:
  - ADR-0025
---

# PRD-0021: Read-Only Legacy Migration API

## Problem

The ECEEE Legacy Import plugin currently requires an SSH port forward and direct
read-only PostgreSQL credentials. The operator must maintain tunnel state, v4 must
understand legacy tables, and the connection screen exposes infrastructure concepts
that are not part of the importer's actual product contract.

## Goals

- Let reviewed v4 tenant import plugins retrieve exactly the legacy data they need
  through a bounded read-only HTTPS API.
- Keep PostgreSQL inaccessible to v4 and keep its credentials inside the legacy
  runtime.
- Preserve the existing News transformation, media import, link reconciliation,
  golden-sample gate, resumability, and tenant isolation.
- Give administrators one understandable connection: base URL plus access key.
- Establish an allowlisted pattern for later legacy Page import without creating a
  generic remote-query system.

## Non-Goals

- A general public legacy API, arbitrary SQL, arbitrary model access, or writes.
- Proxying all media binaries through the migration API.
- Reusing the v4 Remote Object package protocol in the legacy application.
- Implementing Page import or Proceedings/FileMaker behavior in this slice.
- Keeping SSH forwarding as a supported fallback.

## Requirements

- The legacy application exposes a versioned route with authenticated health, News
  summary, and published-News list endpoints.
- Only `GET` is supported. Responses are JSON, non-cacheable, and paginated with a
  maximum page size of 500.
- Authentication uses a dedicated runtime bearer key compared in constant time. A
  missing server key disables the API.
- News output contains only the fields and taxonomy assignments required by the
  importer and never includes database credentials or secret configuration.
- The v4 `LEGACY_API` Data Connection stores a public HTTPS base URL and encrypted,
  write-only access key, scoped to one tenant.
- Connection testing verifies authentication, API version, and News capability.
- The v4 client rejects HTTP, embedded URL credentials, private destinations,
  redirects, oversized responses, invalid JSON, and incompatible API versions.
- The plugin preflight and background job consume the API adapter; no supported
  import command or UI path depends on PostgreSQL or an SSH tunnel.
- Existing media and link processing runs after API records are received.

## Acceptance Criteria

- With no server key, legacy health returns `503`; absent or wrong bearer keys return
  `401`; a valid key returns the version and `news` capability.
- A News request cannot exceed 500 records and can continue through `nextCursor`.
- The summary and item JSON map into the existing News import record without direct
  database access.
- An administrator can create and test a Legacy Migration API connection without a
  database host, port, database name, user, password, or SSH settings.
- The guided News importer performs preflight and can import a bounded batch with
  media and link handling unchanged.
- The old tunnel script, Make target, direct database adapter, and supported
  `--database` command path are absent.
- Previously stored `LEGACY_POSTGRES` records remain readable for upgrade safety but
  are unsupported and cannot be newly created or used by the importer.

## Constraints

- The API exists only for the migration lifetime and remains part of the deprecated
  legacy deployment, not the permanent v4 product architecture.
- Both applications require separately reviewed deployments and environment-secret
  configuration before live use.
- Access-key values never appear in source, tests, logs, API responses, or committed
  examples.

## Implementation Notes

- 2026-10-14: Replaced the v4 plugin connection kind and source adapter with
  `LEGACY_API`; began the fixed version 1 legacy News API implementation.

## Linked ADRs

- [ADR-0025: Authenticated legacy migration API for tenant import plugins](../adrs/active/0025-authenticated-legacy-migration-api.md)

## Completion Evidence

- The legacy repository's five migration API tests pass, including the test runner's
  Django system check.
- The v4 PostgreSQL News suite passes 93 tests; the plugin/tenant suite passes eight
  tests including encrypted write-only credentials and rejected deprecated/insecure
  connections.
- The focused Migration Manager Vitest, changed-file ESLint, production frontend
  build, Django system check, migration drift check, Black check, and specs governance
  validation pass. ESLint reports five pre-existing warnings in
  `DataConnectionsManager.jsx` and no errors.
