---
id: PRD-0037
title: Read-only system diagnostics
status: completed
locked: true
created: 2026-10-23
related_adrs:
  - ADR-0052
---

# Read-only system diagnostics

## Requirements

Provide bounded machine-only log search and a masked database catalog/query API under `/api/v1/diagnostics/`, with a repository helper and skill. Separate explicit log, data and global diagnostic capabilities from CMS full access, import credentials and human roles. Validate every requested tenant against active key bindings; global resources require an additional explicit capability.

Use a dedicated PostgreSQL read role restricted to reviewed diagnostic views. Permit selected columns, validated filters, sorting and cursor pagination; never accept SQL. Classify all model fields, defaulting unreviewed fields to excluded. Omit credentials and mask personal/free-form data before filtering or response generation.

Export selected container/file diagnostics on the host once a minute, with no Docker socket in the backend. Sanitize before export, retain seven days, report coverage gaps, and bound collection to 30 seconds/20 MiB. Stable export generations support paginated searches. Preserve only approved fields and stack metadata, never bodies, headers, settings or raw emails.

Default searches cover one hour; maximum interval is 24 hours, page size 50/default and 200/maximum, response 1 MiB, database timeout five seconds and rate 30 requests/minute/key. Audit metadata without query values or response bodies. Use protected separate environment credentials and refuse redirects in the helper. All returned text is untrusted data.

## Non-goals

Free SQL, arbitrary commands/paths, legacy email archives, new services/search engines, raw personal data, production access or deployment without the repository's fresh owner gates.

## Acceptance

Focused tests demonstrate explicit authorization, single/multi-tenant and global isolation, sanitation, constrained PostgreSQL privileges, transaction cleanup, collection rotation/recovery/bounds, cursor expiry and helper credential safety. Installation and upgrades are additive, idempotent and disabled until explicitly provisioned.

## Implementation notes

- 2026-10-23: Implementation started locally; no production authorization implied.

## Linked ADRs

- [ADR-0052](../adrs/active/0052-read-only-system-diagnostics.md)

## Completion evidence

- 2026-10-23: Implemented both local batches: log export/search and masked data catalog/queries, with explicit scopes, opaque cursors, protected helper and provisioning commands.
- 19 focused API/logging/collector tests passed with `python manage.py test core.diagnostics.tests --settings=core.diagnostics.test_settings --noinput` in the existing backend container.
- 6 actual PostgreSQL privilege/query/tenant tests passed with `python manage.py test core.diagnostics.test_postgres --settings=core.diagnostics.postgres_test_settings --noinput`, using the disposable test database and full CMS migrations.
- 5 helper/credential-preparation tests passed with `python3 -m unittest discover -s skills/eceee-diagnostics/tests`.
- OpenAPI generation/validation with `spectacular --validate --fail-on-warn`, skill validation, specs governance, Python syntax, compose/unit static checks and whitespace validation passed.
- Full backend/frontend suites and external CI were not run: verification was focused on the new diagnostic boundary. Live Linux timer/production acceptance remain rollout work requiring the repository's owner gates. No production connections, deployments or real credential provisioning occurred.
- Files: `backend/core/diagnostics/`, diagnostic management commands, minimal auth/middleware/settings/routes/role integration, host collector units/mount, protected helper/skill, and `docs/diagnostics.md`. Existing unrelated working-tree edits were preserved; the diagnostic batch is isolated on a branch based on the workspace-messaging PR.

## Review fixes

- 2026-10-23: Fixed four verified P2 findings: ordinary Django discovery declaring an absent optional DB alias, successful child exits hiding input truncation, duplicate segments after interrupted publication, and oversized source-gap metadata. Added focused reproductions for all four.
- The full backend Django suite passed locally: 1,639 tests, 18 skipped. The dedicated diagnostic PostgreSQL suite passed six tests and the helper suite passed five. Changed Python lint, OpenAPI validation and specs governance passed. The first broad attempt used an older image missing ffmpeg; verification succeeded on the current backend-editor image.
- The collector now journals sanitized publication data before writing segments/checkpoints and replays pending publication idempotently. No production access, data migration or deployment was performed.
