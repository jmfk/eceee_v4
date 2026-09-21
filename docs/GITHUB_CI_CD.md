# GitHub CI and PR workflow

This repository uses GitHub Actions to run quality checks on every branch push and every pull request targeting `main`.

## Required workflow

The `CI` workflow runs:

- backend lint checks with Black, isort, and flake8 for changed backend Python files
- frontend lint checks with ESLint
- backend Django tests through Docker Compose
- frontend Vitest unit tests through Docker Compose
- frontend Playwright regression tests

The Docker-based jobs use `docker-compose.ci.yml` to run the local infrastructure stack on GitHub's Linux runners while keeping the local Docker Compose files unchanged.

## Branch protection

Configure GitHub branch protection or a repository ruleset for `main`:

- require a pull request before merging
- block direct pushes to `main`
- require the `CI` workflow checks to pass before merge
- optionally require branches to be up to date before merge

The repository default branch is `main`; there is no local `master` branch in this checkout.
