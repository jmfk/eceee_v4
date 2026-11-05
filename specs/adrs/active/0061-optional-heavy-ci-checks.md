---
id: ADR-0061
title: Optional browser checks and targeted historical migration replays
status: accepted
date: 2026-11-05
related_prds:
  - PRD-0041
supersedes:
  - ADR-0057
superseded_by: []
---

# ADR-0061: Optional browser checks and targeted historical migration replays

## Evidence

CI run 1055 took 11m41s. The critical backend job took 10m50s: image build
4m18s, backend command 6m01s. Django ran 1,865 tests in 261 seconds.
Browser checks took 3m03s in parallel and did not cause the release delay.
Log timestamps and test source identify historical Kanban, taxonomy and theme
schema replays as expensive work (approximately 25–52 seconds per boundary,
including setup/cleanup). These are not precise per-test measurements.

The first timing-enabled PR run measured the tagged taxonomy replay at 36.359s,
theme replay at 27.491s and Kanban replay at 18.573s (about 82s combined). The next
slowest individual test was 2.089s. This supports selecting those three historical
replays rather than broadly making normal correctness tests optional.

## Decision

Keep dependency-aware frontend selection, required unit/integration checks,
conservative full checks for high-risk/unknown changes, tenth-PR/seven-day
cadence, exact merged-commit deployment evidence and the stable CI policy gate
from ADR-0057. Preserve the normal tagged deployment, backup, locking, migration,
restart and health flow. OrbStack remains limited to 6 GiB.

Move Playwright admin and pilot browser baselines into an independent workflow
triggered manually or weekly. Their failures remain visible but do not block
merge or deployment. Remove that job from both the CI gate dependency graph and
the expected deployment-evidence jobs; do not merely ignore its result in place.

Tag the three measured historical migration replay tests. Required backend CI
runs them when schema, models, fixtures, relevant tests or unknown/control files
change. Explicit full runs, weekly runs and cadence-selected full runs include
all historical tests. Other backend runs exclude only this tag; normal auth,
tenant-isolation, concurrency and application tests remain required. Local
`make backend-test` still runs everything by default.

Report the twenty slowest Django tests including setup/teardown, and pytest's
fifteen slowest durations. Keep timing informational. Do not turn tests optional
solely because they exceed an arbitrary time threshold.

Cache a ready-to-load dependency-only Docker image by runner OS/architecture,
ISO week, Dockerfile and requirement-file content. Build the `ci` target only on
an exact-key miss; use the existing layer cache as fallback and bind-mount the
current source into every test run. Do not cache a database or test outcomes.
The runtime image stays the final/default Dockerfile target. Weekly invalidation
refreshes unpinned dependencies without making ordinary source edits rebuild
all tools. GitHub's normal branch cache isolation remains intact.

## Consequences

Historical replay selection reduces unrelated backend test time. Moving browser
checks alone does not improve the measured critical path. Warm image cache hits
avoid rebuilding/exporting dependencies; cold misses and duplicate pre/post-merge
full runs remain separate costs. Actual savings must be measured after adoption;
current release evidence is not bypassed.

Browser regressions can reach production before a scheduled/manual check catches
them. The owner explicitly requested non-blocking heavy checks. Schema changes
retain the measured migration regressions as required checks.

## Links

- [PRD-0041](../../prds/0041-risk-based-ci-and-deploy-evidence.md)
- [CI instructions](../../../docs/ci.md)
