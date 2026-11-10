---
id: PRD-0049
title: Instructional video production pipeline
status: draft
locked: false
created: 2026-11-10
related_adrs: []
---

# PRD-0049: Instructional video production pipeline

## Problem

ECEEE instructional content currently exists as Markdown scripts and a limited set of manually captured screenshots. Static images do not demonstrate pointer movement, menu navigation, dialogs, or the timing between a spoken instruction and the corresponding UI action. Producing narrated videos manually would also make revisions and consistent subtitles costly.

The team needs a repeatable workflow that turns each approved script into a faithful, Swedish-language walkthrough of the ECEEE CMS, with synchronized voice-over and visible subtitles. Missing UI states must be identified before capture, especially when a view is unavailable in production or requires test data.

## Goals

- Produce a reviewable animation preview for each approved instructional video.
- Show the actual ECEEE application UI while animating pointer movement, clicks, focus, menus, dialogs, and relevant areas.
- Generate Swedish voice-over with ElevenLabs and synchronize visible subtitles to the spoken text.
- Require human approval of the preview before generating the final video.
- Save the approved video and its supporting assets beside the corresponding Markdown script.
- Keep production content unchanged and use sanitized staging data for demonstrations that require mutations.
- Make missing screenshots and unavailable UI states explicit in a per-video capture checklist.

## Non-Goals

- Build an in-product video editor or a public video hosting/player feature.
- Automatically publish videos to a website, social network, or external media service.
- Generate instructional scripts without human review.
- Recreate the CMS interface as a mock UI when the actual site can be recorded.
- Perform create, edit, approve, publish, restore, or delete actions against production data during recording.
- Guarantee that every theme or workflow can be recorded before its product UI is available and functioning.

## Users and Use Cases

- **Documentation author:** invokes the repository skill from Codex to draft or revise a Swedish video script and a traceable capture checklist for an ECEEE workflow.
- **Documentation producer:** selects a Markdown script, reviews its scene plan, generates a preview, approves it, and exports the final video.
- **CMS subject-matter reviewer:** checks that each UI action and explanation matches current product behavior.
- **Accessibility reviewer:** checks subtitle readability, language, and timing.
- **Maintainer:** updates a scene when the UI changes and regenerates only the affected preview and final video.

## Requirements

### Codex manuscript generation skill

- The repository provides an auto-discoverable Codex skill named `eceee-instructional-video-scripts`, invokable as `$eceee-instructional-video-scripts` while the project is open.
- Given a workflow or feature, the skill inspects current ECEEE implementation and project docs, then creates or revises one Swedish Markdown script folder per video.
- Each scene carries narration that is also the authoritative subtitle text and maps to a real screenshot or an explicit missing/blocked capture requirement.
- Each Swedish production scene has Swedish narration, an executable Playwright action, and an expected UI state assertion. English narration is optional and can be added as a separate locale.
- The skill records unavailable views and state-changing capture needs in the shared capture checklist; it must not invent UI states or mutate production data.
- When asked to produce videos, the skill simulates the full Playwright flow before recording, generates voice-backed localized previews, waits for human preview approval, then exports final MP4 files.

### Private instruction library publication skill

- The repository provides `$eceee-instructional-video-publisher` for approved videos in the private Inbox instruction library, not the public CMS Media library.
- Upload uses `POST /api/v1/support/videos/` with `purpose=instruction`; publication is a separate authorized `POST /api/v1/support/instructions/` with language, canonical `helpGuideId` and plain transcript.
- Publication requires key scopes plus the existing publisher role and may create Inbox/email notifications for tenant members. Uploading alone is not publication approval.
- Markdown manuscripts and VTT sidecars remain source/local artifacts; the current instruction API has no arbitrary manuscript/PDF upload or private subtitle-track field.
- Every production operation identifies exact file, endpoint, tenant, publication/notification effects and recovery limits before acting. Do not silently transcode, replace, delete, or retry uncertain non-idempotent uploads.
- Verify the published instruction metadata and authorized private playback, without exposing signed URLs.

### Scene source and traceability

- Each video has one Markdown script with an embedded `video-script` scene/action manifest in its video folder.
- The embedded manifest maps each scene to Swedish narration, optional English narration, page or route, visible UI state, browser actions, pointer/highlight animation, screenshot references, and subtitle text.
- Scene identifiers remain stable so a changed scene can be regenerated without renumbering unrelated assets.
- Existing screenshots may be used as references or static inserts. A live browser capture is preferred for interactions and state transitions.
- Missing or blocked UI states are recorded in the scene manifest or linked capture checklist; the pipeline must not silently fabricate an unavailable state.

### Browser animation and recording

- Record the ECEEE CMS viewport at a consistent 16:9 aspect ratio and a target resolution of 1920×1080 when supported by the target environment.
- Render the real application UI in a controlled browser session. Support visible pointer movement, click indication, focus/highlight, short pauses, scrolling, and scene/chapter transitions.
- Browser actions use accessible UI locators where available and verify the expected route and visible state before the scene is accepted.
- A preview can be rendered with provisional voice-over and subtitles for review.
- Recording is deterministic enough that rerunning an unchanged scene produces the same sequence of UI states, subject to approved test data.
- If the required application state cannot be reached, mark the scene blocked and report the specific missing state instead of substituting an unrelated screen.
- Before voice generation or recording, simulate every locator, navigation, and expected state without video capture. Stop at the first failed action; never create a partial video by skipping the failed step.
- The production flow supports Swedish `-sv` output by default and optional English `-en` output from localized captions and voices. It must not silently substitute a system voice when ElevenLabs generation fails.
- Each spoken beat may place its associated click at a configurable point within the audio clip, followed by a configurable silent pause of 1–3 seconds before the next narration.

### Voice-over and subtitles

- Generate narration in Swedish using an approved ElevenLabs voice/model configuration.
- Cache each generated narration MP3 using the exact text, voice, model, language, output format, and voice settings so unchanged audio is reused across preview and final renders. Keep the cache local and out of Git.
- Keep narration text authoritative in the Markdown script or scene manifest; generated audio must be traceable to that exact text and voice configuration.
- Support pronunciation guidance for product names, English UI labels, and specialist terms.
- Produce visible, synchronized subtitles in the final video and a separate WebVTT sidecar file.
- Subtitles use readable phrase-level segments, normally no more than two lines at once, and do not obscure the UI control being discussed.
- The pipeline supports timestamped speech output or forced alignment to calculate subtitle timing.
- Re-rendering a scene after narration changes must regenerate its audio and subtitle timings.

### Approval and final export

- Preview approval is an explicit human step before final video export.
- The approval view includes the animation, final Swedish narration, subtitles, and the script text used to generate them.
- The final export is an MP4 containing the browser animation, Swedish narration, and visible subtitles.
- Save the MP4 and WebVTT in the video’s output folder. Keep reusable ElevenLabs narration MP3s in the local ignored audio cache; keep the scene manifest in the Markdown script.
- A final export records the approved script/scene revision and generation configuration so later edits can be compared with the released version.

### Safety, privacy, and operations

- Production capture is read-only. No state-changing action may be executed against production during a recording run.
- Use staging or another explicitly isolated test environment for object creation, tag proposal/review, Designer changes, publishing, undo, or any other state-changing demonstration.
- Use sanitized demo content and accounts; do not record secrets, private contact data, unpublished customer content, browser notifications, or unrelated desktop applications.
- Store ElevenLabs credentials in the approved secret mechanism. Never write API keys into source files, manifests, logs, or recorded content.
- Report a failed browser action, missing test fixture, voice generation error, subtitle alignment error, or export failure against the specific video and scene.
- Keep an audit trail of preview approval and the final output file identity; do not overwrite an approved final video without a new approval.

## Acceptance Criteria

- [ ] A user can invoke `$eceee-instructional-video-scripts` from Codex in this repository and receive a per-video Markdown script and scene-to-capture register.
- [ ] Generated scene narration and subtitle text match, and unavailable views are marked missing or blocked with a concrete capture request.
- [ ] The skill does not claim to render audio/video or perform state-changing site actions.
- [ ] An approved final video can be uploaded to private support storage and separately published in the instruction library with language/help association after its exact operation and notification effects are authorized.
- [ ] Unsupported or oversized files are reported without implicit conversion, replacement, or retry.
- [ ] A pilot Publisher video can be built from its Markdown script and scene manifest without manually clicking through each scene.
- [ ] The preview shows the actual ECEEE UI, animated pointer/clicks, and the requested menus/dialogs for every unblocked scene.
- [ ] A non-recording Playwright simulation passes for every scene before TTS or recording begins; a failed action stops the run.
- [ ] A Swedish preview has a `-preview-sv` filename, Swedish voice track, and synchronized VTT subtitles; an English preview is optional when requested.
- [ ] Each configured scene pause is silent and lasts 1–3 seconds; clicks can be aligned to a position within that scene's narration audio.
- [ ] The Swedish final uses the `-sv` suffix and cannot be generated before explicit preview approval; an English final is optional when requested.
- [ ] Re-running an unchanged Swedish scene with the same voice configuration reuses its cached ElevenLabs MP3 without another provider request.
- [ ] Each scene verifies its expected route and UI state before capture; a failed assertion prevents that scene from being marked ready.
- [ ] A reviewer can play the complete preview with Swedish voice-over and synchronized visible subtitles before approval.
- [ ] Final MP4 export is unavailable until the preview is explicitly approved.
- [ ] The final MP4 plays with narration and visible subtitles, and the companion VTT loads with matching timing.
- [ ] Regenerating one changed scene does not silently alter other approved scenes.
- [ ] An attempted production mutation is blocked by configuration or fails closed before the action is executed.
- [ ] Staging workflows for proposals, Designer, and publishing use documented sanitized fixtures and account roles.
- [ ] All outputs for a video are discoverable in that video’s folder and reference the approved script/scene revision.

## Constraints

- The CMS frontend is React/TypeScript and already declares Playwright in `frontend/package.json`; the production browser automation should align with the TypeScript application toolchain unless implementation evidence shows a concrete reason otherwise.
- Designer details and proposal-review states may be unavailable in production. Their videos depend on a working Designer workspace and/or controlled staging fixtures.
- ElevenLabs is an external service. Voice generation requires secure credential handling, network availability, a selected voice, and approval of the associated usage/cost before large-scale generation.
- A final 1080p render depends on the browser, display scale, fonts, and source assets being available in the render environment; the pipeline must detect and report missing dependencies rather than silently upscaling an incomplete capture.

## Implementation Notes

- Script generation is delivered as the project skill at `.agents/skills/eceee-instructional-video-scripts/`; keep its generation rules aligned with the formats under `docs/manus/instruktionsvideos/`.
- Playwright implementation is in `frontend/scripts/generate-howto-video.mjs`. It reads a scene action block from Markdown, preflights the sequence without recording, records the real viewport, aligns segmented voiceover and captions, and muxes MP4/VTT outputs. The Codex skill documents the local per-video invocation and approval gate.
- Generate or align voice-over per scene, derive phrase-level WebVTT captions, and mux the browser recording and audio into MP4 after approval.
- Start with the Publisher walkthrough as the end-to-end pilot because its current production UI states are available read-only. Use staging for all mutations.
- Record implementation decisions about browser capture, timing format, subtitle rendering, voice selection, and approval storage in ADRs when implementation begins.

## Linked ADRs

- None yet

## Related Materials

- [Codex script-generation skill](../../.agents/skills/eceee-instructional-video-scripts/SKILL.md)
- [Instructional video scripts and screenshots](../../docs/manus/instruktionsvideos/README.md)
- [Supplemental screenshot capture list](../../docs/manus/instruktionsvideos/shot-list-for-nattcapture.md)

## Completion Evidence

- None yet
