---
id: PRD-0001
title: Simplified page versioning
status: started
locked: true
created: 2026-09-22
related_adrs:
  - ADR-0001
---

# PRD-0001: Simplified Page Versioning

## Problem

Page authors currently encounter version numbers, overlapping status badges, direct version selection, and publishing controls across several screens. Saving a selected published version can have unclear live consequences, while "current" and "latest" have different meanings in different parts of the product.

## Goals

- Give authors one predictable working copy for ordinary editing.
- Make saving incapable of changing live content directly.
- Present Live, Working, Scheduled, and History as the user-facing concepts.
- Make every publish, schedule, unpublish, and restore operation target an explicit version.
- Preserve existing content and history while providing safe handling of legacy states.
- Establish interfaces that a future release-packet feature can consume without introducing packets now.

## Non-Goals

- Site selection or site-scoped navigation.
- Persistent release packets or atomic publishing of a page structure.
- Disabling the `PageVersion` storage model.
- Per-site or per-structure versioning modes.
- Replacing the current authentication model.

## Users and Use Cases

- A page author edits a new or live page, saves a working copy, previews it, and publishes it.
- A page author schedules one working copy and continues editing it until launch.
- A page author previews history and restores old content as a new working copy without changing live content.
- A page manager reviews and publishes several explicit working copies, understanding that the operation is not atomic.
- An advanced author publishes a subtree with a warning that the operation is not an atomic release packet.

## Requirements

- Pages presents aggregate states: Not published, Live, Live with unpublished changes, Scheduled, Live with scheduled changes, and Publication ended.
- The standard UI does not show version numbers or use a status indicator as a mutation control.
- The editor opens the canonical editable version rather than the last viewed or numerically latest arbitrary version.
- The first save after opening a live-only page creates a working copy; subsequent saves update that same copy.
- Save is atomic across page data, widgets, and metadata and requires the timestamp last observed by the client.
- Published, expired, superseded, and non-canonical draft versions are read-only.
- Publish, schedule, cancel schedule, unpublish, and restore use explicit version identifiers.
- At most one normal future schedule can be created per page. Existing additional schedules are preserved, reported, and must be resolved before scheduling again.
- A scheduled working version remains editable until its effective time.
- Restore copies historical content into the canonical working copy and never publishes automatically.
- History is the shared secondary surface for preview, comparison, technical version information, and restore.
- Legacy Version Timeline and Settings version-management entry points lead to the shared History surface.
- Publishing with descendants remains an advanced, explicitly non-atomic operation.
- Bulk publishing reviews and submits explicit page/version/timestamp tuples and reports per-item results.

## Acceptance Criteria

- Saving a live-only page creates a working copy and does not alter public output.
- Repeated saves update the same working copy; a stale save is rejected without overwriting newer data.
- Publishing makes exactly the displayed working version live.
- A scheduled working version can be edited without changing current live output.
- Creating a second normal schedule is rejected with actionable conflict information.
- Restoring history changes only the working copy.
- Unpublishing keeps content and history while removing public output.
- Pages and the editor display the same aggregate state for a page.
- Ordinary editing contains no version-number or manual-version-selection controls.
- Legacy pages with multiple drafts or schedules remain readable without destructive migration.
- Bulk publishing rejects stale items and reports partial failures.
- Backend and frontend automated tests cover the workflow and a complete user journey is manually verified.

## Constraints

- The new interface replaces the old standard UI without a feature flag.
- Existing versions and schedules must not be deleted or silently cancelled.
- Expiry remains an advanced control.
- Legacy API contracts remain temporarily available, but the new UI uses only workflow contracts.
- No persistent packet model is introduced.

## Implementation Notes

- 2026-09-22: Implementation started. Requirements locked. Backend workflow service, explicit actions, Pages/editor integration, and shared History UI are being delivered as one batch.
- 2026-09-22: Added a single workflow service for editable, live, scheduled, and aggregate page state; explicit version-targeted actions; optimistic concurrency; idempotent working-copy creation; immutable history enforcement; and non-atomic reviewed bulk publication.
- 2026-09-22: Replaced the normal version selector with Save, Publish changes, Schedule, and History. Pages now uses aggregate states and informational status indicators. Version Timeline and Settings version management lead to the page-level History workflow.
- 2026-09-22: Updated the version manual and UX documents. Packet, Sites, and atomic structure releases remain explicitly out of scope.
- 2026-09-22: Automated backend, frontend, lint, and production-build verification is complete. PRD remains `started` until the browser-level acceptance walkthrough is recorded.
- 2026-09-22: Review follow-up keeps public page attributes inside the working version until publication, makes scheduled takeover reversible on cancellation without reviving superseded content, restores tenant-wide History comparison, and runs legacy mutations inside explicit database transactions.
- 2026-09-22: Delayed slug changes now reject existing sibling collisions on Save and recheck the shared sibling namespace under lock before immediate, scheduled, bulk, or descendant publication.

## Linked ADRs

- [ADR-0001: Canonical page version workflow](../adrs/active/0001-canonical-page-version-workflow.md)

## Completion Evidence

- Backend workflow implementation: `backend/webpages/services/page_version_workflow.py`, workflow endpoints in `backend/webpages/views/page_version_views.py`, shared list/detail state, aggregate filters, and tenant-scoped access.
- Frontend workflow implementation: `PageEditor`, `PublishingEditor`, `PageVersionHistoryPanel`, `PageTreeNode`, `TreePageManager`, legacy redirects, and updated Settings navigation.
- Backend verification: full Django suite passed (660 tests, 18 skipped) against PostgreSQL; focused workflow tests passed (20 tests).
- Frontend verification: full Vitest suite passed (85 files, 999 tests); focused editor tests passed (25 tests); Vite production build passed; affected Playwright editor suite passed (9 tests).
- Static verification: changed frontend files produced no ESLint errors; new backend workflow files passed Black, isort, and Flake8; specification validation passed.
- Remaining acceptance evidence: record a browser walkthrough of new page creation, live-page editing, scheduling, restore, and advanced descendant publishing before changing status to `completed`.
