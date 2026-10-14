---
id: ADR-0031
title: Eval-first prompt optimization
status: accepted
date: 2026-10-14
related_prds:
  - PRD-0021
  - PRD-0022
  - PRD-0023
supersedes: []
superseded_by: []
---

# ADR-0031: Eval-First Prompt Optimization

## Context

Agent quality depends on prompts, context assembly, tool schemas, models, and deterministic validators. DSPy and other optimizers can improve prompts, but optimizing before representative tasks and reliable metrics exist risks overfitting subjective examples and obscuring simpler product or tool defects.

## Decision

Version prompts and agent programs from the first implementation, but improve them manually against a checked-in evaluation harness before introducing automated optimization.

Each profile maintains representative golden tasks, deterministic invariant checks, tool-trace metrics, cost/latency measures, adversarial cases, and held-out end-to-end outcomes. Visual design evaluation combines deterministic layout/accessibility checks, screenshot evidence, and human ratings; an LLM judge is supplementary rather than the sole oracle.

DSPy may be introduced as an offline development dependency only after:

- a stable profile and tool contract exist;
- at least 30 representative development examples exist, with a growth target of 300;
- a held-out test set is protected from optimization;
- metrics correlate acceptably with human review;
- candidate programs can be replayed with recorded or bounded provider cost;
- optimized artifacts are versioned, reviewed, and rollbackable.

Optimization runs separately per provider/model capability family. A compiled prompt or program does not update production automatically; it must beat the baseline on held-out quality, safety, cost, and latency gates.

## Rationale

Eval-first development identifies whether failures come from tools, state, permissions, retrieval, prompts, or models. It preserves a simple runtime while leaving a disciplined path to DSPy when enough evidence exists.

## Consequences

- The first release includes an eval harness and prompt versioning but not DSPy in production.
- Human-reviewed examples are a planned product asset.
- Provider/model changes require regression evals.
- Optimization consumes controlled offline API budget and produces ordinary reviewed artifacts.
- Prompt quality work cannot substitute for deterministic authorization and validation.

## Alternatives Considered

- Add DSPy to the runtime immediately: rejected because metrics and representative data do not yet exist.
- Hand-tune prompts indefinitely: rejected because reproducible optimization becomes valuable once the dataset matures.
- Use only an LLM judge: rejected because safety, schema, revisions, permissions, and render parity have deterministic truth.
- Share one optimized prompt across all providers: rejected because provider capabilities and response behavior differ.

## Links

- Related PRDs: [PRD-0021](../../prds/0021-embedded-cms-agent-platform.md), [PRD-0022](../../prds/0022-design-agent.md), [PRD-0023](../../prds/0023-cms-content-agent.md)
