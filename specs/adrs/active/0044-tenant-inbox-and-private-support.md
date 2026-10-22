---
id: ADR-0044
title: Tenant inbox and private support
status: accepted
date: 2026-10-22
related_prds:
  - PRD-0032
supersedes: []
superseded_by: []
---

# ADR-0044: Tenant inbox and private support

## Context

PRD-0032 is approved for implementation after review of the behavior sketch. Public CMS media cannot enforce private instruction/support access. Existing authentication, tenant membership, Django mail and Celery are available.

## Decision

- Add a bounded Django/DRF module, `tenant_support`, using ordinary relational models. Do not adopt a new document/event framework for this CMS feature.
- Tenant membership remains the outer access boundary. Only the thread creator and explicitly assigned tenant support may read a support thread. System owners assign per-tenant support/publication roles in the product UI; staff or tenant creator status alone grants neither role. Superusers still have the existing tenant-switching capability but need explicit support roles for thread access.
- Store videos in a dedicated private S3-compatible bucket. Reuse the configured S3 adapter credentials and endpoints, but never the media or checkpoint bucket. Check the bucket ACL/policy before storing or issuing playback links. Fail closed, with no public fallback. Playback links expire after 60 seconds. Instruction withdrawal blocks new playback links; existing links may remain valid for those 60 seconds.
- Support MP4/H.264 and WebM/VP8/VP9 initially. Unsupported MOV/HEVC must be exported before upload. Bug videos are limited to five seconds and 25 MiB; instruction videos to 200 MiB. Tenant uploads are limited to 50 files and 1 GiB per rolling day, including unattached uploads. Upload inspection is also limited to 20 attempts per user per hour and at most 4K resolution. Validate file contents with bounded ffprobe/ffmpeg processes; fully decode bug videos. No automatic transcoding or recording UI in this first implementation.
- Publication and messages use caller-generated request UUIDs with database uniqueness and row locks. Inbox entries and durable email-outbox jobs are written in the same transaction. No email for the sender's own message, read receipts, archiving or status changes. Current active tenant members other than the publisher receive publication notifications. Future members see the library without retrospective mail.
- Idempotent retries must match the originally saved content; changed payloads receive HTTP 409 and an explicit new-submission action. Publication/upload recheck roles after acquiring the tenant lock. Status changes and replies share a thread lock. Regranted support roles catch up unread activity without retrospective email.
- Use existing Django mail and Celery Beat to process the durable queue every minute. Sending is disabled until SUPPORT_EMAIL_ENABLED is enabled and an application URL is configured. Retry failures known to occur before provider submission with bounded backoff. After submission begins, an exception or interrupted worker leaves an uncertain delivery for operator inspection, not an automatic resend. A deterministic Message-ID helps tracing but does not guarantee provider deduplication. Exactly-once SMTP delivery cannot be promised.
- Preserve instruction videos and support data; archiving does not delete. No automated retention purge or data migration/backfill is introduced. Database backup captures the metadata; the dedicated bucket requires separately configured object backup/retention and a restore drill before production activation.
- Use an independently scrollable main content area with persistent main navigation and inbox tabs. No redundant back-to-inbox action. Preserve tenant deep links through login and use explicit tenant headers after authorization. Scope client caches by account and tenant.
- Reuse the existing CMS appearance. The approved neutral sketch is behavior guidance, not an appearance redesign. Register inbox destinations in a local searchable command surface (⌘K/Ctrl+K) because this checkout has a reusable command-input component but no mounted application-wide command palette. Broader global command integration is deferred.

## Rationale

This provides one complete instruction → inbox → private support → response journey with existing infrastructure and a clear privacy boundary. Explicit tenant roles avoid exposing every report to other tenant members. Fail-closed storage and honest handling of uncertain mail prevent public attachments and blind duplicate delivery.

## Consequences

- Additive initial migration only; existing core tenants/users and content remain unchanged. No backfills or destructive cleanup.
- ffmpeg/ffprobe are added to the backend image. New private bucket and application URL must be configured; operators must verify private storage, byte-range playback, object backup and email before production activation.
- Uncertain email jobs require provider inspection and a separately controlled retry decision. Inbox content remains available even when email fails or sending is disabled.
- Existing authenticated CMS users are the audience. Public website visitor accounts, video editing/recording, automatic format conversion, mandatory completion tracking and public comments are outside this implementation.
- Tests use real migrations with a narrowly isolated core/auth/support test database, fake provider operations and real local media decoding. An additional disposable PostgreSQL 16 check covers real row locking and competing email workers, without using the shared provider or application database. This is not evidence of production bucket, mail or backup readiness.

## Alternatives Considered

- Public media URLs or static help-video files: rejected for private tenant/support content.
- A new hosted video/helpdesk service: unnecessary for the validated first journey.
- Retrying unknown provider outcomes: rejected because a timeout can occur after the message was accepted.

## Links

- [PRD-0032](../../prds/0032-tenant-inbox-and-support.md)
- [Operator guide](../../../docs/tenant-inbox-support.md)
