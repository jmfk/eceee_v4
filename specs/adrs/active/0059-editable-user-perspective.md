---
id: ADR-0059
title: Editable temporary user perspective
status: accepted
created: 2026-11-05
related_prds:
  - PRD-0043
---

# ADR-0059: Editable temporary user perspective

## Decision

Replace ADR-0058's read-only restriction with explicitly requested delegated editing. Preserve the real administrator browser login and store a 30-minute delegation in its server session. Resolve the effective target before tenant selection and authorization. Browser-session validation checks the original administrator; content views, permissions and authorship receive only the target. Validate both users' current status and revocation state on every request. System-owner targets and nested delegation remain unavailable.

Start/stop and delegated HTTP mutations are logged with actor/target IDs, method, path and status, never request bodies. Original password/MFA records remain unchanged. Personal authentication/security flows are blocked during valid delegation, while a revoked original login can restart normal sign-in. The control endpoint is CSRF-protected and independent of target tenant access, so exit remains possible after target invalidation.

Session-authenticated WebSockets resolve the same target and revalidate the actor and delegation against the live session on each existing authorization check. Session-key rotation at entry/exit rejects old sockets. Existing signed read-only attachment/ticket behavior retains its normal lifetime and live target membership checks; no password/token login is issued. Full client navigation and same-origin tab reloads discard caches when entering/exiting. Expiry fails closed rather than silently promoting a stale target interface to administrator privileges.

## Consequences

Changes are real and are authored as the target user. The persistent banner makes this explicit and provides return in all routes. Delegation affects all tabs sharing this browser session. Audit logs additionally identify the administrator responsible for delegated HTTP actions. Existing TypeScript React UI is extended; a small Python change is required because Django owns session/MFA revocation and tenant authorization. No data migration or dependency is added.

## Related PRD

- [PRD-0043](../../prds/0043-editable-user-perspective.md)
