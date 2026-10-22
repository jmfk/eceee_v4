# Local development access

Verified on 2026-10-21 in `/Users/jmfk/code/eceee_v4`:

- API origin: `http://localhost:10101/api/v1/`.
- OrbStack backend: `eceee-v4-backend-1`, `/app` bound to this checkout's `backend/`.
- Deployment environment: `development`.
- Tenant: `eceee-production-copy`. This identifier belongs to the local database;
  it does not imply permission to contact production.
- Principal: `codex-local`; credential name: `Codex local CMS access`.
- Credential: `ECEEE_API_KEY` in the repository root's ignored `.env.local`, mode `0600`.
- Public profile fields: `ECEEE_API_BASE_URL` and `ECEEE_API_TENANT` in that same file.
- Existing credential expiry: 2026-11-14. Read actual database metadata when renewal
  is needed; this date is a snapshot, not a promise of validity.
- The key is tenant-bound and has CMS scopes, without `server.full_access`.

## Requests

Run from the repository root. The default profile is `dev`; use `--profile dev` for clarity. The client reads the key internally and refuses
redirects. Its defaults come from the protected env file; always confirm the
selected profile before using it.

```sh
python3 skills/eceee-api-operations/scripts/eceee_api.py 'webpages/pages/?page_size=1'
python3 skills/eceee-api-operations/scripts/eceee_api.py webpages/themes/
python3 skills/eceee-api-operations/scripts/eceee_api.py webpages/layouts/
```

Use `--output <path>` to save a response for inspection, and `--data-file <path>`
for a prepared JSON request. Response files may contain private CMS data: keep them
out of Git and do not use this client to retrieve credentials. Errors report only
bounded status; diagnose contracts in code rather than dumping backend settings.

Authenticate with `Authorization: ApiKey <secret>` and `X-Tenant-ID: <identifier>`.
Machine credentials are accepted only under `/api/v1/`; sensitive user, credential,
connection, and machine-key management routes are denied even with broad scopes.
The authoritative scope mapping is `backend/core/machine_api_keys.py`.

## Bootstrap or renewal

Reuse verified credentials. Before provisioning, confirm the container mount,
non-production deployment environment, active target tenant, principal compatibility,
existing credential consumers, destination mode, and Git-ignore status using bounded,
redacting checks. Never inspect Docker's expanded environment.

The existing command creates a dedicated passwordless staff principal and a
30-day key with supported CMS read/write, publishing, and transfer scopes. It
refuses production and does not grant `server.full_access`. It rotates an existing
credential with the same environment/name and replaces its tenant binding; use a
separate name/principal for an additional tenant instead of silently repurposing it.

For a fresh local profile, the bind-mounted backend directory can receive the key
directly without passing it through stdout or command arguments:

```sh
docker --context orbstack exec eceee-v4-backend-1 \
  python manage.py provision_local_machine_access \
  --tenant <confirmed-local-tenant> \
  --name 'Codex local CMS access' --username codex-local \
  --env-file /app/.env.codex.local --variable ECEEE_API_KEY
```

This writes `backend/.env.codex.local` on the host. Confirm it is ignored and mode
`0600` before running the command; create it with that mode if needed. Use
`--env-file backend/.env.codex.local --base-url http://localhost:10101/api/v1/
--tenant <confirmed-local-tenant>` for requests against that profile. An existing
root `.env.local` consumer must be updated through a purpose-built redacting updater
before considering renewal complete; never leave consumers on a rotated key.

Verify one small authenticated read and the intended tenant restriction after
provisioning. Do not test writes by changing real content unnecessarily. Do not
retry uncertain rotation automatically.

## Production

This local profile grants no production access. Discover the intended production
profile separately and apply the repository's fresh owner gate for the exact API
operation. The theme-only production key is not a general CMS credential. See [environment profiles](environments-and-imports.md) for the separate general production profile and dev legacy importer.
