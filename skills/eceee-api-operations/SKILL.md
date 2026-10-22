---
name: eceee-api-operations
description: Operate ECEEE v4 development, staging, or production CMS environments through tenant-scoped machine APIs. Use for inspecting and changing pages, content, themes, media, objects, publishing, and supported transfers; not deployments or database administration.
---

# ECEEE API Operations

Use the existing `/api/v1/` contracts as the only application data source. Run
[`scripts/eceee_api.py`](scripts/eceee_api.py) for authenticated requests; do not
query the database, copy browser credentials, or build a parallel configuration
store.

Read [references/local-development.md](references/local-development.md) for the
verified local profile, request examples, and credential provisioning. Resolve
repository-relative paths from `/Users/jmfk/code/eceee_v4` in this installation.
For another checkout, verify its own environment and ports first.

Read [references/environments-and-imports.md](references/environments-and-imports.md)
when selecting dev/production profiles, provisioning general production access, or
running legacy News imports in dev. Use `--profile dev|production|production-themes`
for API requests; dev is the default. `--check-profile` is local-only. Legacy imports
use the documented dev operator helper and the existing importer, not a broadened
machine credential or a parallel write implementation.

For the isolated editorial import workspace and portable object definitions, use
[the repository guide](../../docs/legacy-editorial-import.md). Definition writes
require the explicit tenant-scoped `object.definition.write` scope; definition
deletion remains a server-wide operation.

## Before a request

1. Identify the environment, tenant, resource, and whether the operation is read-only, mutating, publishing, destructive, or a transfer.
2. Confirm the API origin and explicit tenant before sending credentials. Never reuse a development credential in staging or production, or infer environment from a tenant name. Discover exact routes, payload casing, permissions, and version semantics from the target checkout's URL configuration, serializers, viewsets, and frontend adapters; do not guess endpoints or mechanically rename fields.
3. Use a machine principal whose scopes are no broader than the operation requires.
4. Keep the secret in a mode-`0600` ignored env file. Never put it in a prompt, command argument, repository file, request body, or log.
5. Inspect the latest server representation before changing an existing resource. Preserve fields outside the requested outcome and use the resource's version or working-copy workflow.

## Resource boundaries

- Themes use `theme.read`, `theme.write`, `theme.version`, and `theme.transfer`. Create a named version or export before mutation.
- Pages use `page.read`, `page.write`, and the separately granted `page.publish`. Edit widget instances through page working copies and versions.
- Layout and widget definitions are code-owned. `layout.read` supports discovery and configuration validation; implementation changes require repository code, tests, and deployment.
- Media uses `media.read` and `media.write`.
- Objects use `object.read`, `object.write`, `object.publish`, and `object.transfer`.
- Taxonomies use `content.read` and `content.write`.
- Page schemas, path patterns, preview sizes, and value lists use `site.read`.
  These resources are global; mutations require a deliberately granted
  `server.full_access` credential.

Runtime configuration, secrets, users, remote credentials, deployments, SSH,
backups, and database administration are outside this skill.

Use `inspect-secrets-safely` before checking or changing credentials. Reuse a
working key in the correct environment and tenant. Provisioning an existing named
credential rotates it, so do not run the bootstrap command just to check access.
For theme design work, also use `eceee-theme-authoring`; for widget implementation
or rendering changes, use `eceee-render-parity`.

## Mutations

Follow pagination for inventories, and distinguish current, draft, and published
representations. Check serializers and action implementations before choosing PUT
or PATCH; neither is universally safe for partial nested updates. Save a version
or export where supported, re-fetch before mutation, and reconcile concurrent
changes instead of overwriting them. Keep versions/exports in the owning environment.

Publishing, transfer, deletion, and bulk changes must be within the user's explicit
requested outcome. Destructive database operations remain outside this skill.
Do not automatically retry a failed or uncertain write: first read back to determine
whether it succeeded, particularly for publishing, imports, and credential rotation.

Send bodies through `--data-file`. Use `--upload-file` for one multipart file and
repeat `--form NAME=VALUE` for its accompanying public metadata. Re-read the saved
resource and verify the relevant render or workflow surface after mutation.

Production reads and writes still require the repository's fresh production gate.
Technical possession of a key is not production authorization.

When a production gate is required, prepare the concrete request first: environment,
API origin, tenant, exact HTTP methods/endpoints, affected resources, read/write
scope, expected service/data impact, and recovery point for mutations. Obtain fresh
owner authorization before sending even a read request. Never reuse the local key
or the theme production key for broader operations. Report changed resource IDs,
verification results, and any limitations without credentials or secret-bearing bodies.
