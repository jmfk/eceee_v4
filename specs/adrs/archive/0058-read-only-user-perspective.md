---
id: ADR-0058
title: Server-enforced read-only user perspective
status: superseded
created: 2026-11-05
related_prds:
  - PRD-0042
---

# ADR-0058: Server-enforced read-only user perspective

## Decision

Keep the original browser login intact and store a bounded inspection record in its server session. Resolve the effective target before tenant/classification middleware; validate the original administrator's real login and the target's revocation version on every request. Never manufacture a target MFA/password login or issue target credentials. Browser-session authentication validates the actor, while authorization sees only the target.

Only system owners may enter inspection; non-owner staff and workspace administrators cannot. Non-safe requests are blocked except explicit exit and accessible-workspace selection (session-only). Personal authentication/account endpoints and live WebSocket access are blocked. Expiry or target invalidation fails closed, with a minimal current-user response retaining the exit banner. Exit restores the saved workspace and rotates the session key.

Identity switching applies to the browser session and all tabs. A full navigation clears application caches; same-origin tab notifications reload other open CMS tabs. Existing WebSocket authorization rechecks reject inspection sessions, including already-open sockets. Start/stop are logged with actor/target IDs only.

## Consequences

This intentionally provides inspection, not delegated editing. POST-based editor preview operations and realtime interactions are unavailable in this initial mode. The banner explicitly explains read-only mode and its effect on all tabs. The backend implementation is Python because authentication, MFA revocation, tenant selection and session handling already live there; duplicating them in the TypeScript publisher would introduce a second security boundary.

## Related PRD

- [PRD-0042](../../prds/0042-temporary-user-perspective.md)

Superseded by [ADR-0059](../active/0059-editable-user-perspective.md) after the owner requested delegated editing.
