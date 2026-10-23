# Tenant inbox, instructions and support

Implementation: [PRD-0032](../specs/prds/0032-tenant-inbox-and-support.md) and [ADR-0044](../specs/adrs/active/0044-tenant-inbox-and-private-support.md).

## Product use

Open **Inbox** in the CMS. The Inbox, instruction-library and report tabs stay visible while the content scrolls. The main CMS navigation also has **Rapportera fel**, which captures the current origin/path, discards query strings/fragments, and lets the user review/edit the resulting link.

A system owner opens **Supportinställningar**, selects the intended tenant member, and grants support and/or instruction-publication access. These roles are tenant-specific. Tenant creators and staff do not automatically receive private support access. Only current tenant access plus an explicit support role permits reading another person's reports. Newly assigned support can find existing threads in their inbox; that assignment does not send historical email.

An authorized publisher selects a video, adds a title/description and optional text transcript, reviews the current tenant and recipient count, and publishes. Other active tenant members get personal inbox entries. The library also works for later members. The author does not get an email about their own publication. Archive preserves the film; withdrawal prevents new playback access. Personal inbox archive does not archive the original film or other users' inbox entries. A new reply returns an archived thread to the recipient's inbox.

Messages require a title and description. Type defaults to Question and is optional, as is the location link. Files, images and MP4/WebM videos up to five seconds can be attached to both initial messages and replies. Supported files are MP4/H.264 (AAC/MP3 audio) and WebM/VP8/VP9 (Opus/Vorbis audio). Export MOV/HEVC recordings to a supported format first. Bugs have a strict five-second limit, checked in the browser and again by server-side inspection/full decoding. Instructions may be longer. Upload limits: 25 MiB per bug video, 200 MiB per instruction video, and 50 uploads/1 GiB per tenant per rolling day. Both upload paths share this quota; generated diagnostic JSON is not an upload. Unattached uploads count toward the quota and are preserved; there is no automatic deletion job. Uploads are also throttled to 20 attempts per user per hour and videos are limited to at most 4K resolution. A user can submit 50 reports per rolling day and 100 replies in a thread per rolling day.

Support conversations remain private to the creator, explicitly selected participants and assigned support. Direct conversations are visible only to the sender and their recipient snapshot; a support role alone grants no access to direct messages. New user replies reopen resolved reports. Email is a short generic notice with a tenant-specific login link, without report text, attachments or the reported URL. The email says to read/respond inside ECEEE. Opening an instruction marks the inbox item read; it does not claim completion or that the film was watched.

The inbox search/command surface (⌘K / Ctrl+K) finds destinations and authorized instruction/thread content. Automatic background refresh runs every minute; no WebSocket service is required.

## Deployment prerequisites (not executed by this PR)

The initial migration adds tables depending on existing core/auth migrations. The 2026-10-23 workspace update adds role assignments, profile photos, message participants/files and mandatory board-list identities; see the upgrade notes below. Existing deployments upgrade by running the ordinary reviewed migration flow. Clean-install and existing-core migration paths use the same initial migration. Re-running migrations is a no-op once applied. There are no large existing tables to rewrite or lock for backfill. Application constraints deduplicate publication/message requests and inbox events.

The backend Docker image now includes ffmpeg/ffprobe. API and Celery services must run the same release with the new app/migration installed.

Configure in the established ignored operator environment file or approved secret workflow, without printing credential values:

| Setting | Purpose |
| --- | --- |
| `SUPPORT_STORAGE_BUCKET_NAME` | Dedicated private S3-compatible bucket, different from both public media and transfer checkpoints. No default enables storage. |
| `SUPPORT_APP_URL` | CMS origin for links, e.g. `https://admin.example.invalid`; HTTPS required outside DEBUG. No request-derived hostname. |
| `SUPPORT_EMAIL_ENABLED` | Default `False`; enable only after controlled mail verification. Queued jobs wait while disabled. |

The storage adapter uses the existing AWS endpoint/region settings. Production uses `SUPPORT_STORAGE_ACCESS_KEY_ID` and `SUPPORT_STORAGE_SECRET_ACCESS_KEY`: a dedicated limited key with read/write access only to the private support bucket, including ACL/policy inspection. Both values must be supplied together. The production environment validator rejects a missing pair or reuse of the media/imgproxy access key. Existing local shared-storage setups may omit both and retain their AWS credential pair. Extend only the intended application identity's permissions for the dedicated bucket. Never grant public access. The publisher/public-renderer service does not need this bucket or its object names. Before use, run `python manage.py provision_support_storage` in the authorized environment: it creates a missing dedicated bucket with private ACL or verifies an existing one; it never changes a public bucket's policy. Runtime upload/playback also verifies the dedicated bucket's ACL/policy and fails closed on anonymous grants or failed inspection. Servers without the necessary private bucket ACL/policy APIs must be assessed rather than bypassing the check. Provisioning uses the regional endpoint to select location on Akamai/Linode Object Storage, following [Akamai’s boto3 creation example](https://techdocs.akamai.com/cloud-computing/docs/using-the-aws-sdk-for-python-boto3-with-object-storage); AWS endpoints retain the explicit location constraint outside `us-east-1`. Failures identify configuration, `HeadBucket`, `CreateBucket`, or privacy verification and an allowlisted provider error code. Provider messages and request details are never printed. A failed creation or privacy check still blocks deployment; do not bypass it or change the public media bucket.

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

Python-owned fields are snake_case internally, with the project's camel-case JSON parser/renderer at the boundary. JSON examples: publish `{title, description, transcript, videoId, requestId}`; report `{title, body, kind, location, instructionId, videoId, requestId}`; reply `{body, requestId}`. Request IDs are UUIDs generated once per logical submission and reused after network failure. Reusing an ID with changed content returns HTTP 409 and the existing resource ID; the form preserves the edited text, links to the saved version, and offers an explicit new submission. IDs returned by upload are bound to uploader, tenant and purpose and can be attached only once.

Focused backend test command (requires Django/DRF, boto3, Celery, camel-case parser and ffmpeg/ffprobe):

```sh
cd backend
python manage.py test tenant_support --settings=tenant_support.test_settings --noinput
python manage.py makemigrations tenant_support --settings=tenant_support.test_settings --check --dry-run
```

These tests use real auth/core/support migrations in an isolated SQLite test database, mocked mail/storage and real local video boundary fixtures. The additional `tenant_support.test_settings_postgres` profile is for a disposable, loopback-only cluster with the fixed test role `eceee_support_tests` and the reserved test port (`SUPPORT_TEST_POSTGRES_PORT`). It never targets the application database or a shared provider. A focused local run on PostgreSQL 16 verified 27 tests, including concurrent status/reply updates, publisher revocation and competing email workers, an upgrade from existing core tables and an empty migration plan after reapplication. It used a temporary native cluster to isolate database creation/destruction from the shared provider; that cluster was stopped and removed after the run. These checks do not validate production provider behavior or backup readiness. The application uses uniqueness plus explicit PostgreSQL row locks for writes and worker claims; repeat environment-specific verification against the intended PostgreSQL version before any production gate.

Frontend: `npm run test:run -- src/pages/__tests__/InboxPage.test.jsx src/pages/__tests__/LoginPage.inbox.test.jsx src/api/__tests__/support.test.js src/components/__tests__/Navbar.test.jsx`, followed by the frontend production build. Login-link preservation and browser UI checks are recorded in the PR evidence. No production migration, send, merge or deployment is authorized by these checks.

## Link an instruction film to contextual help

Publish through Profile → Inbox → Publicera instruktion. Choose an optional **Koppla till hjälpartikel** entry, or use **Lägg till instruktionsfilm här** on a help article to preselect it. Publishers can change or clear the selection on the instruction detail page. Clearing the selection keeps the film in the instruction library.

The API persists `help_guide_id` (frontend `helpGuideId`), a stable guide ID from `frontend/src/docs/how-to/`, independent of the translated title. POST `instructions/` and PATCH `instructions/<id>/` accept it. GET `instructions/?help_guide_id=<id>` filters within the current tenant and excludes withdrawn films; the normal default also excludes archived films. Permission and private-video checks remain the same as the instruction library. This association does not make media public or store signed playback URLs in documentation.

A help article plays its workspace's active linked films through the existing short-lived private player. If none are linked, its existing static/generated video remains available. Use **Visa fler instruktionsfilmer** to load older linked films beyond the first API page. Written documentation always remains visible; an instruction-fetch error preserves the existing video and shows an inline error. The existing contextual help icons already lead to these articles.

Migration `tenant_support.0002_instruction_help_guide` adds an optional guide ID and a tenant/guide index. The database column accepts NULL so the previous backend can still publish during migrate-before-restart deployment; API output and idempotent retries normalize it to an empty string. It does not rewrite video objects or publish notifications. Apply it before using this version's instruction APIs. Existing films remain unlinked until a publisher selects an article.

## Local MinIO setup

`make configure-local-infra` now asks the existing shared MinIO provider to provision a separate private support bucket and attach a bucket-scoped supplemental policy to the checkout's existing ECEEE account. The provider's consumer record owns the immutable namespace `w8c4m2`; the canonical bucket is `w8c4m2-dev-support`, with registered frontend-port suffixes for other checkouts. Existing public media/checkpoint names remain unchanged legacy identifiers. No shared service is restarted or recreated.

The helper writes `SUPPORT_STORAGE_BUCKET_NAME` to the ignored mode-0600 `.env`. After changing that file, restart the local backend so it reloads configuration, then run `python manage.py provision_support_storage` in the backend container to verify access and privacy. `make shared-infra-check` and the runtime readiness check now include support storage. The runtime account can inspect the bucket policy and read/write objects; it cannot alter bucket policy or delete buckets. The shared provider alone performs admission. Signed playback uses the browser-visible `http://localhost:10302`; backend storage operations use `http://host.docker.internal:10302`.


## Workspace messaging and roles (2026-10-23)

- **Settings → Roller och behörigheter** (`/settings/roles`) manages tenant roles, permissions and member assignments. Roles combine; the tenant owner/system owner retains administrative recovery access. Main navigation, personal tools, Settings links and dashboard queries follow the same capabilities. CMS API requests enforce these permissions centrally; Kanban attachment/WebSocket access also requires the Kanban capability. Page-editor sockets require page read permission and stop delivering events after revocation. Personal Inbox endpoints defer to their tenant/participant/direct-role checks, including when the user has an empty CMS content role. Authentication probes the current-user endpoint so those users can sign in without page-read access. Existing endpoint-specific restrictions remain in force, including global account administration. Media requests from outside the current workspace retain the existing public-resource/private-namespace authorization and hiding behavior; tenant members remain subject to CMS media permissions.
- **Settings → Support** links to the existing support settings. Explicit direct support/publisher grants remain compatible; tenant roles can also grant those capabilities. Removing one grant does not revoke a capability still supplied by another role. Tenant administration alone does not grant access to private support content.
- Inbox recipients include configured support, active tenant users, tenant roles, board membership groups and board Inboxes. Board delivery requires Kanban write access. A group resolves to participants at send time; later membership changes do not reveal previous conversations. Tenant revocation removes access to threads/files and pending email delivery.
- Selecting a board Inbox creates one ordinary card linked to the conversation in the same transaction. The board recipient snapshot receives the conversation. The shared card contains a generic title and a protected thread link; the subject, body and attachments stay private to conversation participants. Repeated identical submissions reuse the same thread/card.
- Generic attachments use the dedicated private support bucket, shared content validation and a 25 MiB limit per file, ten files per message. Video is fully decoded with the existing five-second policy regardless of message type. Initial messages and replies use the same upload/ownership/single-use checks. Sending waits until video validation completes. Downloads require current authorization and expire after 60 seconds. No public media URLs or executable SVG/HTML previews are introduced.
- Reporting from the current page strips query strings/fragments from its auto-filled location. Opt-in diagnostics are preselected for that report and include up to 20 redacted browser errors plus bounded per-user/tenant server error metadata from the last hour. Named credentials are masked in both plain error text and quoted JSON fragments, including truncated quoted values. Raw server logs, stacks, request bodies, cookies, headers and browser storage are not attached. Collection cannot recover events from before the feature was loaded. Browser diagnostics are cleared on account/tenant changes. The generated JSON attachment uses private database storage and the normal participant download check.
- Upload the instructional recording through Inbox → Publicera instruktion and select **Spela in en femsekunders buggrapport** (`record-bug-video`). The linked film is available beside message attachments. Instruction films retain their separate longer-video limit.
- Profile photos are uploaded by the account owner, validated/reencoded to a 256×256 JPEG without source metadata and stored privately in PostgreSQL. Photos are readable only by the owner or authorized members of the same workspace. Replacing/removing a photo affects that account's profile across its workspaces.

### Upgrade and recovery

Apply `core.0004`, `kanban.0002` and `tenant_support.0003` through the normal migration flow. The role migration gives existing tenant members an explicit Administrator role to preserve their previous CMS access, and adds reusable role presets. Users joining without explicit assignments have the documented default member read permissions and Kanban write permission; assigning an explicit role replaces that default. Empty explicit roles grant no CMS capabilities.

The board backfill adopts one matching Inbox/Done/Archive list, restores it if archived, and creates missing lists. Its stable role survives ordinary renaming/reordering. All existing card IDs, list references and positions remain unchanged. No card is moved to Archive automatically. Mandatory lists cannot be archived through API or undo; deletion is unsupported for every list. Re-running the migration/backfill is idempotent. Its reverse deliberately preserves created lists and cards. Role/list loops are per tenant/board; large installations need a maintenance-window assessment before deployment.

Deploy API and worker code together with the new schema; the new non-null columns are not compatible with old processes writing during a rolling upgrade. Restart workers after the migration so private message email checks use the new participant policy. Do not roll the schema back through application data or reverse to a release that would hide new direct messages. Recover by correcting forward or restoring a separately approved recovery point. Production migration/deployment still requires its own owner gate and data-path review.

Local evidence: PostgreSQL 17 focused backend checks, component tests/build and browser flows with mocked APIs. The local development upgrade preserved existing card locations/positions and verified mandatory lists. Private bucket readiness/privacy was checked without exposing credentials. No real notification email or production deployment is part of this task.

Production bucket access: Linode limited keys can create a new bucket but do not automatically gain access to it. Create a dedicated limited access key naming the existing support bucket and its actual region; do not broaden the image proxy key. Save the one-time response directly into the protected deployment environment without displaying it. Verify `HeadBucket`, `GetBucketAcl`, and `GetBucketPolicy` with the new key before installing it or retrying deployment. A denied policy inspection must still block deployment.
