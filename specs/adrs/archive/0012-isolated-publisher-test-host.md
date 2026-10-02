---
id: ADR-0012
title: Validate the publisher through an isolated hostname alias
status: superseded
date: 2026-09-29
related_prds:
  - PRD-0010
  - PRD-0011
supersedes: []
superseded_by:
  - ADR-0014
---

# ADR-0012: Validate the Publisher through an Isolated Hostname Alias

## Context

The TypeScript publisher needs production-shaped validation before any public hostname moves away from Django. Three test hostnames are available on `colliberty.com`, while the published content being compared belongs to `eceee.org`, `summerstudy.eceee.org`, and `industry.eceee.org`. Rewriting the upstream Host header would select the right content but could cause native form redirects and generated absolute URLs to leave the test origin.

## Decision

Run the publisher in the existing production Compose stack and route only `eceee-test.colliberty.com`, `summerstudy-test.colliberty.com`, and `industry-test.colliberty.com` to it. Preserve the incoming Host header through Caddy. Inside the publisher, map each exact normalized test hostname to its corresponding public source hostname only when resolving published content. Continue to use the original request URL for navigation and form redirects.

Provision the two publisher PostgreSQL roles after Django migrations on every deploy. Treat provisioning as a convergent operation, validate generated URL-safe passwords before backup or migration, and make deployment readiness depend on both publisher liveness and successfully rendered root pages for all test hosts. Mark test-host responses as non-indexable.

## Rationale

An isolated hostname makes rollout and rollback independent of existing public traffic. Application-level content aliasing separates content identity from browser origin, so the test exercises the real same-origin form route without redirecting testers to production. Reusing the existing Compose stack and database keeps the operational change small while dedicated roles preserve the agreed write boundary.

## Consequences

- Existing public hostnames continue to use Django until a separately reviewed traffic-cutover change.
- DNS and TLS for the test hostnames must work before external testing.
- The test hostnames expose the same published content publicly, but `X-Robots-Tag` prevents intended search indexing.
- Test form submissions use the same tenant/page/widget storage path as the source site and must be treated as production-form data during testing.
- A missing database grant, invalid credential, or unresolved source root makes the deployment health gate fail rather than silently serving a broken test site.

## Alternatives Considered

- Rewrite the upstream Host header in Caddy: rejected because redirects could escape to the source production hostname.
- Add the test hostnames to the source roots' stored hostname lists: rejected because a deployment test should not require mutating published CMS data.
- Replace the existing public Caddy route immediately: rejected because parity and production behavior have not yet been validated.
- Run a separate database or VPS: rejected because the test requires production-shaped data and does not justify another stateful deployment.

## Links

- Related PRDs: PRD-0010, PRD-0011
