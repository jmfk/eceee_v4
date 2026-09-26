---
id: ADR-0008
title: Encrypted workspace-scoped remote theme connections
status: accepted
date: 2026-09-26
related_prds:
  - PRD-0005
  - PRD-0007
supersedes:
  - ADR-0006
superseded_by: []
---

# ADR-0008: Encrypted Workspace-Scoped Remote Theme Connections

## Context

ADR-0006 established immutable theme history, stable cross-site lineage, and request-scoped remote credentials. The validated workflow has changed: administrators need several reusable connections per workspace, with one default, while Designer users must transfer themes without receiving a credential.

## Decision

Retain `PageTheme` as the mutable current head, stable UUID lineage, immutable `ThemeVersion` snapshots, normalized comparison, and the existing theme-sync transfer protocol.

Replace request-scoped credentials with named, workspace-owned `ThemeRemoteConnection` records. Encrypt outbound access keys using a separately configured Fernet keyring; the first key encrypts and all configured keys decrypt to support rotation. Never serialize ciphertext or plaintext to the browser.

Issue inbound `ThemeRemoteAccessKey` credentials specifically for theme sync. Store only a SHA-256 digest and a non-secret display prefix on the remote installation, accept the distinct `ThemeKey` authorization scheme only on theme-sync endpoints, and require the key's workspace to match the request workspace.

Workspace administrators manage connections. Users with Designer access may use active connections for assigned themes, but only administrators may import a previously unknown theme.

## Rationale

Server-side saved connections support the normal setup-once workflow without distributing secrets to Designer browsers. A dedicated authorization scheme prevents a theme integration key from becoming a general account API token. Explicit application-level encryption protects the required reversible outbound credential while allowing controlled rotation.

## Consequences

- Production must configure and protect `THEME_REMOTE_CREDENTIAL_KEYS` before saving connections.
- Losing all encryption keys makes saved outbound credentials unrecoverable and requires replacing them.
- Key rotation requires retaining the old key after the new primary until stored credentials have been rewritten or replaced.
- Theme version history, restore semantics, conflict counters, and asset limitations remain as decided in ADR-0006.
- Remote connection management becomes persistent workspace configuration.

## Alternatives Considered

- Continue asking for a token per operation: rejected because it prevents delegated Designer use and repeated setup.
- Persist a normal DRF user token: rejected because it grants broader API identity than theme sync requires.
- Store plaintext credentials: rejected because database access would disclose every remote key.
- Use one global remote connection: rejected because installations require workspace isolation and sometimes staging or migration targets.

## Links

- Related PRDs: PRD-0005, PRD-0007
