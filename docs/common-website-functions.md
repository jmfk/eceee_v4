# Common website functions

This batch lives on `codex/website-functions` (PRD-0065, ADR-0082). It extends the TypeScript publisher and existing CMS authentication, forms and statistics stores.

## Visitor and editorial flows

- Every public page links to **Search and archives** at `/site-tools/search`. Search matches published titles and summaries/descriptions. Select news, publications or events, an inclusive date range and result pages. Event dates filter the event start; other archives filter publication dates. Search is restricted to the object types the actual published detail widget accepts, excludes real child-page collisions, and resolves duplicate slugs before search/date filtering. Detail URLs come from published `news_slug`, `library_slug` and `event_slug` pages, so these pages must be configured before their archive can be used.
- `/sitemap.xml` contains published reachable pages and objects from those archive routes (up to the sitemap limit of 50,000 URLs). Deleted, unpublished and `noIndex` pages are excluded. `/robots.txt` points crawlers to the sitemap and excludes utility/API routes. Existing publisher test hosts retain their noindex response header.
- **Page editor → Settings → Language, sharing and privacy** controls language, sharing image, translations and search indexing. Publish the version to activate changes. Metadata includes canonical, Open Graph and Twitter fields, with resolved object titles/summaries on detail URLs. Canonical and redirect targets use Next’s slashless paths; redirects preserve query parameters. Translations reference existing pages and appear only when reachable and published within the same site. Images must be public media. The document language follows the page, then the site, then English.
- Changes to a public page's slug or parent retain its former paths. The alias resolves to the stable page ID's current published URL within the same site. Published descendant paths and dynamic detail suffixes are preserved. Existing live routes take precedence over aliases; unpublished/deleted or cross-site targets do not redirect. This does not retain history for object slug changes or hostname moves.
- **Profile → Submissions** reviews stored public form submissions. Reviewers require `page.read` and `page.write` in that workspace. Statuses are pending, in review, accepted and rejected; notes are internal. Private query data is scoped to account and tenant, guarded by current permissions and discarded when the view unmounts. Concurrent changes return a conflict instead of overwriting another review. Accepting does not publish an object or page. The sender receives the existing on-page confirmation; no email delivery is introduced. Member-bound event proposals and sender status tracking can follow the separate membership foundation.
- Form controls retain native keyboard interaction, associated labels/help and group names. Public and editor-rendered success/error states remain announced. Existing unsupported file-upload forms remain disabled by the publisher.

## Statistics and account privacy

Enable anonymous page view statistics on the root page's published version. Consent is required by default. Visitors can allow, decline or withdraw through **Privacy settings**; their choice is stored only in the browser on that origin. DNT and Global Privacy Control prevent collection. No tracking cookie, persistent visitor ID, referrer or URL query string is collected by this path. Anonymous page views count toward views but do not claim unique visitors. The existing statistics aggregation job populates the dashboard.

The publisher sends a bounded same-origin event to `/api/statistics`, resolves the site itself, and forwards only the tenant and page URL to existing ingestion. The Caddy route precedes Django's `/api/*` route. Containers default to `http://backend:8000/api/v1/statistics/ingest/`; direct development servers can set `PUBLISHER_STATISTICS_ENDPOINT` to their local backend ingestion URL. No browser credentials are forwarded. The process applies a per-site limit of 300 events/minute; counts are page views, not auditable visitor totals.

**Profile → Account privacy** downloads account details, email verification state and messages authored by that account. It excludes passwords, factors, sessions and other participants' messages. Support messages are bounded to 10,000 and the export states when truncated. This is a scoped account export; use a support request for a complete data-access inventory across other systems.

**Request account deletion** creates a tracked private support conversation when support is configured. It does not immediately delete the account. The operator verifies the requester, inventories personal records, distinguishes tenant-owned editorial material and any retention needs, agrees the specific deletion scope, performs an explicitly approved operation, and records completion in the conversation. No destructive data operation is run by this batch.

## Storage and rollout

Migration `0094_website_functions` adds page aliases and moderation columns to existing submissions. It preserves submission data and defaults old/new submissions to pending. PostgreSQL column defaults allow the restricted form writer to keep its original INSERT column grants; it cannot choose moderation status. Publisher role provisioning adds SELECT on aliases to the read role only. Normal deployment must apply migrations and role provisioning before serving this publisher version. No deployment was requested or performed.

Clean-install verification also found an existing `0080_theme_owned_layouts` failure: its growing Python layout default exceeded PostgreSQL's catalog row limit when used as an ADD COLUMN default. The migration now starts with `{}`, fills layout documents, then restores the Python default. Databases where 0080 already ran are unchanged.

`website` settings are versioned under `page_data`. The existing Django parser persists snake_case keys (`no_index`, `share_image_id`, `analytics_enabled`, `analytics_require_consent`); the React boundary uses camelCase. The publisher explicitly normalizes that boundary. Metadata configuration remains part of the ordinary page version workflow.

## Local evidence and boundaries

- Publisher: 179 passing tests, 3 existing optional integration tests skipped; TypeScript, lint and production bundle verification passed.
- Focused frontend tests covering settings, deletion requests, workspace/concurrency review and renderer/registry parity; Vite build.
- Actual publisher SQL against synthetic PostgreSQL fixtures verifies the winning object across duplicate slugs before text filters, dynamic alias suffixes, site traversal and tenant isolation.
- Real isolated PostgreSQL schema installation and focused alias, review, default-value, export and role-grant checks. Local test PostgreSQL is 14; the deployment target remains the repository's configured version. PG14's default PUBLIC CREATE grant was revoked on the isolated test schema to match the least-privilege test precondition; no development database was altered.
- Panel visual checks at 1280 and 390 pixels, focus and Reduce Motion, using the real components and CSS in an isolated browser harness. Authenticated editor, legacy-renderer and standalone full-site browser sessions were not run.
- Publisher builds exposed two npm advisories for the existing Next 16.4.2 dependency: [GHSA-mfr8-8qww-v76h](https://github.com/advisories/GHSA-mfr8-8qww-v76h) and [GHSA-vc7v-qv4w-wrv8](https://github.com/advisories/GHSA-vc7v-qv4w-wrv8). This batch updates Next within the same 16.4 patch series to 16.4.6 and verifies the production dependency audit (0 findings after the patch).
- The PRs separate the Next.js security patch from the website feature batch; merge and deployment remain separate owner actions.

## Migration and review notes

0094 is an additive, atomic PostgreSQL migration. Existing submission rows receive constant defaults, without changing their payload. The alias table starts empty; no legacy history is inferred. The migration ledger prevents duplicate application; a failed application rolls back its DDL/default changes and can be retried. The new nullable review foreign key and constant-default columns take normal table DDL locks; no external service call or large application backfill is involved. Existing time/tenant indexes remain in use. Prefer roll-forward; a reverse migration would discard new review/history fields and therefore requires an explicit data decision in a live environment. An older publisher can ignore the added columns.

The single systemic review covered P0–P3. Its highest finding was P1 (production statistics routing), corrected with a proxy/origin/HTTPS regression. The P2 corrections cover exact detail-route type/slug resolution, alias precedence and one-hop canonical targets, first-publication history and path row locks, BCP 47 map-key round trips, and account-scoped submission cache/permissions. Targeted checks, rather than another full review loop, verify the consolidated corrections. No intentional findings are ignored.

Final local evidence: publisher `test` 179 passed / 3 optional skipped, `typecheck`, `lint`, `build`; frontend focused renderer/registry checks plus account/cache/navigation regressions and `build`; isolated Django website/export checks 10 passed, focused role checks passing; actual publisher SQL fixture assertions passing; spec validation and whitespace checks passing. No remote CI run or authenticated full-site visual QA was performed.

## PR preparation

The feature branch is based on current main plus the separate Next.js patch PR. Main already contains the clean-install fix for migration 0080, so this PR does not duplicate it. The merge preserves the newer calendar behavior and appends its filter bindings after the new archive parameters. Focused publisher/calendar (181 passing), UI (9 passing), SQL and build checks validate this integration; the required full remote CI is not replaced by these local checks.
