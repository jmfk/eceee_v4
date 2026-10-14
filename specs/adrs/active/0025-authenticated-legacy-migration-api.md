---
id: ADR-0025
title: Authenticated legacy migration API for tenant import plugins
status: accepted
date: 2026-10-14
related_prds:
  - PRD-0012
  - PRD-0020
  - PRD-0021
supersedes:
  - ADR-0013
  - ADR-0024
superseded_by: []
---

# ADR-0025: Authenticated Legacy Migration API for Tenant Import Plugins

## Context

The golden-sample News pipeline and deployment-installed tenant plugin framework are
still required. Their first architecture, however, made the v4 importer depend on a
loopback SSH tunnel and direct PostgreSQL credentials. That exposes a database
protocol across systems, adds operator-managed tunnel state, and couples the plugin
to legacy table structure.

The legacy application already owns the models and permissions needed to select the
authoritative migration data. It can expose that data through a narrower contract
without becoming a permanent dependency for the future Proceedings/FileMaker
feature.

## Decision

Retain the golden-sample gate, deterministic media handling, link reconciliation,
tenant-owned connections, encrypted write-only credentials, background import jobs,
and deployment-installed plugin registry described by the superseded decisions.

Replace the legacy PostgreSQL connection with a dedicated, versioned migration API
inside the deprecated legacy application:

- The API is read-only, authenticated with a dedicated bearer access key, served
  only over public HTTPS, and returns `Cache-Control: no-store`.
- Endpoints are fixed, reviewed resources implemented with the legacy ORM. Version 1
  exposes health, News summary, and bounded pagination of published News records.
- The API does not accept SQL, table/model names, arbitrary filters, writes, or
  client-selected serializers.
- Database credentials remain private to the legacy runtime. v4 stores only the
  HTTPS base URL and encrypted API access key in a tenant-owned `LEGACY_API`
  connection.
- The v4 client rejects non-HTTPS/private destinations, pins the resolved public
  address for each request, rejects redirects, bounds response size, and validates
  the API version and JSON shape before importing.
- Media continues through the existing v4 media importer using source URLs found in
  the returned content. It is not proxied as database blobs through this API.
- Additional legacy content types require new allowlisted API resources and reviewed
  plugin importers. They do not broaden this contract into a generic data API.

The ECEEE Proceedings feature remains a separate plugin and will connect directly to
FileMaker's supported API. It does not use the deprecated legacy migration API.

## Rationale

An application-level allowlist is a smaller security and compatibility boundary than
sharing PostgreSQL. It removes SSH tunnel availability from the import workflow,
hides legacy schema details from v4, and lets each side validate a stable versioned
contract. Keeping the existing import pipeline after source retrieval avoids
duplicating proven transformation, media, link, idempotency, and golden-sample logic.

## Consequences

- Both legacy and v4 deployments are required before an API import can run.
- The legacy runtime needs one dedicated key, and v4 needs the matching encrypted
  secret. Key rotation is coordinated across the two deployments.
- The legacy application remains online for the finite migration period, but it does
  not expose its database network port to v4.
- New source fields or resource types require an explicit API-version compatibility
  decision and tests on both sides.
- Existing SSH tunnel scripts, direct database connection types, and supported CLI
  paths are removed from v4.
- ADR-0013 and ADR-0024 are superseded because their retained decisions and their
  replaced transport clauses must be read as one consistent current architecture.

## Alternatives Considered

- Keep the restricted SSH/PostgreSQL tunnel: rejected because it preserves database
  coupling and an operational tunnel dependency.
- Open PostgreSQL directly between server firewall addresses: rejected because it
  expands network and credential exposure without improving the product contract.
- Add a generic SQL or model-query endpoint: rejected because it recreates database
  sharing over HTTP and is harder to authorize safely.
- Reuse Remote Site object-transfer keys: rejected because the legacy application
  does not implement the v4 object package protocol and this API returns
  tenant-specific migration records, not v4 objects.

## Links

- Related PRDs: PRD-0012, PRD-0020, PRD-0021
- Related decisions: ADR-0008, ADR-0022, ADR-0023
