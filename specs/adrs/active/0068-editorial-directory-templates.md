---
id: ADR-0068
title: Editorial directory templates on existing object widgets
status: accepted
created: 2026-11-07
related_prds:
  - PRD-0048
---

# Editorial directory templates on existing object widgets

Extend Object List and Object Detail with opt-in columnist/event templates, preserving their generic defaults. Reuse News Flash for a columnist's columns. Select columns through numeric IDs in the published Article data.authors array and the existing article_kind column classification. Resolve a URL-selected columnist only from a live, tenant-scoped published profile, failing closed if absent.

Use existing member_slug and event_slug path patterns on separately editable pages; keep column article links under /news/. A host/site-bound publisher endpoint supplies bounded directory pages to public rendering and editor preview. List payloads contain only public presentation fields and resolved portrait/lead media, rather than whole object bodies. The owner later revised columnist card copy and detail layout in [ADR-0069](0069-columnist-card-metadata-and-profile-columns.md). Detail payloads contain only the selected published body's widgets. No stored object is rewritten.

The owner selected manual event grouping. Add an optional eventGroup select field to the existing Event definition, preserving every existing field and object. Published values eceee / other determine the two lists; absent or empty values mean other. Publication snapshots determine grouping, so unpublished grouping edits cannot affect the public lists. No automatic organiser inference is used.

## Local configuration and recovery

- Theme 24 (`eceee`) adds `editorialPage`, with independent hero/main/listing slots and inherited header, navigation and footer. Portable layout: `specs/examples/editorial-page-layout.json`. Existing layouts were preserved. Recovery JSON: `/private/tmp/eceee-layouts-before-editorial.json`.
- Page 255: `/columnists/`, member_slug route, columnist Object Detail in main, columnist Object List (limit 1000) and current-columnist News Flash (0 full / 100 half / 0 third, `/news/`) in listing. Directory hides on detail routes; the dynamic profile/columns hide on the index.
- Page 256: `/events/`, event_slug route, event Object Detail in main and two event Object Lists in listing, groups eceee / other, limit 1000 each. ECEEE cards are large; other-event cards compact. Both pages have a plain, theme-colored hero.
- Local Event definition 10 adds only the optional eventGroup choice. Existing fields were compared after saving: all original attributes preserved. No Event or Article object content was rewritten and no events were assigned a group. Existing 41 events therefore appear under Other events. Recovery definition: `/private/tmp/event-type-before-group.json`; portable added field: `specs/examples/event-group-field.json`.
- These page, theme and definition changes are local CMS configuration. A future production release must explicitly transfer/configure them separately from deploying code, under the production gate.

## Verification

220 distinct focused frontend tests passed across editorial render/registration, News Flash render/editor, PageRenderer, preview adapter and registry parity. 76 focused publisher tests passed across directory selection/route, news preview, SQL query contract and page model. Publisher TypeScript checking and lint passed. Frontend changed JavaScript lint passed; its lint configuration excludes TypeScript, so TypeScript rendering is covered by publisher checking and Vite compilation. Both application builds passed. Widget manifest and specs governance checks passed. Python widget configuration files were formatted with the backend container's Black.

Chrome verified actual public profiles/portraits and published author-specific columns (Adrian Joyce: three columns), event index/detail with practical fields and body, saved standalone event index/detail, and embedded editor profile/column preview. The editor's default john-doe example was replaced with adrian-joyce for this check; Refresh was needed after changing the simulated path. At 390px, the columnist list becomes one column without horizontal overflow; event detail also fits. The public feed returns seven profiles at offset 72 and zero at 79, matching all 79 published columnists. Empty ECEEE group is intentional until an editor classifies an event. No invented cards or content were added.

The working batch remains local on codex/editorial-pages. PR 345's reviewed remote branch/head is unchanged; it remains unmerged pending its separate owner gate. Full CI was not requested for this implementation-only task. No new PR or deployment was initiated.

## PR review and owner follow-up

The owner requested a PR, review/fix, merge and deployment. The local branch includes the unchanged, separately reviewed image PR345 dependency. The owner-requested PR targets main and consolidates that dependency to avoid a second rebase/CI cycle in the rebase-only repository; its merged result supersedes PR345. Public-reader/widget-path changes require the separate exact-head owner merge gate and the normal production release gate. The local configuration described above is not silently deployed by the code release.

Review covered P0–P3. Two P1 findings (raw object/media data in public payloads, and body-widget publication windows) and three P2 findings (pagination progress after duplicate batches, raw URL image fallback, and missing published theme-widget definitions in detail responses) were fixed in one local batch. Fresh independent review and targeted final recheck are clean; no ignored findings or remaining verified P0/P1 issues. Regression coverage includes hidden/future/expired/nested body widgets, allowed public fields, rejected URL-only/private media, authored latest columns, preserved pinned theme widgets, and repeated pagination batches.

Post-review evidence: 887 dependency-selected frontend tests and 149 publisher tests passed before the final narrow P2 fixes. Final focused checks after those fixes: 53 publisher and 17 frontend tests pass, with publisher typecheck passing. Both builds, publisher lint and changed JavaScript lint passed during the consolidated gate; final build results are recorded with the PR. Three DB-dependent tests skip locally. No duplicate broad frontend gate is needed after the targeted recheck; Full CI will validate the final PR head.

Browser checks after the owner’s layout change show matching paragraph/portrait bottom coordinates in the 2:1 profile view, matching metadata/portrait bottoms 30px inside directory cards, and one-column layouts without overflow at390px. Existing metadata values are preserved; imported fields may require editorial correction (for example Adrian’s prefix is euroace, which currently supplies the optional title).

Final narrow P2 follow-ups also pass: URL-only image sources are rejected, published tenant object-theme definitions accompany detail bodies, and pinned widgets render. The full publisher suite after these fixes passes (152 tests, three database-dependent skips). The final source builds pass; 887 dependency-selected frontend tests remain valid for unchanged behavior, with 17 focused renderer/theme tests covering the final follow-ups. The end-to-end visual evidence is saved in `/private/tmp/editorial-profile-reviewed.png` and `/private/tmp/editorial-overview-reviewed.png`.
