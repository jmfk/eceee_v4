---
id: ADR-0017
title: Browser-managed scoped remote access keys
status: accepted
date: 2026-10-09
related_prds:
  - PRD-0015
supersedes: []
superseded_by: []
---

# ADR-0017: Browser-Managed Scoped Remote Access Keys

## Context

Inbound `ThemeRemoteAccessKey` credentials already provide tenant-scoped, hashed-at-rest authentication for theme and site transfer, but operators can only create or rotate them through a server command. Remote-site connection administration is meanwhile embedded in Designer even though site transfer also consumes it.

## Decision

Expose workspace-admin-only list, create, rotate, and revoke endpoints for `ThemeRemoteAccessKey`. Creation and rotation return the raw secret once in that response; list and later mutation responses expose only non-secret metadata. Require one or more allow-listed transfer capabilities and keep the existing hash-only persistence and `ThemeKey` protocol.

Place both outbound connection administration and inbound access-key administration on one Settings → Remote sites screen. Designer retains transfer operations and connection selection but delegates configuration to Settings. Keep the CLI command as an automation and recovery path.

## Rationale

The web flow removes unnecessary production shell access while preserving the existing credential boundary. A single settings destination matches the feature's workspace-wide scope and makes the two sides of remote connectivity understandable without merging their distinct secret-storage models.

## Consequences

- Workspace administrators can mint credentials capable of exporting themes or sites from that workspace.
- The UI and API must strongly communicate that a returned secret cannot be recovered.
- Revoked keys remain as auditable metadata and may be reactivated only by rotation.
- Disabling remote sync makes the credentials unusable but does not alter their stored state.
- CLI and web flows must continue to use the same generator, hash format, capability identifiers, and model.

## Alternatives Considered

- Keep key generation shell-only: rejected because it requires infrastructure access for a workspace configuration task.
- Use general machine API keys: rejected because their broader principal and scope model is unnecessary for site-to-site transfer.
- Store recoverable inbound secrets: rejected because the receiving installation does not need the plaintext after issuance.

## Links

- Related PRDs: PRD-0015
- Extends ADR-0008 without changing outbound credential encryption.
