---
id: PRD-0022
title: Embedded CMS agent platform
status: draft
locked: false
created: 2026-10-14
related_adrs:
  - ADR-0026
  - ADR-0027
  - ADR-0028
  - ADR-0029
  - ADR-0030
  - ADR-0031
  - ADR-0032
---

# PRD-0022: Embedded CMS Agent Platform

## Problem

ECEEE users currently perform multi-step design and content work by navigating between separate editors, inspecting schemas and previews manually, and repeating related changes across themes, layouts, pages, objects, widgets, and settings. The existing generic AI task prototype can run background jobs and report progress, but it is not tenant-scoped, context-aware, steerable, or constrained to the CMS's canonical write workflows.

ECEEE needs one durable agent platform embedded in the CMS. It must support long-running, queued, interruptible work without creating a parallel permission model, data model, or publication path.

## Goals

- Embed an agent in the normal CMS shell and relevant editing surfaces.
- Provide one orchestration runtime with capability-scoped product profiles.
- Let users queue, edit, copy, reorder, cancel, and steer agent commands.
- Persist sessions, runs, public activity, tool calls, checkpoints, and costs durably.
- Preserve tenant isolation, existing permissions, optimistic concurrency, and canonical publication workflows.
- Support tenant-owned model credentials and multiple model providers through one capability-aware adapter contract.
- Give users useful progress, plans, decisions, previews, and errors without exposing raw model chain-of-thought.
- Establish an eval-driven path for improving prompts, tools, routing, and model selection.

## Non-Goals

- Give end-user agents arbitrary SQL, Django ORM, shell, filesystem, Git, deployment, or production-host access.
- Replace the Page, Object, Theme, Designer, Layout, or Settings APIs with an agent-specific source of truth.
- Let an agent silently publish, deploy, send external communications, change credentials, or perform destructive administration.
- Promise true mid-token steering across every model provider.
- Introduce multi-agent execution before a measured need exists.
- Make DSPy or another prompt optimizer a runtime dependency for the first release.

## Users and Use Cases

- A designer asks the embedded agent to revise an assigned theme and continues working while the agent validates and previews the draft.
- An editor queues several page and object updates, reorders the queue, edits an unstarted command, and steers the active command after seeing its plan.
- A tenant administrator selects an approved model provider, sets a budget, and reviews attributable usage without exposing the provider key.
- A user returns after a browser reload and resumes the same session, queue, context, and active-run status.
- Support staff inspect a sanitized audit trail that explains which domain tools changed which records and revisions.

## Requirements

### Embedded experience

- The authenticated CMS shell exposes the agent within two navigation levels and through the combined command palette.
- Relevant surfaces expose contextual entry points for the current theme, layout node, page, object, widget, or safe setting.
- A docked, resizable panel provides Chat, Activity, and Plan/Queue views without covering the primary editor.
- A full workspace provides session history, queue management, run details, cost, and recoverable results.
- The active target is always visible as tenant, site where applicable, aggregate type, aggregate identifier, and reviewed revision.
- The frontend sends identifiers only as hints; the server re-resolves every target and permission.
- Streaming and progressive activity replace spinner-only waiting. Keyboard navigation, visible focus, screen-reader labels, reduced motion, zoom, light mode, and dark mode are supported.

### Sessions, commands, and runs

- A session belongs to one tenant, one creator, and one capability profile; optional theme, page, object, site, or selection targets are explicit.
- A queued command stores immutable target identity and the base revision that the user reviewed.
- Users can edit or delete only commands that have not started.
- Copy creates a new command and new idempotency identity.
- Reordering is transactional and cannot reorder an already running command.
- At most one mutating run writes to one target aggregate at a time.
- Lease recovery uses a monotonically increasing fencing generation; a worker that has lost ownership cannot perform another mutation even if it resumes later.
- A run has durable queued, running, waiting-for-user, cancelling, cancelled, completed, and failed states.
- Retrying creates a new attempt while retaining prior evidence; successful tool mutations are not blindly replayed.
- Every mutating tool call has an idempotency key and records the reviewed and resulting revisions.

### Steer, stop, and recovery

- Steer appends a high-priority instruction to the active run and is applied at the next safe boundary: after a model step, before a tool call, after a tool result, or at an explicit checkpoint.
- The UI reports when a steer was received and when it became active.
- Stop is cooperative. Unsupported provider cancellation marks the run cancelling, discards an obsolete model result, and prevents further mutations.
- Workers persist checkpoints between meaningful steps and resume safely after process, broker, network, or browser failure.
- PostgreSQL queue reconciliation eventually rediscovers eligible work when a Celery/Redis wakeup is lost, and per-tenant execution limits prevent one tenant from starving others.
- Worker retries never duplicate an accepted mutation.

### Authorization and audit

- Existing selected-tenant membership, object permissions, theme assignments, and publication permissions remain authoritative.
- Permission is checked when a command is created and again immediately before every tool execution.
- A queued command fails closed when permission, target ownership, or reviewed revision is no longer valid.
- Agent records carry tenant ownership and are inaccessible across tenants.
- Tenant ownership is enforced in every agent-table relationship, unique constraint, index prefix, query, serializer, subscription, and worker lookup. The implementation follows the repository's current application-enforced tenant boundary; partial agent-only PostgreSQL RLS is not introduced without a separate repository-wide decision.
- The activity stream distinguishes user messages, public agent messages, plans, decisions, tool requests, tool results, validation, previews, errors, and state transitions.
- State changes and their public audit events commit atomically. Per-session event ordering cannot skip a late commit, and reconnect detects and repairs sequence gaps from PostgreSQL.
- Secrets, raw provider payloads, hidden reasoning, credentials, and sensitive content excluded by policy are not written to the public stream.

### Providers, budgets, and usage

- Provider adapters declare support for structured output, tools, streaming, reasoning controls, usage reporting, cancellation, and native compaction.
- A model is enabled for mutating work only after passing the shared adapter and tool-contract suite.
- Tenant credentials are write-only, encrypted at rest, separately authorized, rotatable, revocable, and never included in prompts or ordinary logs.
- A run snapshots its provider, model, capability set, prompt/program version, and budget.
- Per-run and tenant budget limits can prevent starting another model step or tool loop.
- Usage and cost are attributable to tenant, user, session, run, provider, model, profile, and prompt/program version.

### Context and transparency

- Model context is derived from authoritative live reads, the accepted plan, relevant recent messages, current queue/steer state, validated tool results, and a compact checkpoint.
- The complete audit history remains durable even when model context is compacted.
- A checkpoint records decisions, unresolved questions, affected identifiers, revisions, validation state, and recovery instructions; it does not replace authoritative CMS data.
- Provider-native compaction may optimize a run but cannot be the only recoverable context representation.
- The product displays concise decision and progress summaries, not raw chain-of-thought.

### Observability and operations

- Operators can measure queue latency, model latency, tool latency, retries, conflicts, cancellation delay, token use, cost, validation failures, and completion outcome.
- Logs use stable run, command, tool-call, tenant, correlation, and causation identifiers while redacting content according to policy.
- Retention policies distinguish audit metadata, tenant content, model payloads, previews, and credentials.
- A kill switch can disable a provider, model, profile, or mutating tool without disabling read-only CMS access.

## Acceptance Criteria

- An authorized user can start a session from the CMS shell, queue two commands, edit and reorder the unstarted command, steer the running command, reload the browser, and observe the same durable state.
- A worker restart at each defined checkpoint resumes or safely fails without duplicating a mutation.
- A paused worker that resumes after losing its lease is fenced before mutation, and a queued command still starts after its original broker wakeup is deliberately dropped.
- Concurrent event writers and out-of-order worker completion cannot cause a reconnecting client to miss a committed activity event.
- Concurrent edits return the canonical domain conflict rather than overwriting a newer draft or version.
- A user from tenant B cannot discover, subscribe to, retrieve, steer, copy, or execute tenant A's agent records or targets.
- A provider key is never returned after creation and does not appear in application logs, exceptions, events, model inputs, or API responses.
- Unsupported provider capabilities cause a deterministic preflight failure before mutation.
- Public activity explains what the agent did and why at a summary level without storing raw chain-of-thought.
- Focused API, authorization, queue, recovery, provider-contract, accessibility, and end-to-end tests pass.

## Constraints

- PostgreSQL is the durable source for agent workflow state; Celery/Redis and Channels are execution and delivery mechanisms only.
- Existing domain APIs and workflow services remain the mutation boundaries.
- The initial release uses one orchestrating agent and one writer per target aggregate.
- Production operations remain subject to the repository's separate human gates.
- The implementation must coexist with the legacy `AIAgentTask` surface until explicit migration or removal work is approved.

## Implementation Notes

- Use [the implementation plan](../plans/0001-embedded-cms-and-design-agent.md) as the ordered execution guide.
- The first demonstrable journey is the Design Agent editing an assigned theme draft and layout, rendering previews, and stopping before publication.

## Linked ADRs

- [ADR-0026: One agent runtime with capability-scoped profiles](../adrs/active/0026-capability-scoped-agent-profiles.md)
- [ADR-0027: Domain tools preserve canonical CMS workflows](../adrs/active/0027-domain-tools-preserve-canonical-workflows.md)
- [ADR-0028: Durable PostgreSQL runs with cooperative steering](../adrs/active/0028-durable-runs-and-cooperative-steering.md)
- [ADR-0029: Provider-neutral context packs and public reasoning summaries](../adrs/active/0029-provider-neutral-context-and-transparency.md)
- [ADR-0030: Tenant BYOK through capability-aware provider adapters](../adrs/active/0030-tenant-byok-provider-adapters.md)
- [ADR-0031: Human-controlled publication and recoverable mutations](../adrs/active/0031-human-controlled-publication.md)
- [ADR-0032: Eval-first prompt optimization](../adrs/active/0032-eval-first-prompt-optimization.md)

## Completion Evidence

- None yet.
