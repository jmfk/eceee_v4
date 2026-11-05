---
id: PRD-0043
title: Editable temporary user perspective
status: completed
locked: true
created: 2026-11-05
related_adrs:
  - ADR-0059
  - ADR-0060
---

# PRD-0043: Editable temporary user perspective

## Problem

The owner explicitly requested editing as the selected user, extending PRD-0042's initial read-only interpretation.

## Requirements

- Preserve PRD-0042's system-owner entry restriction, real target authorization, 30-minute session limit, visible identity/return banner, revocation checks, workspace restoration and tab synchronization.
- Permit normal content/workspace/profile mutations according to the target's existing permissions. Never inherit the initiating system owner's capabilities.
- Attribute content authorship to the target and log the initiating actor, target, method, route and response status for delegated mutations without payloads or credentials.
- Support session-authenticated editor WebSockets as the target; reject stale original-owner sockets and ended/expired delegations.
- Keep personal authentication, passwords and MFA flows outside delegation. No target login credential is created.
- Return clears client caches by full navigation. Revocation of the original administrator must still permit normal sign-in again.

## Acceptance Criteria

- A delegated permitted mutation runs as the target; a target-denied operation remains forbidden.
- Start, return, expiry, inactive/deleted/revoked accounts, CSRF, credential overrides and websocket identity are covered by focused tests.
- The local app demonstrates entry and return without changing production permissions or data.

## Linked ADRs

- [ADR-0059](../adrs/archive/0059-editable-user-perspective.md)

## Implementation Notes

- Supersedes PRD-0042's read-only requirements at the owner's explicit request.

## Completion Evidence

- Consolidated local verification: 88 backend authentication, delegation, workspace/role and support checks passed; 64 focused frontend checks passed.
- Scoped Python/frontend lint, Vite production build and specs validation passed. Existing TreePageManager lint warnings remain unchanged.
- Browser verification: enter as an existing account, retain the identity banner after reload, and return to the original administrator. Swedish access-denied and prefilled access-request views verified at desktop and 640px widths.
- No database migration or new dependency. Local demo accounts are not release artifacts; no production account or tenant data is transferred.

## Recovery correction

- [ADR-0060](../adrs/active/0060-stable-login-session-delegation.md) fixes reproduced multi-tab login-cookie loss, preserves delegated state independently of stale session payloads, and keeps an independent return endpoint available when workspace bootstrap fails.
- Sign-in and 404 surfaces cover/remove admin navigation. Email sign-in uses the email credential field. Google/Apple remain controlled by configured providers.
