# Theme Verification

Use this reference before applying or handing off a theme.

## Before mutation

- Confirm environment, tenant, site, theme ID/name, and current updated/version identity.
- Record a named theme version or export a theme package.
- Summarize the intended subsystem diff and explicitly list preserved areas.
- Re-fetch before applying and stop on concurrent changes.

## Structural validation

- Submit data through the existing serializer/API so current validation runs.
- Re-read the theme and compare the saved editable fields with the intended result.
- Check stable keys, style references, asset URLs, preview references, and default/active flags.
- Confirm named style keys referenced by preview content still exist.

## Visual and behavioral matrix

Check the surfaces affected by the theme:

1. Theme Designer preview with representative content.
2. Page editor iframe preview, including unsaved-state behavior when relevant.
3. Standalone React render at `/_render/<site-id>/<slug>` using saved state.
4. Existing Django-rendered public page or development parity route.

Use at least mobile (375 px), tablet (768 px), and desktop (1440 px) widths for responsive changes. Compare typography, colors, content width, spacing, breakpoints, nested layouts, images, captions, tables, links, empty states, and interaction states.

For Image Style work, cover one single image and one collection where the style permits both. Check long captions, missing optional captions, portrait and landscape sources, lightbox behavior, processed URLs, and alignment at narrow widths.

## Repository checks when code changes are unavoidable

Theme configuration alone does not require repository tests. If a demonstrated limitation requires product code, use the repository's ECEEE render-parity workflow and run the focused widget/render tests, registry parity where relevant, frontend lint, and build before handoff.

## Handoff

Report:

- target environment and theme;
- version/export recovery point;
- settings added, changed, and intentionally preserved;
- preview pages and viewport sizes checked;
- API/serializer or repository checks run;
- remaining visual decisions, unsupported behavior, or intentional mismatches.

Do not describe a theme as production-ready if only the style editor's isolated preview was checked.
