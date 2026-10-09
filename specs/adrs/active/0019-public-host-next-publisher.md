---
id: ADR-0019
title: Route existing public content hosts to the Next publisher
status: accepted
date: 2026-10-09
related_prds:
  - PRD-0017
supersedes: []
superseded_by: []
---

# ADR-0019: Route Existing Public Content Hosts to the Next Publisher

## Context

The Next publisher has a shared React `PageRenderer`, TypeScript theme compilation, direct read-only PostgreSQL access, native public forms, isolated production test hosts, and parity coverage. Production Caddy still sends the two live content hosts declared in this repository to Django. The existing Django rendering APIs require authentication and tenant access, so an anonymous API-backed publisher would require a new public contract or service credential while adding latency and another runtime dependency.

## Decision

Route ordinary page traffic for `summerstudy.$DOMAIN` and `industry.$DOMAIN` to the existing Next publisher. Keep the incoming hostname unchanged so the publisher resolves the corresponding CMS root directly and preserves same-origin links and form redirects.

Retain narrow Django routes for `/admin*`, `/api/*` except publisher form submissions, `/static/*`, and `/media/*`. Route `/api/forms/*` to the publisher and `/imgproxy/*` directly to imgproxy. Keep the isolated test-host routes and their non-indexing headers.

Require deployment health verification of the publisher's health endpoint and both live public roots. Roll back by deploying the prior reviewed tag, which restores the Django fallback route.

## Rationale

This uses the already validated final architecture instead of creating a temporary Django-API data source that cannot serve anonymous traffic as currently authorized. Explicit path carve-outs keep the CMS and compatibility surfaces stable while removing Django template rendering from ordinary public requests. Limiting the change to hosts already represented by the production Caddyfile avoids silently expanding the deployment's domain ownership.

## Consequences

- Public page availability now depends on the publisher service and its least-privilege database role.
- Django remains available for CMS/API work and legacy static/media paths but no longer renders ordinary pages on the two cut-over hosts.
- Publisher parity gaps become public on these hosts, so full publisher CI and rendered-route health checks are merge and deploy gates.
- The repository does not begin serving the root `$DOMAIN`; that requires a separate hostname and routing decision.

## Alternatives Considered

- Build a second API-backed Next renderer: rejected because the required Django endpoints are authenticated, it would duplicate the existing renderer, and it would add request fan-out and Django runtime dependency.
- Route every path to Next: rejected because CMS APIs, admin redirects, and compatibility assets remain active supported surfaces.
- Add `$DOMAIN` to the public content block: rejected because this deployment does not currently declare that hostname as a public Django content route.
- Keep live traffic on Django indefinitely: rejected because it does not achieve the requested removal of Django template rendering from the public path.

## Links

- Related PRDs: PRD-0017
