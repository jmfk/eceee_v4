# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

ECEEE v4 is a Docker-based CMS stack with:

- Backend: Django 4.2+, Django REST Framework, PostgreSQL 17 locally, Redis, Celery, HTMX, Pydantic.
- Frontend: React 19, Vite, Tailwind CSS, React Query, Zustand, React Router, Vitest.
- Supporting services: MinIO, ImgProxy, Playwright rendering service, theme sync service, deployment scripts under `deploy/`.

The system centers on page management, publishing workflows, code-based layouts/themes, multi-tenancy, and a code-based widget system.

## Development Direction

- Build new features in TypeScript and React, with PostgreSQL for persistent data. This includes widgets, public rendering, APIs, and business logic where the existing TypeScript stack can support them.
- Do not expand the Python/Django implementation for new functionality by default. Prefer using or extending the TypeScript publisher and frontend, and keep data access tenant-scoped.
- Maintain existing Python code when needed for correctness, security, or compatibility. If a requested feature cannot reasonably be implemented without new Python code, explain the specific dependency and tradeoff before proceeding with that part.

## Repository Map

- `backend/`: Django project, API, templates, static assets, management commands, migrations.
- `frontend/`: React application and component tests.
- `deploy/`: production compose files and deployment/rollback/backup scripts.
- `theme-sync/`: theme file synchronization service.
- `playwright-service/`: website rendering service.
- `docs/`, `manuals/`, `backend/README.md`, `frontend/README.md`: project documentation.
- `.cursor/rules/`: source material for these agent instructions.

## Application UI Design

Use the repository's [eceee-v4-design skill](.agents/skills/eceee-v4-design/SKILL.md) when creating, changing or reviewing ECEEE application UI. Its established ECEEE visual contract takes precedence over generic design skills, including recommendations against cards, borders or the existing blue action styling. This applies to CMS application chrome and tools, not tenant website themes or public rendering.

Use the approved compact Tags style for new and revised CMS tools: 12px control text, slim fields, small corners, filters added by an icon and displayed as removable pills inside search, and tabs connected to a baseline. Field labels sit in the placeholder position when empty and unfocused, then animate into the border on focus or when filled; respect Reduce Motion and keep labels clear of values. Preserve comfortable text/chevron/icon insets and panel padding, and avoid repeated labels or metadata. Follow the repository design skill for the concrete patterns and accessibility requirements.

## Core Conventions

- Prefer existing project patterns over new abstractions.
- Python should follow PEP 8 and project formatting. `backend/pyproject.toml` sets Black line length to 120 and excludes migrations.
- Frontend code should follow the existing ESLint/Vite/React patterns.
- Use functional React components and hooks.
- Use React Query for server state and Zustand for client state.
- Use Tailwind utility classes; organize complex class lists roughly as layout, spacing, typography, then color.
- Treat identifier casing as an important cross-language contract. Python names and
  Python-owned payload fields use `snake_case`; TypeScript/JavaScript variables,
  properties, and frontend-owned payload fields use `camelCase`. Follow normal
  language exceptions such as `PascalCase` for React components, classes, and
  types, and preserve any deliberate project-specific exception.
- Before adding or changing a cross-language name, inspect serializers, adapters,
  API payloads, persisted data, tests, and nearby call sites for established casing
  and exceptions. Bridge `snake_case` and `camelCase` explicitly at the boundary;
  never assume a mechanical rename is safe or allow both forms to become competing
  sources of truth.
- Use DRF serializers for validation, viewsets for API logic, permissions for access control, and filters/pagination for list endpoints.
- Add Django indexes for frequently queried columns and use `select_related`/`prefetch_related` where query shape warrants it.
- Prefer UUIDs for cross-service references.
- Keep user-facing errors meaningful, use appropriate HTTP status codes, and log server-side errors where useful.

## Security And Safety

- Validate inputs on both client and server.
- Use Django security features: CSRF protection, XSS protections, authentication, authorization, and parameterized ORM queries.
- Do not introduce raw SQL unless there is a clear reason and the query is parameterized.
- Never run destructive database operations such as `DROP`, `DELETE`, or `TRUNCATE` without explicit user approval.
- Never commit secrets, API tokens, database dumps, or generated local environment files.

## Production Rules

- `eceee-vps` is the production VPS's Linode-internal name. It is neither a
  locally resolvable DNS/SSH name nor necessarily the Linode API instance
  label. Do not run `ssh root@eceee-vps`, ask the owner to translate it into
  `PROD_HOST`, or query the Linode API with an exact-label assumption. From a
  local machine, resolve the public production host through the established
  ECEEE production DNS records (`app.eceee.org`, `admin.eceee.org`, and
  `imgproxy.eceee.org`) and require them to agree on one public IPv4 address
  before production SSH or deployment. The default local `linode-cli` profile
  may belong to another Linode account and must not be treated as authoritative
  for ECEEE production unless its account ownership has been independently
  established. Report the resolved SSH host and command scope before the
  operation, then use that address as the SSH target. If the DNS records disagree or
  the production mapping is otherwise ambiguous, stop and report that specific
  discrepancy. Never display Linode API tokens or configuration contents; apply
  `inspect-secrets-safely`.
- An explicit owner request to **deploy** authorizes the normal, reviewed
  `make prod-deploy TAG=<release-tag>` operation needed to deliver the current
  task. An explicit request to **merge and deploy** authorizes both steps. Do not
  ask again solely because the PR number, release tag, or merge commit was
  created after that request. Report the resolved PR, tag, commit, CI/review
  status, destination, expected impact, and material risks before acting. If
  checks fail, fix and reverify within the same task; ask only when the target,
  scope, operational impact, or data risk materially changes, or the user has
  not requested the operation. A vague `continue` or ambiguous keypad signal
  is not deployment authorization.
- A deploy request also authorizes bounded read-only production checks needed
  to prepare or verify that deploy, such as status, logs, current commit,
  health, and a migration impact audit. State what is being checked and redact
  output; do not use this permission for unrelated exploration or mutation.
  Other production SSH operations require an explicit owner request for their
  purpose and scope, but no duplicate confirmation when that request already
  supplies it. Stop if the production host is ambiguous or a command would
  expand beyond the authorized task or expose secrets.
- Prefer reviewed repository targets and scripts over ad hoc server commands.
  Durable production changes should normally go through local code/config
  changes, commit/push, and `deploy/scripts/`. A directly authorized emergency
  or diagnostic server change must be minimal, recorded in the handoff,
  verified after execution, and reconciled back into the repository when it
  represents persistent configuration or behavior.
- Always deploy by a Git tag, never by passing a commit hash as `TAG`. Verify
  immediately before deployment that the tag resolves to the reviewed commit
  and that production DNS records agree. Use only the reviewed `make prod-deploy`
  target and its repository scripts; preserve preflight, backup, locking,
  migration, credential provisioning, restart, and health checks. Stop if they
  request interactive credentials, expose secrets, or require an unreviewed
  manual server action.
- Normal tagged deployments use fresh exact-commit CI evidence. The old
  `FAST_RELEASE` path is retired. Use `make prod-preflight-local` only for explicit
  local diagnosis, not as an automatic duplicate of CI. Missing or failed CI
  evidence blocks deployment; do not bypass its gate.
- Verify that the release is expected to cause no more disruption than the
  normal deploy flow. Report any extra maintenance window, restart scope,
  temporary unavailability, or expansion to unrelated services; obtain a new
  decision only for materially larger impact.
- Protect existing production data as a hard constraint. The reviewed preflight
  and backup must succeed before mutation. Review migrations for upgrade safety,
  tenant isolation, locking, failure recovery, and non-destructive behavior.
  A requested deployment includes its reviewed, non-destructive migrations;
  do not add a second data approval solely because they update existing rows.
  Restoration, backfills, resets, destructive cleanup, `DELETE`, `TRUNCATE`,
  or an unreviewed broad rewrite require a distinct explicit owner request
  naming the data target and operation.
- If deployment or health verification fails after production mutation, preserve
  data and stop further mutation. Bounded read-only diagnostics may proceed
  under the deploy request. Report the completed phases and failure evidence;
  obtain explicit approval before manual repair, rollback, or restoration.
  Prefer a reviewed, backup-aware, resumable recovery script and verify the
  recovery point and rollback or roll-forward plan.
- For production debugging, use bounded read-only status or logs within the
  requested task. Redact output and use `inspect-secrets-safely` whenever
  credentials or secret-bearing configuration could be involved.

## Common Commands

Use `make help` for the full list of targets. Key ones: `make servers`, `make migrate`, `make test`, `make lint`.

Backend static assets: `cd backend && npm run build` / `npm run watch:css`

## Pull Request Review And Merge

- Keep review and CI proportional to the changed risk. Before opening or updating
  a PR, inspect the complete intended diff once, batch verified fixes, run focused
  checks during editing, and run one broader local gate when shared behavior or
  migrations warrant it. Match local formatter and tool versions to CI before
  pushing. Do not start another full review or broad test run merely because a
  routine fix was made; recheck the affected code and tests. A new full review is
  warranted only when the fix changes the contract, risk, or substantial scope.
  If a review round produces no new verified findings, stop reviewing and report
  the result. Do not use repeated independent reviews as a substitute for a
  clear risk decision. Keep required Full CI and authorization checks below.
- Ordinary low-risk changes use selected tests without a separate fast-track
  approval lane. High-risk, cadence-due and unknown changes require the full gate.
  Review remains required and proportional to risk; passing CI is not review.
- After addressing review feedback on an existing pull request, always run the
  relevant local verification, commit the completed review fixes, and push them
  to that pull request's branch before handing the work back. Do not leave
  completed review fixes only in the local working tree. Omit the push only when
  the user explicitly requests that or an external blocker prevents it, and report
  the reason.
- Never equate passing CI with code review or approval. Report CI status,
  submitted reviews, and GitHub's `reviewDecision` as separate facts.
- Review, risk assessment and required tests/CI belong before approval of the
  final head commit. Once that commit is approved and the owner requests merge,
  merge directly. Do not rerun tests, restart CI, cycle the `full-ci` label,
  repeat review or ask for another confirmation as part of merging.
- Immediately before merge, make one read-only check of the head SHA, existing
  check results, submitted reviews, review decision, unresolved threads and
  mergeability. Reuse successful evidence for that exact commit; checking its
  status must not trigger new work. Report the result briefly and merge with an
  exact-head guard, without bypassing branch protection.
- Follow the risk/cadence plan from `scripts/ci_evidence.py`: affected tests for
  ordinary changes; full CI at high risk, every tenth merged PR, or weekly.
  Include the prospective PR in the cadence. Verify the current head's successful
  `Fast CI / Fast CI gate` or, when full is required, `Full CI / Full CI gate`.
  During preparation/review, request the `full-ci` label only if a required full
  run is not already present;
  do not launch duplicate full runs for the same head. Later pushes require fresh
  evidence. Deployment reuses exact merged-commit main CI through `make prod-deploy`;
  do not repeat local full suites after valid CI. Keep backup, locking, migration,
  environment and health checks. See `docs/ci.md`.
- An explicit owner request to **merge** authorizes merging the PR created for
  the current task after review and the required checks pass. **Merge and deploy**
  also authorizes that merge. Do not require the owner to repeat the instruction
  after the PR number or final head commit becomes known. Immediately before
  merging, report the current PR/head, checks, submitted reviews, review decision
  (or that the provider cannot expose it), unresolved threads, mergeability,
  changed behavior, and remaining material risks. The agent's own review and
  passing CI are evidence, not a substitute for a missing merge request.
- If the approved head changes, required evidence is missing or failing, a
  blocking finding appears or GitHub prevents the merge, stop and report the
  specific blocker. Do not silently turn a merge request into fixes, a rebase,
  another review or a test/CI cycle. Base-branch movement alone does not require
  a rebase when the approved head remains mergeable with valid required checks.
- Treat migrations, backfills, tenancy or authorization changes, destructive
  cleanup, and production data-path changes as high-risk. Review the final head's
  concrete data and operational impact before approval, then reuse that review
  for the unchanged approved commit. A prior explicit **merge** request for the
  same task remains
  authorization for a reviewed, non-destructive change; a destructive or newly
  expanded operation needs its own explicit owner decision.
- For migration or backfill PRs, the review must explicitly consider clean-database
  installation, upgrade from existing data, idempotency and resumability, tenant
  isolation, locking and performance, failure recovery, rollback or roll-forward,
  and operational verification. Record gaps instead of treating green tests as
  sufficient evidence.
- If the user has not requested merge, stop at a merge-ready PR and state what
  remains. Repository rules being bypassable do not create authorization.
- This direct-merge rule supersedes older merge-workflow instructions requiring
  another confirmation, review or Full CI run after approval. Production
  deployment, destructive operations and their separate authorization rules are
  unchanged. Automatic checks triggered by GitHub after merge may run normally;
  they are not a reason to delay or retest an already approved merge.

## Testing Expectations

- Run the narrowest relevant tests for the change, then broader suites when the change affects shared behavior.
- Backend model, serializer, view, permission, migration, and API contract changes should include or update backend tests.
- Frontend component and workflow changes should include or update Vitest/React Testing Library tests.
- Mock external services and APIs in automated tests.
- Review test fixtures and generated data carefully; avoid brittle tests tied to incidental markup or ordering.
- If tests cannot be run, document why and mention the residual risk.

## Documentation

- Update documentation when behavior, setup, APIs, environment variables, or workflows change.
- Keep documentation focused. Do not generate new docs unless the user asks or the change clearly requires it.
- Document complex business logic inline with concise comments or docstrings.
- Keep API documentation/OpenAPI expectations current for new or changed endpoints.

## Code Review Checklist

Before handing work back, check:

- Django admin is not a supported product surface. Do not report findings that are
  reachable only through Django admin unless the user explicitly asks for an admin
  review. Continue to report issues in shared code when they also affect APIs,
  background jobs, public rendering, or other supported runtime paths.
- Code follows existing style and project conventions.
- Relevant tests pass or skipped tests are explained.
- New backend endpoints have permissions, validation, pagination/filtering where appropriate, and consistent JSON/error responses.
- Database migrations are intentional and backwards-compatible where possible.
- Frontend changes are accessible, responsive, and do not add unnecessary state.
- Performance impact is considered for database queries, rendering, caching, and asset size.
- Security impact is considered for auth, input handling, HTML rendering, file/media handling, and secrets.
