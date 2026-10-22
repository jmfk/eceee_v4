# Environment profiles and legacy News imports

## Select the environment explicitly

Run from `/Users/jmfk/code/eceee_v4`:

```sh
python3 skills/eceee-api-operations/scripts/eceee_api.py --profile dev --check-profile
python3 skills/eceee-api-operations/scripts/eceee_api.py --profile production --check-profile
python3 skills/eceee-api-operations/scripts/eceee_api.py --profile production-themes --check-profile
```

These checks read only local configuration. They do not contact any server or
prove credential validity. `dev` is the default. All profiles read the ignored,
mode-0600 root `.env.local`, with separate key variables:

| Profile | API | Tenant | Key variable |
| --- | --- | --- | --- |
| `dev` | `http://localhost:10101/api/v1/` | `ECEEE_API_TENANT` (configured as `eceee-production-copy`) | `ECEEE_API_KEY` |
| `production` | `https://app.eceee.org/api/v1/` | `ECEEE_PROD_API_TENANT` (defaults to `default`) | `ECEEE_PROD_API_KEY` |
| `production-themes` | same production API | same production tenant | `ECEEE_PROD_THEME_API_KEY` |

Development requests reject remote origins. Production profiles are pinned to the
production HTTPS base URL. Missing production keys never fall back to dev or theme
keys. The theme profile accepts theme routes only; it cannot be used to administer
pages or imports. An explicit `--tenant` selects another workspace only when the
key already grants access. `--key-variable` cannot cross profile boundaries.

For a small dev acceptance request:

```sh
python3 skills/eceee-api-operations/scripts/eceee_api.py --profile dev --status-only 'webpages/pages/?page_size=1'
```

Production API requests require a fresh owner gate describing the exact operation.
`--check-profile` needs no production gate because it never makes a network request.

## Production access status

Provisioned with fresh owner authorization on 2026-10-22: `Codex CMS production`,
principal `codex-cms-prod`, tenant `default`. The separate `ECEEE_PROD_API_KEY` is
installed locally and one authorized pages read succeeded. Credential expiry is
2027-01-19T22:15:21Z; verify actual metadata before renewal. Subsequent production
operations still require their own fresh owner gates; bootstrap approval is not
ongoing access authorization.

## Production provisioning

The existing theme key remains separate. General production access uses a new
passwordless staff principal `codex-cms-prod`, credential `Codex CMS production`,
tenant `default`, and a 90-day expiry. The requested CMS scopes include publishing
but exclude `server.full_access` and machine-denied credential/user routes.

`deploy/scripts/provision-codex-api.py --host <resolved-production-ipv4>` prints a
reviewable plan without SSH. `--apply` must only be used after a fresh owner gate
covering the reported IP, SSH command, principal creation and tenant membership,
new credential/scopes/expiry, local secret installation, and one read-only pages API
verification. Resolve app/admin/imgproxy production DNS immediately before the gate.

The helper refuses existing credentials and never rotates automatically. It sends
reviewed Python into the existing production backend via SSH, without deploying or
restarting services. Raw key material stays inside captured SSH pipes and is
installed atomically into `.env.local`; it is never printed. Database storage is
hashed. If SSH has an uncertain outcome, installation fails, or verification fails,
stop and request a separate diagnostic/recovery gate. Revoking only the new named
credential is the recovery path; do not delete users or CMS data. Retry only after
reconciling remote state. The prepared script does not itself supply owner approval.

## Legacy News into dev

Only the News importer is currently implemented by the legacy migration API.
Do not promise import of other legacy resources. Keep source credentials separate:
`LEGACY_API_BASE_URL` and `LEGACY_API_ACCESS_KEY` are already stored locally and
must not be printed. The wrapper passes them privately through stdin into the dev
backend; it does not copy the env file into the container or put secrets in argv.

```sh
# Check the local target, definitions and sample gate; no legacy API call.
python3 skills/eceee-api-operations/scripts/legacy_news.py --check

# Default is dry-run: newest published records, transformations and counts, no writes.
python3 skills/eceee-api-operations/scripts/legacy_news.py --namespace default --limit 100

# Only after the same selection passes dry-run and the sample gate is accepted:
python3 skills/eceee-api-operations/scripts/legacy_news.py --apply --namespace default --limit 100
```

The helper verifies the OrbStack container's `/app` bind belongs to this checkout
and refuses any backend whose deployment environment is not `development`. There
is no production import option. Tenant, namespace and `codex-local` membership are
validated before import. The existing `migrate_legacy_news` command remains the
only transformation/write implementation; `--resume`, advisory locking,
article transactions, deterministic media keys and link reconciliation are retained.
This is a local operator adapter, not a new machine-API permission or direct-model
write workflow. Do not grant `server.full_access` to work around import route denial.

Ask for the intended dataset/limit before a large import. Keep the default 100
record bound unless another bounded selection was requested. Record tenant,
namespace, selection and resulting counts so an interrupted run can use the same
selection with resume. Do not assume a timeout means that nothing was imported.

### Golden-sample gate

As checked on 2026-10-22, the local `eceee-production-copy` / `default` definitions
are ready, but the sample acceptance gate is not accepted. A one-record legacy API
dry-run passed. Do not set the acceptance marker to work around this blocker.
Follow `docs/legacy-news-migration.md`: prepare/reconcile the samples, review all
supported preview/render surfaces, then record explicit acceptance through the
existing command. Sample changes invalidate acceptance. A real import will refuse
to run until that process has completed.
