# CMS collaboration and learning: verified boundaries

Audit date: 2026-11-10. Scope: repository implementation, local focused tests and eight generated local previews. **No production read, upload, key grant, publication or deployment was performed for this audit.** Local status-only reads were made with the existing dev key. A production screenshot shows UI state, not proof that local changes are deployed.

## What exists and what works

| Surface | Source of truth / API | Verification and limits |
| --- | --- | --- |
| Instruction library (`/inbox/library?tenant=default`) | `tenant_support.Instruction`, private `PrivateVideo`; `/api/v1/support/instructions/` | Existing browser flow, pagination, language/help filtering, roles and notification deduplication are covered by backend tests. New scoped ApiKey access is local code, not deployed. |
| Upload instruction film | `POST /api/v1/support/videos/`, multipart `file`, `purpose=instruction`, then separately authorized instruction POST | Private support bucket, codec/duration/size checks and owner binding. Not `/media/upload/`, no public-media approval queue. Storage network operations are mocked in local API tests; actual deployed storage needs authorized acceptance. |
| Inbox and bug reports | `/api/v1/support/inbox/`, `/threads/`, `/videos/`, `/attachments/` | Reports are `POST threads/` with `kind=bug`, not a new duplicate endpoint. A key acts as its principal; private human threads remain protected. Submission/reply request IDs deduplicate content; uploads are not idempotent. |
| Kanban | `/api/v1/kanban/boards/`, `columns/`, `cards/`, `comments/`, `attachments/`, `workspace/` | Existing CRUD/actions, revisions, roles and board membership. Existing machine scope mapping already worked; local provisioned keys need explicit `kanban.read/write` grants. |
| Profile | `/api/v1/utils/current-user/`, `/utils/profile-photos/<id>/` | Local machine contract: own selected-tenant profile, preferred language and own photo only. Fixed an existing camelCase/parser mismatch that made the language PATCH fail validation. No human impersonation or account-security administration. |
| Contextual help | `frontend/src/docs/how-to/**/*.md`, Swedish translations, `src/data/howToDocs.js` | 38 canonical guide identities in this release checkout, compiled by Vite. Help/sidebar, localization and private instruction linkage have focused frontend coverage. These are code releases, not tenant API documents. |
| Video scripts/editor | `docs/manus/instruktionsvideos/<slug>/manus.md`, shared Markdown parser and script editor | Fixed nested action leakage in the parser while preserving locale narration fields. `helpGuideId` survives script editing and is recorded in new video manifests. |
| Video production | `frontend/scripts/generate-howto-video.mjs`, Playwright + ElevenLabs + FFmpeg | Eight Swedish local demo previews rendered with verified-Swedish standard voice Will. Each has MP4, VTT and narration JSON; timing/text checked. They are 1440×900 previews, not approved final 1080p outputs or proof of production behavior. |
| Change Notes / changelog | PRD-0050 and `eceee-cms-release-change-notes` skill | **Not implemented as a CMS resource, API/UI or deploy gate.** Draft preparation works as a source workflow. No publication endpoint should be invented or a help article/media version note substituted. |

## One workflow, distinct sources

1. Describe a lasting CMS task in canonical help Markdown; keep stable guide identity and matching translation identity.
2. Write executable scene/narration in the manuscript and set `helpGuideId` to that existing article. Several videos may belong to one guide.
3. `cd frontend && npm run howto:check` checks manuscript/help associations. Simulate the real UI against isolated local fixtures before spending voice credits.
4. Generate voice-backed preview MP4/VTT/JSON; `npm run howto:check -- --require-previews` checks current preview files, narration text and cue timings. Review the preview before final export. Keep the historical still-image `render_videos.py` out of this production path.
5. On an explicit publication request, upload the approved final video to private support storage, then publish instruction metadata with canonical help ID and language. Existing help automatically retrieves private films by guide/tenant/language. Do not duplicate the whole help article into the library transcript or put signed URLs into source Markdown.
6. A release note summarizes what changed in a specific tagged release and links help/instructions. It is separate from permanent task instructions and from a video's scene script. PRD-0050 still needs its own implemented publication resource and reviewed release integration.

The eight current manuscripts map Designer films to `settings-themes`, Publisher to `objects-manage`, Tags to `tags-manage`, and image focus to `media-upload`. These metadata links do not publish films. Existing preview artifacts were annotated with their help association without changing recorded actions, audio or subtitles.

## API key contract

All paths below are relative to `/api/v1/`. Continue using `Authorization: ApiKey …`, an explicit `X-Tenant-ID`, environment-specific credentials and the existing redacting API helper. Never put a key into shell arguments or logs. The same key can carry several scopes; authorization is the intersection of key scopes, allowed tenants, active principal, membership and resource-specific roles/ownership.

| Operation | Scope | Additional boundary |
| --- | --- | --- |
| Read support context/library/own Inbox or visible threads | `support.read` | Live membership; personal/participant/support-role filters remain |
| Write reports, replies, own Inbox archive, bug attachments/videos | `support.write` | Principal remains sender/owner; normal support-role checks still apply |
| Publish or change instruction state | `support.publish` | Existing `can_publish` role required |
| Upload instruction video | `support.write` **and** `support.publish` | Publisher role, size/quota/codec validation, private bucket |
| Kanban reads/writes | `kanban.read` / `kanban.write` | Existing board membership, role and revision rules |
| Read own minimal profile/photo | `profile.read` | Only principal's selected tenant/profile |
| Change own preferred language/photo | `profile.write` | No arbitrary target, other tenants, passwords, MFA, email or roles |

Existing `server.full_access` semantics remain, but do not bypass role, ownership or machine-denied routes. Granting it merely to read a profile is unnecessary. Support role/label administration remains outside machine routes, including full-access keys.

A human system administrator can explicitly add scopes without changing the credential via `POST /api/v1/core/machine-api-keys/<uuid>/grant-scopes/`, body `{"scopes":["support.read"]}`. The action locks the record, unions supported scopes, retains the existing hash/identity/tenants, and never returns a secret. Machine keys cannot call this key-management API or self-escalate. Scope grants are not automatic and do not grant support/publisher roles; inspect the existing principal and target tenant before any authorized grant. Production needs the reviewed code deployed first. Do not rerun `provision_local_machine_access` to check access: that command rotates a named key.

Use camelCase JSON at the HTTP boundary (`helpGuideId`, `videoId`, `requestId`, `preferredLanguage`). Python serializers internally use snake_case. Kanban mutations have action-specific revision payloads; inspect their serializer instead of guessing.

## Private-library publication contract

`POST support/videos/` accepts one file. The response is a private video ID, not a pending media record. To publish, send `POST support/instructions/` with `title`, `description`, `language`, `helpGuideId`, plain `transcript`, `videoId`, and a stable UUID `requestId`. This creates tenant-member Inbox entries and may queue email; upload approval does not imply permission to notify recipients.

`GET support/instructions/<id>/` and library queries verify metadata. `GET support/videos/<id>/playback/` returns a short-lived private bearer URL; save it only to a protected response file or verify through the authorized app. API helper output files use mode 0600. `PATCH support/instructions/<id>/` accepts language, help association, archive and withdrawal state. It does not replace video/title/transcript; a revised video needs a new explicit publication.

Uncertain uploads must not be retried blindly: no API lists unattached private uploads. Publication uses request-ID deduplication, but changed content with the same ID conflicts. No existing content or uploads are automatically deleted.

## Remaining product gaps

- The instruction library is a video-plus-plain-transcript resource, **not a general manuscript/PDF/VTT file library**. It has no private caption-track field or endpoint. Current films have burned-in captions; VTT stays with local artifacts. A private VTT playback contract is separate work.
- The eight previews are local and await final approval/export and an explicitly authorized library publication. A production library may correctly remain empty until then.
- Real production key scopes, publisher role, storage upload/playback and email delivery were not inspected or changed. Passing mocked tests does not prove those provider settings.
- Help Markdown and instructional manuscript trees are intentionally separate inputs. `helpGuideId` links them; copying manuscripts into the help tree is unnecessary.
- Change Notes need their own resource, release association, evidence storage, authorization and deployment integration before PRD-0050's proposed gate can operate.
- The Makefile's historical `howto-auth-prod` helper asks for username/password and is not the approved Chrome/1Password login workflow. Use an already approved storage-state file obtained through regular Chrome, or local `--mock-api`. Do not invoke that legacy login helper as an agent.

## Skills and verification

- `eceee-help-authoring`: route permanent help, translation, manuscript and release-specific material.
- `eceee-instructional-video-scripts`: source/action verification, simulation, narration, previews and approved finals.
- `eceee-instructional-video-publisher`: private instruction-library upload and separately authorized publication.
- `eceee-workspace-operations`: scoped service-account Inbox/report/Kanban/self-profile operations.
- `eceee-cms-release-change-notes`: draft/evidence preparation; report the missing CMS publication capability.
- Installed `eceee-api-operations`: same helper and environment isolation, extended allowlist for collaboration routes; saved private output is mode 0600. Helper tests run without credentials/network.

Verification: 181 distinct backend tests passed across the combined PostgreSQL gate (180 passed, one missing-fixture error) and the successful targeted rerun of that remaining test after supplying its public repository tooling. The original 137 support/Kanban/profile tests also passed. Frontend evidence covers 41 distinct tests: the combined 36-test help/API/parser gate plus provenance and additional manuscript round-trip regressions. Canonical API-helper tests (11) and legacy-entry compatibility tests (5) pass. All eight refreshed preview MP4s have audio/video tracks and pass help-ID, source-fingerprint, cue/text and narration-timing checks. Five repo skills pass the official skill validator; specs indexes, changed JS lint and Python formatting pass.

The actual dev profile is configured for `http://localhost:11601/api/v1/` and tenant `eceee-production-copy`. Status-only reads of `support/context/`, `kanban/boards/`, and `utils/current-user/` with its **unchanged existing key returned 403**. The local implementation does not silently add scopes or roles. A human owner must explicitly grant the required capabilities to the correct existing key/principal/tenant before those real-key operations can work. Production availability and key grants remain unverified.

The preview checker now hashes executable actions, selected locale and narration/context at recording time; changing a locator while keeping the caption unchanged invalidates the old preview. Missing fingerprints are unverifiable rather than backfilled. Previous artifacts are preserved under `/private/tmp/eceee-video-pre-provenance-20261110/`.

 Earlier attempts with the minimal SQLite support settings could not load the full app's models; full SQLite migrations also reject PostgreSQL ArrayFields. The successful backend gate uses the existing isolated test PostgreSQL and a disposable test database, never the dev database. No broad full CI or production deployment was requested or triggered.

## Review result

Reviewed P0–P3, including privacy, tenant/key boundaries, publication effects and compatibility. Highest initial priority: P1 (machine access blocked for the requested instruction workflow / incorrect upload destination). Local fixes address those gaps. Additional P2 fixes cover profile-language casing, script-editor nested actions/assertions/locale metadata/new scenes, and stale-preview provenance. The independent review found no P0/P1 issues in the final authorization changes; targeted regression checks close later editor findings. No verified code findings remain unresolved or ignored. Product gaps above are deliberately reported as unimplemented capabilities, not silently claimed complete.

At the audit handoff, local work was on `codex/instruction-video-work`; release preparation now uses a separate `codex/cms-collaboration-api` branch. No production mutation was part of the audit. Existing content, keys, stashes and recovery references are preserved.

Release preparation verified the exact isolated source checkout with a successful production frontend build, 41 focused frontend tests, and 15 API/profile tests after preserving legacy form parsing alongside JSON. No schema migration, live key scope/role grant, or instruction publication is included in the deployment.
