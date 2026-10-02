# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

ECEEE v4 is a Docker-based CMS stack with:

- Backend: Django 4.2+, Django REST Framework, PostgreSQL 17 locally, Redis, Celery, HTMX, Pydantic.
- Frontend: React 19, Vite, Tailwind CSS, React Query, Zustand, React Router, Vitest.
- Supporting services: MinIO, ImgProxy, Playwright rendering service, theme sync service, deployment scripts under `deploy/`.

The system centers on page management, publishing workflows, code-based layouts/themes, multi-tenancy, and a code-based widget system.

## Repository Map

- `backend/`: Django project, API, templates, static assets, management commands, migrations.
- `frontend/`: React application and component tests.
- `deploy/`: production compose files and deployment/rollback/backup scripts.
- `theme-sync/`: theme file synchronization service.
- `playwright-service/`: website rendering service.
- `docs/`, `manuals/`, `backend/README.md`, `frontend/README.md`: project documentation.
- `.cursor/rules/`: source material for these agent instructions.

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
  before requesting the production gate. The default local `linode-cli` profile
  may belong to another Linode account and must not be treated as authoritative
  for ECEEE production unless its account ownership has been independently
  established. Report the resolved SSH host and exact command scope in the
  gate, then use that address as the SSH target. If the DNS records disagree or
  the production mapping is otherwise ambiguous, stop and report that specific
  discrepancy. Never display Linode API tokens or configuration contents; apply
  `inspect-secrets-safely`.
- Codex may use SSH and run commands in production only after a fresh, explicit owner gate for the exact operation. Immediately before requesting that gate, report the production environment and host, the exact commands or tightly bounded command class, whether the work is read-only or mutating, the expected service and data impact, the evidence motivating it, and the rollback or recovery plan when applicable. The owner must authorize that reported operation in a new message; a general request to continue, prior approval, or an ambiguous keypad signal is not authorization.
- Production authorization is limited to the reported environment, host, scope, commands, and time-bounded task. A materially different command, target, service, data set, risk, or recovery path requires a new report and explicit owner authorization. Stop if a command would expand beyond the approved scope, expose secrets, or require an unreviewed destructive action.
- Prefer reviewed repository targets and scripts over ad hoc server commands. Durable production changes should normally go through local code/config changes, commit/push, and `deploy/scripts/`. A directly authorized emergency or diagnostic server change must be minimal, recorded in the handoff, verified after execution, and reconciled back into the repository when it represents persistent configuration or behavior.
- After an owner gate, Codex may run the approved SSH, `docker exec`, `docker logs`, `docker compose`, Django management, database, status, logging, deployment, or recovery commands directly. Do not infer permission for adjacent commands; harmless command syntax adjustments are allowed only when they do not change the approved scope or risk.
- Codex may run `make prod-deploy TAG=<release-tag>` only after a human deployment gate. Always deploy by a Git tag, never by passing a commit hash as `TAG`. Immediately before requesting that gate, verify the tag resolves to the intended exact commit and report the production environment, tag, exact commit, current CI/review status, expected operational and data-path impact, and known residual risks. The owner must then explicitly authorize deploying that tag and commit to production in a new message. Review, merge, preparation, prior risk acknowledgement, or a general request to continue is not deployment authorization.
- Deployment authorization is valid only for the reported tag, commit, and production environment. Verify the tag still resolves to that commit immediately before deployment. Any tag movement, commit change, failed preflight requiring code/config changes, or materially changed risk invalidates the authorization and requires a fresh report and new explicit approval. Never infer approval from an ambiguous keypad signal or short response.
- After the human gate, use only the reviewed `make prod-deploy` target and its repository scripts. Do not replace or bypass their preflight, backup, locking, migration, credential-provisioning, or health-check steps. Stop and report if they request interactive credentials, expose secrets, or require an unreviewed manual server action.
- Before requesting the gate, verify that the deployment is expected to cause no more service disruption than the established `make prod-deploy` flow normally causes. Report any extra maintenance window, restart scope, temporary unavailability, or expansion to unrelated services; a materially larger operational impact requires a separate explicit owner decision before deployment.
- Protect existing production data as a hard constraint. The reviewed preflight and backup must succeed before mutation; migrations must be reviewed for upgrade safety and non-destructive behavior. The authorized deployment must not include restoration, backfills, resets, destructive cleanup, `DELETE`, `TRUNCATE`, broad data rewrites, or other separately risky data operations unless the owner approves that exact operation through its own human gate.
- If deployment or health verification fails after production mutation, do not improvise a manual fix, destructive rollback, or data restoration. Preserve production data, stop further mutation, report the completed phases and failure evidence, and request a new owner gate for the exact diagnostic or recovery path.
- For production debugging, Codex may run `make prod-logs`, `make prod-status`, or explicitly approved SSH/read-only commands after the owner gate above. Redact output and use `inspect-secrets-safely` whenever credentials or secret-bearing configuration could be involved.
- Production restoration, backfills, resets, destructive cleanup, `DELETE`, `TRUNCATE`, and broad data rewrites require a separate owner gate naming the exact data target and operation. Prefer a reviewed, backup-aware, resumable script in `deploy/scripts/`; verify the recovery point and rollback or roll-forward plan before execution.

## Common Commands

Use `make help` for the full list of targets. Key ones: `make servers`, `make migrate`, `make test`, `make lint`.

Backend static assets: `cd backend && npm run build` / `npm run watch:css`

## Pull Request Review And Merge Gate

- After addressing review feedback on an existing pull request, always run the
  relevant local verification, commit the completed review fixes, and push them
  to that pull request's branch before handing the work back. Do not leave
  completed review fixes only in the local working tree. Omit the push only when
  the user explicitly requests that or an external blocker prevents it, and report
  the reason.
- Never equate passing CI with code review or approval. Report CI status,
  submitted reviews, and GitHub's `reviewDecision` as separate facts.
- Before merging any pull request, fetch its current checks, submitted reviews,
  review decision, unresolved review threads when available, and mergeability.
  Do this immediately before the merge even if the PR was inspected earlier.
- Before requesting owner sign-off to merge, apply the `full-ci` label and verify
  that the full CI run succeeded for the pull request's current head commit.
  A later push requires a new full run and a new status report.
- Never merge a pull request unless the user has explicitly instructed the agent
  to merge that specific PR after the agent has reported the current head commit,
  checks, submitted reviews, review decision, unresolved review threads, and
  mergeability. That instruction is the repository owner's sign-off and may be
  used instead of a submitted GitHub `APPROVED` review. A submitted approval from
  another authorized reviewer is still valid supporting evidence, but is not
  required for an owner-operated repository.
- Owner sign-off is valid only for the reviewed head commit. Any later code change
  invalidates it and requires a fresh status/review report followed by a new,
  explicit instruction to merge that PR. Comments, bot reports, successful checks,
  branch-protection bypasses, and the agent's own review are not owner sign-off.
- Do not infer merge authorization from requests to review, fix, commit, push,
  synchronize, rebase, make mergeable, or report which branches can be merged.
- Treat migrations, data migrations, backfills, tenancy or authorization changes,
  destructive cleanup, and production data-path changes as high-risk. An agent
  must never merge such a PR without a fresh risk review of the current head and
  a separate explicit owner instruction that names the PR and acknowledges the
  reported high-risk change. A prior general instruction to merge is insufficient.
- For migration or backfill PRs, the review must explicitly consider clean-database
  installation, upgrade from existing data, idempotency and resumability, tenant
  isolation, locking and performance, failure recovery, rollback or roll-forward,
  and operational verification. Record gaps instead of treating green tests as
  sufficient evidence.
- If the required owner sign-off or authorization is absent, stop at a merge-ready
  PR, state exactly what is missing, and leave the merge to the user. Repository
  rules being bypassable does not weaken this gate.

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
