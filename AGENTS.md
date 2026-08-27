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
- Backend uses `snake_case`. Frontend uses `camelCase`. API serialization/conversion is expected to bridge these conventions.
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

- Do not SSH into production to inspect state, edit files, run Docker commands, or execute Django commands.
- Do not run `docker exec`, `docker logs`, `docker compose`, or similar commands on the production server.
- Production changes must go through local code/config changes, commit/push, and the scripts in `deploy/scripts/`.
- For deployment, ask the user to run `make prod-deploy` or `make prod-deploy TAG=v0.x.x`.
- For production debugging, ask the user to run `make prod-logs` or `make prod-status` and share the output.
- For production data restoration, create or update a script in `deploy/scripts/` and ask the user to run it.

## Common Commands

Use `make help` for the full list of targets. Key ones: `make servers`, `make migrate`, `make test`, `make lint`.

Backend static assets: `cd backend && npm run build` / `npm run watch:css`

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

- Code follows existing style and project conventions.
- Relevant tests pass or skipped tests are explained.
- New backend endpoints have permissions, validation, pagination/filtering where appropriate, and consistent JSON/error responses.
- Database migrations are intentional and backwards-compatible where possible.
- Frontend changes are accessible, responsive, and do not add unnecessary state.
- Performance impact is considered for database queries, rendering, caching, and asset size.
- Security impact is considered for auth, input handling, HTML rendering, file/media handling, and secrets.
