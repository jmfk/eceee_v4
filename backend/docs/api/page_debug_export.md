# Page debug export

Authenticated superusers can retrieve a read-only JSON snapshot for one page:

```text
GET /api/v1/webpages/pages/{page_id}/debug/
```

Add `?download=true` to download the response as `page-{page_id}-debug.json`.
Downloads are always rendered as JSON, even when the browser requests HTML.
The response includes page metadata and cached publication state, compact page-version
summaries, and recent content import logs. Version and import-log lists default to 100
entries; `version_limit` and `import_limit` accept values from 1 to 250 and report
whether results were truncated. Long version titles and meta text are truncated in the
summary list and identified with per-field truncation flags.

To include stored page data, widgets, widget counts, and version-specific CSS for one
version, pass `?version_id={version_id}`. Full content is never expanded for the whole
version history in one response. The endpoint is limited to 10 requests per minute per
superuser.

The endpoint requires a superuser and respects the current tenant context. Restricting
access to superusers prevents tenant-scoped staff accounts from selecting another active
tenant through the tenant header. Import logs are additionally constrained through their
namespace tenant. It is strictly read-only and returns `Cache-Control: no-store`.

Exports are limited to 5 MiB. The endpoint returns HTTP 413 when stored page fields, a
selected version, bounded history metadata, or the final rendered JSON would exceed that
limit. Large stored fields are measured in PostgreSQL before they are loaded into the
application process.

To reduce accidental disclosure and oversized exports, the response excludes raw
imported HTML, IP addresses, and import error messages; removes credentials, query
strings, and fragments from import source URLs; and identifies users only by ID and username.
Stored JSON such as page data, widgets, CSS variables, change summaries, and import
statistics retains its original key spelling. The response reports its redactions in the
`privacy` object.
