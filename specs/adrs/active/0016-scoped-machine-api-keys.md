---
id: ADR-0016
title: Scoped machine API keys across the supported CMS API
status: accepted
date: 2026-10-05
related_prds:
  - PRD-0014
supersedes: []
superseded_by: []
---

# ADR-0016: Scoped Machine API Keys Across the Supported CMS API

## Context

ECEEE already exposes most product behavior through Django REST Framework and authenticates humans with sessions, JWT, or DRF tokens. Theme transfer additionally uses a tenant-bound `ThemeKey`. Codex needs API-first access to themes and eventually the whole supported CMS surface. Expanding the theme-only key into an unrestricted bearer secret would make one leaked credential equivalent to an unbounded human administrator and would bypass a clear endpoint classification.

## Decision

Add one general machine API-key authentication mechanism for the supported CMS API. A key represents a dedicated machine principal and is constrained by environment, tenant/workspace access, expiry, active state, and stable capability identifiers. Keys are hashed at rest, displayed only at creation or rotation, auditable, throttled, and revocable.

Views explicitly declare their machine capability or deny machine access. Existing DRF permissions and tenant checks continue to run after authentication. An explicit `server.full_access` capability may authorize all inventoried machine-supported application endpoints for principals that already have the underlying permission, but it does not include endpoints classified as machine-denied.

The application API does not expose deployment, SSH, arbitrary commands, database administration, backups, or secret control. Those remain separate operational control planes with their existing human gates.

Migrate theme automation onto the general key and capability system while retaining `ThemeKey` compatibility during a bounded transition. ADR-0008 remains active for saved remote connection encryption, theme version lineage, and the current compatibility protocol until that migration is complete.

## Rationale

One reusable authentication system avoids a separate Codex or theme server while scopes, principals, and endpoint declarations retain least privilege and auditability. Returning a normal authenticated principal lets existing DRF permissions remain authoritative. A named full-access capability satisfies trusted whole-application automation without making every key implicitly omnipotent.

## Consequences

- Endpoint inventory and classification become required work before claiming whole-server API coverage.
- Existing views need capability declarations or explicit machine denial.
- Tenant middleware must recognize machine authentication before resolving tenant context.
- Key lifecycle management needs UI/API administration, protected secret storage, auditing, rotation, expiry, and revocation.
- Existing `ThemeKey` credentials remain temporarily duplicated with the new system and require a migration plan.
- Supported product behavior becomes easier to automate consistently through OpenAPI and shared validation paths.

## Alternatives Considered

- Extend `ThemeKey` to every endpoint: rejected because its theme-specific identity and authorization scheme would become misleading and dangerously broad.
- Use one global environment variable API key: rejected because it lacks principal identity, tenant boundaries, scopes, rotation records, and useful auditability.
- Use ordinary human JWT or DRF tokens for Codex: rejected because lifecycle, attribution, expiry, and permission intent are coupled to a human account.
- Build a separate MCP server with direct model or database access: rejected as the primary integration because it would duplicate application contracts and permissions. An MCP adapter may later call the supported API, but it must not become a second source of truth.

## Links

- Related PRDs: PRD-0014
- Related decision: ADR-0008
