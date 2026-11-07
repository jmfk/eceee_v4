---
id: PRD-0047
title: News page composition and related stories
status: started
locked: true
created: 2026-11-07
related_adrs:
  - ADR-0066
---

# News page composition and related stories

## Requirements

- Match the supplied news-page references in the local ECEEE site: cyan news hero, boxed article in the left column, related lists on the right, and full-width news cards below.
- Reuse News Flash for the lower two-column grid with progressive loading. Omit Browse News and Filter controls.
- Show the selected published Article on `/news/<slug>/`; use the priority/latest published Article on `/news/`.
- Choose related stories automatically through shared topic, category and keyword tags, excluding the current Article. Keep News and Columns separate using existing Article-kind classifications.
- Reuse the existing sidebar-news widget and theme/layout infrastructure. Preserve tenant scope, publication rules and all stored Article content.
- Use TypeScript for selection and rendering, with only the compatibility fields required by existing CMS registration in Python.
- Stack article, related lists and cards on narrow screens. Preserve the approved typography, card geometry and accessible links.

## Acceptance

- Index and detail routes show the expected article and working related/card links.
- Related lists never include the current Article, drafts, expired versions or another tenant's content; a common kind/source alone does not make stories related.
- Preview and public rendering agree. Unrelated pages/layouts remain unchanged.
- Theme changes have a recovery export; focused tests and actual desktop/mobile browser checks pass.
