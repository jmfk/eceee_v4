---
name: eceee-help-authoring
description: Create and maintain ECEEE source-owned contextual help, its video manuscripts and article associations, and route release notes to the supported release workflow. Use for help content consolidation rather than CMS media uploads.
---

# ECEEE help authoring

Read [the learning surface map](../../../docs/cms-learning-and-collaboration.md). Keep one source of truth per concern:

- `frontend/src/docs/how-to/**/*.md`: canonical task-oriented help article, stable `id` and `sectionId`, steps and explanatory copy. Vite compiles these files through `src/data/howToDocs.js`; changing a production article requires a reviewed code release.
- `frontend/src/docs/how-to-translations/sv/**/*.md`: Swedish translation with matching guide identity. Preserve source/translation metadata; do not create a second unrelated article merely to translate it.
- `docs/manus/instruktionsvideos/<slug>/manus.md`: authoritative narration, executable `video-script` and stable `helpGuideId` referring to an existing article. Several films may belong to one help article. Keep narration, assertions, capture status and source language accurate.
- `video/<slug>-preview-sv.mp4`, VTT and JSON: generated review artifacts. They are not article sources or publication approval. Use `$eceee-instructional-video-scripts` for Playwright/ElevenLabs rendering, cache and final-approval rules. Do not use the historical still-image Python renderer for current tutorials.
- Private instruction library: approved video publication metadata, plain transcript, language and canonical `helpGuideId`. Use `$eceee-instructional-video-publisher`. Existing `HelpInstructionVideos` retrieves these private films per tenant/guide/language; signed playback URLs never belong in Markdown.
- Release Change Notes: use `$eceee-cms-release-change-notes`. PRD-0050 is a proposed resource/gate, not an implemented CMS endpoint. Prepare release-specific drafts/evidence in source until that feature exists; do not substitute a help article or media-file version note.

Before editing, inspect the actual UI behavior and article parser. Preserve stable IDs because contextual links and published instructions depend on them. Put lasting task instructions in help, action/narration timing in the manuscript, and release-specific before/after changes in Change Notes. Link between them instead of copying complete content across systems. The script editor and generator share the Markdown parser; preserve `helpGuideId`, locale captions and audio metadata through editing.

Run `cd frontend && npm run howto:check` after manuscript/help changes. Add `-- --require-previews` for local delivery after rendering. Run focused parser/script-editor/help tests for behavioral changes. Production capture remains read-only; mutable demonstrations require isolated fixtures. Report exactly what is source-only, generated, approved, published or still missing. Never mark mock-data footage as proof that production behavior works.
