---
id: ADR-0036
title: Frozen pilot contracts and isolated reference verification
status: accepted
date: 2026-10-21
related_prds:
  - PRD-0027
supersedes: []
superseded_by: []
---

# ADR-0036: Frozen Pilot Contracts and Isolated Reference Verification

## Context

The owner requires evidence that retiring Django preserves supported functionality. The first batch establishes the current Headline, Banner, TwoColumns and Forms behavior before any implementation is moved. There is no replacement backend to compare yet.

## Decision

- Version portable request/configuration cases and freeze reviewed wire responses against source commit `9da0eb18451db16f5b8406f1c0c6c5a4f108483d`. Preserve exact fields, types and array order; record the complete render catalog through sorted type identities and a canonical-content digest.
- Run real DRF parser/router/renderer observations, independent semantic assertions, PostgreSQL save/reload and rejection tests, React preview tests and Chromium desktop/mobile checks. The render fixture is shared across these test surfaces, with explicit independent expected content and ordering.
- Run the local baseline in disposable PostgreSQL 17 and Playwright containers. Use a unique unpublished network and tmpfs data, never existing development databases. This is the documented ephemeral-test exception to shared-local-services. No host ports are published or allocated.
- Copy Git-tracked and selected new nonignored backend/frontend source files into a run-specific read-only snapshot. Exclude environment files and installed dependencies. Do not mount operator environment files or pass operator credentials. Backend fixtures use public test-only values; external mail, caches, Channels and Celery use in-process test backends.
- Never update the frozen reference in a normal run. Observation-only capture is separate from verification. A later reference change needs reviewed source provenance and an explicit snapshot diff.
- Fail on missing/different contract observations, unexpected types/order/fields, skipped required tests or flaky browser tests. Keep comparison outputs and failure traces. Known reference defects are explicit metadata and yield `passed_with_known_reference_issues`, not a claim of defect-free behavior.
- Report reference provenance separately from the current tested commit and dirty working-tree state. Report candidate parity as `not_supplied` until observations from an actual replacement exist. Comparing frozen responses does not prove middleware behavior; separate session/tenant/CSRF and persisted-state tests cover those pilot paths.

## Consequences

- Future adapters can consume the same case JSON and compare observations using the standalone strict comparator.
- This batch adds no runtime widget implementation, schema migration or new product API. It does not retire any Django path.
- Chromium checks use an isolated test-only entry point with the real renderer/CSS, not the complete CMS UI or live publisher. Full editing/publishing journeys, simultaneous write races, temawidgets, jobs and migration parity remain later gates.
- Pydantic/DRF behavior, including error payloads and an observed Headline casing defect, remains visible. An intentional fix is a separately reviewed change; the frozen defect is not an approved target behavior for the replacement.

## Alternatives Considered

- Regenerate expected snapshots on every run: rejected because it conceals regressions.
- Replay writes into the developer's database: rejected because it contaminates data and interferes with parallel work.
- Use only mock/unit or pixel comparisons: rejected because neither proves persisted state, authorization or functional interaction.
- Rewrite the API while creating the baseline: deferred until the baseline is independently runnable.

## Links

- [PRD-0027](../../prds/0027-framework-independent-content-contract.md)
- [PLAN-0003](../../plans/0003-django-parity-verification.md)
- [Runner and fixture instructions](../../../backend/webpages/tests/fixtures/pilot_baseline/README.md)
