---
id: ADR-0042
title: Canonical Object editing and publishing workflow
status: accepted
date: 2026-10-22
related_prds:
  - PRD-0030
supersedes: []
superseded_by: []
---

# ADR-0042: Canonical Object editing and publishing workflow

## Decision
Keep ObjectVersion as storage and date-based public selection. Introduce an Object workflow service following the Page contract, with object row locking and explicit reviewed version/revision tokens. Use an additive migration for a title snapshot, revision counter, and schedule predecessor metadata; do not rewrite existing content.

The highest draft or scheduled version newer than published history is the canonical working copy. Older drafts remain historical rather than becoming editable after a newer version is published. Working-copy saves validate through the existing Object serializer and copy live content atomically on first save. Parent and metadata remain structural Object settings; unchanged settings are omitted from content saves, while intentional structural edits included in a working-copy save compare the reviewed baseline under the Object lock; title, data, widgets and featured status belong to the version. Public rendering reads the live title snapshot, falling back to the Object title for legacy versions. Known legacy titles are filled lazily when copied or superseded; no historical title is invented through a bulk backfill. Normal model writes, including internal imports, advance revision tokens. Draft workflow writes suppress relationship projection updates; the existing publication-cache worker refreshes scheduled projections through an idempotent pending marker.

Publish retires older active publications. Scheduling ends the predecessor at activation, retaining its original expiry for cancellation/rescheduling. Unpublish expires every currently active predecessor so legacy publications cannot reappear. Existing parallel schedules are preserved and must be explicitly cancelled before creating a new schedule or publishing changes. No migration normalizes legacy dates.

Retire implicit object publication, bulk publication, direct content updates, and widget-only editor writes with HTTP 410. Supported editor writes use the complete working-copy endpoint. Internal import/transfer operations retain their separate explicit contracts and are not converted into editor commands.

## Consequences
Old editing clients must reload. Existing extra drafts remain viewable/restorable history; extra schedules remain visible and explicitly cancellable. Published and expired versions cannot be edited through the CMS API. Deployment requires the additive schema migration before updated services start; rollback should retain the added columns and use a forward fix rather than deleting revision/title metadata.

## Links
- [PRD-0030](../../prds/0030-object-publishing-workflow.md)
- [Page precedent](0001-canonical-page-version-workflow.md)
