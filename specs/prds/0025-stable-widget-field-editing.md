---
id: PRD-0025
title: Stable widget field editing
status: completed
locked: true
created: 2026-10-20
related_adrs:
  - ADR-0033
---

# PRD-0025: Stable Widget Field Editing

## Problem

The widget side panel remounts fields during typing, delays the save buffer and exposes rich-text placeholders.

## Requirements

- Keep field DOM and rich-text instances stable while editing the same widget.
- Include the latest input in immediate Save and dirty tracking.
- Reset buffers and schema on widget, path, page or version changes.
- Hydrate external changes without echoing them as user edits or overwriting newer local input with its own echo.
- Enable formatted editing in all declared rich-text widget fields, including nested fields.
- Preserve existing HTML, revision checks, conflict resolution and full-snapshot persistence.

## Acceptance Criteria

- Tests cover selection, immediate save, sibling isolation, identity changes and external hydration.
- Browser checks cover rich-text formatting, undo, widget switching, save/reload and existing conflicts.
- No backend revision, conflict or publication contract changes.

## Implementation Notes

- Local batch: `codex/side-column-editing-fix`.
- Removed timing-based prop/UDC synchronization; fields report synchronously through their existing owner, with local-origin metadata retained for UDC echoes.
- Raw HTML that DOMPurify cannot round-trip remains in the source editor, preserving trusted scripts and embeds without executing them in the form.
- Revisions, server persistence, three-way merge and conflict resolution were not changed.

## Linked ADRs

- [ADR-0033](../adrs/active/0033-widget-editor-session-and-field-ownership.md)

## Completion Evidence

- 318 distinct focused unit/state/render tests pass: a consolidated 317-test gate plus the late schema-response regression, followed by the final six state/HTML regressions after the source-disable fix.
- Commands: `npm run test:state`; focused `npm run test:run` suites for SideColumnEditing, IsolatedFormRenderer, WidgetEditorPanel, TextInput, TextareaInput, useFormDataBuffer, threeWayMerge, ContentWidget, CanonicalWidgetUpdates, registryParity and PageRenderer.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:12600 npx playwright test --config playwright.config.js e2e/page-editor.regression.spec.js --workers 2`: all 15 Chromium tests pass, including focus/selection, schema stability, immediate save/reload, formatting/native undo, same-type widget switches, independent concurrent edits and explicit rich-text conflict choices. API responses use the existing mocked CMS fixture.
- `npm run lint -- --quiet`, `npm run build`, Python AST checks for widget schema metadata, `git diff --check`, and specs validation pass. Build retains the existing large-chunk warning.
- Browser screenshot: `frontend/test-results/side-column-richtext.png` (local ignored test artifact), visually inspected.
- Independent final P0–P3 review: no verified findings remain; previously identified P1/P2 and source-disabled P3 defects were fixed and re-reviewed.
- No live backend, production or deployment checks were run; this batch changes client editing and two widget UI schema annotations.
- PR #252 review follow-up: lossless source editing now protects all rich-text fields, including direct and nested `RichTextInput` fields. Refresh retries both type validation and schema loading, and Tab/Shift+Tab navigate between form controls.
- Review verification: all 1,654 frontend tests in 162 files and all 17 Chromium page-editor regressions pass. Frontend lint/build, diff checks and specs validation pass; existing revision/merge/conflict paths remain unchanged. Inline fields retain the native context menu rather than displaying unsupported block commands.
- Further PR #252 review: source-only protection uses the field's actual inline rules; field paste and block formatting preserve unrelated HTML and update the save buffer synchronously. Toolbar mouse/keyboard activation establishes selection inside its owning field.
- Further verification: 1,662 frontend tests in 162 files and 20 Chromium page-editor regressions pass, including inline images/attributes, body paste/native undo/format/save-reload, plain clipboard text and toolbar isolation. Frontend lint/build and diff checks pass; revision and conflict handling are unchanged.
- Conditional-group fields now take hydration from their parent form and retain their DOM for same-group external updates. Rich-text link dialogs close on field unmount, disable or external hydration, and pending results cannot edit a retired field. Dialog root cleanup is deferred outside the field's React commit.
- Follow-up verification: 1,666 frontend tests in 162 files and all 22 Chromium page-editor regressions pass; lint, build, diff and specs validation pass. The first concurrent gate timed out in an existing Designer test; the complete test suite passed when run separately, without changing timeouts. Browser coverage includes rapid conditional-group edits with immediate save and navigation away from an open link dialog.
