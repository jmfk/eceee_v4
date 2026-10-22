# Tenant inbox, instructions and support

Implementation: [PRD-0032](../specs/prds/0032-tenant-inbox-and-support.md) and [ADR-0044](../specs/adrs/active/0044-tenant-inbox-and-private-support.md).

## Product use

Open **Inbox** in the CMS. The Inbox, instruction-library and report tabs stay visible while the content scrolls. The main CMS navigation also has **Rapportera fel**, which captures the current origin/path, discards query strings/fragments, and lets the user review/edit the resulting link.

A system owner opens **Supportinställningar**, selects the intended tenant member, and grants support and/or instruction-publication access. These roles are tenant-specific. Tenant creators and staff do not automatically receive private support access. Only current tenant access plus an explicit support role permits reading another person's reports. Newly assigned support can find existing threads in their inbox; that assignment does not send historical email.

An authorized publisher selects a video, adds a title/description and optional text transcript, reviews the current tenant and recipient count, and publishes. Other active tenant members get personal inbox entries. The library also works for later members. The author does not get an email about their own publication. Archive preserves the film; withdrawal prevents new playback access. Personal inbox archive does not archive the original film or other users' inbox entries. A new reply returns an archived thread to the recipient's inbox.

Reports require a short description; bug reports also require a location link. Video is optional. Supported files are MP4/H.264 (AAC/MP3 audio) and WebM/VP8/VP9 (Opus/Vorbis audio). Export MOV/HEVC recordings to a supported format first. Bugs have a strict five-second limit, checked in the browser and again by server-side inspection/full decoding. Instructions may be longer. Upload limits: 25 MiB per bug video, 200 MiB per instruction video, and 50 uploads/1 GiB per tenant per rolling day. Unattached uploads count toward the quota and are preserved; there is no automatic deletion job. Uploads are also throttled to 20 attempts per user per hour and videos are limited to at most 4K resolution. A user can submit 50 reports per rolling day and 100 replies in a thread per rolling day.

Support and the creator reply in one private thread. New user replies reopen resolved reports. Email is a short generic notice with a tenant-specific login link, without report text, attachments or the reported URL. The email says to read/respond inside ECEEE. Opening an instruction marks the inbox item read; it does not claim completion or that the film was watched.

The inbox search/command surface (⌘K / Ctrl+K) finds destinations and authorized instruction/thread content. Automatic background refresh runs every minute; no WebSocket service is required.

## Deployment prerequisites (not executed by this PR)

The migration is additive: new tables only, depending on existing core/auth migrations. No content backfill, rewrite or cleanup. Existing deployments upgrade by running the ordinary reviewed migration flow. Clean-install and existing-core migration paths use the same initial migration. Re-running migrations is a no-op once applied. There are no large existing tables to rewrite or lock for backfill. Application constraints deduplicate publication/message requests and inbox events.

The backend Docker image now includes ffmpeg/ffprobe. API and Celery services must run the same release with the new app/migration installed.

Configure in the established ignored operator environment file or approved secret workflow, without printing credential values:

| Setting | Purpose |
| --- | --- |
| `SUPPORT_STORAGE_BUCKET_NAME` | Dedicated private S3-compatible bucket, different from both public media and transfer checkpoints. No default enables storage. |
| `SUPPORT_APP_URL` | CMS origin for links, e.g. `https://admin.example.invalid`; HTTPS required outside DEBUG. No request-derived hostname. |
| `SUPPORT_EMAIL_ENABLED` | Default `False`; enable only after controlled mail verification. Queued jobs wait while disabled. |

The storage adapter uses the existing AWS endpoint/region/credential settings. Extend only the intended application identity's permissions for the dedicated bucket. Never grant public access. The publisher/public-renderer service does not need this bucket or its object names. Before use, run `python manage.py provision_support_storage` in the authorized environment: it creates a missing dedicated bucket with private ACL or verifies an existing one; it never changes a public bucket's policy. Runtime upload/playback also verifies the dedicated bucket's ACL/policy and fails closed on anonymous grants or failed inspection. Servers without the necessary private bucket ACL/policy APIs must be assessed rather than bypassing the check.

**Production requires the repository's separate owner gates.** This implementation does not configure or access production. Before enabling for users, verify:

- Object-store endpoint reaches the browser, GET and byte-range seeking work for supported formats, and anonymous GET/HEAD are denied. The API returns a signed URL after current membership/participant checks, valid for 60 seconds. Old links may work for up to that period after withdrawal/revocation. Renew playback in the UI if a link expires.
- Edge/body-size configuration allows the intended upload sizes; the application independently checks each upload's actual byte count. Video validation runs with protocol/demuxer restrictions, a decoder thread limit and subprocess timeouts. Unsupported/unknown duration fails validation.
- Celery worker and Beat process `tenant_support.tasks.deliver_pending` on the default queue every minute. Enable sending only after testing the existing Django email backend, sender identity and a controlled recipient. No real email has been sent by automated tests.
- The normal database backup includes the support tables. **The database backup script does not back up S3 objects.** Configure private-bucket object backup/versioning/retention separately and perform a coordinated database/object restore drill before production activation. Preserve object keys when recovering metadata. The API offers no permanent deletion/reset. Do not run destructive rollback/restore without its separate gate.

## Mail recovery and operator visibility

Inbox events and email jobs commit together, with a unique recipient/event key. Workers claim jobs under row locks before external IO. Failures before provider submission retry with exponential minute backoff, at most five attempts. A missing recipient email is an explicit failed job. Jobs are skipped when the recipient loses access. A missing application URL leaves the job pending with a visible configuration error.

A deterministic Message-ID traces the logical send, but SMTP/Postmark's Django backend does not provide a general exactly-once guarantee. A timeout after submission or interrupted worker leaves an **uncertain** job, without blind retry. These appear in **Supportinställningar**, along with failed/pending-error jobs. Check the provider's delivery log using the job's stable Message-ID before deciding whether to retry; never resend an already accepted message. Any provider-backed retry facility must preserve the same event identity. The durable inbox remains accessible throughout.

If upload succeeds but a database transaction later fails, an unreferenced private object may remain. It has no public route or authorized playback link. Reconcile such objects only through a separately reviewed retention/cleanup operation; do not delete them during deploy or recovery.

## API and local verification

All endpoints are under `/api/v1/support/` and require personal authenticated tenant access (machine API keys are rejected):

- `context/`: GET permissions, tenant, unread count and limits; POST owner-managed tenant role assignment.
- `inbox/`: GET personal paginated entries (`kind`, `archived`, `search`, `page`); `inbox/<id>/`: PATCH personal archive state.
- `instructions/`: GET paginated library (`archived`, `search`, `page`); POST idempotent publication. `instructions/<id>/`: GET/read; PATCH publisher archive/withdrawal.
- `threads/`: POST question/report; `threads/<id>/`: GET/read, POST idempotent reply, PATCH support status.
- `videos/`: POST multipart (`file`, `purpose`); `videos/<id>/playback/`: GET authorized 60-second URL (no public fallback).
- `deliveries/`: GET paginated operator-visible delivery problems.

Python-owned fields are snake_case internally, with the project's camel-case JSON parser/renderer at the boundary. JSON examples: publish `{title, description, transcript, videoId, requestId}`; report `{title, body, kind, location, instructionId, videoId, requestId}`; reply `{body, requestId}`. Request IDs are UUIDs generated once per logical submission and reused after network failure. IDs returned by upload are bound to uploader, tenant and purpose and can be attached only once.

Focused backend test command (requires Django/DRF, boto3, Celery, camel-case parser and ffmpeg/ffprobe):

```sh
cd backend
python manage.py test tenant_support --settings=tenant_support.test_settings --noinput
python manage.py makemigrations tenant_support --settings=tenant_support.test_settings --check --dry-run
```

These tests use real auth/core/support migrations in an isolated SQLite test database, mocked mail/storage and real local video boundary fixtures. The additional `tenant_support.test_settings_postgres` profile is for a disposable, loopback-only cluster with the fixed test role `eceee_support_tests` and the reserved test port (`SUPPORT_TEST_POSTGRES_PORT`). It never targets the application database or a shared provider. A focused local run on PostgreSQL 16 verified 23 tests, including competing email workers, an upgrade from existing core tables and an empty migration plan after reapplication. It used a temporary native cluster to isolate database creation/destruction from the shared provider; that cluster was stopped and removed after the run. These checks do not validate production provider behavior or backup readiness. The application uses uniqueness plus explicit PostgreSQL row locks for writes and worker claims; repeat environment-specific verification against the intended PostgreSQL version before any production gate.

Frontend: `npm run test:run -- src/pages/__tests__/InboxPage.test.jsx src/pages/__tests__/LoginPage.inbox.test.jsx src/api/__tests__/support.test.js src/components/__tests__/Navbar.test.jsx`, followed by the frontend production build. Login-link preservation and browser UI checks are recorded in the PR evidence. No production migration, send, merge or deployment is authorized by these checks.
