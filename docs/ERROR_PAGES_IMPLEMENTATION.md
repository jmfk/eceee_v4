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

The hostname-aware public view resolves an exact special route before normal CMS page resolution. Error handlers resolve the matching error definition from the root page's effective theme. The server renders the same structured theme layout tree, responsive styles, palette tokens, fonts, and widget JSON used by the React renderer, while returning the correct HTTP status.

Older themes that do not yet contain `special_pages` receive the portable default error definitions when opened or rendered. The definitions are persisted on the next theme publish; no destructive data migration is required.

## Legacy page rows and rollback

Existing direct children named `403`, `404`, `500`, or `503` are retained as dormant rollback data. They are excluded from Pages lists, hierarchy counts, public navigation/search, and route resolution. Creating a new root page no longer provisions error-page children.

The legacy rows and provisioning service should remain until the theme-owned implementation has been used successfully in production and a separately reviewed cleanup migration is approved.
