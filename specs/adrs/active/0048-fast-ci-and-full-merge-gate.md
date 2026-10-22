---
id: ADR-0048
title: Fast push feedback and an exact-revision full CI merge gate
status: accepted
date: 2026-10-22
related_prds:
  - PRD-0028
supersedes: []
superseded_by: []
---

# ADR-0048: Fast push feedback and an exact-revision full CI merge gate

## Context

Ordinary PR pushes currently repeat PostgreSQL, browser and production-image
checks. The owner wants fast feedback during implementation and complete evidence
once the batch is ready for merge. A permanent full-ci label must not keep making
every later push expensive. Existing GitHub rules have no required status checks.

## Decision

Use two callers of one reusable CI workflow. Ordinary PR updates and main pushes
run lint and package-relevant unit checks, without Playwright, database integration
or production builds. An explicit full-ci label addition requests every check;
remove/reapply the label for a later request. Select paths across the complete PR
diff, including deletions; fail if the event base is unavailable.

Emit separate fast and full gate names. The full gate rejects every missing,
skipped, cancelled or failed expected job. Quick runs and unrelated label events
must not emit a skipped successful full gate. Separate concurrency groups preserve
the requested full run while ordinary pushes continue. GitHub checks must match
the current revision and strict rules require an up-to-date main base.

Prepare a separate main-only GitHub ruleset requiring both GitHub Actions gate
checks, with no bypass actors. Activate it only after the workflow rollout is
merged, exact-revision CI is verified, and the settings change is authorized.
Preserve existing rulesets; preview by default, verify before applying and read
back the installed rule. Until activation, the owner/agent merge procedure remains
necessary. This ADR changes CI cadence; the pilot contract and browser checks in
ADR-0039 remain mandatory in the full merge gate.

## Consequences

- Ordinary iterations avoid browser/system installation and database/production builds.
- Complete verification is delayed until requested, so fast CI alone is incomplete evidence.
- Each later push needs a fresh full run before merge, even when the label remains.
- Repository enforcement requires a recorded post-merge settings activation.
- Future workflow removal needs coordinated ruleset removal to avoid blocking all merges.

## Alternatives considered

- Keep full-ci as a level-triggered label: repeats expensive work after every push.
- Run full suites only after merge: detects regressions after they already reach main.
- Skip a required full-gate job during fast runs: skipped jobs can satisfy required checks.
- Duplicate the full job implementations: lets quick and final verification drift.

## Links

- [CI operator instructions](../../../docs/ci.md)
- [PRD-0028](../../prds/0028-framework-independent-content-contract.md)
- [ADR-0039](0039-frozen-pilot-behavior-baseline.md)
