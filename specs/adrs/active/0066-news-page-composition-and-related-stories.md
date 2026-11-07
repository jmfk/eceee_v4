---
id: ADR-0066
title: News page layout with contextual sidebar lists
status: accepted
created: 2026-11-07
related_prds:
  - PRD-0047
---

# News page layout with contextual sidebar lists

Reuse News Detail, Sidebar Top News and News Flash, adding explicit opt-in settings rather than new parallel widget types. Keep related selection in the TypeScript publisher and its host/site-bound preview endpoint. Retrieve tags from the same live published Article version used for rendering. Shared topic/category/keyword tags establish relatedness; existing Article-kind terms distinguish News/Press Release from Columns. Exclude the selected Article and retain existing tenant/publication filters. Do not substitute unrelated latest items when no related items exist.

Use a separate `newsPage` layout in the existing local `eceee` theme, cloned from Main with a full-width `moreNews` slot after the article/sidebar grid. Retain the site's header/navigation/footer. Add scoped boxed-article and related-list presentation only when explicitly selected. Use a priority/latest fallback on the news index and the URL-selected Article on detail routes.

Preserve stored Article bodies and the existing render-time duplicate suppression. The recovery point is the exported local theme package made before this change. Production release v0.1.87 remains pending explicit owner approval and is not deployed by this implementation task.

## Local implementation and verification

The portable layout definition is in `specs/examples/news-page-layout.json`. Local theme 24 adds this layout without changing the other layouts. Page 254 uses News Detail (`objectTypes: [8]`, `fallbackToLatest: true`, `boxed: true`, `showMetadata: false`, `showObjectType: false`), two Sidebar Top News widgets (`relatedToCurrentArticle: true`, kinds `news` / `column`, five headlines each, no dates/thumbnails), a plain Hero with `eceee news`, palette `teal3` and `white`, and News Flash in `moreNews` (0 full / 100 half / 0 third). Its initial batch is 12, with progressive loading. This page/theme content is local configuration and must be transferred separately from the code for a future production rollout.

Verification: 187 focused frontend tests and 68 publisher tests pass; both builds pass, publisher lint passes, frontend lint has zero errors and 968 existing warnings. Python schema formatting/import checks pass. The 51 frozen contract cases compare without differences. Public desktop and 390px mobile rendering, real shared-tag News and Columns results, and continuation loading were verified. The index priority Article currently has only an Article-kind classification, so its empty related lists are expected; no classifications or article bodies were invented or changed.

Saved standalone preview `/_render/249/news` also renders the composition. Embedded editor Preview could not be visually verified: Chrome leaves its iframe document at `about:blank` despite the `/__render-frame` source and refresh/reload attempts. The model adapter and render-component tests pass, including camel-case editor slugs. This remaining preview-host issue is recorded rather than claiming complete visual parity; PRD-0047 stays started.
