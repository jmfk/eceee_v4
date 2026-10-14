---
id: ADR-0029
title: Tenant BYOK through capability-aware provider adapters
status: accepted
date: 2026-10-14
related_prds:
  - PRD-0021
  - PRD-0022
  - PRD-0023
supersedes: []
superseded_by: []
---

# ADR-0029: Tenant BYOK through Capability-Aware Provider Adapters

## Context

Tenants may bring API keys for OpenAI, Anthropic, Google Gemini, xAI Grok, DeepSeek, and future providers. These APIs differ in tool calling, structured output, streaming, reasoning controls, cancellation, usage reporting, retention, and compaction. The current central AI client reads environment-level OpenAI and Anthropic keys and does not provide a tenant credential boundary.

## Decision

Introduce write-only tenant model credentials encrypted at rest and a provider adapter contract that exposes actual capabilities instead of pretending all providers are identical.

Credential records belong to a tenant and environment, identify a provider and optional endpoint/account metadata, record creation/rotation/revocation audit data, and return only public status and a redacted identifier. The raw secret is accepted only on create/rotate, decrypted just in time inside the worker, never included in task payloads or model context, and never returned by the API. The application encryption root remains outside the database and follows the repository's secret-management policy.

Each adapter implements normalized request, tool-call, structured-result, streaming-event, usage, error, and cancellation behavior and declares capability flags. Models are separately registered and enabled per profile only after contract tests. Runs snapshot provider, model identifier, adapter version, capability set, reasoning setting, retention mode where known, prompt/program version, and budget.

Start production support with OpenAI and Anthropic. Add Gemini, Grok, and DeepSeek only after the shared contract, redaction, failure, rate-limit, and tool-use tests pass for each provider. Do not silently emulate an unsupported mutating capability.

## Rationale

Capability-aware adapters permit real multi-provider support without weakening tool safety to a lowest common denominator. Tenant-owned encrypted credentials preserve cost ownership and isolation while keeping secrets out of the agent record.

## Consequences

- Credential lifecycle UI, encryption, redaction, rotation, and audit work is required.
- Provider-specific behavior remains visible in capabilities and eval results.
- Cost estimates may be unavailable or approximate until pricing metadata is current.
- Provider outages and rate limits produce normalized public errors while preserving provider details in restricted operational logs.
- Existing environment-level AI callers require an explicit migration decision; they are not silently converted.

## Alternatives Considered

- One platform-owned API key per provider: rejected as the only model because it mixes tenant cost and trust boundaries.
- Store keys in browser local storage: rejected because workers and queued runs need secure server-side access and browsers are an inappropriate secret store.
- One generic OpenAI-compatible HTTP adapter for every provider: rejected because compatibility does not cover reasoning, tools, cancellation, retention, or usage semantics.
- Enable every named provider in the first release: rejected because breadth would delay a testable vertical journey.

## Links

- Related PRDs: [PRD-0021](../../prds/0021-embedded-cms-agent-platform.md), [PRD-0022](../../prds/0022-design-agent.md), [PRD-0023](../../prds/0023-cms-content-agent.md)
