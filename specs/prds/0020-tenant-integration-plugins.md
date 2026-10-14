---
id: PRD-0020
title: Tenant integration plugins and guided imports
status: started
locked: true
created: 2026-10-14
related_adrs:
  - ADR-0024
  - ADR-0025
---

# PRD-0020: Tenant Integration Plugins and Guided Imports

## Problem

ECEEE has tenant-specific integrations that do not belong in the generic CMS product surface. The existing legacy News migration is only available as an operator command, while the generic Content Migration UI exposes editable plans and connection configuration without an installed-code contract. Future ECEEE proceedings functionality must integrate directly with FileMaker from v4 without retaining a runtime dependency on the deprecated legacy application.

## Goals

- Let trusted, deployment-installed packages register tenant-specific importers and long-lived features.
- Let a workspace administrator explicitly activate an installed plugin for an allowed tenant.
- Show installed importers and their requirements before asking an administrator to configure or run one.
- Expose the existing, tested legacy News pipeline as the first guided importer, including media and link reconciliation.
- Establish a separate feature-plugin boundary for future ECEEE proceedings and its direct FileMaker integration.
- Keep connection configuration, import jobs, credentials, and authorization tenant-isolated.

## Non-Goals

- Uploading or executing arbitrary plugin code from the browser or database.
- Implementing the proceedings domain or FileMaker field mappings before the legacy behavior has been inventoried.
- Implementing the legacy Pages importer in this first slice.
- Replacing the existing v4-to-v4 Remote Object package transfer.
- Running a production legacy import as part of deployment.

## Users and Use Cases

- An ECEEE workspace administrator activates the installed Legacy Import plugin, configures its read-only legacy PostgreSQL connection, reviews a bounded News preflight, and starts or resumes an import.
- An administrator sees actionable instructions when the required tunnel or connection credential is absent.
- A future ECEEE administrator configures a FileMaker Data API connection for the separately installed Proceedings feature plugin.

## Requirements

- Plugins are trusted Python code discovered at application startup and identified by stable reverse-domain IDs and explicit versions.
- Plugin activation is persisted per tenant; a plugin may restrict which tenant identifiers can activate it.
- Plugins declare a kind (`import` or `feature`), required connection kinds, capabilities, and importer form fields.
- The importer catalog is generated from installed code and tenant activation, not from database-authored executable workflows.
- Connections are tenant-owned, uniquely named within a tenant, and never serialize stored secrets or ciphertext to the browser.
- The Legacy News importer accepts a compatible legacy PostgreSQL connection, target namespace, bounded limit, newest-first selection, and resume mode.
- Legacy News always includes its current media import and link reconciliation behavior; the UI must not advertise unsupported toggles.
- Preflight is read-only and reports connection readiness, source summary, target readiness, and actionable missing-dependency instructions.
- Imports run as observable background jobs with an idempotency key, an immutable option snapshot, bounded errors, progress, and tenant ownership.
- Background work revalidates plugin activation, connection ownership, tenant authorization, and importer options before touching source or destination data.
- The Proceedings plugin is registered as a separate, long-lived feature boundary. FileMaker is a connector inside that plugin rather than the plugin identity.

## Acceptance Criteria

- An administrator can list installed plugins and activate the ECEEE Legacy Import plugin only for an allowed tenant.
- Content Migration lists Legacy News from the registry and explains its connection requirement.
- A legacy PostgreSQL connection can be created without returning its password in any API response.
- A failed connection test distinguishes missing configuration from an unreachable SSH tunnel/database endpoint.
- A bounded News preflight can be run without mutating destination content.
- Starting the same request twice with the same idempotency key returns one import job.
- Import jobs and connections from another tenant are neither listed nor addressable.
- Existing management-command imports and v4 Remote Object transfers continue to work.
- The installed Proceedings feature is discoverable independently from Legacy Import but does not claim unfinished FileMaker functionality.

## Constraints

- Legacy PostgreSQL remains read-only and is reached through the existing loopback SSH-tunnel arrangement in this first version.
- Plugin code is installed during deployment and reviewed like application code.
- Secrets use the existing application credential-encryption keyring and are write-only through the API.
- The first implementation follows the repository's current Django tenant-authorization boundary; broader database RLS adoption is not introduced implicitly by this feature.

## Implementation Notes

- 2026-10-14: Implementation started on `codex/tenant-import-plugins`.
- 2026-10-14: Added the deployment-installed registry, separate Legacy Import and Proceedings definitions, tenant activations, tenant-owned encrypted connections, the guided Legacy News form, preflight, idempotent background jobs, and recent-job status.
- 2026-10-14: Kept Proceedings at an explicit foundation state; no unfinished FileMaker behavior is exposed as operational.
- 2026-10-14: PRD-0021 and ADR-0025 supersede the locked PostgreSQL/SSH connection requirements with a tenant-owned `LEGACY_API` connection. The deployment-installed plugin model remains in force.

## Linked ADRs

- [ADR-0024: Deployment-installed tenant plugins with typed extension points](../adrs/archive/0024-deployment-installed-tenant-plugins.md) (superseded)
- [ADR-0025: Authenticated legacy migration API for tenant import plugins](../adrs/active/0025-authenticated-legacy-migration-api.md)

## Completion Evidence

- Django system checks and migration drift checks pass after applying the three new local migrations.
- A rollback-only API smoke test returned `200/200/200/201/202` for catalog, activation, importer catalog, connection creation, and job creation; repeating the same idempotency key returned the same job.
- A rollback-only credential smoke test verified write-only API behavior, encrypted storage, and server-side credential resolution without printing the credential.
- The focused Migration Manager Vitest passes; frontend lint and production build pass.
- The repository-wide Django test runner remains blocked before test execution by the pre-existing SQLite-incompatible `webpages.0005_add_hostnames_and_indexes` migration. The new backend API path was therefore also exercised against the migrated PostgreSQL development database inside a rolled-back transaction.
