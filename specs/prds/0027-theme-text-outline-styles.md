---
id: PRD-0027
title: Theme text outline styles
status: completed
locked: true
created: 2026-10-21
related_adrs:
  - ADR-0036
  - ADR-0037
  - ADR-0038
---

# PRD-0027: Theme text outline styles

## Requirements

- Define named, theme-wide text outline styles, selectable wherever text outline is offered.
- Create, edit and preview styles directly in Designer using its existing draft and publication flow.
- Support outline, gradient blur and drop shadow.
- Support same-as-text, white, black, complementary and custom RGB colors.
- Expose thickness, gradient/blur radius, angle, offset and opacity as applicable to the effect.
- Preserve existing banner outline choices and the default of no outline.
- Include styles in theme copies, exports, imports and recoverable versions.

## Acceptance Criteria

- Unsaved Designer edits update previews and survive save/reload, publication and undo.
- Editor, standalone/publisher and Django rendering resolve the same style keys safely.
- Unknown/deleted styles fall back to no effect; changing a display name preserves references.
- Validate style keys, property types and numeric ranges at the API boundary.

## Implementation Notes

- Local implementation; no production mutation or deployment authorized.
- [ADR-0036](../adrs/active/0036-theme-text-effects.md).


## Completion Evidence

- Implemented named styles in Designer and the theme settings editor; selectors and CSS resolve the same keys in banner editor, React publisher and Django rendering.
- Styles participate in Designer drafts, publish/undo, snapshots, clone and portable theme/site packages. API casing preserves dictionary keys and nested presentation properties.
- Focused Vitest gate: 179 tests passed across Designer, widget updates, theme editor, effect compilation, scoped editor CSS and registry parity. PageRenderer separately passed 155 tests against the same presentation resolver.
- Focused PostgreSQL pytest gate: 42 tests passed across style validation/casing, banner config, Designer save/reload/publish/undo, and theme versions.
- Frontend build and touched-file ESLint passed (pre-existing warnings remain); publisher typecheck passed. Generated publisher manifest matched the canonical backend export. Migration consistency, specs validation and diff checks passed.
- Inspected the local Designer UI and complementary gradient-blur previews on light/dark samples. Test style remained unsaved and was removed after inspection. Existing saved theme/draft data was preserved. Local migration 0087 applied successfully.
- Full repository suites and the updated Playwright page-editor tests were not run for this feature iteration. No push, PR, merge or deployment performed.

- Editing follow-up: numeric fields retain temporary empty/out-of-range input locally. Valid values update the preview immediately; blur restores the last valid value for empty input and clamps out-of-range numbers. Seven focused editor tests and touched-file ESLint passed.

- Owner clarification: No outline is intrinsic and always available. Dark/light must be editable theme definitions, initialized for new themes and existing themes with no presets. Removed hard-coded banner effect/selector shortcuts. Migration 0088 preserves non-empty definitions and pending custom draft edits. Focused verification: 234 frontend tests and 14 backend tests passed, including edited default keys and idempotent backfill.

- Applied 0088 locally after saving a theme/draft recovery snapshot outside Git. Confirmed editable Dark/Light definitions in Designer and the theme-driven choices in five page-editor banner controls. Frontend build, touched-file lint, migration consistency, specs governance and diff checks passed. No production operations.

- Save-flow correction: local theme 8 had a saved draft based on live version 18 while live was version 29. Removed the live-staleness restriction from saving theme setting edits to the separate draft; retained draft-version concurrency checks and the publication live-version gate. The UI now enables Save draft and explains the remaining publication block. [ADR-0037](../adrs/active/0037-preserve-stale-designer-draft-edits.md).

- End-to-end publication correction: saved Designer outlines must be published to appear in WYSIWYG. Added explicit outline-only publication with safe per-key merging for stale drafts, without publishing unrelated changes. Editor controls, scoped CSS and preview refresh the published definitions. [ADR-0038](../adrs/active/0038-outline-only-theme-publication.md).

- Verified outline-only publication on local theme 8: saved Text outline 1 was merged into published theme version 30, while unrelated stale Designer changes retained their original base. Confirmed Text outline 1 in all five page-85 WYSIWYG banner menus. Six focused frontend tests, six backend tests, seven editor/preview tests, touched-file lint and frontend build passed. No production deployment.

- PR preparation gate: 354 frontend tests across 13 focused files, 108 backend PostgreSQL tests, and 21 publisher tests passed. Publisher typecheck, touched-file ESLint, migration consistency, specs governance and diff checks passed. Reused the passing frontend build and actual-browser verification; full repository and Playwright suites were not repeated. Unrelated file-manager cleanup test edits are excluded from this batch.
