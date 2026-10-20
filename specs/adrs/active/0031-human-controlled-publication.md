---
id: ADR-0031
title: Human-controlled publication and recoverable mutations
status: accepted
date: 2026-10-14
related_prds:
  - PRD-0022
  - PRD-0023
  - PRD-0024
supersedes: []
superseded_by: []
---

# ADR-0031: Human-Controlled Publication and Recoverable Mutations

## Context

The agent can prepare coherent drafts faster than a human, but publication, scheduling, unpublication, broad schema changes, destructive cleanup, and bulk mutations have wider effects than ordinary draft editing. Treating them as implicit final steps would weaken existing review workflows and make stale plans dangerous.

## Decision

Separate preparation from effectful transitions. The agent may autonomously read, plan, validate, render, and save within an authorized draft or working copy. Publish, schedule, unpublish, archive/delete, bulk, schema-impacting, credential, and external-communication actions are distinct plan items with an approval class.

Before an approval, the server resolves and reports exact targets, current revisions, affected public/data surfaces, validation and preview evidence, expected impact, and recovery path. Approval is bound to that target set, revision set, and operation. Any material change invalidates it.

Theme publication uses existing Designer revisions or named theme versions. Because the current shared Designer draft has only one mutable snapshot, a high-impact unpublished agent mutation first stores an immutable pre-mutation draft snapshot or validated inverse operation. Restore is bound to the mutation's resulting draft revision and refuses to overwrite later work. Page mutations use canonical working versions and historical restore behavior. Object and Settings mutations must establish an equivalent recovery or roll-forward path before activation. Destructive operations prefer archive, soft delete, or a separately recoverable command where the domain supports it.

The product action should execute directly after explicit selection and present progress and Undo/recovery rather than a generic confirmation dialog. Irreversible or externally visible actions may use a brief dedicated review screen because the information, not the word "confirm", is the required gate.

## Rationale

Binding approval to reviewed state preserves human control without forcing approval for every safe tool call. Domain recovery mechanisms remain authoritative and explainable.

## Consequences

- Tool metadata must classify approval and recovery requirements.
- Long plans may pause at approval boundaries.
- The UI needs a compact impact review and post-action recovery affordance.
- Some bulk workflows remain unavailable until target enumeration and recovery are bounded.
- Successful validation is necessary but not equivalent to publication authorization.

## Alternatives Considered

- Ask for approval before every mutation: rejected because it destroys useful autonomy and creates alert fatigue.
- Automatically publish when the plan completes: rejected because correctness and user intent are different conditions.
- Use a generic "Are you sure?" modal: rejected because it does not communicate exact state, impact, or recovery.
- Let a broad initial approval cover later changed revisions: rejected because the reviewed artifact would no longer match execution.

## Links

- Related PRDs: [PRD-0022](../../prds/0022-embedded-cms-agent-platform.md), [PRD-0023](../../prds/0023-design-agent.md), [PRD-0024](../../prds/0024-cms-content-agent.md)
- Preserves [ADR-0004](0004-designer-draft-publication.md), [ADR-0010](0010-named-theme-version-checkpoints.md), and [ADR-0015](0015-revision-based-page-collaboration.md).
