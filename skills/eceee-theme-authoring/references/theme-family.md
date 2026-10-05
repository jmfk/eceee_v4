# ECEEE Theme Family

Use this reference when work spans `eceeeSummerStudy`, `Industry`, and `eceee`.

## Browser rule

Use Chrome for authenticated inspection, comparison, preview, export, and management in `app.eceee.org`. Do not use the Codex in-app browser for this workflow. Browser inspection remains read-only unless the production write gate has been satisfied for the exact mutation.

## Production baseline before synchronization, observed 2026-10-05

The Theme Designer comparison between `Industry` and `eceeeSummerStudy` reported 60 differences. `eceeeSummerStudy` was newer and was at live theme version 57; `Industry` was at live theme version 2.

Changed areas reported by Designer:

- breakpoints;
- component styles;
- design groups and their calculated selectors, element typography, slots, targeting, and responsive layout properties;
- font variants;
- gallery styles;
- preview image;
- image styles.

Notable exact differences included the `sub-page-navigation` component style and a `partner-logos` gallery/image style present in the Summer Study design. The comparison also reported additional Summer Study design groups and more Source Sans 3 variants.

The production identity fields were:

| Theme | Name | Description | Preview image state |
| --- | --- | --- | --- |
| Summer Study | `eceeeSummerStudy` | empty | `SS26_Header_768-1024.png` |
| Industry | `Industry` | `Industry` | no selected image shown in Designer |

Treat these observations as a dated baseline. Re-inspect in Chrome before mutation because the themes remain independently editable.

## Industry synchronization, 2026-10-05

`Industry` theme ID 3 was synchronized from `eceeeSummerStudy` theme ID 2 through the scoped theme-sync API. Industry retained its own ID, stable key, name, description, tenant, active/default state, site icon, and version history. Its live sync version became 5.

The complete Summer Study theme contract and seven referenced assets were copied. A named recovery checkpoint was recorded as theme version ID 7 with the name `Before copying eceeeSummerStudy 2026-10-05 asset-safe retry`.

Semantic package comparison confirmed that the copied design fields and asset contents match Summer Study. The raw Designer comparison still reports `design_groups` and `image` because Industry deliberately owns separate asset paths; path inequality alone is not a design mismatch.

The public Industry page was checked in Chrome at 375, 768, and 1440 px with no horizontal overflow. Its existing page content includes a black banner region and one empty-source image element; those are content-level properties, not missing copied theme assets.

## eceee theme creation, 2026-10-05

The standalone production theme `eceee` was created as theme ID 7 from `eceeeSummerStudy` sync version 57 through the scoped theme-sync API. It received its own server-generated stable key, asset paths, and version history; its initial sync version is 1. It remains inactive, is not the default, and was not assigned to a page or site.

Semantic package comparison confirmed that all design fields and referenced asset contents match Summer Study. The source transfer package contains seven asset references representing six unique file contents, so the content-addressed import stores six files under the new theme's own asset path.

The authenticated Theme Designer preview was checked in Chrome with a 1440 px browser viewport and its mobile, tablet, and desktop canvases. The rendered canvas widths were 390, 768, and 1280 px respectively, with no horizontal overflow, no broken images among the 12 rendered images, and no browser console errors. A separate 375 px Chrome viewport check confirmed that the responsive Designer layout and mobile theme preview render correctly.

## Repository baseline

- `themes/default/base/eceee_summer_study/theme.py` inherits `EceeeTheme` and adds its own colors, fonts, breakpoints, and preview image.
- `themes/default/base/industry/theme.py` is standalone and supplies its own colors, fonts, breakpoints, and preview image.
- `themes/default/base/eceee/theme.py` is currently only a minimal base with name, preview image, and breakpoints. The live production `eceee` record is a complete Summer Study copy, so this generated Python file must not be used to overwrite it until a fresh server export has reconciled the file.

Do not assume generated Python files are authoritative when they conflict with the live Designer. Export or fetch the latest server representation and validate it before deriving another theme.

## Parallel development policy

Keep three independent theme records, stable keys, assets, drafts, and version histories. Use Summer Study as the behavioral source for the initial `eceee` theme, then let visual identity diverge intentionally.

For a shared capability change:

1. Record a named version or export for every affected live theme.
2. Implement and verify the capability in one theme.
3. Compare the resulting full theme contract against the other two themes.
4. Port only the shared behavior; preserve theme-specific colors, typography, imagery, content, and deliberate layout differences.
5. Verify all three at the same representative desktop, tablet, and mobile widths.
6. Record which differences are intentional so later synchronization does not erase them.

Never create runtime inheritance or a shared mutable production theme merely to keep the three themes synchronized. Synchronize reviewed changes through versioned theme data and explicit comparison.
