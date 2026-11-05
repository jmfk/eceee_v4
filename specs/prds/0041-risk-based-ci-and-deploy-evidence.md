---
id: PRD-0041
title: Risk-based test selection and CI-backed deployment
status: completed
locked: true
created: 2026-11-05
related_adrs:
  - ADR-0057
  - ADR-0061
---

# PRD-0041: Risk-based test selection and CI-backed deployment

## Problem

Repeating full suites locally, in CI and again during deployment causes long
release times and resource-dependent timeouts on the operator's machine.

## Requirements

- Select affected tests and their dependencies for ordinary changes.
- Run the complete suite for high-risk/unknown changes, every tenth merged PR
  since a verified full baseline, and at least weekly.
- Base cadence on merged PRs rather than individual commits. Include the
  prospective PR when deciding whether its pre-merge run must be full.
- Reuse successful GitHub Actions evidence for the exact merged release commit
  at deployment. Reject missing, stale, failed, cancelled or pending evidence.
- Preserve tagged releases, production backups, operation locking, migration
  checks, service restart and health checks.
- Increase the operator's OrbStack memory limit from 4 to 6 GiB.

## Acceptance Criteria

- Ordinary frontend changes use Vitest's dependency graph; missing related tests
  fall back to the frontend suite.
- Full gates cannot be satisfied by skipped required jobs or another commit.
- Tests cover cadence boundaries, risk classification and deployment refusal.
- Deploying a verified release does not reinstall dependencies or repeat suites
  on the operator's computer.

## Implementation Notes

- Shared backend/runtime/control changes remain conservative full checks.
- Weekly verification runs on main, Monday at 03:00 UTC; manual full runs remain available.

## Linked ADRs

- [ADR-0057](../adrs/archive/0057-risk-based-ci-and-deploy-evidence.md)

## Completion Evidence

- Framework-independent helper suite: 54 passed; final CI policy/deploy checks: 29 passed; frontend selection checks: 3 passed.
- Workflow YAML/Bash syntax, Black 25.11.0, isort, flake8 and specification validation passed.
- Production backup/lock/environment/migration/health guard tests passed.
- Independent P0-P3 review found a rerun ordering issue; fixed with regression and targeted clean recheck.
- OrbStack configured at 6144 MiB; runtime reports 6283915264 usable bytes after restart.
- Real Vitest dependency collection selected 57 files for the prior shared-layout change (232 total files).
- Rollout uses the high-risk full CI gate before merge and exact merged-commit evidence before deployment.

- Follow-up owner request: browser checks become optional/manual and historical schema replays are selected as defined by [ADR-0061](../adrs/active/0061-optional-heavy-ci-checks.md).
