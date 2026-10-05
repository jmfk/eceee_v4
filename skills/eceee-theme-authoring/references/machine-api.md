# Scoped Machine API

Use this reference for authenticated theme API work and machine-key lifecycle operations.

## Authentication boundary

Machine credentials are accepted only below `/api/v1/`. Send the secret through the `Authorization: ApiKey <secret>` header and identify the selected workspace with `X-Tenant-ID: <tenant identifier>`. Never put the secret in a URL, command argument, skill file, repository file, log, exported theme, or conversation.

Prefer a dedicated active machine principal with access only to the intended tenant. For ordinary theme work grant only:

- `theme.read` for theme reads, comparisons, and exports;
- `theme.write` for theme creation and updates;
- `theme.version` for checkpoint, history, and restore operations;
- `theme.transfer` for sync and remote transfer operations.

Do not request `server.full_access` for theme authoring. Machine-key management requires a human superuser, and data-connection, user/credential, session-workspace, remote-credential, and machine-key management routes remain machine-denied.

## Bootstrap and storage

Deployment creates the credential tables but no production key. Bootstrap is a separate production mutation: confirm the exact environment, host, tenant, principal, scopes, expiry, creator, storage destination, verification request, and rollback before requesting the production gate.

The secret is returned only at creation or rotation. Transfer it directly into the approved protected secret store through a redacting adapter or a human handoff; never display it to Codex. Record only its stable credential name, environment, tenant, scopes, owner, expiry, and protected-store reference.

## Production profile

The provisioned ECEEE production profile uses:

- API base URL `https://app.eceee.org/api/v1/`;
- tenant identifier `default`;
- principal `codex-theme-prod`;
- managed key name `Codex theme production`;
- scopes `theme.read`, `theme.write`, `theme.version`, and `theme.transfer`;
- 1Password vault `ECEEE - Production - Codex`;
- 1Password item `eceee-prod-theme-api`.

The initial credential was created on 2026-10-05 with a 90-day lifetime. Treat its actual stored expiry as authoritative and rotate it before expiry through a separately approved production operation. Resolve it only through a purpose-built redacting adapter; never run a command that returns the credential field to tool output.

## Request workflow

1. Resolve the credential internally from its allowlisted protected-store reference.
2. Fetch the latest theme representation and version identity.
3. Create a named version or export before mutation.
4. Re-fetch immediately before writing and stop if the theme changed.
5. Send the narrowest API request using the machine header and explicit tenant header.
6. Re-read the saved representation and then verify visually in Chrome.

Use a redacting application adapter for requests. Do not use ad hoc `curl` commands that place secrets in arguments, and do not copy a browser session or human JWT into the machine workflow.

## Rotation and revocation

Rotation is serialized but intentionally not idempotent: every successful rotation creates a new secret. Do not retry an uncertain rotation automatically. Verify the new credential before retiring the previous consumer configuration, and revoke a key immediately when its scope, tenant, principal, environment, or storage boundary is no longer correct.

Report only bounded outcomes such as `created`, `installed`, `verified`, `revoked`, or `failed`; never report the secret or a derived fingerprint.
