---
id: PRD-0033
title: Tenant-internal Kanban
status: completed
locked: true
created: 2026-10-22
related_adrs: [ADR-0045]
---

# PRD-0033: Tenant-internal Kanban

## Problem
Tenant members need a shared place to coordinate tasks and review assets before using them in published content.

## Requirements
- Tenant-only boards and custom ordered columns; all members have full access in v1 behind a centralized permission boundary.
- Cards have immutable UUIDs, tenant-unique readable IDs, permanent links, Markdown descriptions with visual/source editing, labels, checklists, multiple assignees, deadlines and external issue references.
- Move cards within/across boards and reorder columns with drag/drop and accessible alternatives.
- Navigable card detail with comments/activity at right and attachments below content, responsive on narrow screens.
- Archive/restore boards, columns and cards; undo moves/archive without overwriting concurrent edits. No permanent deletion.
- Persistent private tenant attachments on cards/comments, image preview, file download, MP4/WebM playback, explicit limits and errors.
- Approve individual immutable attachments. Copy into Media Library or Designer through their validation/version boundaries, retain provenance and original attachments, and search/import from both destinations.
- Append-only activity records for durable changes, filterable separately from editable comments.
- Mentions, assignment notifications and one-day-before deadline notifications in the app; no email.
- Atomic updates and history, optimistic concurrency and authorized real-time refresh.
- Text and semantic search of cards, checklists, comments and filenames; filters and My tasks; exact IDs first.
- Reuse configured OpenAI credentials for asynchronous indexing, store embeddings in PostgreSQL, keep text search available on provider failure. No OCR, document extraction or transcription.

## Non-goals
Guests, role editor, external two-way synchronization, permanent deletion, production deployment.

## Acceptance Criteria
All flows work through the tenant-scoped API and UI, including tenant isolation, concurrency errors, archive recovery, private file access and provenance-preserving import. Focused backend/frontend tests and build checks pass before a single PR is opened.

## Implementation Notes
- Implementation is isolated in the tenant-kanban worktree from the remote default branch.

## Linked ADRs
- [ADR-0045](../adrs/active/0045-tenant-kanban.md)

## Completion Evidence
- `scripts/test-kanban.sh`: 40 passing backend/scope tests against disposable PostgreSQL, including clean install, upgrade, parallel creates/edits, private uploads, media/Designer import and WebSocket revocation.
- `npx vitest run src/components/kanban src/api/kanban.test.js`: 10 passing tests; 98 passing tests with the affected Designer and Navbar suites after integration with current main.
- `npx playwright test --config playwright.kanban.config.js`: 5 passing browser workflows, desktop/mobile and light/dark screenshots.
- Frontend build, focused ESLint, backend Black/isort/Flake8, shell syntax and specs validation passed.
- OpenAI credential presence verified with the safe helper. No live provider/storage acceptance, full repository suite, production operation or deployment performed.
- Operational and API details: [Tenant Kanban](../../docs/tenant-kanban.md).
