# Widget pilot reference baseline

This is the executable first step of the Django retirement investigation. It freezes current behavior before moving production implementation. It does **not** claim that a Django-free replacement exists or has passed parity.

## Scope and provenance

- Reference product source: `9da0eb18451db16f5b8406f1c0c6c5a4f108483d`.
- `cases.json`: 51 portable DRF requests, explicit semantic expectations, four populated widgets with nested child identities, the expected database representation and a known reference issue.
- `reference.json`: reviewed frozen responses for those requests plus the full render catalog's sorted identities and canonical SHA-256. Its runtime metadata records the Python/Django/Pydantic versions used to freeze it.
- Code widget types: Headline, Banner, TwoColumns and Forms. Theme-authored widgets and other CMS domains remain outside this first baseline.

Wire JSON uses the observed `camelCase` contract; `storedWidgets` explicitly describes the observed `snake_case` configuration stored by the page API. Tests check both rather than mechanically normalizing the comparison. List ordering and nested widget IDs are significant.

Comparison ignores only the Pydantic 2 minor version in `body.rawErrors[].url` documentation links (`https://errors.pydantic.dev/2.<minor>/v/<error_type>`). CI installs a newer compatible Pydantic than the original capture; this documentation version is not widget functionality. The raw reference/captures remain unchanged, and URL presence, domain, major version, error type/path, message, input, context and every other field remain strict. The backend assertion and standalone comparator share this rule.

Known reference issue: the metadata validation endpoint parses `headerLevel` as `header_level`, while `HeadlineConfig` names its field `headerLevel`. It silently returns the default `h1` for a nondefault requested value. The fixture characterizes this defect and the report names it; it does not approve copying the defect into a replacement. Fixing it requires a separate reviewed product change and explicit baseline diff. Invalid widget configurations currently return HTTP 200 with `isValid: false`; that existing API convention is also captured.

## Run locally

Requires Docker with the `orbstack` context, the existing backend dependency image and internet access for frontend `npm ci`. It does not require operator environment files, a running CMS, a shared database or published host ports.

From the repository root:

```sh
make pilot-baseline PILOT_BASELINE_ARGS="--output /tmp/eceee-pilot-baseline"
```

The default backend image is `eceee-v4-2-backend:latest`. If unavailable, build the repository's backend image using development requirements and select it explicitly:

```sh
docker --context orbstack build --build-arg REQUIREMENTS_FILE=dev.txt -t eceee-pilot-backend:local backend
make pilot-baseline PILOT_BASELINE_ARGS="--backend-image eceee-pilot-backend:local --output /tmp/eceee-pilot-baseline"
```

`--backend-only` and `--frontend-only` are focused iteration modes and report `partial_passed`, never full baseline success. `--docker-context default` is available for CI/Linux environments.

The runner copies tracked and new nonignored backend/frontend source files to a temporary snapshot, excluding `.env*`, installed dependencies and frontend public assets. Containers read that snapshot rather than a changing checkout. It creates only its own uniquely named Docker resources. PostgreSQL 17 stores synthetic data in tmpfs on a private unpublished test network; cleanup removes those disposable resources without operating on shared services. Browser/unit tests use a pinned Playwright image and `npm ci` against the committed frontend lockfile. The Vite test config disables env-file loading.

## What is verified

| Layer | Evidence |
| --- | --- |
| Reference contracts | Real DRF routing, parsing, authentication permission and JSON rendering; frozen schema/defaults/UI-schema, valid/invalid/missing/null/empty/extra/alias/coercion cases and complete manifest digest. Direct view observations do not exercise middleware. |
| PostgreSQL | Real session authentication and tenant middleware. Saving the four-widget tree, reloading through the API, separate wire/storage casing, preserved live version/order/IDs, rejected stale write with no state/revision change or broadcast, denied foreign-tenant/anonymous writes and required CSRF for session mutations. |
| React | Populated rendering, ordering, nesting, preview form behavior, local unsaved state, hidden widgets and rich-text sanitization. Existing registry parity and actual PagePreview iframe message tests are included. |
| Chromium desktop/mobile | Actual shared renderer and compiled CSS in a test-only HTML entry point: responsive column geometry, content/order, usable form controls with inert submission, local draft/reset and no runtime console errors. No retries. |
| Comparator | Independent negative tests prove missing fields/cases, additional fields, permissions, revisions, ordering, JSON boolean/integer types and different fixture versions fail comparison. |

The browser harness is **not** the complete page editor or live publisher. The draft/reset buttons are test controls around the real renderer. PostgreSQL tests exercise actual saves separately. Actual simultaneous database races, publishing/scheduling/restore, all identity providers, media uploads, public form ingestion, theme widgets, jobs and Django-free migration/install remain later gates. Successful reference verification is not evidence that these areas have been migrated.

## Artifacts and outcomes

The chosen output directory must not already exist; choose a fresh path for each run. The runner refuses existing paths without changing their permissions or contents. Newly created artifact directories are writable by the container user and contain only synthetic test data. The output contains `report.json`, phase logs, observed/frozen comparison results, per-test backend results, Vitest JSON, Playwright JSON and failure traces/screenshots. Reports record reference/tested commit, dirty working-tree state, runtime versions and exact commands. Run outputs are temporary artifacts, not new frozen fixtures to commit.

- `passed_with_known_reference_issues`: all required baseline checks passed, with the documented reference defect still present.
- `partial_passed`: only a selected layer ran.
- `observed_only`: capture for review; no baseline pass claimed.
- `failed`: differences, failed/missing/skipped tests, flaky browser results or execution failure. Missing prerequisites are failures, not skipped successes.

Mandatory backend and React test names and browser title/project pairs are checked explicitly. Passing counts alone cannot replace a required scenario. Shared fixture changes select both backend and frontend CI checks.

`candidateParity: not_supplied` remains explicit until an actual replacement adapter is implemented. Normal runs never overwrite `reference.json`. Reading an existing test or comparing the old adapter to its own frozen outputs does not establish replacement parity.

## Compare a future adapter

Consume the requests in `cases.json` and emit the same observation envelope as `pilot_baseline_adapter.py`: format version, SHA-256 of the exact case file bytes, and all observation IDs with their status/body. `render-manifest` additionally records the canonical manifest digest and type set. Do not drop unsupported cases or coerce values to make the comparator pass.

```sh
python3 scripts/pilot_baseline.py compare /tmp/replacement-observations.json --output /tmp/pilot-comparison.json
python3 -m unittest discover -s scripts/tests -p test_pilot_baseline.py -v
```

This comparison covers portable contracts; the replacement must separately pass the persisted-state and end-to-end gates before it can take over writes. A comparator success alone never authorizes retirement.

To revise the reference deliberately, use `run --observe-only --output <new-directory>` on the reviewed reference source, verify source provenance against its commit, inspect the observation and independent expectation differences, then review the fixture update as a code change. The capture command never writes the checked-in reference. Preserve known issues and skipped/failed results explicitly; never regenerate expectations in CI.
