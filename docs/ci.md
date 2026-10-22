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
Fast feedback is deliberately incomplete and cannot authorize a merge.

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

## Activate repository enforcement after rollout

The existing repository ruleset does not require status checks. This PR prepares
enforcement; **it does not change live GitHub settings**. Until the following
activation is complete, owner/agent merge discipline remains the enforcement.
Merge this rollout only after its exact-head Full CI passes and owner approval.
Then separately authorize the settings change and run:

```sh
python3 scripts/ci_ruleset.py
python3 scripts/ci_ruleset.py --apply --verification-sha <40-character-tested-PR-head>
```

The first command is an offline JSON preview. Apply verifies the workflow files
exist on `main` and both check names have succeeded from GitHub Actions on the
specified verification revision. It creates the separate **ECEEE CI merge gates**
ruleset for `main`, with strict up-to-date checks and no bypass actors. Existing
rulesets are preserved. A matching ruleset is a no-op; drift is rejected rather
than overwritten. Readback must match the desired policy. It does not change
reviews, merge methods, release tags, deployment settings or other branches.

After activation, inspect GitHub's active rules for `main`. Confirm a PR with only
fast checks is blocked by the missing full gate, then request full CI and confirm
both exact-revision gate checks are successful. Repeat after a new push to confirm
the old full result cannot authorize the new commit. Record this live rollout
verification separately from the local policy tests and CI results. Reverting
workflow files alone does not remove the required checks: rollback requires a
separately authorized removal of only this named ruleset before retiring its jobs.

The workflow files remain review-sensitive: these gates assume normal repository
code review, rather than protecting against a contributor deliberately rewriting
the CI jobs themselves. See GitHub's
[required status checks guidance](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).
