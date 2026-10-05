---
id: PRD-0014
title: Server-wide machine API access
status: started
locked: true
created: 2026-10-05
related_adrs:
  - ADR-0016
---

# PRD-0014: Server-Wide Machine API Access

## Problem

Codex and other trusted automation can operate only selected ECEEE workflows through purpose-specific credentials. The application already exposes many authenticated REST endpoints, but there is no single, auditable machine identity that can be deliberately authorized across the supported CMS API. Theme automation therefore risks becoming a separate integration path instead of using the same contracts as the product.

## Goals

- Allow trusted machine clients to operate all supported CMS capabilities that have stable API endpoints.
- Provide first-class API keys with explicit principal, tenant, environment, scope, expiry, rotation, revocation, and audit semantics.
- Support a deliberately granted full-server application scope while retaining narrower scopes for normal integrations.
- Make theme inspection, versioning, comparison, transfer, and authoring available through the general API without distributing human session credentials.
- Keep the browser UI and machine clients on the same validation, permission, concurrency, and version contracts.

## Non-Goals

- Exposing SSH, deployment, backups, secrets, database administration, or arbitrary server commands through the application API.
- Bypassing production authorization gates, tenant isolation, Django/DRF permissions, or theme version-conflict protection.
- Making every internal Python function remotely callable.
- Placing API-key values in browser storage, source control, logs, theme packages, or Codex prompts.
- Replacing public anonymous endpoints or human browser sessions.

## Users and Use Cases

- A repository owner gives Codex a time-bounded key for API-driven theme work in one environment and workspace.
- An operator gives a trusted automation principal full supported-CMS access for a bounded maintenance workflow.
- A theme integration receives only theme read/write/version/transfer scopes.
- An administrator creates, rotates, revokes, and audits keys without recovering their secret values.

## Requirements

- Add a machine API-key credential whose secret is generated with a stable non-secret prefix, shown once, and stored only as a cryptographic digest.
- Bind every key to a dedicated machine principal, owning environment, creator, active state, expiry, and one or more tenant/workspace boundaries.
- Define stable capability identifiers. The initial set must include theme read/write/version/transfer scopes and an explicit `server.full_access` capability.
- Authenticate keys with a distinct authorization scheme and make the machine principal available through the normal `request.user` and `request.auth` paths.
- Authenticate the machine principal early enough for tenant middleware to validate `X-Tenant-ID` before database access.
- Preserve all existing view permissions. API-key scope checks are additive and must never turn a denied human operation into an allowed machine operation.
- Default API-key access to denied unless a view declares supported machine access or the request has the explicit full-access capability and the view is not excluded.
- Maintain an explicit deny list for session-only, credential-management, secret-management, deployment, infrastructure, and similarly unsuitable endpoints.
- Inventory the existing API and classify every route as public, human-session/JWT, machine-supported with required capability, or machine-denied.
- Continue to enforce optimistic concurrency and immutable version history for theme writes. A full-theme replacement must begin from the latest server representation and return a conflict rather than overwrite newer work.
- Record key creation, rotation, revocation, authentication failures, last use, principal, tenant, route, method, response class, and mutating-operation correlation identifiers without recording secrets or sensitive bodies.
- Provide rate limits, idempotency support for retried mutations where practical, and clear `401`, `403`, `409`, and validation responses.
- Publish the supported API through OpenAPI and provide a Codex-oriented client workflow that never requires a human password or browser token.
- Keep existing `ThemeKey` clients working during migration, then migrate them to scoped general API keys before any removal.
- Store operational copies of key secrets in the approved password manager or protected runtime secret facility, never in repository files.

## Acceptance Criteria

- A tenant-bound key with theme scopes can read, compare, version, export, create, and update themes but cannot operate pages or administer credentials.
- A key with `server.full_access` can operate every inventoried supported CMS endpoint permitted to its principal and tenant, except explicitly machine-denied surfaces.
- The same keys cannot invoke deployment, shell, database-admin, backup, or secret-recovery functionality because those capabilities are outside the application API.
- Revoked, expired, wrong-environment, wrong-tenant, malformed, and insufficient-scope keys fail without leaking credential details.
- Key material appears exactly once at creation or rotation and is absent from database plaintext, API responses after creation, application logs, browser storage, exports, and test fixtures.
- Theme writes return conflicts on stale versions and create recoverable theme versions on success.
- The API inventory and OpenAPI document identify required machine capabilities for every supported route.
- Focused authentication, authorization, tenant-isolation, audit, throttling, and theme workflow tests pass locally before rollout.

## Constraints

- The existing Django REST Framework permission model and PostgreSQL tenant isolation remain authoritative.
- Human production gates remain authoritative even when a technically capable key exists.
- The rollout must be additive and reversible; existing JWT, DRF token, session, and `ThemeKey` clients cannot be broken without an explicit migration step.
- Implementation should reuse the current REST API instead of creating a parallel Codex-only server.

## Implementation Notes

- 2026-10-05: Requirements and architecture direction recorded. The repository already has JWT, DRF token, session authentication, tenant middleware, and a theme-only hashed `ThemeKey` implementation to reuse and migrate.
- 2026-10-05: Started the API foundation with hashed environment-bound machine credentials, tenant bindings, additive principal permissions, full-access and initial theme scopes, and middleware-aware authentication.
- Planned sequence: API inventory; credential model/authentication/audit foundation; theme scopes and migration; broader endpoint classification; full-access key; Codex client documentation; staged rollout and legacy-key retirement.

## Linked ADRs

- [ADR-0016: Scoped machine API keys across the supported CMS API](../adrs/active/0016-scoped-machine-api-keys.md)

## Completion Evidence

- 2026-10-05: Seven focused machine-key API tests passed against PostgreSQL.
- 2026-10-05: The complete backend suite passed: 997 tests, 12 skipped.
- 2026-10-05: Black, Python compilation, migration consistency, skill validation, specs governance validation, and `git diff --check` passed.
