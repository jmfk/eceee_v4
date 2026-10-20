---
id: PRD-0024
title: CMS Content Agent for Pages, Objects, Widgets, and safe Settings
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

# PRD-0024: CMS Content Agent for Pages, Objects, Widgets, and Safe Settings

## Problem

Editors assemble content across page hierarchy, working versions, object schemas, object versions, widget slots, media, and selected tenant settings. These operations can be automated, but only if the agent respects the distinct version, validation, authorization, reference, and publication rules of each domain.

## Goals

- Provide a CMS Agent profile for authorized Page, Object, and widget-instance work.
- Support useful cross-domain tasks while retaining one authoritative workflow per aggregate.
- Expose a separately elevated Theme/Admin profile for allowlisted settings.
- Make every proposed mutation reviewable, conflict-aware, reversible where supported, and attributable.
- Reuse existing CMS APIs, serializers, schemas, registries, and workflow services.

## Non-Goals

- Let the content agent create new widget implementation types or edit repository code.
- Give ordinary editors access to user administration, credentials, remote connections, migrations, or system operations.
- Infer publication authority from edit authority.
- Perform broad content rewrites, subtree publication, bulk deletion, or schema migration without a separately reviewed plan and explicit approval.
- Provide character-level collaborative rich-text editing.

## Users and Use Cases

- An editor creates a page working copy, selects an existing theme/layout, adds configured widgets, links approved objects, and reviews a responsive preview.
- An editor asks the agent to update several related objects; the agent queues one explicit target per command and reports partial conflicts without losing completed work.
- A tenant administrator asks the Theme/Admin profile to add a value list or additive object-type field after impact analysis.
- A user selects a widget and asks the agent to rewrite content or reconfigure presentation without affecting unrelated widgets.

## Requirements

### Page tools

- The agent can list, search, inspect, create, and structurally place pages within the selected tenant and the user's permissions.
- Editable content uses the canonical Page working copy and complete-snapshot workflow from ADR-0001, ADR-0002, and ADR-0015.
- Page commands carry the reviewed version identifier and edit revision.
- The agent can change supported page attributes, page data, theme/layout selection, widgets, publishing metadata, and object links only through their canonical endpoints.
- Page hierarchy moves, slug changes, hostnames, scheduling, and publication are exposed as distinct tools with distinct review impact.
- Preview uses unsaved or saved working state as appropriate and clearly labels which one is shown.

### Object tools

- The agent can list, search, inspect, create, and edit authorized object instances and versions.
- Object values are validated against the current object-type schema and field permissions.
- Object-reference fields resolve only tenant-authorized objects of permitted types.
- Object widget instances use the same stable widget identity and parity contracts as page widgets.
- Before mutating object versions, implementation must establish a reviewed-revision conflict contract equivalent in safety to the Page workflow; absence of that contract blocks mutating Object Agent rollout.
- Object publication, scheduling, and unpublication are separate reviewed actions.

### Widget-instance tools

- The agent retrieves the authoritative widget registry entry, backend schema/defaults, edit contract, render contract, and target-slot rules before creation or update.
- Supported operations are add, configure, move, copy, remove, and inspect widget instances by stable identity.
- Nested widget operations address stable parent/slot/widget paths, never unreviewed array indexes.
- The server validates the full owning page or object snapshot after a widget operation.
- Data-driven widgets show loading, success, empty, and error preview states when applicable.
- Creating or changing a widget implementation type is routed to a separate developer workflow outside this product agent.

### Safe settings and elevated profile

- The Theme/Admin profile uses an explicit allowlist rather than generic Settings CRUD.
- Initial candidate settings are themes through their existing workflows, value lists, additive object-type changes, namespaces, and non-secret presentation settings.
- Users, roles, machine keys, model credentials, data connections, remote sites, content migrations, experiments, destructive schema changes, and system operations are machine-denied until separately specified.
- Object-type changes include affected-object count, validation impact, compatibility assessment, and rollback/roll-forward guidance.
- Secret-bearing settings expose presence, status, public identifiers, and validation outcome only; values are never returned to the model.

### Cross-domain planning

- A plan decomposes work into commands whose target aggregate, base revision, expected effect, required permission, and approval level are explicit.
- Cross-domain work does not use a distributed database transaction. Each accepted command is independently idempotent and records compensation or recovery guidance.
- A failure in one command does not silently roll back unrelated completed commands or skip required user review.
- Shared references are resolved and validated before mutation and revalidated at execution.

### Publication and destructive actions

- Saving a draft or working copy does not imply publication.
- Publish, schedule, unpublish, archive, delete, hierarchy-wide, bulk, and schema-impacting operations are separate plan items.
- The approval view shows exact targets, reviewed revisions, public/data impact, preview or validation evidence, and recovery path.
- A changed revision, target set, or impact invalidates the approval and requires renewed review.

## Acceptance Criteria

- An editor can ask the agent to create a page working copy with valid widgets and object references, preview it, and leave it unpublished.
- Independent agent and human page edits rebase or conflict according to ADR-0015 without data loss.
- Object mutation is not enabled until stale-write tests prove a reviewed-revision boundary.
- A widget invalid for the destination slot or schema is rejected without partially saving the owner.
- An editor cannot access Theme/Admin tools by changing client payloads or routes.
- A safe setting change reports impact and uses its existing canonical API; a denied setting cannot be invoked because no tool is registered.
- Publication and destructive actions require a distinct reviewed action tied to current revisions.
- Cross-tenant searches, references, events, and queue commands return no data and perform no mutation.

## Constraints

- Existing Page workflow, Object APIs, Theme workflows, widget registries, and Settings APIs remain authoritative.
- Cross-language casing is bridged explicitly at existing adapters.
- The first release edits widget instances only; repository-level widget implementation remains developer work.
- Settings expansion is incremental and evidence-driven.
- The CMS Agent and Design Agent share runtime infrastructure but not capability grants.

## Implementation Notes

- Implement Page and widget-instance support before Object mutation and Settings mutation.
- Treat the missing Object reviewed-revision contract as a deliberate prerequisite, not an invitation to reuse timestamps or last-write-wins implicitly.

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
