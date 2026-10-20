---
id: ADR-0026
title: One agent runtime with capability-scoped profiles
status: accepted
date: 2026-10-14
related_prds:
  - PRD-0022
  - PRD-0023
  - PRD-0024
supersedes: []
superseded_by: []
---

# ADR-0026: One Agent Runtime with Capability-Scoped Profiles

## Context

Themes, the restricted Designer, and Layout Editor operate on one theme-owned design system, while Pages, Objects, widgets, and Settings use other domain workflows. Separate agent products would duplicate sessions, queues, provider integrations, context handling, observability, and UI. One unconstrained agent would instead give designer-only users tools and context they must not possess.

## Decision

Build one embedded agent runtime with explicit capability-scoped profiles. The initial profiles are `designer`, `cms_editor`, and `theme_admin`.

A profile selects its system contract, available domain tools, context builders, approval classes, eval suite, and UI name. Server-side authorization then intersects profile capabilities with the authenticated principal's current tenant and object permissions. A capability absent from the effective set is not registered as a model tool and cannot be invoked through a crafted request.

The profile is immutable for a run. Switching profile starts a new run and records the transition. An administrator who invokes the agent from Designer receives the narrower `designer` profile by default and must explicitly choose a broader profile.

Use one orchestrating agent and one mutating writer per target aggregate. Read-only critics or specialist subagents may be introduced only after eval evidence shows a bounded failure that cannot be solved more simply with tools or deterministic validation.

## Rationale

Shared infrastructure avoids duplicated systems, while capability construction provides a real security and product boundary rather than relying on prompting. Defaulting administrators to the local narrow profile reduces accidental scope expansion.

## Consequences

- Every tool and context source needs stable capability identifiers.
- Profile changes and permission changes are auditable independently.
- Sessions may share a user-visible history, but each run snapshots its effective capabilities.
- Multi-agent orchestration is deliberately deferred.
- Profile-specific product wording and evals become first-class configuration.

## Alternatives Considered

- Separate Designer, CMS, and Theme agent services: rejected because orchestration, provider, queue, and UI behavior would drift.
- One agent with all tools and prompt-only restrictions: rejected because prompts are not an authorization boundary.
- Automatically grant all tools held by an administrator: rejected because invocation context should still minimize authority.

## Links

- Related PRDs: [PRD-0022](../../prds/0022-embedded-cms-agent-platform.md), [PRD-0023](../../prds/0023-design-agent.md), [PRD-0024](../../prds/0024-cms-content-agent.md)
- Extends [ADR-0003](0003-tenant-membership-authorization.md) and [ADR-0016](0016-scoped-machine-api-keys.md).
