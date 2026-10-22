# Tenant Kanban

Kanban is available under `/kanban`. Members of the active tenant and its owner have full access in v1; staff/superuser status alone does not grant access to another tenant's boards. The permission boundary is centralized for later role support. There are no guests or permanent-delete endpoints.

Create a board, customize its columns, then create cards. Drag column headers to reorder and cards to reposition or move between columns. Dropping a card on a board link moves it to that board's first active column. Arrow buttons and destination selectors provide keyboard/touch alternatives. Card links and UUIDs never change on moves; readable `TASK-N` numbers are unique within each tenant. Archive retains descendants and attachments. Use the archive filter to find and restore boards, columns and cards, or undo a recent archive/move from activity. Undo fails safely after a conflicting later change.

Card details have descriptions/checklists/assignments/deadlines at left, comments and activity at right, and files below the content. On mobile these sections stack. Descriptions/comments store Markdown; the visual editor supports headings, emphasis, lists, links, images, quotations and code. Use the mention selector to insert `[@Name](#member-123)`. Mentions, assignments and deadlines produce in-app notifications. Deadline checks run every minute and notify once within the day before the deadline (also immediately when assigned within that window). No email is sent.

## Attachments and import

Uploads go to the existing **private checkpoint bucket**, under `tenants/<tenant UUID>/kanban/`. They are persistent and do not enter the pending-media expiry workflow. The bucket must already be provisioned by the normal checkpoint-storage setup and remain distinct from the public media bucket. Authorized downloads stream S3 ranges for the built-in video player, including asynchronous streaming under ASGI without buffering the entire response. Signed, 15-minute, read-only browser tickets support JWT logins; every use rechecks membership. Do not log ticket query strings or WebSocket protocol headers.

Existing file validation applies: images 50 MiB, documents/audio 100 MiB, MP4/WebM 500 MiB. Validation scans bounded chunks rather than buffering videos in memory. Unsupported formats, empty files and unsafe content are rejected. SVG is downloaded rather than rendered inline. Video is played natively without transcoding; actual browser codec support still applies. Reverse proxies must permit the advertised upload size if operators choose to expose 500 MiB uploads.

Use the attachment section to upload to a card or an existing comment. Image attachments have a Copy Markdown image action for embedding in descriptions/comments. Approval is immutable-attachment-specific and is recorded in activity; a Done column does not imply approval.

Media Library and Designer each have an **Importera från Kanban** panel. Search by card text or filename, inspect source card and approval, then explicitly import a copy. Originals remain on the card and imports record destination, user and timestamp. Media imports require the destination namespace's ordinary approval tags. Existing global media content-hash uniqueness is preserved: an existing active copy in the same tenant/namespace may be reused only if the importer can access it under ordinary Media Library rules; inaccessible destinations and collisions with another namespace, tenant or deleted record are rejected without disclosure or deletion. Designer imports use an existing image slot, image validation (including the Designer's 10 MiB limit), permissions and draft revision checks. Save/discard local Designer edits before importing. Import never publishes the theme.

## Search and background work

Card lists support board, column, assignee, label, mine, deadline and archived filters. Search combines lexical matches with semantic similarity; exact `TASK-N` matches rank first. Card list APIs are paginated (100 default, 500 maximum per page); the board client follows pages. Search returns the best 100 matches. Attachment import search returns the newest 100 matching attachments; narrow the search when necessary.

Embeddings use the existing `OPENAI_API_KEY` and optional `KANBAN_EMBEDDING_MODEL` (default `text-embedding-3-small`, 512 dimensions). Searchable title, description, checklist text, comments and filenames are sent to OpenAI. File contents, OCR and video/audio transcription are excluded. Text is chunked within input limits and combined into a card vector. Arrays and indexed revisions live in PostgreSQL; v1 uses exact cosine ranking within the tenant/filter set, without a new vector service/extension. This is intended for small boards; measure before adopting indexed vector search.

Run the existing Celery worker and beat services. Mutation callbacks enqueue indexing; a once-per-minute repair task retries stale entries (100 per pass) and deduplicates deadline reminders. An old indexing job cannot overwrite a newer revision. Lexical search continues when OpenAI/indexing is unavailable. The UI uses Channels invalidations with reconnect and a periodic workspace refresh. Development WebSockets honor the existing `VITE_WS_URL` setting. All Kanban caches and browser tickets are isolated by tenant and authenticated user, including the embedded import panels.

## API contract

All endpoints are under `/api/v1/kanban/`, use the existing authentication and tenant-selection contract, and return camelCase JSON. Python serializers/services own snake_case names; `frontend/src/api/kanban.js` bridges the boundary explicitly. Multipart uploads use `file`, `revision` and optional `comment`.

- `boards/`: GET list, POST `{title}`; `boards/<uuid>/`: GET detail, PATCH `{revision,title?,archived?}`.
- `boards/<uuid>/columns/`: POST `{revision,title}`; `reorder-columns/`: POST `{revision,columnIds}` including every column exactly once.
- `columns/<uuid>/`: PATCH `{revision,title?,archived?}`.
- `cards/`: paginated GET and POST `{title,column,...}`. `cards/<uuid>/`: GET detail and PATCH `{revision,...}`. Editable fields: title, description, checklist (`id,text,done`), externalReferences (`system,issueId,url`), assignees (user IDs), labels (label UUIDs), deadline (ISO timestamp/null), archived, column and position.
- `cards/<uuid>/comments/`: POST `{revision,body}` using the card revision; `comments/<uuid>/`: PATCH `{revision,body}` using the comment revision.
- `cards/<uuid>/attachments/`: multipart POST; `attachments/`: GET search (`q`, optional `approved=true`); `attachments/<uuid>/download/`: GET with byte ranges.
- `attachments/<uuid>/approve/`: POST `{revision}` using the card revision; `import/`: POST `{revision,destination,...}`. Media requires namespace and tagIds; Designer requires themeId, assetKey and draftVersion, with optional targetBreakpoint.
- `workspace/`: GET members/boards/columns/labels/notifications/upload policy; `workspace/access/`: GET ephemeral browser read ticket; `labels/`: POST `{name}`; `activity/`: GET with optional board; `undo/`: POST `{activityId}`; `read-notification/`: POST `{id}`.

Updates require a current revision and return HTTP 409 on conflict. State and activity commit together. Card placement serializes tenant writes and advances revisions for affected neighbors. Import first spools and validates the source in bounded chunks outside the tenant write lock, then rechecks approval and revision under the lock. Imports hold the tenant write lock while completing the destination copy, so large imports can briefly delay edits in that tenant. No imported or original files are deleted by archive/undo.

Machine API keys can use `kanban.read` and `kanban.write`. Their principal must still belong to the selected tenant, and their existing tenant restrictions apply. Imports additionally require `media.write` or `theme.write`, unless the key has server full access. Browser tickets never authorize writes.

## Local verification

- `scripts/test-kanban.sh`: disposable PostgreSQL on OrbStack, with an internal network and no published ports; tests clean install, upgrade with existing tenant data, concurrent writes, membership revocation, ranges, private uploads, import/provenance, notifications, semantic fallback and related existing scope mappings. Requires the existing `eceee-v4-backend-editor:latest` image; override only its name via `ECEEE_KANBAN_TEST_IMAGE` if needed.
- `cd frontend && npx vitest run src/components/kanban src/api/kanban.test.js`.
- Start the frontend on a registered port, then `PLAYWRIGHT_BASE_URL=http://127.0.0.1:<port> npx playwright test --config playwright.kanban.config.js`. Browser tests use mocked API responses with the real page/editor and capture desktop/mobile/light/dark screenshots. They do not prove live S3/OpenAI availability.
- Run focused ESLint, `npm run build`, backend Black/Flake8 and specs validation before pushing.

The additive initial migration creates only new Kanban tables/indexes/constraints. It does not rewrite existing tenant/content/media data. Back up new Kanban tables and include the private bucket in the existing backup policy before production adoption. No production deployment is part of this change.
