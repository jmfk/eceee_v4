# Risk-based CI and deployment evidence

Ordinary changes run package-relevant lint, dependency-aware frontend tests and a
frontend build. Vitest `--changed <complete-PR-base>` follows imported dependencies;
an empty selection falls back to all frontend tests. Backend, authorization,
shared rendering/layouts/widgets, dependencies, build/deploy controls and unknown
paths conservatively require full CI.

`scripts/ci_evidence.py plan` chooses full verification when:

- The current or cumulative diff since the last verified full main baseline is high risk.
- This is the tenth merged PR since that baseline (including the prospective PR).
- The baseline is at least seven days old, unavailable, or cannot be verified.

PR identities, rather than commit counts, handle multi-commit rebase merges.
Incomplete Git history never narrows checks. Missing GitHub metadata falls back to
full CI. The first rollout bootstraps with a full run.

## Full verification

The stable `CI policy gate` requires the planned caller to succeed and the other
caller to be skipped; it is the check used by the prepared branch-protection
ruleset helper. Existing remote rulesets are preserved.

The CI caller selects exactly one reusable job set: `Fast CI` or `Full CI`. A
full gate requires every full job to succeed: Python helpers, backend/frontend
lint, Django integration, frontend units/build, publisher production checks. Skipped, missing, failed and cancelled required
jobs cannot satisfy the full gate.

Full CI also runs on main every Monday at 03:00 UTC. Use workflow dispatch on
main for an immediate full baseline. A PR can request a manual full run by adding
`full-ci`; after a new push, remove/reapply it only when no automatic full run is
already verifying the current head. Do not request duplicate full runs on one head.

```sh
gh workflow run ci-full.yml --ref main
gh pr edit <number> --add-label full-ci
```

## Approved merges

Complete review and the required checks before approval of the final head.
After approval, an explicit owner request to merge means merge directly: no new
tests, CI reruns, `full-ci` label cycle, review round or repeated confirmation.
Read the current head, existing checks, submitted reviews, review decision,
unresolved review threads and mergeability once; reuse valid evidence for the
unchanged approved commit and use an exact-head merge guard.
Do not bypass branch protection.

If the head changes, required evidence is missing/failing or a blocker appears,
report it instead of starting another review/test cycle under the merge request.
Ordinary base movement does not itself require a rebase. GitHub's automatic
post-merge checks may still run; production deployment keeps its separate gates.

## Deployment

```sh
make prod-deploy TAG=v0.x.y
```

The target requires an immutable release tag, a clean checkout of its exact
merged commit, complete history, and fresh successful main-branch GitHub Actions
evidence from the known CI workflows. It verifies the policy again. A newer
pending/failed/cancelled attempt cannot be hidden behind an earlier success;
another commit's result is never substituted. Full evidence is required when
risk or cadence demands it. GitHub unavailability fails closed.

The evidence gate replaces local dependency installation and duplicate full
suites. The production flow still validates environment, locks the operation,
backs up data, checks/applies reviewed migrations, restarts services and verifies
backend, publisher and public-route health. Missing evidence must be fixed in CI;
it is not permission to bypass a gate.

```sh
make prod-preflight TAG=v0.x.y       # Evidence check only
make prod-preflight-local TAG=v0.x.y # Explicit full local diagnostic run
```

`FAST_RELEASE` is retired. CI success and code review are separate evidence; the
owner's explicit merge/deploy request remains the authorization boundary.

## Local resource limits

The operator's OrbStack limit is 6 GiB on a 16 GiB Mac, verified after its required
restart. Keep frontend checks at two workers (one during resource diagnosis).
Do not stop shared provider services or unrelated projects to make a test pass.

Decision: [ADR-0061](../specs/adrs/active/0061-optional-heavy-ci-checks.md).

## Optional heavy checks and timing

`Optional browser regression tests` runs Playwright admin and pilot baselines
weekly, or through Actions → Run workflow. It is independent of required CI and
never contributes to the merge or deployment gate.

Historical schema replays carry the `historical_migration` tag. CI includes them
for schema/model/fixture/control changes, changes to those tests, cadence full
runs, weekly checks and explicit full runs. Other backend runs exclude only that
tag. Local `make backend-test` still includes them by default. Django prints its
twenty slowest tests (including setup/teardown); pytest prints fifteen durations.

Measured run 1055: backend 10m50s (image 4m18s, test command 6m01s), frontend
3m17s, browser 3m03s, publisher 2m54s. The backend was the critical path; making
Playwright optional alone would not have shortened that run. Exact per-test
Django timings were unavailable before the timing runner was added.

The first timing-enabled PR run measured the tagged tests at 36.359s (taxonomy
upgrade/backfill), 27.491s (theme asset migration) and 18.573s (Kanban upgrade).
The next slowest individual test was 2.089s. Keep those faster correctness tests
required; the measured historical replays account for about 82 seconds together.

## Backend image cache

CI restores a ready-to-load dependency image using an exact key containing the
runner OS/architecture, ISO week, Dockerfile and all requirement files. On a miss,
it builds the Dockerfile's `ci` target, saves the image and retains BuildKit layer
caching as a fallback. The target contains tools and Python dependencies; the
Compose bind mount supplies the current checkout at `/app` on every test run.
Application source edits therefore reuse the image without testing stale code.

Dependency/Dockerfile edits and the weekly key force rebuilding. There is no
fallback to an image built for different dependencies. GitHub's branch cache
scope rules still apply, so a PR cache cannot seed the first main-branch build.
The first run after adoption is cold; subsequent speedups must be measured in CI.
