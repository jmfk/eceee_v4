---
id: PRD-0018
title: Remote object structure import
status: started
locked: true
created: 2026-10-07
related_adrs:
  - ADR-0020
---

# PRD-0018: Remote Object Structure Import

## Problem

Editors can transfer themes and complete page packages between ECEEE installations, but cannot selectively pull structured object trees with their referenced content. Large object libraries make an all-or-nothing import impractical.

## Goals

- Let a workspace administrator select remote object types, cap the number of candidate root objects, and choose exact roots to import.
- Import complete descendant trees and recursively referenced objects without losing managed media or tag metadata.
- Update matching destination objects without deleting local objects or version history.

## Non-Goals

- Pushing local objects to a remote installation.
- Mirroring by deleting destination content absent from the selected remote graph.
- Downloading arbitrary third-party URLs referenced by content.
- Supporting more than 10,000 objects or 2 GB of uncompressed media in one initial-version transfer.

## Users and Use Cases

- A workspace administrator pulls selected news, event, or publication trees from staging or another ECEEE installation.
- An administrator limits a large remote type to a manageable candidate list before selecting roots.
- A repeated import appends changed remote content as local versions while retaining local history.

## Requirements

- Reuse saved remote-site connections, but require a scoped general machine API key for object transfer.
- List at most 500 top-level candidates per selected type, newest created first.
- Recursively include descendants and outgoing object references, handling cycles and duplicate references.
- Include the required type definitions, namespaces, selected object versions, managed media, media tags, canonical tags, and relevant media collection associations.
- Match objects by type name and slug. Create missing objects and append changed versions to matches without deleting local content.
- Run a no-write preflight that reports counts, limits, external URLs, type conflicts, namespace conflicts, and create/update outcomes.
- Require an explicit per-type and per-namespace resolution before starting an import with conflicts.
- Run export and import as observable background jobs that survive browser reloads and expire their packages after 24 hours.

## Acceptance Criteria

- An administrator can select remote roots through the Object Browser and see imported trees with remapped parents and object references.
- Referenced managed media renders from destination storage and retains legacy and canonical tags.
- Non-administrators, wrong-tenant credentials, legacy ThemeKey credentials, and insufficient machine scopes cannot use object transfer endpoints.
- Failed validation or import does not leave partially imported database content.
- Repeating an unchanged import does not create duplicate object versions.
- Existing theme and page transfer workflows continue to work.

## Constraints

- Destination database mutation is non-destructive and tenant-scoped.
- Global object type definitions must not be overwritten when they are used by another tenant.
- Package parsing must enforce entry, path, checksum, object-count, and uncompressed-size limits.

## Implementation Notes

- 2026-10-07: Implementation started as one locally verified backend/frontend batch.
- 2026-10-07: Added scoped remote endpoints, bounded/checksummed packages, atomic tenant-aware import, type and namespace conflict handling, media/tag/collection/type-icon transfer, background jobs, expiry cleanup, and the Object Browser wizard.

## Linked ADRs

- [ADR-0020: Bounded asynchronous remote object packages](../adrs/active/0020-bounded-remote-object-packages.md)

## Completion Evidence

- Django system checks and migration drift checks pass, including a clean upgrade through webpages migration `0084` and object storage migration `0025`.
- The full PostgreSQL-backed Django suite passes: 1,163 tests with 12 intentional skips.
- The full Vitest suite passes: 1,454 tests across 141 files. Focused object import and remote-site settings tests also pass.
- Backend and focused frontend lint, the frontend production build, diff checks, and repository spec validation pass.
