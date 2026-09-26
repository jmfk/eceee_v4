---
id: PRD-0006
title: Privileged workspace switching
status: completed
locked: true
created: 2026-09-26
related_adrs:
  - ADR-0007
---

# PRD-0006: Privileged Workspace Switching

## Problem

The development auto-login account needs to inspect multiple workspaces, but the current Designer navigation selector is browser-only and is not an explicit privileged profile operation. Ordinary users must not be offered or granted cross-workspace switching.

## Goals

- Put workspace selection in Profile for the development auto-login account and superusers.
- Enforce the switching permission on the server as well as in the interface.
- Keep ordinary users scoped to workspaces they are already authorized to access.

## Non-Goals

- Change workspace membership or Designer theme assignments.
- Expose the internal term “tenant” in the user interface.
- Add a persistent database preference to the user model.

## Users and Use Cases

- `dev_auto_user` selects the workspace used for local development from Profile.
- A superuser switches workspace for support or verification.
- A staff or ordinary user cannot access the privileged workspace switch operation.

## Requirements

- Only `dev_auto_user` and superusers may execute the workspace-switch endpoint.
- The Profile selector lists active workspaces available to privileged switchers.
- A successful selection is stored in the authenticated session and browser workspace state.
- The Designer navigation no longer provides a workspace selector.
- Explicit workspace headers remain rejected when the user has no access to the requested workspace.

## Acceptance Criteria

- Profile displays the selector for `dev_auto_user` and superusers only.
- Switching reloads Profile in the selected workspace.
- A non-superuser receives HTTP 403 from the switch endpoint.
- Inactive or unknown workspaces cannot be selected.
- Existing single-workspace and restricted Designer access continues to work.

## Constraints

- The automatic development user remains enabled only under the existing DEBUG-only middleware rule.
- No schema migration is required.

## Implementation Notes

- 2026-09-26: Implementation started on `codex/shared-admin-render-layer`.
- 2026-09-26: Moved workspace selection from Designer navigation to Profile and added a server-authorized, session-backed switch operation.

## Linked ADRs

- [ADR-0007: Session-backed privileged workspace selection](../adrs/active/0007-session-backed-workspace-selection.md)

## Completion Evidence

- Backend: 26 focused workspace, current-user, tenant-access, and Designer API tests passed against PostgreSQL.
- Frontend: 3 focused Profile and Designer navigation tests passed; ESLint passed.
- Production build: Vite build passed with the repository's existing bundle-size and mixed-import warnings.
- Static checks: Django system check, migration drift check, specification validation, and Git whitespace validation passed.
- Visual verification: Profile displayed all active workspaces for `dev_auto_user`; submitting the current selection completed the server round trip and reloaded with the same selected workspace.
