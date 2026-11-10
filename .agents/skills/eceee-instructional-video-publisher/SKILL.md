---
name: eceee-instructional-video-publisher
description: Upload approved ECEEE tutorial videos and publish them in the private tenant instruction library under Inbox, linked to source-owned help articles. Does not upload instructions to the CMS media library.
---

# ECEEE instruction library publisher

The destination is **Inbox → Instruktionsfilmer**, `/inbox/library?tenant=<identifier>`. Its files live in private support storage, not CMS Media. Read [the consolidated contract](../../../docs/cms-learning-and-collaboration.md) and the target checkout's support routes/serializers before requesting API access.

## Prepare locally

- Select the exact approved final MP4/WebM, language, title, description, manuscript and canonical `helpGuideId`. Preview generation is not publication approval; do not silently label a preview as final.
- Use `$eceee-instructional-video-scripts` for rendering and `$eceee-help-authoring` for article changes. From `frontend/`, run `npm run howto:check -- --require-previews` to validate current manuscript/help links and preview narration/VTT before final export. Final artifacts also need their own media inspection.
- Check actual codecs, dimensions, duration and bytes. The server accepts H.264 MP4 or VP8/VP9 WebM, at most 4K; obtain deployed size limits from the authorized support context. The bug-video five-second limit does not apply to instructions.
- Preserve Markdown and VTT locally. The instruction API accepts plain transcript text, not arbitrary manuscript/PDF/VTT uploads. It currently has no private caption-track field; burned-in subtitles and transcript work, separately uploaded VTT tracks are not supported. Never substitute a public media upload.

## Use the existing key and private API

Use `$eceee-api-operations` and its redacting `eceee_api.py` helper with the correct environment profile and explicit tenant. Use `$inspect-secrets-safely` before credential checks. This branch adds machine support; verify deployment rather than treating source changes as production availability. The existing key needs `support.read`, `support.write`, `support.publish`; its principal also needs the tenant's existing publisher role. Do not rotate a key, expand its scopes, or grant roles merely to test access.

1. Prepare one concrete authorization plan naming tenant/origin, exact files and payload, private storage, endpoints, final help association, and whether publication/notifications are authorized. Reuse explicit authorization for that exact operation; production requirements in the API skill still apply. Uploading and publication are distinct actions.
2. Read `GET /api/v1/support/context/` for `canPublish`, `recipientCount`, `storageConfigured` and `videoLimits.instruction`. Inventory `GET /api/v1/support/instructions/` with pagination and language/help filters for duplicate checks.
3. Upload one video with `POST /api/v1/support/videos/`, multipart **file** plus `purpose=instruction`. Helper arguments are `--upload-file <path> --file-field file --form purpose=instruction`. Keep its returned `id` in the operation record. This is a private upload, not a pending public-media approval record. It is not yet listed or playable in the library.
4. Only when instruction publication and recipient notification are authorized, `POST /api/v1/support/instructions/` with a `--data-file` containing `title`, `description`, `language` (`sv`/`en`), `helpGuideId`, `transcript`, `videoId` and a stable UUID `requestId`. Use the same request ID and exact payload for a verified retry; never generate a new ID after an uncertain publication. Existing publication creates personal Inbox entries and may queue email for active tenant members.
5. Verify `GET /api/v1/support/instructions/<id>/`, the filtered library, and the linked help article. `GET /api/v1/support/videos/<id>/playback/` produces an expiring private bearer URL; keep its response in a protected output file and do not log or publish that URL. Verify authorized playback without turning a signed URL into a permanent help asset.
6. Report instruction ID, language, help association and publication status. `PATCH /api/v1/support/instructions/<id>/` supports `language`, `helpGuideId`, `archived`, `withdrawn`; use only when requested. Archive preserves the film; withdrawal removes access. Do not delete content automatically.

## Failure handling

Do not automatically retry an uncertain video upload: it is not idempotent and there is no general API to list unattached uploads. Preserve the operation record and report uncertainty. Instruction publication is deduplicated by principal/tenant/request ID; read state before retrying and retain the identical payload. Stop on scope, role, codec, quota or storage errors; never fall back to public media, browser credentials, another tenant or database writes.
