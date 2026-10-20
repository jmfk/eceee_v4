---
id: ADR-0029
title: Provider-neutral context packs and public reasoning summaries
status: accepted
date: 2026-10-14
related_prds:
  - PRD-0022
  - PRD-0023
  - PRD-0024
supersedes: []
superseded_by: []
---

# ADR-0029: Provider-Neutral Context Packs and Public Reasoning Summaries

## Context

Long-running agent sessions must survive provider changes, context-window pressure, worker restarts, and compaction. Live CMS records change independently of the conversation. Raw chain-of-thought is not a stable product contract and may expose sensitive or misleading intermediate reasoning. A broad vector index of the repository would add cost and stale context before retrieval quality is proven.

## Decision

Build each model turn from a provider-neutral context pack containing:

- profile contract and registered tool schemas;
- authenticated tenant and explicit target identifiers;
- accepted plan and active queue item;
- current steer and cancellation state;
- authoritative domain snapshots or digests read just in time;
- relevant recent public messages and tool results;
- compact checkpoint of older decisions and unresolved work;
- bounded, provenance-labelled retrieval results.

Persist the complete public audit stream separately from the compact model window. Checkpoints record decisions, identifiers, revisions, constraints, validation evidence, open questions, and recovery guidance. They never substitute for a fresh domain read.

Use deterministic structured retrieval first: current workspace APIs, registries, schemas, theme contract, widget quick reference, selected nodes, usage references, and relevant repository documentation. Add PostgreSQL lexical retrieval for a curated knowledge corpus when required. Add embeddings/pgvector only after held-out evals show a material retrieval gain. Every indexed item carries tenant/visibility scope where applicable, source path or record, version/commit, and timestamp.

Provider-native conversation state or compaction may be used as an optimization, but a run must remain recoverable from application-owned state. Do not expose or store raw chain-of-thought. Show concise plans, decision summaries, progress, tool activity, validation, and errors.

## Rationale

Authoritative reads and explicit checkpoints resist stale context and provider lock-in. A staged retrieval design keeps the first release lean. Public summaries give users useful transparency without turning hidden reasoning into an API or audit dependency.

## Consequences

- Context builders and token budgets must be tested per profile and provider.
- Checkpoint quality becomes an eval target.
- Native compaction cannot be assumed across providers.
- Repository and tenant knowledge ingestion need provenance and invalidation rules before activation.
- Some users may perceive less "thinking" text, but the activity stream is more stable and actionable.

## Alternatives Considered

- Replay the full transcript forever: rejected because cost, latency, and context limits grow without bound.
- Store only provider conversation IDs: rejected because recovery and portability depend on an external opaque state.
- Index the entire repository and tenant corpus in an external vector database initially: rejected as premature infrastructure and a larger authorization surface.
- Display raw chain-of-thought: rejected because it is not a reliable, safe, or portable product contract.

## Links

- Related PRDs: [PRD-0022](../../prds/0022-embedded-cms-agent-platform.md), [PRD-0023](../../prds/0023-design-agent.md), [PRD-0024](../../prds/0024-cms-content-agent.md)
