# Built-in widget contract pilot

One declarative source, with small Python and Node adapters. No new server or npm dependencies.

| Source | Owns |
| --- | --- |
| `render_catalog.json`, format 1 | All 25 built-in widgets' names, CSS, variables, layout parts and variants; default special pages. |
| `pilot_models.json`, format 1 | Headline, Banner, TwoColumns, Forms and nested FormField: explicit model names/aliases, annotations, defaults, descriptions, constraints and UI hints. |
| Original non-pilot Python models | All other widget schemas and custom validators. |

Presentation metadata uses the existing render-manifest casing; model declarations explicitly bridge Python field names and frontend aliases. Full editor layout-part labels/properties are preserved alongside the selector/relationship subset exported to manifest format 2. Defaults, schemas and validation results are evaluated from definitions, not copied from baseline responses.

## Node-only build and tests

Requires Node 20 or newer. No install step, Python, Django, database or `.env` is needed:

```sh
node backend/widget_contracts/manifest.mjs
node backend/widget_contracts/manifest.mjs --check
node --test backend/widget_contracts/tests/*.test.mjs
node backend/widget_contracts/observe.mjs backend/webpages/tests/fixtures/pilot_baseline/cases.json /tmp/widget-contract-observations.json
```

`make publisher-manifest` and `make publisher-manifest-check` now use Node directly. `--output <path>` selects another manifest path; `--check` detects drift and never rewrites it. The generated renderer manifest is byte-identical to the existing format-2 output. The Python `export_publisher_manifest` management command remains supported.

The package's JavaScript entry point exports `buildRenderManifest`, `configurationSchema`, `configurationDefaults`, `configurationUiSchema` and `validateConfiguration`. These return independent data. `validateConfiguration` evaluates model input; `transport.mjs` separately reproduces the existing API parser/renderer boundary. It is not an HTTP/authentication implementation.

## Complete verified pilot

Use the baseline runner's disposable, unpublished Docker resources with synthetic data. Choose a new output directory for each run:

```sh
python3 scripts/pilot_baseline.py run --candidate-contracts --output /tmp/widget-contract-pilot-run
# Equivalent convenience target:
make widget-contract-pilot PILOT_BASELINE_ARGS="--output /tmp/widget-contract-pilot-another-run"
```

Prerequisites and backend-image options are in the [baseline instructions](../webpages/tests/fixtures/pilot_baseline/README.md). The additional Node phase uses `node:22-alpine` with no network and mounts only the package, case inputs and output directory. Reports include candidate observations, differences, Node runtime, tested/reference commits, fixture digest, PostgreSQL tests, React tests and desktop/mobile browser results. `--backend-only` remains a partial run.

The runner checks the same 51 frozen request inputs plus the complete manifest against actual Node results. Django also consumes the shared definitions and runs real save/reload, storage/wire casing, stale revision, tenant and CSRF tests. Additional Python tests verify registry/metadata coverage, Django-free imports and direct Node/Pydantic field-value compatibility. CI checks the Node build, candidate comparison, backend tests and existing browser baseline.

## Remaining boundaries

Pydantic is still authoritative for CMS API validation and writes. Node validation is comparison-only; it is not yet an approved production validator. Its declared scope consists of the pilot's primitive/nullable/literal/list/dictionary/nested-model types and minimum-length constraints. There are no custom validators in these five models; other widgets and new annotation kinds require separate work.

The Headline API parser drops `headerLevel`; the transport adapter records the same known baseline defect. Direct model validation retains it correctly. Changing that API behavior requires a separate reviewed change and explicit baseline revision. Only Pydantic 2 minor documentation URL versions are normalized by the comparator; semantic fields and user content stay strict.

`contractCandidate.status: passed` means the tested contract observations match. `candidateParity: not_supplied` remains because no replacement CMS backend exists. Anonymous Node cases reproduce a policy response; actual authentication, authorization, tenant selection, persistence and publication remain Django responsibilities. Theme-defined widgets stay scoped to their owning theme/tenant and are excluded from the static catalog. No Django write/publication path is retired here.

## Verification evidence

The initial implementation was verified on the working tree based on `2f11baef` (reports record `workingTreeDirty: true`):

- `/tmp/eceee-widget-contract-pilot-verified`: complete candidate comparison (51 cases plus catalog), 10 Django tests, 11 React tests and 6 Chromium desktop/mobile tests passed.
- `/tmp/eceee-widget-contract-broader-fixed`: the expanded candidate command's 129 PostgreSQL/backend tests passed with no skips, including all existing EASY widget, manifest, theme layout and error-page tests. This also verifies the final test settings and broader backend selection; unchanged frontend evidence is reused from the complete run.
- The direct Node/Pydantic matrix covers 714 configurations across every top-level and nested FormField declaration. Nine standalone Node tests and nine runner/comparator tests pass.
- The original source and shared catalog match for every moved field of all 25 widgets; all five generated Pydantic schemas match their original models. The frozen fixture files and generated renderer manifest are unchanged.

Runtime: Node 22.23.4 in the standalone no-Python/no-Django container; Python 3.11.17, Django 4.2.30 and Pydantic 2.14.1 in the backend; PostgreSQL 17.11. Reports retain the known reference issue and do not claim replacement-backend parity.

CI integration follow-up: the CSS parity test now reads the canonical catalog and is mandatory in the local pilot command (27 React tests plus 6 browser tests). The backend manifest test compares temporary Node output with Python bytes without requiring a frontend checkout; the publisher CI job still checks the committed manifest for drift. All four backend contract tests, including the 714-configuration matrix, pass with only the backend mounted and no network/database.
