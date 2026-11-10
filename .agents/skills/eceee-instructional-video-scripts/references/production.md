# ECEEE instructional video production

Use this workflow when the user asks for a rendered video, not when they ask only for a manuscript.

## 1. Prepare an executable scene flow

Keep the Swedish narration authoritative in `manus.md`. Set `helpGuideId` in frontmatter to an existing source-owned help article; run `npm run howto:check` from `frontend/` before rendering. English is optional: add `captionEn` only when the English locale is requested. Add a fenced `video-script` JSON array in the same Markdown file; this is the single executable scene/action list read by both the Markdown parser and Playwright renderer. Add frontmatter `id`, `title`, `summary`, and `sectionId`; `id` must match the video slug. Each array entry is one narrated beat and one Playwright action. Put `captionSv` directly on every action; the renderer requires only the caption for its selected language. Captions must match the scene narration. Use `captureStatus: "ready"` only after verifying the view and locator; use `"missing"` or `"blocked"` when prerequisites are not met. Any missing/blocked scene makes the guide unrecordable, and the renderer stops before browser interaction or voice generation. Add separate assertion entries (`assertVisible`, `assertHidden`, or `waitForText`) after meaningful transitions. The first `goto` establishes the opening screen and is preloaded before narrated actions; its caption must describe the visible starting screen, not a click that will not be shown.

Example beat:

```video-script
[
  {
    "scene": 1,
    "captureStatus": "ready",
    "type": "goto",
    "path": "/media",
    "captionSv": "I mediabiblioteket börjar vi med att välja bilden som ska användas.",
    "captionEn": "In the media library, we start by choosing the image to use.",
    "actionAtFraction": 0.72,
    "postNarrationPauseMs": 1500
  },
  {
    "scene": 2,
    "captureStatus": "ready",
    "type": "click",
    "role": "button",
    "name": "Choose focus point",
    "captionSv": "Öppna fokuspunktens inställningar.",
    "captionEn": "Open the focus point settings.",
    "actionAtFraction": 0.68,
    "postNarrationPauseMs": 1800
  },
  {
    "type": "assertVisible",
    "role": "heading",
    "name": "Choose image focus",
    "captionSv": "Kontrollera att dialogen för fokuspunkt öppnas.",
    "captionEn": "Confirm that the focus point dialog opens.",
    "postNarrationPauseMs": 1200
  }
]
```

`actionAtFraction` places the action within the generated speech clip: `0` is when speech starts and `1` is when it ends. Tune this from the preview so the narration introduces the action before the cursor clicks. The `postNarrationPauseMs` value is a silent 1000–3000 ms teaching pause before the next spoken beat.

For Swedish-only production, run with `--language sv --language-suffix --preview`; the selected locale produces only `-preview-sv.mp4` and its VTT. English is a separate optional pass with English scene captions and the English voice configured.

Do not invent locators. Inspect the current UI code or a live, authorized browser session and use stable accessible roles, labels, test IDs, and exact visible states. Supported locator fields are `selector`, `selectors`, `label`, `placeholder`, `role` + `name`, and `text`. Put a visible-state assertion after opening a menu/dialog and after any action that changes the view. A sequence with a failed locator or assertion is not recordable.

## 2. Simulate before spending voice credits

Use the repository's existing Playwright tool from `frontend/` with `--docs-dir` set to the video's folder and `--guide <slug>`. Run `--simulate-only` first. It loads the real site, drives the exact action sequence, and stops at the first failure without recording or generating voice. For authenticated browser work, use the user's regular Chrome profile for login and 1Password/MFA. Never ask for a password in Playwright or print/read browser storage state; resume only with an already approved Playwright storage-state file. If no safe authorized state exists, stop and explain the setup needed.

Simulation is browser interaction, not a harmless static dry run. Keep production strictly read-only. Run any create/edit/save/publish/undo demonstration only in a documented, sanitized staging fixture that can be restored to its starting state before recording. The pipeline simulates again before every recording; reset mutable fixtures between simulation and recording.

## 3. Create localized, narrated previews

Run the action flow for the requested locale, Swedish by default. Use ElevenLabs for every beat; require generated audio so a missing voice or denied API request stops the run. The script loads `.env` internally without printing values. It recognizes `ELEVENLABS_VOICE_ID_SWE` / `ELEVENLABS_VOICE_ID_SV` and `ELEVENLABS_VOICE_ID_ENG` / `ELEVENLABS_VOICE_ID_EN`.

Example Swedish preview (replace paths/URL with the authorized environment):

```sh
cd frontend
VIDEO_SLUG="my-tutorial"
VIDEO_BASE_URL="https://your-authorized-staging-host"
VIDEO_AUTH_STATE="../.auth/approved-storage-state.json"
VIDEO_DIR="../docs/manus/instruktionsvideos/${VIDEO_SLUG}/video"
node scripts/generate-howto-video.mjs \
  --docs-dir "../docs/manus/instruktionsvideos/${VIDEO_SLUG}" --guide "${VIDEO_SLUG}" \
  --base-url "${VIDEO_BASE_URL}" --storage-state "${VIDEO_AUTH_STATE}" \
  --output-dir "${VIDEO_DIR}" --public-dir "${VIDEO_DIR}" \
  --work-dir "/private/tmp/eceee-video-work/${VIDEO_SLUG}/sv" \
  --audio-cache-dir "howto-audio-cache" \
  --language sv --language-suffix --preview --voice elevenlabs --require-voice \
  --format mp4 --cursor --no-context --post-narration-pause-ms 1500
```

`frontend/howto-audio-cache/` is the persistent, git-ignored ElevenLabs cache. Cache keys include the exact narration text, selected voice, model, language, output format, and voice settings. Re-running an unchanged Swedish beat with the same configuration reuses its MP3; edited text or a changed voice/configuration generates a new cache entry. The renderer copies cached audio into the per-run work directory before muxing. `--language-suffix --preview` creates `<slug>-preview-sv.mp4` and `.vtt`. The final approved Swedish file is `<slug>-sv.mp4`. Add a second `--language en` pass only when English is needed. Keep `--public-dir` equal to `--output-dir` so this local recording does not copy into the CMS help site's public asset folder.

The renderer records the real Playwright viewport with visible cursor/click feedback, plays each generated narration clip against its action, holds silence for the configured 1–3 seconds, burns captions into the MP4, and writes a matching WebVTT sidecar. Captions end with the spoken clip; the silent pause has no subtitle. Any failed action or missing voice stops the run. Never treat a WebM without voice or a still-image slideshow as a finished tutorial.

## 4. Review, adjust, and export

Review the requested preview MP4 and VTT. For Swedish-only delivery, check the route/state, cursor and clicks, narration timing, silent pauses, Swedish voice, and subtitle/audio match. Adjust the manifest and regenerate only previews until the user approves them.

Only after explicit user approval, rerun the same flow without `--preview` and add `--final-approved`. This generates local `<slug>-sv.mp4`; add an English pass only if it was requested. The generator refuses to overwrite an existing locale final unless `--replace-final` is also passed after the user approves replacing that specific file. Report the preview and final paths. Uploading remains a separate skill and requires its own operation-specific authorization.

## 5. Output and failure states

Keep final MP4s, VTTs, scene register, and voice/recording manifests in the video's `video/` folder. Keep cache/work assets outside the manuscript package unless a reviewer requests them. Do not commit `.env`, browser storage state, voice credentials, or auth artifacts.

If the simulation fails, fix the procedure, locator, fixture, or expected state and simulate again. If ElevenLabs denies the selected voice or voice generation fails, stop and report the provider's bounded error; do not silently fall back to macOS speech. Do not render a partial/incorrect video after a missing scene or failed Playwright action.

## 6. Link and publish the approved result

Run `npm run howto:check -- --require-previews` to verify help IDs and local preview MP4/VTT/narration manifests. After preview review and final export, use `$eceee-instructional-video-publisher` for a separately authorized private instruction-library publication. Preserve the final MP4, VTT and source manuscript; publish `helpGuideId`, language and plain transcript with the private video ID. The library does not accept arbitrary Markdown/PDF/VTT files or a private caption-track resource. Public `/media/upload/` is not the instruction destination.
