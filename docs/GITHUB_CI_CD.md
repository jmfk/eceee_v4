# GitHub CI and PR workflow

This repository uses GitHub Actions to run linting, unit tests, and Playwright regression tests before code is merged to `main`.

The intended day-to-day flow is:

1. Create a feature branch from `main`.
2. Commit changes on that branch.
3. Push the branch to GitHub.
4. Open a pull request into `main`.
5. Wait for the `CI` workflow to pass.
6. Merge the PR after review.

Do not push directly to `main`.

## When CI runs

The workflow lives in `.github/workflows/ci.yml`.

It runs on:

- every branch push
- every pull request targeting `main`

The workflow uses GitHub Actions concurrency so that when a branch receives a newer push, older in-progress runs for the same branch are cancelled. This keeps the visible result focused on the latest commit.

## What CI checks

The workflow has five jobs.

### Backend lint

Runs:

```bash
make backend-lint
```

This checks changed backend Python files with:

- Black in check mode
- isort in check mode
- flake8

Backend lint is intentionally scoped to changed backend Python files relative to `origin/main`. The existing backend codebase is not yet globally Black/flake8 clean, so this gives us an enforceable rule for new work without turning the first CI step into a large historical cleanup.

### Frontend lint

Runs:

```bash
cd frontend && npm ci && npm run lint
```

Existing warnings are currently allowed, but lint errors fail CI.

### Backend tests

Runs:

```bash
make backend-test
```

This starts the local infrastructure stack and runs Django tests in the backend Docker container.

The test command uses:

```bash
python manage.py test --keepdb --verbosity=2 --failfast --noinput
```

### Frontend unit tests

Runs:

```bash
make frontend-test
```

This starts required test infrastructure and runs the Vitest suite in the frontend Docker container.

### Frontend Playwright tests

Runs:

```bash
make frontend-e2e-test
```

This includes:

- public site Playwright regression tests against the Django public renderer
- admin/frontend Playwright regression tests against the Vite app

In GitHub Actions, Chromium is installed before this job runs:

```bash
npx playwright install --with-deps chromium
```

If the Playwright job fails, GitHub uploads the Playwright HTML report as an artifact named `frontend-playwright-report`.

## Docker Compose in CI

Local development still uses the normal compose files:

- `docker-compose.dev.yml`
- `docker-compose.infra.yml`

GitHub Actions also adds:

```bash
docker-compose.ci.yml
```

That CI override changes the infrastructure service platform to `linux/amd64`, which matches GitHub's Ubuntu runners. The local infra file keeps its Apple Silicon-friendly platform settings.

The Makefile supports this through variables:

```bash
DOCKER_COMPOSE
COMPOSE_DEV_FILES
COMPOSE_INFRA_FILES
```

Locally, the defaults are equivalent to:

```bash
docker-compose -f docker-compose.dev.yml
docker-compose -f docker-compose.infra.yml
```

In GitHub Actions, they become:

```bash
docker compose -f docker-compose.dev.yml
docker compose -f docker-compose.infra.yml -f docker-compose.ci.yml
```

## Running the same checks locally

Before opening a PR, run:

```bash
make backend-lint
make frontend-lint
make backend-test
make frontend-test
make frontend-e2e-test
```

For a quicker frontend-only loop:

```bash
make frontend-lint
make frontend-test
```

For a backend-only loop:

```bash
make backend-lint
make backend-test
```

## Branch protection

Configure GitHub branch protection or a repository ruleset for `main`:

- require a pull request before merging
- block direct pushes to `main`
- require the `CI` workflow checks to pass before merge
- optionally require branches to be up to date before merge

The repository default branch is `main`; there is no local `master` branch in this checkout.

## If CI fails

Use the failing job name to decide where to start:

- `Backend lint`: run `make backend-lint`
- `Frontend lint`: run `make frontend-lint`
- `Backend tests`: run `make backend-test`
- `Frontend unit tests`: run `make frontend-test`
- `Frontend Playwright`: run `make frontend-e2e-test`

Fix the issue locally, commit the change, and push the branch again. GitHub will cancel old runs and start a new CI run for the latest commit.

## Current limitation

The backend lint gate checks changed backend Python files only. A future cleanup branch can reformat and fix the full backend, then change `backend-lint` to enforce Black, isort, and flake8 across all backend Python files.
