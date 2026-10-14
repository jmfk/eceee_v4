# Theme-owned special and error pages

HTTP error pages and other system routes are defined in the Layout Editor. They are not normal CMS pages and do not use `WebPage`, `PageVersion`, publishing, or `ObjectInstance` records.

## Theme contract

`PageTheme.layouts.special_pages` contains the static page definitions. Each entry has:

- a stable UUID and key;
- a label and kind (`error` or `route`);
- an active `layout_key` from the same theme layout document;
- either a supported HTTP `status_code` or a public `route`;
- a widget map keyed by the selected layout's slots.

The required 403, 404, 500, and 503 entries share `error_layout` by default. Their starter widgets are portable theme data. Route entries can be added for system surfaces such as login pages.

The Layout Editor validates unique routes and status codes, layout and slot references, widget IDs, slot allow/deny rules, and maximum widget counts. Special-page widgets use the regular visual page/widget editors, but changes are saved and published with the theme workspace.

## Runtime behavior

The production Next publisher resolves an exact special route before normal CMS page resolution. Its not-found boundary renders the theme-owned 404 definition while preserving the HTTP 404 response, and its shared error-page model builder resolves the other supported status definitions for status-specific handlers. The optional Django public renderer follows the same route precedence and error lookup contract when it is enabled.

Both render paths use the structured theme layout tree, responsive styles, palette tokens, fonts, and static widget JSON. Special pages deliberately exclude page- and page-version-specific CSS because their content and presentation belong to the theme.

Older themes that do not yet contain `special_pages` receive the portable default error definitions when opened or rendered. The definitions are persisted on the next theme publish; no destructive data migration is required.

## Legacy page rows and rollback

Existing direct children named `403`, `404`, `500`, or `503` are retained as dormant rollback data. They are excluded from Pages lists, hierarchy counts, public navigation/search, and route resolution. Creating a new root page no longer provisions error-page children.

The legacy rows and provisioning service should remain until the theme-owned implementation has been used successfully in production and a separately reviewed cleanup migration is approved.
