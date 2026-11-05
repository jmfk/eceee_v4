---
id: PRD-0042
title: Temporary user perspective
status: started
locked: true
created: 2026-11-05
related_adrs:
  - ADR-0058
---

# PRD-0042: Temporary user perspective

## Problem

A system administrator needs to reproduce the CMS access and navigation of an existing user.

## Requirements

- Offer “View as user” for active non-system-owner accounts to the system owner.
- Enforce the target user's actual workspace, role, designer and content access on the server.
- Default to read-only inspection; block content/account mutations, personal authentication flows and WebSocket access while inspecting.
- Display a persistent identity banner and a return action, including after reload or expiry.
- Preserve the initiating administrator's authenticated session and workspace; expire inspection after 30 minutes without silently restoring privileges to stale clients.
- Validate the administrator and target's current account state and credential revocation; reject nesting and non-browser credentials.
- Reload client state when switching identities, synchronize open tabs, and record start/stop events without credentials.

## Non-Goals

- Editing as another user, changing passwords or permissions, or production content migration.

## Acceptance Criteria

- A normal/workspace administrator cannot initiate inspection; inactive, self and system-owner targets are rejected.
- Read requests use target identity, writes fail, and return restores the original identity and workspace.
- Expired, deleted, inactive or revoked targets fail closed while a valid administrator can still exit.
- Focused server security tests and frontend tests cover the workflow; the running local app supports manual verification.

## Linked ADRs

- [ADR-0058](../adrs/archive/0058-read-only-user-perspective.md)

## Implementation Notes

- Existing Django authentication/session boundaries require a small Python extension; UI remains React.

- Read-only interpretation superseded by [PRD-0043](0043-editable-user-perspective.md) at the owner’s request before release.
