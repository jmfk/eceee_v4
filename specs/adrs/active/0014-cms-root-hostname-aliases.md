---
id: ADR-0014
title: Resolve publisher test hosts through CMS root aliases
status: accepted
date: 2026-10-02
related_prds:
  - PRD-0010
  - PRD-0011
supersedes:
  - ADR-0012
superseded_by: []
---

# ADR-0014: Resolve Publisher Test Hosts through CMS Root Aliases

## Context

The parallel publisher originally mapped each test hostname to a configured public source hostname. That duplicated site identity outside the CMS and required deployment configuration to know which public hostname represented each ECEEE v4 root. The publisher and CMS now support exact and scoped-wildcard hostname aliases directly on published root pages.

## Decision

Resolve the incoming normalized hostname directly against the published root page's `hostnames` array. Exact aliases take precedence over the most-specific scoped wildcard; unrestricted `*` and `default` fallbacks remain disabled unless explicitly enabled. Preserve the incoming browser hostname for links, form actions, and redirects.

Register `eceee-test.colliberty.com`, `summerstudy-test.colliberty.com`, and `industry-test.colliberty.com` as exact aliases on their intended published roots. Treat alias changes as production-data mutations requiring an explicit owner gate and verify them separately from service liveness. Keep the test-host Caddy routes non-indexable and leave all existing public Django routes unchanged.

## Rationale

The root page remains the single source of truth for site identity, so the publisher does not duplicate or infer public-host mappings in deployment configuration. Exact aliases also exercise the same host resolution used by future public routes while preserving same-origin form behavior.

## Consequences

- Activating or moving a test hostname requires a reviewed CMS data change and a rollback that removes only the added alias.
- Missing aliases return 404 even when the publisher service is healthy; rendered-host verification is an operational acceptance check rather than a liveness dependency.
- Existing public hostnames remain on Django until a separately reviewed cutover.
- Test form submissions use the selected root's production tenant/page/widget identity and must be treated as production-form data.

## Alternatives Considered

- Configure `test-host=source-host` mappings in the publisher: rejected because it duplicates CMS site identity and can select the wrong root when public hostnames are ambiguous.
- Rewrite the upstream Host header in Caddy: rejected because redirects and form flows could escape the test origin.
- Use unrestricted wildcard or default roots: rejected because they weaken tenant/site routing isolation.

## Links

- Related PRDs: PRD-0010, PRD-0011
- Supersedes: ADR-0012
