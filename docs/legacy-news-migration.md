# Legacy News migration runbook

The golden sample is the release gate for the legacy News migration. Do not run the database import until the sample pages have been reviewed at `/migration-preview/news/<slug>/` in Django, the standalone renderer, and the editor preview.

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

The non-dry run creates or updates the preview page and canonical sample objects after the definition preflight passes. Repeating it does not create duplicate objects, versions, media, tags, or taxonomy terms. `--resume` retries original URLs represented by placeholders.

After the Django public, standalone React, and editor/Designer desktop and mobile captures have passed review, record that explicit gate:

```sh
cd backend
python manage.py migrate_legacy_news --sample-manifest --tenant eceee --resume --accept-golden-sample
```

Database mode refuses to import while this gate is absent or pending review. Any later sample content change invalidates the gate until it is accepted again.

With the Django and React development servers running, capture every sample at mobile and desktop sizes. `NEWS_MIGRATION_SITE_ID` is the numeric ID of the `migration-preview` root page:

```sh
cd frontend
NEWS_MIGRATION_SITE_ID=<page-id> npm run legacy-news:capture
```

The command writes 40 ignored images under `artifacts/legacy-news-migration/`: Django public, standalone React, the shared editor render frame, and Designer preview for five samples at two viewports.

## Read-only legacy role

The legacy database administrator must provision a new role. Replace the role and database identifiers through the approved secret channel; do not paste the generated password into tickets, chat, shell history, or repository files.

```sql
CREATE ROLE eceee_v4_news_reader LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '<generated>';
GRANT CONNECT ON DATABASE <legacy_database> TO eceee_v4_news_reader;
GRANT USAGE ON SCHEMA public TO eceee_v4_news_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO eceee_v4_news_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO eceee_v4_news_reader;
ALTER ROLE eceee_v4_news_reader SET default_transaction_read_only = on;
```

Copy `.env.local.example` to the ignored `.env.local`, fill it outside agent-visible output, and run `chmod 600 .env.local`. The importer refuses missing database settings; the tunnel helper refuses group/world-readable files.

```sh
make legacy-db-tunnel
```

The tunnel binds only `127.0.0.1:10110`. In another terminal, inspect the source counts without writing locally:

```sh
make legacy-news-database-dry TENANT=eceee
```

Only after reconciling that report against the golden samples should an operator run:

```sh
cd backend
python manage.py migrate_legacy_news --database --tenant eceee --env-file ../.env.local --resume
```

The source connection uses a read-only PostgreSQL transaction and imports only `status=2`. Local v4 writes remain transactional per article.

## Media policy

Every imported media record receives `legacy` and `news`. Failed downloads create a deterministic 1200×675 PNG with the source filename, host, and bounded failure category and also receive `migration-placeholder`. Every source URL is retained in media metadata for reconciliation.

AI tagging is not part of golden-sample acceptance. If enabled after acceptance, use the separately cost-capped pilot only; failure or exhaustion must never stop content migration.

```sh
cd backend
python manage.py tag_legacy_news_media --tenant eceee --user <operator> --limit 100 --budget-usd 1.00 --model gpt-6-luna
```
