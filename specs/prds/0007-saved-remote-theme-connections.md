---
id: PRD-0007
title: Saved remote theme connections
status: completed
locked: true
created: 2026-09-26
related_adrs:
  - ADR-0008
---

# PRD-0007: Saved Remote Theme Connections

## Problem

Theme transfer currently requires an administrator to re-enter a remote URL, workspace identifier, and broad API token for each session. That prevents the normal setup-once workflow and exposes credentials to every browser user performing a transfer.

## Goals

- Let each workspace keep several named remote-site connections and one default.
- Let Designer users use configured connections without receiving their access keys.
- Limit inbound remote keys to theme synchronization and one workspace.
- Make initial setup and key rotation reproducible for an operator.

## Non-Goals

- Continuous or automatic synchronization.
- Sharing one connection across workspaces.
- Displaying or recovering a saved access key.
- Synchronizing non-theme content.

## Users and Use Cases

- A workspace administrator configures the normal remote site once and marks it default.
- A workspace administrator adds a staging or migration site as another connection.
- A Designer user selects a saved connection and uploads or downloads theme versions.
- An operator creates or rotates a theme-only access key on the remote installation.

## Requirements

- Connections are workspace-scoped and contain a name, site URL, remote workspace identifier, encrypted access key, active state, and default state.
- At most one active connection is default; the first connection becomes default automatically.
- Only workspace administrators can create, edit, or delete connections.
- Users with Designer access can list and use active connections but cannot read encrypted or decrypted credentials.
- Remote access keys authenticate only the theme-sync API and only for their owning workspace.
- Access keys are stored as one-way hashes on the receiving remote site and shown only when created or rotated.
- Outbound credentials are encrypted at rest with a separately configured, rotatable keyring.
- Remote URLs continue to receive server-side SSRF validation.

## Acceptance Criteria

- The Designer theme overview selects the default connection automatically.
- Multiple saved remote sites can be created and selected.
- API responses never include access-key material or encrypted ciphertext.
- A Designer assignee can transfer an assigned theme but cannot manage connections or import a previously unknown theme.
- Deleting the default connection promotes another active connection when one exists.
- Production refuses credential storage when its encryption keyring is not configured.
- Setup documentation explains remote key creation, local encryption configuration, and key rotation.

## Constraints

- Remote transfers remain synchronous.
- Existing immutable theme version and lineage behavior remains unchanged.
- Binary asset replication remains outside this change.

## Implementation Notes

- 2026-09-26: Implementation started on `codex/shared-admin-render-layer`.
- 2026-09-26: Added scoped inbound keys, encrypted saved connections, default selection, and Designer/admin permission separation.

## Linked ADRs

- [ADR-0008: Encrypted workspace-scoped remote theme connections](../adrs/active/0008-encrypted-workspace-remote-connections.md)

## Completion Evidence

- Backend: 36 focused Designer, contract, versioning, credential, and connection tests passed against PostgreSQL.
- Frontend: 3 focused Designer theme overview tests passed; touched-file ESLint passed.
- Production build: Vite build passed with the existing chunk-size and mixed-import warnings.
- Database: migration `0074` applied successfully to the local development database.
- Visual verification: confirmed the empty state and administrator add-connection form in the running local Designer UI.
