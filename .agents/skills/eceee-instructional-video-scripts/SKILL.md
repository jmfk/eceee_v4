---
name: eceee-instructional-video-scripts
description: Create ECEEE instructional video packages and produce localized, voice-synchronized Playwright recordings from the real CMS. Use when Codex is asked to draft, animate, voice, subtitle, review, or export a tutorial.
---

# ECEEE instructional video scripts

Create a reviewable script package and, when requested, produce synchronized video previews from a requested ECEEE CMS workflow. The user can invoke this skill directly with `$eceee-instructional-video-scripts` or describe the tutorial they need.

## Workflow

1. Identify the user, task, and intended outcome from the request. If the topic is clear, proceed with sensible defaults: Swedish narration, concise training video, and the existing project folder structure. Ask only when a missing product decision would change the instructions materially.
2. Inspect the current ECEEE implementation and relevant repository documentation before describing behavior. Prefer the supported user-facing frontend and API flows. Treat visible labels, permissions, save/publish behavior, and state transitions as facts to verify; mark unresolved details for subject-matter review instead of inventing them.
3. Create or revise one folder per video under `docs/manus/instruktionsvideos/<video-slug>/`. Keep the spoken narration as the authoritative subtitle wording. Preserve the current conventions in neighboring video folders.
4. Give each scene a stable number and include the exact Swedish narration/subtitle, Playwright actions, expected state assertions, and a clear capture status. English narration is optional and can be added as a separate locale later. Keep each narrated beat focused on one user action or decision.
5. Update that video's `screenshots/README.md` to map each scene to its view and narration. Use `captured`, `missing`, or `blocked` status accurately. Never create a fake image file or describe a planned view as an existing capture.
6. If a required view is unavailable or needs state changes, add a concrete item to `docs/manus/instruktionsvideos/shot-list-for-nattcapture.md`: environment, role, starting state, action/menu/dialog to show, and safe stopping state. Production capture is read-only; use an isolated staging/demo environment for mutations.
7. Update `docs/manus/instruktionsvideos/README.md` when adding a video or changing the package contents. Keep scene narration and subtitle text synchronized.
8. When video production is requested, use the Playwright production workflow in [references/production.md](references/production.md). Simulate the full procedure first, then create a Swedish voice-backed `-preview-sv.mp4` and matching VTT subtitle. Create an English preview only when English captions and an English voice are requested. Stop if an action, expected state, or voice generation fails.
9. Ask the user to review the preview before creating final `-sv.mp4` output. Never mark a preview as final or overwrite a prior final without approval.

## Script conventions

- Write the master narration in Swedish. Add a faithful English version only when the English locale is requested. Preserve the application's English labels exactly when they appear in the UI, and explain them in the narration language.
- Include title, approximate duration, audience, purpose, preparation, scenes, and a short closing summary.
- Write narration for speech: clear sentences, direct verbs, one idea at a time. Avoid unsupported promises about permissions, save behavior, validation, publishing, or undo.
- Show before/after states only when they are genuinely available. Clearly distinguish a planned capture from an inspected or captured state.
- A proposed scene should not demonstrate a state-changing action on production data. If the current app view cannot safely demonstrate the action, mark it blocked and specify the staging capture needed.

## Boundaries

- This skill can generate audio-backed Playwright previews and final local MP4s through the repository pipeline. It does not upload, approve, attach, or publish videos to the CMS; use the separate publisher skill for an explicitly requested upload.
- Do not log in to or change a live site, create test records, approve proposals, publish, restore, or delete data as part of script generation. If the user separately requests screenshots or site operation, follow the current browser, login, and production safety instructions for that task.
- Keep screenshots, captured content, credentials, and private user data out of narration unless explicitly needed and safe for the intended audience.
- Never fall back to still-image slides or silent speech if Playwright, ElevenLabs, or muxing fails. Report the blocked stage and keep its output marked as a preview or incomplete.

## Help and private library association

Use `$eceee-help-authoring` to select a stable existing help article and set `helpGuideId` in the manuscript frontmatter. Run `cd frontend && npm run howto:check`; after rendering, add `-- --require-previews`. The renderer records that help ID, language and preview status in its JSON manifest. Publication targets the private Inbox instruction library through `$eceee-instructional-video-publisher`, not public CMS Media. Change Notes remain a separate proposed release feature; see [the surface map](../../../docs/cms-learning-and-collaboration.md).

## Video production

For real-site capture, simulation, voice synchronization, pauses, language naming, preview review, and final export, follow [references/production.md](references/production.md). The production renderer is `frontend/scripts/generate-howto-video.mjs`; `docs/manus/instruktionsvideos/render_videos.py` creates still-image previews and is not a substitute for a real-site recording.

## Project references

- [Video script index and capture status](../../../docs/manus/instruktionsvideos/README.md)
- [Night capture checklist](../../../docs/manus/instruktionsvideos/shot-list-for-nattcapture.md)
- [Video production PRD](../../../specs/prds/0049-instructional-video-production.md)
