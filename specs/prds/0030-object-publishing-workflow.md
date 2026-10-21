---
id: PRD-0030
title: Object publishing workflow
status: completed
locked: true
created: 2026-10-22
related_adrs:
  - ADR-0042
---

# PRD-0030: Object publishing workflow

## Problem
Object Publishing and Versions duplicate history and expose storage mechanics rather than the Page editing workflow.

## Requirements
- Use one Publish tab containing aggregate publication status, immediate publication, scheduling, cancellation, unpublishing, and history.
- Save repeatedly into one canonical working copy; live and historical content stay immutable.
- Published content, including title, changes only through publication or scheduled activation.
- Restore historical content into the working copy without publishing it.
- Require reviewed version identifiers and revisions; reject stale mutations atomically.
- Preserve existing drafts, schedules, and published history. Surface legacy conflicts; allow explicit cancellation of extra schedules.
- Keep operations tenant scoped and validated; retire implicit publication and editor mutation bypasses.

## Non-Goals
- Production deployment, bulk data normalization, destructive cleanup, or changes to Page behavior.

## Acceptance Criteria
- Save does not change public content; repeated saves reuse the working version.
- Scheduled content remains editable until its activation time and freezes afterward.
- Publish, cancel, restore, and unpublish have focused regression coverage, including stale revisions and tenant isolation.
- The Object editor has the same Save/Publish/History navigation pattern as Pages.

## Implementation Notes
- User selected the full workflow rather than interface-only alignment.

## Linked ADRs
- [ADR-0042](../adrs/active/0042-canonical-object-workflow.md)

## Completion Evidence
- Focused workflow/API, affected Object tests, and public rendering tests: 59 passed (PostgreSQL, including the existing Page scheduled-publication worker check).
- Frontend workflow/editor/save controls: 18 tests passed. Publisher query tests: 16 passed; publisher TypeScript check passed. Frontend production build passed (existing bundle-size warnings).
- Local additive migration applied; migration state check and spec governance check passed.
- Browser checked at desktop and 390px widths, including unsaved changes across tabs and Undo.
- [API and upgrade notes](../../docs/object-publishing-workflow.md).

### Focused verification commands

- Backend (existing isolated PostgreSQL test configuration): `python manage.py test object_storage.test_version_workflow object_storage.tests object_storage.test_widgets easy_widgets.tests.test_news_list_template easy_widgets.tests.test_news_detail_widget webpages.tests.test_page_version_workflow.PageVersionWorkflowTest.test_scheduled_version_refreshes_the_publication_cache_when_due --keepdb --noinput` — 59 passed. The final canonical-editor flag change was additionally checked with the 20 workflow/API tests.
- Frontend: `npm run test:run -- src/components/objectEdit/ObjectPublishingView.test.jsx src/components/objectEdit/ObjectDataForm.test.jsx src/pages/__tests__/ObjectInstanceEditPage.static.test.js src/components/__tests__/SaveVersionControl.test.jsx` — 18 passed; `npm run build` passed.
- Publisher: `npm test -- tests/db.test.ts` — 16 passed; `npx tsc --noEmit` passed.
- `python manage.py makemigrations object_storage --check --dry-run` — no changes; spec governance validation and `git diff --check` passed.
- Broad repository suites and production checks were not run; verification was limited to the affected workflow, rendering, and worker integration. Existing local changes outside this batch were preserved.

- Local Celery worker was idle (no active, reserved, or scheduled tasks), restarted to load the publication projection hook, and responded to a post-restart health ping. No production operation, commit, push, or PR was performed.

### PR preparation against current main

- Isolated this batch in `codex/object-publishing-workflow`, preserving unrelated working-tree changes in the original checkout.
- Renumbered this PRD to PRD-0030 and its ADR to ADR-0042 because current main already owns the former identifiers.
- Preserved main's theme widget validation and published widget type payloads. Workflow operations now acquire the existing tenant lock before Object locks; added coverage for copying released widget revision pins.
- Current-main verification: 66 backend tests passed, including Object workflow/rendering, Page scheduled publishing, and theme-widget write boundaries. Frontend: 18 passed and production build passed. Publisher: 16 passed and TypeScript check passed.
- Changed backend files pass Black, isort and flake8. Changed frontend files pass ESLint with no errors. Spec validation, migration-state validation and diff whitespace checks pass.
- Full repository suites and production checks remain outside this PR preparation; deployment and merge require their separate owner gates.

## Review follow-up

The PR review added mounted editor regressions for tab remounts, edits during Save, Undo, late save completion after navigation, and publication-status refresh. Structural settings now carry explicit baselines only when changed. Public news and hierarchy widgets read live snapshots, including titles and ordering before scheduled projection refresh. The activation worker rechecks a candidate after locking so a concurrent reschedule keeps its pending marker.

### Main integration verification

Merged main `a1d5c766296c9c5bac3cfcf98b3198e8c888c704` into the PR branch after owner authorization. Main's shared widget contracts keep ADR-0041; the Object workflow decision now uses ADR-0042. The combined tree passes 78 PostgreSQL/backend tests, 54 frontend tests (including page/object context), nine Node contract tests, the frontend build, focused lint/format checks, and specification validation.
