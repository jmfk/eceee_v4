---
name: eceee-system-access
description: Read and update supported ECEEE CMS resources through the tenant-scoped machine API, including pages, themes, layouts, media, objects, taxonomies, and site configuration.
---

# ECEEE System Access

Use the existing `/api/v1/` contracts as the only application data source. Run
[`scripts/eceee_api.py`](scripts/eceee_api.py) for authenticated requests; do not
query the database, copy browser credentials, or build a parallel configuration
store.

## Before a request

1. Identify the environment, tenant, resource, and whether the operation is read-only, mutating, publishing, destructive, or a transfer.
2. Use a machine principal whose scopes are no broader than the operation requires.
3. Keep the secret in a mode-`0600` ignored env file. Never put it in a prompt, command argument, repository file, request body, or log.
4. Inspect the latest server representation before changing an existing resource. Preserve fields outside the requested outcome and use the resource's version or working-copy workflow.

## Resource boundaries

- Themes use `theme.read`, `theme.write`, `theme.version`, and `theme.transfer`. Create a named version or export before mutation.
- Pages use `page.read`, `page.write`, and the separately granted `page.publish`. Edit widget instances through page working copies and versions.
- Layout and widget definitions are code-owned. `layout.read` supports discovery and configuration validation; implementation changes require repository code, tests, and deployment.
- Media uses `media.read` and `media.write`.
- Objects use `object.read`, `object.write`, `object.publish`, and `object.transfer`.
- Taxonomies use `content.read` and `content.write`.
- Page schemas, path patterns, preview sizes, and value lists use `site.read` and `site.write`.

Runtime configuration, secrets, users, remote credentials, deployments, SSH,
backups, and database administration are outside this skill.

For local development, provision or rotate the dedicated credential with
`python manage.py provision_local_machine_access --tenant <identifier>`. The
command refuses production, writes the secret directly to the protected env file,
and reports only bounded status.

## Mutations

Send bodies through `--data-file`. Use `--upload-file` for one multipart file and
repeat `--form NAME=VALUE` for its accompanying public metadata. Re-read the saved
resource and verify the relevant render or workflow surface after mutation.

Production reads and writes still require the repository's fresh production gate.
Technical possession of a key is not production authorization.
