---
id: PRD-0017
title: Public Next publisher cutover
status: in-progress
locked: true
created: 2026-10-09
related_adrs:
  - ADR-0019
---

# PRD-0017: Public Next Publisher Cutover

## Problem

The production stack already runs and validates the standalone Next publisher on isolated test hostnames, but the live Summer Study and Industry public hosts still send page requests to Django. This leaves the legacy Django renderer on the public request path even though the TypeScript renderer and its read-only data boundary are available.

## Goals

- Route live public page requests for the production hosts already declared in the repository to the Next publisher.
- Keep Django as the CMS, API, migration owner, and compatibility origin without using its template renderer for public pages.
- Make the cutover observable, testable, and reversible through the normal tagged deployment workflow.

## Non-Goals

- Deploy the change or mutate production DNS, CMS hostnames, credentials, or data.
- Add a new public root-domain route that is not already served by this deployment.
- Remove Django, its API, admin, migrations, static files, or media compatibility routes.
- Change editor, Designer, or standalone preview rendering.
- Replace the publisher's read-only PostgreSQL data layer with Django API calls.

## Users and Use Cases

- Public visitors receive server-rendered React pages from Next on the Summer Study and Industry hosts.
- Editors continue to manage and publish content through the existing Django-backed CMS.
- Operators can verify both live publisher routes during deployment and roll back by deploying the prior tag.

## Requirements

- `summerstudy.$DOMAIN` and `industry.$DOMAIN` must send ordinary public page requests to the `publisher` service.
- Requests for admin entry points, CMS APIs, static files, and legacy media paths must retain their existing Django behavior.
- Same-origin `/imgproxy/*` requests must reach imgproxy and publisher form submissions must reach the publisher form route.
- Existing isolated `*-test.colliberty.com` publisher routes must remain available and non-indexable.
- Deployment health verification must require the backend, publisher health endpoint, and both live public publisher roots to respond successfully.
- CI must validate the production Caddy configuration and the updated deployment health contract.

## Acceptance Criteria

- The production Caddy configuration sends fallback page traffic for both existing live content hosts to `publisher:3000`.
- `/api/forms/*` reaches the publisher before the broader `/api/*` Django route.
- `/admin*`, `/api/*`, `/static/*`, and `/media/*` retain explicit Django routing.
- `/imgproxy/*` reaches imgproxy with the prefix removed.
- The deployment healthcheck fails when either live publisher root or the publisher health endpoint is unavailable.
- Publisher tests, lint, typecheck, build, Caddy validation, deployment script tests, and specs validation pass locally.

## Constraints

- Production deployment still requires the repository's tag-based owner gate and successful backup/preflight flow.
- The two live hostnames must remain assigned to the intended published root pages in CMS data.
- A separately reviewed change is required before adding or moving any other public hostname.

## Implementation Notes

- 2026-10-09: Implementation started on `codex/public-publisher-cutover`.
- 2026-10-09: Production routing, renderer-marked live-route health checks, CI Caddy validation, and operator documentation were implemented locally. Production deployment remains separately gated.

## Linked ADRs

- [ADR-0019: Route existing public content hosts to the Next publisher](../adrs/active/0019-public-host-next-publisher.md)

## Completion Evidence

- 2026-10-09: Publisher tests (76 passed, 2 database-dependent skipped), lint, typecheck, production build, and client-bundle verification passed.
- 2026-10-09: Shared registry, `PageRenderer`, render-frame, and editor-preview parity suites passed (153 tests).
- 2026-10-09: Deployment health, production-operation, deploy-control, and serialized-image-build script tests passed; ShellCheck and production Caddy validation passed.
- 2026-10-09: Specs governance validation passed. Local visual parity was not rerun because the publisher server was stopped and the Django comparison host returned HTTP 500; the live-route deployment gate remains required.
