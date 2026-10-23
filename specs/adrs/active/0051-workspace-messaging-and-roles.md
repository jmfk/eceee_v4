---
id: ADR-0051
title: Tenant recipient snapshots and stable board list roles
status: accepted
date: 2026-10-23
related_prds: [PRD-0036]
supersedes: []
superseded_by: []
---

# ADR-0051: Tenant recipient snapshots and stable board list roles

## Decision
Extend the existing private support conversation boundary for direct messages. Preserve support's existing role-gated access and distinguish it explicitly from direct conversations. Resolve tenant groups and board memberships at send time and persist participants. Group membership changes do not reveal historical conversations. Revoked tenant membership removes access, including file downloads and notifications.

A board's mandatory lists use immutable internal roles `inbox`, `done`, `archive`, independent of editable titles and positions. Upgrade adopts one matching list per role, restores that list if archived and adds only missing lists. No cards are moved or removed. Board membership is a recipient group, not a new board visibility boundary.

Files remain private and are downloaded with attachment disposition after authorization. Videos in messages are decoded and limited to five seconds; published instructional videos retain the separate policy. Client diagnostics contain bounded redacted error metadata, never request bodies or account credentials. Server diagnostics expose only bounded request metadata, not unrestricted server logs.

## Consequences
- Existing support paths remain compatible; recipient snapshots and idempotency are explicit.
- Additive migrations are required, including mandatory list backfill. Downgrade does not remove newly created lists or content.
- Whole-CMS roles must preserve machine credentials and existing tenant boundaries; changing a role never creates tenant membership implicitly.


## Role integration

Interactive CMS requests use the existing resource scope vocabulary plus tenant role-management, support, settings, integration, statistics and AI capabilities. Machine credentials keep their independent scope boundary. Existing direct support/publisher role grants remain explicit compatibility grants, combined with tenant roles; tenant administration does not imply private support access. Upgrade assigns existing tenant members the administrator role to preserve access. The default for unassigned new members is CMS resource reads plus Kanban write, excluding support access. An explicit role, including an empty one, replaces this default. System/tenant owners retain recovery access.

Photos are private, bounded, reencoded JPEGs in the existing database. This avoids introducing another public upload path or depending on S3 setup for account photos. Diagnostic JSON is also private database content; generic user attachments remain in the separate private support bucket.


## Review corrections (PR #274)

Board delivery creates only a generic card and a protected thread link. It must not copy the private subject/body into the tenant-wide Kanban surface. Inbox remains a personal utility governed by tenant, participant and support/publisher checks, including direct grants paired with an empty CMS content role. Page-editor sockets enforce the same page-read capability as HTTP and recheck access before receiving or emitting editor events.

Media requests from users outside the current tenant continue through existing public-resource/private-namespace checks, preserving private-resource concealment. Tenant members remain subject to role-based media capabilities. Message/reply submission waits for video validation; credential redaction handles quoted JSON error fragments as well as plain text.

Recipient groups use tenant-owned roles and board memberships. Global Django groups have no tenant owner and are excluded to prevent cross-workspace group-name disclosure. Generic attachments and legacy video uploads share the existing rolling tenant count/byte quota under the tenant row lock; generated inline diagnostics do not count as uploads.

CMS navigation and Settings actions/queries follow resource capabilities; empty content roles retain personal Profile and Inbox access. Global user administration stays restricted to system owners.

Authentication probes the role-independent current-user endpoint. The root route waits for authentication and lands users without page-read access in Profile.
