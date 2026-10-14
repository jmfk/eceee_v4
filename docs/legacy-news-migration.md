# Legacy News migration runbook

The golden sample is the release gate for the legacy News migration. Do not run the API import until the sample pages have been reviewed at `/migration-preview/news/<slug>/` in Django, the standalone renderer, and the editor preview.

## Golden sample

Before importing, create the object definitions in the React object-type editor. PostgreSQL is the authority for these definitions; the importer only reads and validates them. It never creates, updates, or repairs an object definition.

Create `news`, `news_type`, `news_category`, `news_source`, `news_topic`, and `news_keyword` in the target namespace. The `news` definition must have a `main` widget slot and these fields:

| Field | Component | Additional contract |
| --- | --- | --- |
| `summary` | `textarea` |  |
| `presentationalPublishingDate` | `datetime` |  |
| `sourceDate` | `date` |  |
| `externalUrl` | `url` |  |
| `featuredImage` | `image` | optional |
| `types` | `object_reference` | multiple, allows `news_type`, relationship `news_types` |
| `categories` | `object_reference` | multiple, allows `news_category`, relationship `news_categories` |
| `sources` | `object_reference` | multiple, allows `news_source`, relationship `news_sources` |
| `topics` | `object_reference` | multiple, allows `news_topic`, relationship `news_topics` |
| `keywords` | `object_reference` | multiple, allows `news_keyword`, relationship `news_keywords` |

All six definitions must be active and assigned to the namespace selected for the import. A non-dry import fails its preflight with a bounded error if this contract is missing or incompatible, leaving the definitions unchanged.

The manifest at `backend/content_migration/legacy_news/samples/manifest.json` is deliberately limited to four public ECEEE pages and one labelled synthetic edge case. It stores URLs and expected traits, not copied article bodies. The fetcher identifies itself, waits ten seconds between public requests, and retries only twice.

```sh
make legacy-news-sample-dry TENANT=eceee
cd backend
python manage.py migrate_legacy_news --sample-manifest --tenant eceee --resume
```

The non-dry run creates or updates the dedicated local preview site at `http://migration-preview.localhost:10101/migration-preview/news/<slug>/` and the canonical sample objects after the definition preflight passes. Repeating it does not create duplicate objects, versions, media, tags, or taxonomy terms. `--resume` retries original URLs represented by placeholders. Write-mode imports are serialized with a database advisory lock, so a second importer exits instead of racing the active run. New media uses a tenant- and namespace-scoped deterministic storage key derived from its source URL, which lets a restart replay an upload without accumulating UUID-named orphan objects or colliding with another tenant. If a media upload succeeds but its database record cannot be created, the command also makes a best-effort deletion of the unreferenced uploaded file before failing.

After the Django public, standalone React, and editor/Designer desktop and mobile captures have passed review, record that explicit gate:

```sh
cd backend
python manage.py migrate_legacy_news --sample-manifest --tenant eceee --resume --accept-golden-sample
```

API mode refuses to import while this gate is absent or pending review. Any later sample content change invalidates the gate until it is accepted again.

With the Django and React development servers running, capture every sample at mobile and desktop sizes. `NEWS_MIGRATION_SITE_ID` is the numeric ID of the dedicated `migration-preview-site` root page (the page whose hostname is `migration-preview.localhost`):

```sh
cd frontend
NEWS_MIGRATION_SITE_ID=<page-id> npm run legacy-news:capture
```

The command writes 40 ignored images under `artifacts/legacy-news-migration/`: Django public, standalone React, the shared editor render frame, and Designer preview for five samples at two viewports.

## Read-only legacy migration API

Deploy the fixed migration API in the legacy application behind public HTTPS. Set a
dedicated `ECEEE_LEGACY_MIGRATION_API_KEY` in that application's protected runtime
environment. The legacy application keeps its own database credentials; neither the
database port nor an SSH forward is shared with v4.

In v4, create a **Legacy Migration API** Data Connection containing the API base URL
and matching access key. The browser never receives the saved key. The plugin UI is
the preferred way to test the connection, preflight the import, and run it.

For an operator CLI dry run, put `LEGACY_API_BASE_URL` and
`LEGACY_API_ACCESS_KEY` in the ignored mode-0600 `.env.local` using the approved
secret channel. Then inspect source counts and transformations without writing:

```sh
make legacy-news-api-dry TENANT=eceee
```

Only after reconciling that report against the golden samples should an operator run:

```sh
cd backend
python manage.py migrate_legacy_news --api --tenant eceee --env-file ../.env.local --resume
```

For a bounded development dataset containing the 100 most recent published News
items, use the same selection for the dry run and import:

```sh
python manage.py migrate_legacy_news --api --tenant eceee --env-file ../.env.local --dry-run --limit 100 --newest-first
python manage.py migrate_legacy_news --api --tenant eceee --env-file ../.env.local --resume --limit 100 --newest-first
```

`--newest-first` orders by the legacy presentational publishing date, then by
legacy ID for deterministic ties. Without it, the established ascending legacy-ID
order remains unchanged.

The API returns only published legacy records (`status=2`). Local v4 writes remain transactional per article. The v4 client requires public HTTPS, rejects redirects, bounds responses, and validates API version 1 before transforming records.

## Media policy

Every imported media record receives `legacy` and `news`. Failed downloads create a deterministic 1200×675 PNG with the source filename, host, and bounded failure category and also receive `migration-placeholder`. Every source URL is retained in media metadata for reconciliation.

AI tagging is not part of golden-sample acceptance. If enabled after acceptance, use the separately cost-capped pilot only; failure or exhaustion must never stop content migration.

```sh
cd backend
python manage.py tag_legacy_news_media --tenant eceee --user <operator> --limit 100 --budget-usd 1.00 --model gpt-6-luna
```
