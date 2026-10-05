# ECEEE Theme Contract

Use this reference when reading, creating, or updating theme data.

## Sources of truth

- Theme model and defaults: `backend/webpages/models/page_theme.py`
- API serializer and validation: `backend/webpages/serializers/theme.py`
- Theme API routes: `backend/webpages/views/page_theme_views.py` and `frontend/src/api/themes.js`
- Designer endpoints and versions: `backend/webpages/views/designer_theme_views.py`
- Snapshot and restore fields: `backend/webpages/services/theme_versions.py`
- Frontend normalization: `frontend/src/utils/themeDataNormalizer.js`
- Unified Data Context save path: `frontend/src/contexts/unified-data/context/UnifiedDataContext.tsx`

Inspect these files again when the repository changes; this reference is routing guidance, not a substitute for current code.

## Persisted theme surface

The recoverable theme snapshot covers:

- identity and presentation: `name`, `description`, theme image, site icon;
- design system: `fonts`, `colors`, `breakpoints`, `design_groups`;
- styles: `component_styles`, `image_styles`, `table_templates`;
- preview: `designer_preview`;
- compatibility fields: `gallery_styles`, `carousel_styles`, `css_variables`, `html_elements`, `custom_css`;
- state: `is_active`, `is_default`.

The public serializer also exposes immutable or server-owned fields such as `id`, `stable_key`, timestamps, and creator metadata. Do not attempt to replace server-owned values.

## Update semantics

- `GET /api/v1/webpages/themes/{id}/` reads a theme.
- `POST /api/v1/webpages/themes/` creates a theme.
- `PUT /api/v1/webpages/themes/{id}/` updates a theme and must be based on the latest complete editable representation.
- `GET .../{id}/export_theme/` and `POST .../import_theme/` provide portable packages.
- Designer version endpoints list, name, and restore snapshots.

Use the existing frontend API client, authenticated browser session, or an application-owned redacting adapter. Do not copy browser tokens into commands or skill files.

## Casing and preservation

Backend-owned payload fields are snake_case; the frontend normalizes them to camelCase. Follow the live serializer and normalizer rather than mechanically renaming nested user-defined data. Image and component style definitions intentionally contain camelCase keys such as `styleType`, `usageType`, and `imgproxyConfig`.

Before applying an update:

1. Capture the latest editable theme representation and its `updated_at`/version identity.
2. Create a named version or export package.
3. Produce a structural diff grouped by theme subsystem.
4. Re-fetch and compare the identity immediately before the write.
5. Apply one coherent update and re-read the saved result.

Never delete unknown keys merely because the current task does not use them.

## Creation defaults

For a new theme, define only settings supported by the live serializer and editor. Use application defaults for omitted optional values. Choose a durable human-facing name and let the server own `stable_key` unless the current API explicitly supports a creation value.

Do not mark a new theme default or active unless the user requested that operational state.
