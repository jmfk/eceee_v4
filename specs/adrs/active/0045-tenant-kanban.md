---
id: ADR-0045
title: Tenant Kanban workflow and private attachments
status: accepted
date: 2026-10-22
related_prds: [PRD-0033]
supersedes: []
superseded_by: []
---

# ADR-0045: Tenant Kanban workflow and private attachments

## Decision
Extend the existing Django/DRF, React Query, Channels and Celery architecture rather than introducing a separate document service. Tenant membership is required at every API, download and WebSocket boundary. Full access applies only inside that boundary. This project decision takes precedence over the generic multitenant-document skill's Go/River/JSON-document architecture; no existing CMS infrastructure is migrated. Existing membership-scoped relational ORM/API authorization is retained rather than adding a new RLS/composite-key/document-event store to this module.

Serialize Kanban writes with a tenant row lock; require resource revisions for edits. Persist state and append-only activity in one transaction. Broadcast invalidations only after commit. Conditional undo uses recorded revisions and refuses to overwrite later changes. Archive is reversible; it never deletes files or descendants.

Use immutable attachments in the existing private checkpoint bucket under a tenant/kanban storage prefix and authenticated streaming/range downloads; never expose raw storage URLs. Copy imports leave originals intact, record provenance, and honor existing destination validation and Designer draft revisions. Approval belongs to a specific immutable attachment. A comment's attachments remain accessible after comment edits.

Native browser media and WebSocket requests use 15-minute signed read tickets bound to user and tenant, checked against live membership. Tickets cannot authorize writes and are stripped before visual content becomes persisted Markdown. Machine integrations use kanban.read/kanban.write; imports additionally require the destination write scope.

Markdown is canonical; visual editing converts only the explicitly supported formatting. Rendering sanitizes HTML. Mentions use explicit member IDs in Markdown links, avoiding ambiguous username matching. Notifications are tenant/user scoped and persisted; periodic deadline checks are idempotent.

Store embedding arrays and indexed revisions in PostgreSQL JSON fields; exact cosine ranking scans only the authorized tenant/filter set. This intentionally avoids a new PostgreSQL extension or service for the initial small-board workload. Revisit indexed vector storage when measured tenant volume warrants it. Stale indexes are excluded, jobs are revision-checked, and periodic repair catches failed enqueue/provider attempts. Provider errors never disable lexical search. No file contents are sent to the provider.

## Consequences
Tenant-wide writes serialize briefly; remote uploads/embedding calls must not unnecessarily extend the lock. Exact semantic ranking is linear in the selected tenant's indexed cards. No new shared-service provider or deployment is required. Existing tenants/data are not rewritten by additive migrations.

## Links
- [PRD-0033](../../prds/0033-tenant-kanban.md)
