---
id: ADR-0007
title: Session-backed privileged workspace selection
status: accepted
date: 2026-09-26
related_prds:
  - PRD-0006
supersedes: []
superseded_by: []
---

# ADR-0007: Session-Backed Privileged Workspace Selection

## Context

The existing workspace selector writes directly to browser storage. It provides useful request routing but is not an authorization boundary and is located in a task-specific Designer navigation bar rather than account settings.

## Decision

Expose workspace switching as an authenticated Profile operation available only to `dev_auto_user` and superusers. The server validates the requested active workspace and records its identifier in the session. The browser records the validated identifier only after the server accepts it. Request middleware continues to validate explicit workspace headers against user access.

## Rationale

A server-authorized operation makes the privilege explicit without adding a database preference or changing the existing `X-Tenant-ID` transport contract. Session state supplies a deterministic fallback, while browser state keeps existing API requests consistent.

## Consequences

- Privileged users get one account-level place to switch workspaces.
- Ordinary users cannot invoke the switch endpoint or see its controls.
- Browser storage remains routing state, not proof of authorization.
- Sessions on different browsers may select different workspaces.

## Alternatives Considered

- Store a preferred workspace on the user model: rejected because the need is session-specific and does not justify a schema change.
- Keep the Designer-only selector: rejected because it is client-only and unavailable elsewhere in the application.

## Links

- Related PRDs: PRD-0006
