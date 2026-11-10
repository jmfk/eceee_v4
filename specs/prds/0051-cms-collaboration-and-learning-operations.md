---
id: PRD-0051
title: CMS collaboration and learning operations
status: completed
locked: true
created: 2026-11-10
related_adrs:
  - ADR-0070
---

# PRD-0051: CMS collaboration and learning operations

## Problem

Instruction publication is incorrectly routed by a skill to the public CMS media library. Existing collaboration APIs and the code-owned help/video pipelines have inconsistent machine access and documentation. Release Change Notes are specified but not implemented.

## Goals

- Reuse existing instruction, Inbox, Kanban, report and self-profile contracts through the same environment/tenant-bound API-key mechanism with least-privilege scopes.
- Preserve private ownership: the key acts as its principal, never as an arbitrary human.
- Correct skills and give each learning surface a clear source of truth and verified status.

## Non-Goals

- No production mutation, deployment, credential rotation, automatic scope/role grants, impersonation, or upload during the audit.
- No second implementation of existing Django storage, membership or publication workflows.
- This audit does not implement the separate Change Notes product from PRD-0050 or its proposed deployment gate.

## Requirements

- Existing browser APIs remain compatible. Machine requests need appropriate read/write/publication scopes and tenant binding; existing board membership, support roles and file ownership remain enforced.
- Instruction publication targets the private library, explicitly not `/media/upload/`. Upload and publication are separate; publication may notify tenant members.
- Machine self-profile operations never reach another person's profile or account-security APIs.
- Human Inbox contents remain private; machine reports/messages use their own principal and existing request-id deduplication.
- Source Markdown owns help articles and executable video scripts; the renderer produces voice-backed MP4/VTT previews. Approved instruction publication links to a stable help guide ID.
- Document which capabilities are implemented, tested, only mocked, local-only, or unimplemented. Do not advertise proposed Change Notes gates as operational.

## Acceptance Criteria

- Scoped machine keys can use authorized instruction/Inbox/report/self-profile operations and existing Kanban routes; wrong scopes, tenant, owner and role are rejected in focused tests.
- Script-editor Markdown round trips without losing narration or adding nested actions.
- Corrected skills describe actual supported methods, fields, limitations and publication effects.
- A consolidated status/reference document links help, manuscripts, video artifacts, private library and proposed Change Notes without duplicating source content.

## Constraints

TypeScript owns help/parser/video work. Minimal existing Django authorization changes are necessary because it owns collaboration models, tenant checks, private video storage and authentication. No schema change is needed.

## Implementation Notes

- Review and local implementation started 2026-11-10. Existing production state is not inferred from source/tests.

## Linked ADRs

- [ADR-0070](../adrs/active/0070-machine-collaboration-and-private-learning-boundaries.md)

## Completion Evidence

- 181 distinct backend tests passed using isolated PostgreSQL (one environment-dependent test passed after its missing public tooling was supplied); no dev/production data affected.
- 41 distinct frontend tests covered help, API adapters, script/editor locale+assertion preservation and render provenance across the combined gate and targeted regressions.
- API-helper/compatibility tests: 11 + 5 passed; five skill validations and specs governance passed.
- Eight refreshed local MP4/VTT previews verified against canonical help IDs, source fingerprints and narration timings; older artifacts preserved.
- Independent P0–P3 review plus targeted regressions resolved all verified findings. Actual unchanged dev key returns 403 pending explicit scope grants; no production requests, uploads, grants, deployment or publication performed.
- [Consolidated audit and API/learning contract](../../docs/cms-learning-and-collaboration.md).
