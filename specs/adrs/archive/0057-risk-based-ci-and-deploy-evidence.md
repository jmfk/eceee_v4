---
id: ADR-0057
title: Risk-based CI cadence and exact-commit deployment evidence
status: superseded
date: 2026-11-05
related_prds:
  - PRD-0041
supersedes:
  - ADR-0048
superseded_by:
  - ADR-0061
---

# ADR-0057: Risk-based CI cadence and exact-commit deployment evidence

## Decision

Replace full verification on every PR/deploy with dependency-aware frontend test
selection and conservative full checks for backend, authorization, shared runtime,
dependencies, build/deploy controls and unknown paths. Selected frontend runs also
lint and build; if Vitest finds no related tests, run its full suite instead.

Use successful full gates from main as baselines. Count merged PR identities,
including the prospective PR, across Git ancestry. Require a full run at ten PRs
or seven days, and schedule a weekly main full run. Missing evidence/history/API
access chooses full CI rather than narrowing verification. Inspect the cumulative
diff since the full baseline so risky changes are not hidden by later UI work.

Production deployment verifies fresh successful main-branch Actions evidence for
the exact release commit from the known CI workflows. A newer failed/pending/
cancelled workflow attempt blocks reuse of older success. A full gate additionally
requires every expected full job to have succeeded. GitHub token material is
handled by gh; diagnostics never print credentials or provider response bodies.

A stable `CI policy gate` validates the planned conditional caller for branch
protection, without requiring a skipped full check on ordinary changes. The
existing ruleset helper targets this stable check; no remote ruleset is replaced.

Normal `make prod-deploy` uses this evidence preflight instead of rerunning local
suites. `prod-preflight-local` retains the explicit full diagnostic run. Retire the
separate FAST_RELEASE bypass path. Backup, locking, migration checks, environment
validation, restart and health scripts remain unchanged.

## Consequences

- Small UI releases avoid unrelated tests and local duplicate runs.
- Selection is incomplete evidence by design; cumulative periodic full runs and
  always-full risky changes bound that risk.
- Deployment needs GitHub availability and full Git history; it fails closed
  rather than silently bypassing evidence checks.
- The first rollout has no main full baseline and therefore runs full CI.
- Runtime memory is 6 GiB after an authorized local OrbStack restart; provider data
  and project isolation are preserved.

## Links

- [PRD-0041](../../prds/0041-risk-based-ci-and-deploy-evidence.md)
- [CI operator instructions](../../../docs/ci.md)
