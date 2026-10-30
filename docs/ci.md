# Fast feedback and the full merge gate

Ordinary PR updates and pushes to `main` run **CI**. Adding the `full-ci` label
requests **Full CI** on that PR's current revision. Both callers use
`ci-checks.yml`, so commands and dependency pins have one source of truth.

| Checks | Ordinary update | Full CI before merge |
| --- | --- | --- |
| CI policy, gate and Python helper unit tests | Always | Always |
| Python formatting/lint | Changed backend/scripts | Yes |
| Frontend lint and unit tests | Frontend/shared changes | Yes |
| Publisher unit tests and lint | Publisher/shared changes | Yes |
| Django/PostgreSQL integration suite and migrations | No | Yes |
| Admin Playwright and desktop/mobile pilot baseline | No | Yes |
| Publisher SQL, typecheck, production build/image, dependency audit and deployment checks | No | Yes |

Selection uses the event's PR **base SHA through the tested merge checkout**, not
just the most recent commit. Deleted paths still select their package. Unknown
and infrastructure paths select all packages; shared widget contracts also select
all packages. Full CI selects everything, including for documentation-only PRs.
Fast feedback is deliberately incomplete. The ordinary merge path requires Full
CI. The opt-in fast-track lane below accepts its limited evidence for a narrowly
eligible patch and requires a combined review afterward.

## Fast track for small fixes

Use this lane only when the owner explicitly requests fast track for a small,
isolated, reversible fix. Exclude migrations, stored-data contracts, tenant scope,
authorization, secrets, dependencies, CI/deployment controls, and production
data paths. A small diff is not enough by itself.

Run focused local checks, wait for `Fast CI / Fast CI gate` on the exact head,
and make a brief risk assessment. Report the PR number and head, changed
behavior, checks, residual risk, submitted reviews, review decision, unresolved
threads, and mergeability. Ask the owner for `Yes` or `y` to merge that PR. Do
not bypass active GitHub branch protection if it requires Full CI.

Mark each PR body `Fast-track follow-up: pending` and record its head commit in
the task handoff. Within one week or after five fast-track merges, whichever
comes first, review their combined diff and run
`make prod-preflight TAG=<latest-fast-track-tag>` on the latest release tag.
Batch any findings into one follow-up PR, then update the original PR bodies
with the review result and any fix link. Do not fast-track more changes while
that follow-up is unresolved.

For an eligible frontend-only release, first read the exact commit currently
deployed in production through an authorized read-only check. Inspect the full
diff from that commit to the new release tag; a frontend path alone does not
make a behavior change safe. After the owner approves the reported tag, commit,
base commit, and narrow checks, run:

```sh
make prod-deploy TAG=v0.x.y FAST_RELEASE=1 FAST_BASE_REF=<deployed-commit>
```

This uses the reviewed deploy path with `frontend-lint frontend-test` as its
fixed preflight. The script rejects changes outside `frontend/src/`,
`frontend/public/`, and `frontend/index.html`, a missing base, or a base that is
not an ancestor of the release. Use ordinary `make prod-deploy TAG=...` for all
other releases. Both paths still back up the database, check migrations, restart
services, and verify health. GitHub's active main branch ruleset was inspected
on 2026-10-30: it requires a PR but does not require status checks. Check it
again before the first fast-track merge or after any ruleset change.

## Requesting the final run

Wait until the review batch is ready, then add `full-ci` using GitHub's Labels UI
or `gh pr edit <number> --add-label full-ci`. The workflow listens to the **label
addition event**, not ordinary pushes or the continued presence of the label.
If the label is already present, remove and reapply it:

```sh
gh pr edit <number> --remove-label full-ci
gh pr edit <number> --add-label full-ci
```

A later push runs fast CI only. The new commit has no successful full gate and
must receive another explicit full run before merge. Separate concurrency groups
prevent a quick run cancelling a requested full run. A new full request supersedes
an older full request on that PR. Full-workflow concurrency also includes the
triggering label, so unrelated label events cannot cancel a requested full run
before their reusable call is skipped. An old in-flight run may finish after a new
push; it remains evidence for its tested revision and cannot satisfy the new one.

Required job names are distinct: `Fast CI / Fast CI gate` and
`Full CI / Full CI gate`. A quick call never creates a skipped full gate. A label
unrelated to `full-ci` skips the entire reusable call, so it creates no full-gate
check. The full gate requires **success** for every expected job: missing, skipped,
failed or cancelled required jobs are rejected. Fast CI allows only intentionally
unselected jobs to be skipped. Tests exercise both policies.

## Optional status-check enforcement

The existing repository ruleset does not require status checks. The existing
`scripts/ci_ruleset.py` would require both Fast CI and Full CI on every PR,
which is incompatible with the fast-track lane. Do not apply it while fast track
is in use. If status-check enforcement is desired later, first design a rule
that preserves both merge paths and get separate owner approval. The script can
still be previewed offline:

```sh
python3 scripts/ci_ruleset.py
```

Do not use `--apply` without a revised policy and its own owner gate. Reverting
workflow files alone would not remove required checks from an activated ruleset.

The workflow files remain review-sensitive: these gates assume normal repository
code review, rather than protecting against a contributor deliberately rewriting
the CI jobs themselves. See GitHub's
[required status checks guidance](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).
