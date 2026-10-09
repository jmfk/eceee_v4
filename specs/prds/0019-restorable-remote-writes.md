---
id: PRD-0019
title: Restorable mapped remote publishing
status: in-progress
locked: true
created: 2026-10-09
related_adrs: []
---

# PRD-0019: Restorable Mapped Remote Publishing

## Problem

Remote theme uploads and site-package imports can mutate theme, content, and media state on their destination. Theme history preserves many theme changes, but there is no single enforced destination-side rollback checkpoint covering every affected resource before a remote or package-driven write begins. The current transfer flow also assumes a source root maps to the same logical destination; administrators cannot publish a local CMS page branch into a different production branch while safely rewriting its internal links.

## Goals

- Make every cross-installation or package-driven destination write recoverable.
- Capture the exact affected destination state before mutation.
- Publish any selected local CMS page branch to an explicitly selected branch on another installation.
- Rewrite transferred references so the deployed branch works under its destination identities, path, hostname, media storage, and themes.
- Let workspace administrators inspect and restore checkpoints without server-shell access.
- Keep rollback behavior tenant-scoped, auditable, and safe to retry.

## Non-Goals

- Replace database, object-storage, or disaster-recovery backups.
- Snapshot an entire tenant when only one bounded transfer graph is affected.
- Copy externally hosted media that is not owned by the destination.
- Detect production by hostname or environment name.
- Guess a destination for links that point outside the transferred branch and have no explicit destination mapping.

## Users and Use Cases

- An administrator uploads a theme to another installation and restores the destination theme if the upload is wrong.
- An administrator updates or replaces a site and restores its prior pages, publication state, themes, and referenced media.
- An administrator selects a local page subtree and publishes it into a different existing production subtree without preserving the source root identity or URL prefix.
- An administrator reverses a newly created transfer by removing only the records created by that transfer.
- An administrator can reverse a restore because restoration creates its own checkpoint first.

## Requirements

- The destination server creates an immutable checkpoint before any remote, ZIP, or future API transfer mutates existing theme, site-content, or media state.
- A remote-publish plan identifies a source page branch, destination connection, destination workspace, and either an existing destination branch root or a destination parent for a newly created branch.
- Source and destination branch roots may have different stable identifiers, numeric identifiers, ancestor paths, slugs, and hostnames. The durable transfer binding records their explicit mapping instead of assuming identity equality.
- Publishing to an existing destination branch supports Update and binding-scoped Replace. Publishing beneath a destination parent supports creation of a distinct mapped branch. Source hostnames never overwrite destination hostnames.
- Before mutation, assessment reports the affected destination pages, themes, media, link rewrites, unresolved links, conflicts, selected mode, and checkpoint scope. No write starts before an administrator confirms that assessed plan.
- The destination rewrites known structured page, page-version, theme, and media identifiers through the transfer object maps.
- The destination rewrites links within rich text, widget configuration, page data, CSS, and theme data when they point into the transferred branch or to transferred owned assets. Rewriting preserves anchors and query strings.
- Absolute source-site links into the transferred branch are rewritten to the selected destination hostname and branch path. Relative internal links are normalized against the source branch before mapping and emitted relative to the destination when safe.
- Links outside the transferred branch remain external unless the plan contains an explicit destination mapping. Unresolved or ambiguous links are reported and never silently guessed.
- Remote writes require both the relevant resource capability and an explicit write capability; a key intended only for pulling content cannot publish to its workspace.
- The write must not begin unless its checkpoint and required owned binary data are durably stored.
- A checkpoint records the selected resource scopes, destination workspace, affected stable identifiers, actor or access-key identity, source operation, creation time, and restoration status without storing credential material.
- Existing site-content checkpoints include page metadata, all affected page versions and publication windows, tags, hierarchy, hostnames, and import-binding state.
- Existing theme checkpoints include the complete restorable theme snapshot and owned theme assets.
- Existing media checkpoints include metadata, owned binary data, namespace and collection relationships, tags, and deletion state.
- For resources that did not exist before the write, the checkpoint records prior absence and the exact records created by the operation so restoration removes only that transfer-owned data.
- Restoring a checkpoint is a workspace-administrator operation and creates a new checkpoint before it mutates current state.
- Restoration is asynchronous, idempotent or safely resumable, tenant-scoped, and reports partial or failed recovery without deleting its source checkpoint.
- Checkpoints remain available until explicitly removed by a workspace administrator. Deletion must be separate from restoration and must clearly report that recovery data will be lost.
- Existing theme history remains the normal theme comparison surface, while transfer checkpoints provide the operation-level link between theme, content, and media recovery.
- All future remote write endpoints must use the same destination-side checkpoint guard rather than relying on clients to request a snapshot.

## Acceptance Criteria

- A remote theme update creates a restorable pre-upload checkpoint before changing the destination theme.
- A local branch can be assessed and published to a differently identified production branch through a saved remote connection.
- After mapped publishing, internal page links, structured identifiers, transferred media URLs, and theme-asset references resolve to destination resources.
- Destination hostnames and unrelated ancestors remain unchanged.
- The assessment blocks confirmation when a required destination mapping is missing and lists non-blocking external or unresolved references.
- A site Update or Replace import creates a checkpoint covering every selected existing resource before mutation.
- A transfer that only creates new records has a rollback checkpoint that removes only records created by that transfer.
- A failed checkpoint prevents the destination write and leaves destination data unchanged.
- A workspace administrator can list checkpoints, see their scope and originating operation, and start a restore.
- A restore returns theme, page, publication, media, and binding state to the checkpointed state and is itself reversible.
- A key or user from another workspace cannot list, download, restore, or delete checkpoints.
- A transfer key without explicit write access can assess and pull its allowed resources but cannot start a destination mutation.
- Focused tests cover snapshot failure, cross-tenant denial, update restoration, creation rollback, binary restoration, repeated restore attempts, and restoration of a restore.
- Focused tests cover different source/destination roots, nested branches, hostname/path changes, anchors and query strings, structured IDs, rich-text links, media URLs, theme assets, unresolved external links, and attempts to write with a pull-only key.

## Constraints

- Database and object-storage changes cannot share one transaction, so binary checkpoint persistence must complete before the database mutation transaction begins.
- Existing immutable published-version rules and tenant locks remain authoritative during write and restore.
- Checkpoints may contain unpublished content and must use private object storage with no credential or signed-URL persistence.
- Destination branch selection and mapping are CMS concepts and must not be coupled to Git branches or deployment tags.
- Snapshot cleanup is explicit in the initial implementation; no automatic retention policy may silently remove the only recovery point.

## Implementation Notes

- 2026-10-09: Implementation started from the bounded remote object package foundation delivered by PRD-0018. The first slice establishes destination-owned checkpoints around object imports before expanding the same guard to page and theme publishing.
- 2026-10-09: Bounded object imports now abort when checkpoint capture fails, record updated and created object/media resources, expose tenant-admin checkpoint history in Remote Sites settings, and queue tenant-scoped restoration.

## Linked ADRs

- [ADR-0021: Destination-owned transfer checkpoints](../adrs/active/0021-destination-owned-transfer-checkpoints.md)

## Completion Evidence

- Object-transfer backend suite passes: 31 tests, including capture failure, tenant isolation, restoration, created-parent rollback, and failed-restore rollback.
- Remote Sites settings tests pass: 7 tests, including checkpoint listing and restore confirmation.
- Focused backend and frontend lint, migration drift, diff checks, and repository spec validation pass.
