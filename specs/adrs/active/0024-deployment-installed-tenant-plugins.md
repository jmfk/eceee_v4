---
id: ADR-0024
title: Deployment-installed tenant plugins with typed extension points
status: accepted
date: 2026-10-14
related_prds:
  - PRD-0020
supersedes: []
superseded_by: []
---

# ADR-0024: Deployment-Installed Tenant Plugins with Typed Extension Points

## Context

ECEEE needs both finite legacy migrations and long-lived proceedings functionality. The existing generic migration-plan UI stores executable workflow configuration in the database, while the mature legacy News pipeline is code-based and tested. Treating both needs as arbitrary runtime scripts would permit unreviewed code-like behavior, blur tenant ownership, and couple the permanent FileMaker integration to the deprecated legacy application.

## Decision

Introduce a small registry of trusted, deployment-installed plugin definitions. Each plugin has a stable reverse-domain ID, version, kind, allowed tenant identifiers, required connection kinds, and typed extension definitions. Database records only activate installed plugins for a tenant and store configuration; they never contain executable plugin code.

Use two extension kinds:

- Import plugins register one or more bounded importer definitions with declarative form fields, preflight, validation, and background execution.
- Feature plugins establish long-lived product boundaries and may later register APIs, jobs, object definitions, and connections through explicit reviewed code.

Package ECEEE legacy importers together under `org.eceee.legacy_import`, beginning with a News importer and later adding Pages as a separate importer. Register `org.eceee.proceedings` independently; FileMaker is its source connector, not its domain identity.

Reuse and harden the existing Data Connections and Content Migration applications rather than create a third integration subsystem. Connections and plugin jobs are tenant-owned. Secrets are encrypted using the established remote-credential keyring, accepted only on writes, and omitted from API responses. Plugin jobs snapshot validated non-secret options and use tenant-scoped idempotency keys.

For the first legacy importer, retain the existing loopback SSH tunnel and read-only PostgreSQL account. Do not add a permanent API to the deprecated application. Proceedings will connect from v4 directly to FileMaker's supported API when its behavior is implemented.

New tenant-owned records follow the repository's existing Django tenant foreign-key and authorization-query pattern. This decision does not silently introduce partial PostgreSQL RLS into two applications while the rest of the repository remains application-enforced; adopting repository-wide RLS requires a separately planned migration and verification program.

## Rationale

Deployment-installed packages keep execution reviewable and make plugin versions reproducible. Typed extension points let the CMS render a safe generic catalog and form without dynamic frontend code. One legacy package avoids duplicating source, media, and link infrastructure for every content type, while separate importer IDs preserve independent forms and behavior. Naming the permanent plugin after Proceedings keeps the domain independent of FileMaker as a replaceable vendor.

## Consequences

- Adding or upgrading plugin code requires a normal application deployment.
- Tenant administrators may activate installed plugins but cannot upload code.
- Existing generic migration plans remain available for compatibility but are not the contract for tenant plugins.
- Secrets encrypted with the configured keyring become unavailable if every key is lost.
- The first News UI depends on an operator-managed SSH tunnel; connection health must explain that dependency.
- Proceedings/FileMaker behavior remains a separate implementation batch after legacy behavior is inventoried.
- Application-level tenant filtering remains a security-critical repository invariant until a broader RLS migration is accepted.

## Alternatives Considered

- Store Python or JavaScript plugins in the database: rejected because it creates an unsafe remote-code-execution surface.
- Create one deployable plugin per legacy content type: rejected initially because News and Pages share the same source, media, links, and operational lifecycle.
- Keep FileMaker behind the deprecated legacy application: rejected because v4 must own the long-lived Proceedings capability.
- Build a new source API in the deprecated legacy application: rejected for the first migration because the existing read-only tunnel is already bounded and operational.
- Generalize the existing free-form migration-plan DSL: rejected because tenant-specific transformation logic needs reviewed code and focused tests.

## Links

- Related PRDs: PRD-0020, PRD-0012
- Related decisions: ADR-0008, ADR-0022, ADR-0023
