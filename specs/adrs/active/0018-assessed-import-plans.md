---
id: ADR-0018
title: Assess imports and scope replacement to imported bindings
status: accepted
date: 2026-10-09
related_prds:
  - PRD-0016
supersedes: []
superseded_by: []
---

# ADR-0018: Assess Imports and Scope Replacement to Imported Bindings

## Context

Site packages may contain pages, referenced themes, media metadata, and binaries, while older or deliberately reduced packages may omit some dependencies. Administrators need to understand that graph before import and need Update, Clone, and Replace without giving Replace tenant-wide destructive meaning.

## Decision

Represent an import as an assessment followed by an explicit import plan. The plan selects resource scopes, one mode, publication handling, and an optional clone media namespace. ZIP and remote sources produce the same assessment shape.

Keep the existing site package as the canonical transport. Remote exports include the selected scopes. Optional standalone theme ZIPs are validated and normalized into the package import path. Missing optional packages add warnings and do not abort otherwise valid work.

Define Replace as synchronization of records known through the selected site's import binding. It may remove stale bound pages and replace matching bound theme/media content, but it must not delete unrelated workspace records. Update preserves local identifiers and unbound local additions. Clone creates independent records, removes root hostnames, and may target a newly created media namespace.

## Rationale

One assessment and plan contract keeps remote and uploaded imports consistent. Binding-scoped replacement gives administrators a complete replacement workflow without turning a site import into an unsafe workspace reset. Reusing the package pipeline keeps validation, authorization, reference remapping, and background execution in one place.

## Consequences

- Import creation requires an assessment token or equivalent validated source identity so the reviewed source and imported source cannot silently diverge.
- Bindings need enough theme/media lineage metadata to update or replace selected dependencies safely.
- Imports can complete with dependency warnings, and the UI must present them.
- A package without a selected or available theme may use the destination fallback theme, so visual parity is not guaranteed until the missing theme is supplied.

## Alternatives Considered

- Import first and report dependencies afterward: rejected because administrators cannot make an informed scope or mode choice.
- Make every missing dependency fatal: rejected because site and media content can still be useful independently.
- Replace all workspace media or themes: rejected because package ownership is narrower than the tenant and could destroy unrelated data.
- Build separate remote and ZIP import engines: rejected because their safety and mapping rules would drift.

## Links

- Related PRDs: PRD-0016
