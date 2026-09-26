---
id: ADR-0006
title: Immutable theme snapshots with request-scoped remote credentials
status: superseded
date: 2026-09-26
related_prds:
  - PRD-0005
supersedes: []
superseded_by:
  - ADR-0008
---

# ADR-0006: Immutable Theme Snapshots with Request-Scoped Remote Credentials

## Context

`PageTheme.sync_version` was a mutable conflict counter, not a recoverable design history. Names were editable and only unique inside one workspace, so they could not identify the same theme across installations. The initial remote-transfer use case was occasional and did not justify durable credentials.

## Decision

Add stable UUID lineage and append-only `ThemeVersion` snapshots while keeping `PageTheme` as the current head. Compare normalized snapshots and reuse the theme-sync API for remote pull and push. Supply remote URLs, workspace identifiers, and tokens for each operation without persistence.

## Rationale

The design added history and cross-site identity with minimal impact on page rendering and avoided storing secrets before a repeated workflow had been validated.

## Consequences

- Theme history is append-only and restore creates another version.
- Asset references are versioned without guaranteeing binary replication.
- Administrators must provide remote connection details for each operation.

## Alternatives Considered

- Treat each version as a separate theme: rejected because pages would bind to arbitrary copies.
- Use `sync_version` as history: rejected because it stores no prior content.
- Store remote tokens: initially rejected until the persistent delegated workflow was validated.

## Links

- Related PRDs: PRD-0005
- Superseded by: [ADR-0008](../active/0008-encrypted-workspace-remote-connections.md)
