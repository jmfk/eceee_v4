# Page debug export

Authenticated staff users can retrieve a read-only JSON snapshot for one page:

```text
GET /api/v1/webpages/pages/{page_id}/debug/
```

Add `?download=true` to download the response as `page-{page_id}-debug.json`.
The response includes page metadata and cached publication state, compact page-version
summaries, and recent content import logs. Version and import-log lists default to 100
entries; `version_limit` and `import_limit` accept values from 1 to 250 and report
whether results were truncated. Long version titles and meta text are truncated in the
summary list and identified with per-field truncation flags.

To include stored page data, widgets, widget counts, and version-specific CSS for one
version, pass `?version_id={version_id}`. Full content is never expanded for the whole
version history in one response. The endpoint is limited to 10 requests per minute per
staff user.

The endpoint requires a staff user and respects the current tenant context. Restricting
access to staff prevents an arbitrary authenticated caller from selecting another active
tenant through the tenant header. Import logs are additionally constrained through their
namespace tenant. It is strictly read-only and returns `Cache-Control: no-store`.

To reduce accidental disclosure and oversized exports, the response excludes raw
imported HTML, IP addresses, and import error messages; removes credentials, query
strings, and fragments from import source URLs; and identifies users only by ID and username.
Error counts remain available for diagnosis. The response reports these redactions in
its `privacy` object.
