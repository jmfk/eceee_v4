# Standalone public publisher

The publisher is a Next.js App Router server whose request path is entirely TypeScript/React. Public rendering does not call Django, a Django API, or a Django-served asset: each request reads one repeatable-read PostgreSQL snapshot, resolves public media from stored URLs, compiles the checked-in theme/widget metadata, and renders with the shared React renderer. Django remains the content-management system and migration owner, and its public renderer is the parity reference during development.

## Local development

From the repository root run:

```sh
make servers
make publisher-dev
```

The reference Django renderer is available at `http://summerstudy.localhost:10101` and the Next renderer with HMR at `http://summerstudy.localhost:10115`. No `/etc/hosts` entry is needed: names below `.localhost` resolve to the loopback interface, and `summerstudy.localhost` is already assigned to the matching root page in the local database. Port `10115` is the registered `publisher-preview` port; the target does not create a database, container, or another port.

`make publisher-dev` reads the repository's ignored `.env` without printing it, derives a publisher connection string for the existing shared PostgreSQL service, forces transactions to be read-only, and starts Next directly on the host. The renderer process needs PostgreSQL and public object storage, but it does not need a running Django web process except when doing a visual comparison. Media rows with no stored `file_url` use `PUBLISHER_MEDIA_BASE_URL` (the full public bucket URL), or fall back to `AWS_S3_ENDPOINT_URL` plus `AWS_STORAGE_BUCKET_NAME`.

## Publisher manifest

Registered widget CSS, CSS variables, layout parts and variant metadata plus the built base CSS are stored in `src/generated/publisher-manifest.json`. Regenerate the deterministic artifact after a backend widget or base CSS change:

```sh
make publisher-manifest
```

Use `make publisher-manifest-check` in the local gate. It fails when the checked-in artifact differs from the Django widget registry/build output. This is a build-time consistency check only; Django is not imported or contacted by the running Next publisher.

## Local parity loop

Iterate with HMR on `:10115`, then run the focused publisher checks and the 16-route Summer Study comparison:

```sh
cd publisher
npm test
npm run lint
npm run typecheck
npm run build
npm run test:parity
```

The Playwright suite compares desktop and mobile responses against Django on `:10101`, including published internal paths, headings, image presence, important computed styles, asset failures, browser errors, empty image sources, fallback states, and placeholder links. Invalid, deleted, unpublished, and cross-site page references are intentionally omitted even if legacy Django markup still contains a dead link. The local dataset must contain the referenced public media collections to exercise their full contents; missing local fixture data is reported separately from renderer behavior.

For a deterministic feature and object-rendering exercise, seed the dedicated local site and run the supertest suite while both renderers are running:

```sh
docker exec eceee-v4-2-backend python manage.py seed_publisher_supertest_site
cd publisher
npm run test:supertest
```

The seed command is idempotent. The suite compares desktop and mobile Django/Next output for an image carousel, collapsible nested content, multi-column content, tables, forms, dynamic object routes, featured news ordering, missing slugs, and generic object list/detail widgets.

Standalone Next.js App Router (Node) server. Django owns models and migrations, while public requests read PostgreSQL and store validated form submissions directly; no public request calls Django APIs. Start with `npm ci && npm run dev` in this directory and provide `PUBLISHER_DATABASE_URL` for the least-privilege role created by `provision_publisher_roles`. Point a development hostname at the app and register that hostname on a Django root page. Production Compose derives the non-secret `PUBLISHER_MEDIA_BASE_URL` from the configured Linode region and bucket. No database credentials are needed for tests, typecheck or build. Keep the page-rendering role read-only even though the client also requests `default_transaction_read_only=on`.

Public form storage additionally requires `PUBLISHER_FORM_DATABASE_URL`. Use a separate role with column-level `SELECT (tenant_id, page_id, widget_id, submitted_at)` and `INSERT (id, tenant_id, page_id, page_version_id, widget_id, form_title, data, submitted_at)` grants on `webpages_publicformsubmission`; do not grant it permission to read `data` or `form_title`, and do not reuse the read-only rendering credential. The POST endpoint re-resolves the hostname, published page, version, and recursive form widget through the read-only connection before writing. It accepts only URL-encoded forms, enforces a 64 KiB request limit and a per-form rate limit, validates configured fields, choices, lengths, and RE2-compatible patterns, silently drops honeypot spam, and redirects to widget-scoped success or error feedback. File fields, arbitrary `submit_url` destinations, email notifications, webhooks, CAPTCHA providers, retention controls, and a management UI remain outside this iteration.

Production includes parallel test routes for `eceee-test.colliberty.com`, `summerstudy-test.colliberty.com`, and `industry-test.colliberty.com`. Each test hostname must be added to the `hostnames` array of its own published root page; the publisher resolves the browser-facing hostname directly, including for form submissions. These aliases are CMS content configuration and are not enforced by the deployment healthcheck. All existing public hostnames continue to use Django. Create the test hostnames' DNS A/AAAA records before expecting Caddy to issue their certificates.

The path resolver selects an exact hostname in PostgreSQL, then the most specific scoped wildcard alias (`*.example.com` matches subdomains but not `example.com`), then walks parent/slug within that root's tenant. Unrestricted fallback routing is denied by default: set `PUBLISHER_ALLOW_WILDCARD_HOSTNAMES=true` to permit bare `*`, and list specific comma-separated request hosts in `PUBLISHER_DEFAULT_HOSTNAMES` to permit the `default` root for those hosts. All reads for a request use one read-only, repeatable-read snapshot. Root slug is silent for hostname roots. It selects effective, unexpired page and object versions by descending effective date and version number. Registered dynamic path patterns resolve their remaining segments into path variables for news and generic object list/detail widgets. Database IDs are strings because Django uses 64-bit IDs.

The public model resolves layout and theme inheritance from published ancestor versions, applies widget inheritance behavior and ordering, filters widget visibility and publication windows, resolves same-site published links and navigation, and resolves tenant-scoped public media/collections. Rendering reuses the same React `PageRenderer`, widget registry, layouts and HTML sanitizer as the editor preview, so registered static widgets and recursive containers share one implementation. Theme fonts, breakpoints, colors, design groups, legacy HTML elements, widget CSS/variables, variants, layout properties, component/image/gallery/carousel styles, theme CSS and page/version overrides are compiled in TypeScript. Rich HTML is sanitized during server rendering.

Still required before replacing every Django route: implement preview tokens, add scheduled-publication cache/invalidation, and validate additional sites against complete production-shaped media fixtures. Data-driven widget families beyond the implemented news and generic object list/detail resolvers still render their shared empty/loading state unless their saved configuration already contains resolved data. The production deploy applies Django migration `0077_publicformsubmission` before idempotently provisioning the two publisher roles; it then starts the test Publisher without changing the live public routes.
