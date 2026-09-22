# Page debug export

Authenticated admins and editors can retrieve a read-only JSON snapshot for one page:

```text
GET /api/v1/webpages/pages/{page_id}/debug/
```

Add `?download=true` to download the response as `page-{page_id}-debug.json`.
The response includes page metadata and cached publication state, every page version
with its stored page data and widgets, compact widget counts, and recent content import
logs. Import logs default to 100 entries; `import_limit` accepts values from 1 to 250.

The endpoint requires an authenticated user and respects the current tenant context.
It is strictly read-only and returns `Cache-Control: no-store`.

To reduce accidental disclosure and oversized exports, the response excludes raw
imported HTML, IP addresses, and import error messages; removes query strings and
fragments from import source URLs; and identifies users only by ID and username.
Error counts remain available for diagnosis. The response reports these redactions in
its `privacy` object.
