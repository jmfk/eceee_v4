---
name: eceee-theme-authoring
description: Create, revise, migrate, and verify complete ECEEE v4 themes through the existing Theme Designer, API, export, and version workflows. Use for fonts, colors, breakpoints, design groups, component styles, image styles, table templates, preview content, assets, and custom CSS. Do not use for unrelated app design or widget implementation work.
---

# ECEEE Theme Authoring

Build coherent, recoverable ECEEE themes without inventing a parallel theme system.

## Route the work

- Read [references/theme-contract.md](references/theme-contract.md) before creating or changing theme data.
- Read [references/image-styles.md](references/image-styles.md) when image presentation, galleries, carousels, lightboxes, sizing, or alignment is in scope.
- Read [references/theme-family.md](references/theme-family.md) when work involves the `eceeeSummerStudy`, `Industry`, or `eceee` theme family.
- Read [references/machine-api.md](references/machine-api.md) before authenticated API work or machine-key lifecycle operations.
- Read [references/verification.md](references/verification.md) before applying or handing off theme changes.

## Core workflow

1. Identify the target ECEEE environment, tenant, site, theme, and whether the request is exploratory, local, staging, or production.
2. Inspect the current theme and relevant preview content before proposing changes. Preserve settings outside the requested design outcome. For authenticated interaction with `app.eceee.org`, always use Chrome; do not use the Codex in-app browser.
3. For an existing theme, create a named theme version or export a recoverable theme package before mutation. For a new theme, start from the closest intentional theme or the application defaults rather than an unrelated production theme.
4. Translate the design brief into one coordinated system: typography, colors, breakpoints, design groups, component styles, image styles, table templates, assets, HTML element rules, and custom CSS only where needed.
5. Prefer the scoped machine API for structured reads and writes once a production key has been provisioned. Use Chrome for visual inspection and verification. Do not write theme rows directly in the database or create a second configuration source.
6. Preview a complete representative page, then verify the affected edit and render surfaces described in the verification reference.
7. Report the target theme, settings changed, recovery point, verification performed, and any intentional mismatch or unsupported request.

## Safety and boundaries

- Treat API `PUT` updates as full-theme replacements: begin with the latest server representation and change only intended fields. Never construct a partial `PUT` from memory.
- Preserve `stable_key`, tenant ownership, assets, preview references, and unrelated style dictionaries. Respect the established snake_case API/persistence and camelCase frontend boundary.
- Re-fetch immediately before applying a prepared update. If the theme changed since inspection, stop and reconcile rather than overwriting concurrent work.
- Use exported packages for portability and theme versions for recovery. Do not treat a browser preview or copied JSON fragment as a backup.
- Do not expose credentials. Use the repository's secret-inspection rules if authenticated automation requires checking configuration.
- Production reads or writes require the repository's fresh production authorization gate. A request to design a theme is not production deployment permission.
- Keep theme work lean. Configure existing capabilities first; propose product code only after demonstrating a concrete limitation in the current theme contract.

## Implementation choices

- Prefer reusable theme styles over page-specific CSS.
- Prefer explicit, human-readable style names and stable keys over positional or generated names.
- Keep breakpoint behavior mobile-safe and avoid upscaling source images.
- Use Designer preview content that exercises real headings, body copy, links, tables, images, captions, nested layouts, empty states, and long content.
- When several themes need the same capability, preserve separate theme records and assets. Reuse a reviewed style contract or package; do not silently link mutable theme state across tenants.
- Treat `eceeeSummerStudy`, `Industry`, and `eceee` as a coordinated family with separate version histories. Compare them after shared-capability changes and copy intentional behavior through reviewed snapshots or APIs, not by coupling live mutable records.
