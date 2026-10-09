---
id: PRD-0015
title: Unified remote site settings
status: completed
locked: true
created: 2026-10-09
related_adrs:
  - ADR-0008
  - ADR-0017
---

# PRD-0015: Unified Remote Site Settings

## Problem

Remote-site connections are configured inside Designer while inbound access keys can only be created with a production command. Administrators need one discoverable workspace settings surface for both directions of a remote-site relationship.

## Goals

- Put remote-site administration under Settings.
- Manage outgoing saved connections and incoming scoped access keys together.
- Let a workspace administrator create, rotate, and revoke inbound keys in the web application.
- Keep secret material out of later API responses and browser sessions.

## Non-Goals

- Replacing machine API keys.
- Recovering an access-key secret after its one-time display.
- Changing theme or site transfer protocols.
- Granting remote-site administration to Designer-only users.

## Users and Use Cases

- A workspace administrator saves a connection to another ECEEE installation.
- A workspace administrator creates a key for another installation to connect to the current workspace.
- An administrator rotates a compromised or expired-by-policy key and updates the consuming connection.
- A Designer selects an administrator-configured connection while transferring themes.

## Requirements

- Add a Remote sites destination under Settings.
- Show outgoing connections and incoming access keys as distinct sections on one screen.
- Preserve tenant scoping, administrator authorization, encrypted outbound credentials, hashed inbound credentials, URL validation, and one-default-connection behavior.
- Allow explicit `theme.transfer` and `site.transfer` capability selection, with at least one capability required.
- Return a newly created or rotated raw key exactly once and never include it in list responses.
- Show key prefix, capabilities, active state, creation time, and last-used time without exposing hashes.
- Keep Designer transfer operations working with configured connections while linking administration to Settings.

## Acceptance Criteria

- A workspace administrator can complete the former `prod-theme-access-key` setup flow from the remote site's web UI.
- A non-administrator cannot create, rotate, revoke, edit, or delete remote-site configuration.
- The one-time secret is visibly distinguished from persistent metadata and can be copied.
- Refreshing or leaving the screen removes the raw secret from the UI.
- Existing saved connections continue to work without migration.
- Focused backend and frontend tests cover authorization, one-time secret handling, capability validation, routing, and primary UI flows.

## Constraints

- Production must still enable the remote sync endpoints before issued credentials are usable.
- No secret value, digest, encrypted value, length, or checksum may be logged or serialized after creation/rotation.
- Existing CLI setup remains available for operational recovery and automation.

## Implementation Notes

- 2026-10-09: Implementation started on `main`; existing unrelated `make/tests.mk` changes are being preserved.
- 2026-10-09: Added the unified Settings screen, workspace-admin access-key API, Designer handoff, and setup documentation.

## Linked ADRs

- [ADR-0008: Encrypted workspace-scoped remote theme connections](../adrs/active/0008-encrypted-workspace-remote-connections.md)
- [ADR-0017: Browser-managed scoped remote access keys](../adrs/active/0017-browser-managed-remote-access-keys.md)

## Completion Evidence

- Backend: 22 focused `ThemeVersionApiTests` passed against PostgreSQL, including authorization, capability validation, hash-only persistence, one-time creation/rotation responses, and revocation.
- Frontend: 32 focused Vitest tests passed across Remote Sites settings, Designer themes, Settings routing, and sidebar navigation.
- Quality: focused ESLint passed; Black, isort, and Flake8 passed for changed backend files; Vite production build passed with existing chunk warnings.
- Governance: `validate_specs.py` passed.
- Visual verification: confirmed the unified page and access-key form in the running local application at `/settings/remote-sites`.
