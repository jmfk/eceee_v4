---
id: ADR-0027
title: Domain tools preserve canonical CMS workflows
status: accepted
date: 2026-10-14
related_prds:
  - PRD-0022
  - PRD-0023
  - PRD-0024
supersedes: []
superseded_by: []
---

# ADR-0027: Domain Tools Preserve Canonical CMS Workflows

## Context

An agent needs to read and mutate themes, layouts, pages, objects, widget instances, and selected settings. Generic JSON Patch, direct model access, or a broad database tool would bypass existing permissions, schema validation, optimistic concurrency, publication invariants, casing adapters, and recovery behavior.

## Decision

Expose small, typed domain tools that call the same application services and supported APIs as the human product. Do not give the product agent arbitrary SQL, ORM, shell, filesystem, Git, or generic record-mutation tools.

Each mutating tool declares:

- required agent capability and user permission;
- tenant and aggregate target;
- reviewed version or revision;
- strict input and output schemas;
- affected paths or domain fields;
- idempotency key;
- validation and conflict outcomes;
- whether it requires separate human review;
- sanitized audit representation.

Theme tools use the Designer draft, full-theme version, export/import, and serializer contracts as appropriate. Page tools use the canonical complete working-copy service. Object tools remain read-only until a reviewed-revision mutation boundary is established. Widget-instance tools mutate the complete owning Page or Object snapshot and validate the relevant registry, slot, and renderer contracts. Settings tools are explicitly allowlisted; there is no generic Settings tool.

Repository-level creation or modification of widget implementations is a separate developer workflow in an isolated Git worktree with code review and tests. It is not an end-user CMS tool.

## Rationale

Domain tools keep AI behavior inside the product's established safety boundaries and make model mistakes rejectable by deterministic code. They also produce clearer audit records and more stable evals than free-form patches.

## Consequences

- More tools and adapters must be maintained than with a generic mutation endpoint.
- Domain workflow improvements automatically benefit both human and agent clients.
- Unsupported product behavior remains unavailable until its canonical service exists.
- Tool schemas become versioned contracts that require compatibility tests.
- The model can propose unsupported work, but execution fails before mutation with a specific explanation.

## Alternatives Considered

- Generic JSON Patch against persisted documents: rejected because validation and concurrency semantics vary by aggregate.
- Direct Django ORM tools: rejected because they bypass serializers and workflow services.
- Browser automation of the CMS UI: rejected as the primary write path because it is brittle and obscures authorization and idempotency; it remains useful for visual verification.
- A separate MCP server with direct database access: rejected because it creates a second application boundary. A future MCP adapter may call the same supported tools.

## Links

- Related PRDs: [PRD-0022](../../prds/0022-embedded-cms-agent-platform.md), [PRD-0023](../../prds/0023-design-agent.md), [PRD-0024](../../prds/0024-cms-content-agent.md)
- Preserves [ADR-0002](0002-single-page-workflow-mutation-boundary.md), [ADR-0004](0004-designer-draft-publication.md), [ADR-0009](0009-theme-preview-documents.md), and [ADR-0015](0015-revision-based-page-collaboration.md).
