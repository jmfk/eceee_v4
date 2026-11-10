---
name: eceee-instructional-video-scripts
description: Draft or revise Swedish instructional-video scripts for the ECEEE CMS, including scene narration, subtitle text, and screenshot capture requirements. Use when Codex is asked to plan or generate an ECEEE tutorial; it does not render video or operate the live site.
---

# ECEEE instructional video scripts

Create a reviewable script package for a requested ECEEE CMS workflow. The user can invoke this skill directly with `$eceee-instructional-video-scripts` or describe the tutorial they need.

## Workflow

1. Identify the user, task, and intended outcome from the request. If the topic is clear, proceed with sensible defaults: Swedish narration, concise training video, and the existing project folder structure. Ask only when a missing product decision would change the instructions materially.
2. Inspect the current ECEEE implementation and relevant repository documentation before describing behavior. Prefer the supported user-facing frontend and API flows. Treat visible labels, permissions, save/publish behavior, and state transitions as facts to verify; mark unresolved details for subject-matter review instead of inventing them.
3. Create or revise one folder per video under `docs/manus/instruktionsvideos/<video-slug>/`. Keep the spoken narration as the authoritative subtitle wording. Preserve the current conventions in neighboring video folders.
4. Give each scene a stable number and include what appears on screen, the exact narration/subtitle, and the supporting capture filename or a clear capture status. Keep scenes focused on one user action or decision.
5. Update that video's `screenshots/README.md` to map each scene to its view and narration. Use `captured`, `missing`, or `blocked` status accurately. Never create a fake image file or describe a planned view as an existing capture.
6. If a required view is unavailable or needs state changes, add a concrete item to `docs/manus/instruktionsvideos/shot-list-for-nattcapture.md`: environment, role, starting state, action/menu/dialog to show, and safe stopping state. Production capture is read-only; use an isolated staging/demo environment for mutations.
7. Update `docs/manus/instruktionsvideos/README.md` when adding a video or changing the package contents. Keep scene narration and subtitle text synchronized.

## Script conventions

- Use Swedish narration unless the user asks for another language. Preserve the application's English labels exactly when they appear in the UI, and explain them in Swedish.
- Include title, approximate duration, audience, purpose, preparation, scenes, and a short closing summary.
- Write narration for speech: clear sentences, direct verbs, one idea at a time. Avoid unsupported promises about permissions, save behavior, validation, publishing, or undo.
- Show before/after states only when they are genuinely available. Clearly distinguish a planned capture from an inspected or captured state.
- A proposed scene should not demonstrate a state-changing action on production data. If the current app view cannot safely demonstrate the action, mark it blocked and specify the staging capture needed.

## Boundaries

- This skill creates and edits Markdown script and capture-planning files. It does not generate voice audio, animate a browser, render/export video, or approve a final video; those belong to the separate production pipeline in [PRD-0049](../../../specs/prds/0049-instructional-video-production.md).
- Do not log in to or change a live site, create test records, approve proposals, publish, restore, or delete data as part of script generation. If the user separately requests screenshots or site operation, follow the current browser, login, and production safety instructions for that task.
- Keep screenshots, captured content, credentials, and private user data out of narration unless explicitly needed and safe for the intended audience.

## Project references

- [Video script index and capture status](../../../docs/manus/instruktionsvideos/README.md)
- [Night capture checklist](../../../docs/manus/instruktionsvideos/shot-list-for-nattcapture.md)
- [Video production PRD](../../../specs/prds/0049-instructional-video-production.md)
