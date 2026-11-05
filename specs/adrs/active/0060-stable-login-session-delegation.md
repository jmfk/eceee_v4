---
id: ADR-0060
title: Stable login sessions during delegation
status: accepted
created: 2026-11-05
related_prds:
  - PRD-0043
---

# ADR-0060: Stable login sessions during delegation

## Evidence

A regression reproduces the production logout: a request retaining the pre-switch cookie receives 401 because delegation rotated/deleted that login session. Django may return a deletion cookie for that late request, clearing the browser's new cookie. Local development auto-login masked the effect during browser checks.

## Decision

Keep the actual administrator login cookie stable across enter/exit; no authentication principal or login credential changes during delegation. Store the target context in one additive `UserPerspectiveSession` row per Django session, outside its mutable JSON payload. Concurrent stale session saves cannot erase the delegation or resurrect an ended legacy delegation. Entry serializes against the login-session row; stopped rows remain inactive until normal session cleanup cascades them away.

Each delegation has a fresh nonce checked by live WebSocket authorization. Ending/re-entering the same target does not reauthorize an old delegated socket. The initiating administrator, target status/security version, expiry, tenant permissions, no-credential issuance and personal-security restrictions remain unchanged. A tenant-independent GET control endpoint exposes only the active target summary to the valid original administrator, retaining the exit banner if workspace bootstrap fails.

Existing v0.1.76 delegations are lazily imported only after validating their original administrator. No global session/account/content rewrite is performed. The migration creates a new empty table and indexes/FKs; target deletion nulls its reference so delegation fails closed while exit remains possible. Login-session deletion cascades its temporary context. Entry/exit/action audit messages receive an explicit production INFO logger.

## Upgrade and recovery

- Clean installs and upgrades apply the same additive migration; existing users, permissions, content and authentication records are untouched.
- The migration is transactional and contains no data backfill. Runtime legacy import is idempotent through the one-to-one session constraint. Per-session locking serializes entry and exit. Workspace payload metadata is reloaded and saved under that same lock; existing-cookie responses are marked clean so Django cannot overwrite later restoration when an earlier response finishes last.
- Normal pre-deploy backup and writer/migration guards remain required. Verify schema, session/nonce regressions and service health after upgrade.
- Prefer roll-forward recovery. A code rollback to v0.1.76 requires coordinating exit of active delegations because old code does not read the separate table; keep the additive table. Reversing/dropping it is not part of normal rollback and requires a separate data decision.

## User interface

A session-expired sign-in screen is fully opaque and hides admin chrome while preserving the mounted work for password/MFA reauthentication. Unknown routes have a standalone 404 without Navbar/StatusBar. The ordinary login form maps an email-shaped identifier to allauth's `email` field; provider buttons still follow the server's configured Google/Apple list.

## Related PRD

- [PRD-0043](../../prds/0043-editable-user-perspective.md)
