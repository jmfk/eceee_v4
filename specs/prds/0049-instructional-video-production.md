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

- **Documentation producer:** selects a Markdown script, reviews its scene plan, generates a preview, approves it, and exports the final video.
- **CMS subject-matter reviewer:** checks that each UI action and explanation matches current product behavior.
- **Accessibility reviewer:** checks subtitle readability, language, and timing.
- **Maintainer:** updates a scene when the UI changes and regenerates only the affected preview and final video.

## Requirements

### Scene source and traceability

- Each video has one Markdown script and one scene manifest in its video folder.
- The manifest maps each scene to its narration, page or route, visible UI state, browser actions, pointer/highlight animation, screenshot references, and subtitle text.
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

### Voice-over and subtitles

- Generate narration in Swedish using an approved ElevenLabs voice/model configuration.
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
- Save the MP4, WebVTT, narration audio, scene manifest, and any retained source captures in the video’s output folder.
- A final export records the approved script/scene revision and generation configuration so later edits can be compared with the released version.

### Safety, privacy, and operations

- Production capture is read-only. No state-changing action may be executed against production during a recording run.
- Use staging or another explicitly isolated test environment for object creation, tag proposal/review, Designer changes, publishing, undo, or any other state-changing demonstration.
- Use sanitized demo content and accounts; do not record secrets, private contact data, unpublished customer content, browser notifications, or unrelated desktop applications.
- Store ElevenLabs credentials in the approved secret mechanism. Never write API keys into source files, manifests, logs, or recorded content.
- Report a failed browser action, missing test fixture, voice generation error, subtitle alignment error, or export failure against the specific video and scene.
- Keep an audit trail of preview approval and the final output file identity; do not overwrite an approved final video without a new approval.

## Acceptance Criteria

- [ ] A pilot Publisher video can be built from its Markdown script and scene manifest without manually clicking through each scene.
- [ ] The preview shows the actual ECEEE UI, animated pointer/clicks, and the requested menus/dialogs for every unblocked scene.
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

- Initial implementation recommendation: TypeScript with Playwright browser automation and browser-viewport screencast, using small, scene-oriented manifests. A macOS full-desktop screen recording is not required for normal CMS UI captures.
- Generate or align voice-over per scene, derive phrase-level WebVTT captions, and mux the browser recording and audio into MP4 after approval.
- Start with the Publisher walkthrough as the end-to-end pilot because its current production UI states are available read-only. Use staging for all mutations.
- Record implementation decisions about browser capture, timing format, subtitle rendering, voice selection, and approval storage in ADRs when implementation begins.

## Linked ADRs

- None yet

## Related Materials

- [Instructional video scripts and screenshots](../../docs/manus/instruktionsvideos/README.md)
- [Supplemental screenshot capture list](../../docs/manus/instruktionsvideos/shot-list-for-nattcapture.md)

## Completion Evidence

- None yet
