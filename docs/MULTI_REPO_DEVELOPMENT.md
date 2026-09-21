# Shared OrbStack development

ECEEE is a consumer of the machine-wide services in the sibling `shared-local-infrastructure` repository. That repository is the sole lifecycle owner of PostgreSQL, Redis, and MinIO; ECEEE owns only its application containers and stateless imgproxy.

## First-time setup

1. Ensure OrbStack is running and `docker context show` returns `orbstack`.
2. In `../shared-local-infrastructure`, start the admitted services with `make up`, `make cache-up`, and `make object-storage-up`.
3. In this repository, run:

   ```bash
   make configure-local-infra
   make shared-infra-check
   make servers
   ```

The configuration helper reads provider-managed credentials without printing them, atomically updates the ignored repo-root `.env`, and sets mode 0600.

## Isolation contract

| Service | Shared endpoint | ECEEE isolation |
|---|---|---|
| PostgreSQL 17 | `127.0.0.1:10300` | database `eceee_v4`, role `local_eceee_v4` |
| Redis 7.4 | `127.0.0.1:10301` | ACL user `eceee_v4`, keys/channels `eceee_v4:*` |
| MinIO | `127.0.0.1:10302` (`10303` console) | access key `eceee-v4`, bucket `eceee-media` |

Do not run provider `down`, reset, or volume deletion commands from this project. `make infra-down` stops only ECEEE's imgproxy. `make clean` likewise leaves shared service containers and volumes untouched.

`make demo-reset-site` is the only destructive shared-database workflow. It is hard-limited to the separately admitted disposable database `eceee_demo`; it cannot reset `eceee_v4` or any other consumer database.

## Tests

PostgreSQL-backed tests use `docker-compose.test-infra.yml`, which has isolated, disposable PostgreSQL, Redis, and MinIO services with no published host ports. `make test-infra-down` removes only those test resources. Tests never create, flush, or drop data in the shared development services.

## Health checks

- `make shared-infra-check` validates OrbStack, provider endpoints, secret-file permissions, and the local `.env` contract without printing credentials.
- `make check-servers` reports the shared services plus the ECEEE application endpoints.
- `make check-conf` validates the local consumer contract.

The old `make use-external-infra` name remains as a backwards-compatible alias for `make configure-local-infra`.
