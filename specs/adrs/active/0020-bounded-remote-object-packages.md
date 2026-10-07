---
id: ADR-0020
title: Bounded asynchronous remote object packages
status: accepted
date: 2026-10-07
related_prds:
  - PRD-0018
supersedes: []
superseded_by: []
---

# ADR-0020: Bounded Asynchronous Remote Object Packages

## Context

Remote object selections form a graph rather than a simple tree: descendants can reference other roots, versions contain media references, and media carries two tag systems. A synchronous response can become large, while direct cross-database writes would bypass tenant permissions, version workflows, and recoverability. Existing ThemeKey credentials are intentionally restricted to themes.

## Decision

Represent a selection as a versioned, self-contained ZIP package produced by a tenant-scoped asynchronous export job and consumed by a tenant-scoped asynchronous import job. Candidate listing and preflight are read-only. The graph includes descendants and recursively outgoing object references, but is bounded to 10,000 objects and 2 GB of uncompressed media. The destination validates the entire package before an atomic, non-destructive upsert.

Saved remote connections gain an explicit credential scheme. Object endpoints accept only general machine API keys with `object.read` or `object.transfer`; legacy ThemeKey credentials remain theme-only. Type and namespace conflicts are resolved before package application, and globally shared object types used by other tenants cannot be overwritten by this workflow.

## Rationale

Packages preserve a reviewable boundary, permit server-to-server streaming, and keep remote databases independent. Background jobs keep the UI responsive and observable. Explicit graph and byte limits give predictable first-version operations without prematurely building a distributed migration platform.

## Consequences

- Transfer packages and job artifacts require expiry and cleanup.
- Source IDs must be remapped after every destination object exists.
- Existing saved ThemeKey connections must be upgraded to an ApiKey before they can transfer objects.
- Imports beyond the first-version limits require splitting the selection or a later resumable chunk protocol.

## Alternatives Considered

- Direct API creation one object at a time: rejected because partial failure would expose broken hierarchies and references.
- Extend ThemeKey to objects: rejected because it violates the accepted scoped-machine-key boundary.
- Mirror remote trees by deletion: rejected because the requested workflow must preserve local content and history.

## Links

- Related PRDs: PRD-0018
- Extends [ADR-0016](0016-scoped-machine-api-keys.md).
