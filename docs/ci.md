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
lint, Django integration, frontend units/build, browser/pilot baselines and
publisher production checks. Skipped, missing, failed and cancelled required
jobs cannot satisfy the full gate.

Full CI also runs on main every Monday at 03:00 UTC. Use workflow dispatch on
main for an immediate full baseline. A PR can request a manual full run by adding
`full-ci`; after a new push, remove/reapply it only when no automatic full run is
already verifying the current head. Do not request duplicate full runs on one head.

```sh
gh workflow run ci-full.yml --ref main
gh pr edit <number> --add-label full-ci
```

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

Decision: [ADR-0057](../specs/adrs/active/0057-risk-based-ci-and-deploy-evidence.md).
