import { chromium } from 'playwright'
import { mkdir, readdir, readFile, copyFile, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseHowToMarkdownCollection } from '../src/utils/howToMarkdown.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(__dirname, '..')
const recordingTempDirName = '.recording-tmp'
const defaultHelpVideoLanguage = 'sv'
const defaultAnthropicTranslationModel = 'claude-3-5-haiku-20241022'
const defaultAnthropicTranslationFallbackModels = [
  'claude-3-5-haiku-latest',
  'claude-3-haiku-20240307'
]

const getEnvVoiceIdForLanguage = (language = '') => {
  const normalized = language.toLowerCase()

  if (normalized === 'sv' || normalized.startsWith('sv-') || normalized === 'swe' || normalized === 'swedish') {
    return process.env.ELEVENLABS_VOICE_ID_SWE || process.env.ELEVENLABS_VOICE_ID_SV || ''
  }

  if (normalized === 'en' || normalized.startsWith('en-') || normalized === 'eng' || normalized === 'english') {
    return process.env.ELEVENLABS_VOICE_ID_ENG || process.env.ELEVENLABS_VOICE_ID_EN || ''
  }

  return ''
}

const parseArgs = (argv) => {
  const args = {
    baseUrl: process.env.HOWTO_BASE_URL || 'http://127.0.0.1:3100',
    outputDir: process.env.HOWTO_OUTPUT_DIR || '',
    publicDir: process.env.HOWTO_PUBLIC_DIR || '',
    docsDir: process.env.HOWTO_DOCS_DIR || join(frontendRoot, 'src/docs/how-to'),
    workDir: process.env.HOWTO_WORK_DIR || '',
    recordingTempDir: '',
    width: Number(process.env.HOWTO_VIDEO_WIDTH || 1440),
    height: Number(process.env.HOWTO_VIDEO_HEIGHT || 900),
    headless: process.env.HEADED !== '1',
    guideId: '',
    topicId: '',
    storageState: process.env.HOWTO_AUTH_STATE || '',
    mockApi: process.env.HOWTO_MOCK_API === '1',
    cleanBrowserState: process.env.HOWTO_CLEAN_BROWSER_STATE !== '0',
    overlayCaptions: process.env.HOWTO_NO_OVERLAY !== '1',
    all: false,
    format: process.env.HOWTO_VIDEO_FORMAT || 'webm',
    ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
    voiceProvider: process.env.HOWTO_VOICE_PROVIDER || '',
    language: process.env.HOWTO_LANGUAGE || defaultHelpVideoLanguage,
    voiceId: process.env.HOWTO_VOICE_ID || '',
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
    elevenLabsModelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
    elevenLabsOutputFormat: process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128',
    elevenLabsMaxRetries: Number(process.env.ELEVENLABS_MAX_RETRIES || 3),
    audioCacheDir: process.env.HOWTO_AUDIO_CACHE_DIR || join(frontendRoot, 'howto-audio-cache'),
    translationProvider: process.env.HOWTO_TRANSLATION_PROVIDER || '',
    translationModel: process.env.HOWTO_TRANSLATION_MODEL || defaultAnthropicTranslationModel,
    translationModelFallbacks: (process.env.HOWTO_TRANSLATION_MODEL_FALLBACKS || defaultAnthropicTranslationFallbackModels.join(','))
      .split(',')
      .map(model => model.trim())
      .filter(Boolean),
    translationFallback: process.env.HOWTO_TRANSLATION_FALLBACK || 'original',
    translationCacheDir: process.env.HOWTO_TRANSLATION_CACHE_DIR || join(frontendRoot, 'howto-translation-cache'),
    narrationPaddingMs: Number(process.env.HOWTO_NARRATION_PADDING_MS || 1200),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    anthropicVersion: process.env.ANTHROPIC_VERSION || '2023-06-01',
    openAiApiKey: process.env.OPENAI_API_KEY || '',
    listVoices: false,
    voiceSearch: process.env.HOWTO_VOICE_SEARCH || '',
    voiceType: process.env.HOWTO_VOICE_TYPE || '',
    voiceCategory: process.env.HOWTO_VOICE_CATEGORY || '',
    voicePageSize: Number(process.env.HOWTO_VOICE_PAGE_SIZE || 20),
    segmentedNarration: process.env.HOWTO_SEGMENTED_NARRATION !== '0',
    sfx: process.env.HOWTO_SFX === '1',
    cursor: process.env.HOWTO_CURSOR !== '0',
    contextSegments: process.env.HOWTO_CONTEXT_SEGMENTS !== '0',
    contextHoldMs: Number(process.env.HOWTO_CONTEXT_HOLD_MS || 1800),
    requireActionableSteps: process.env.HOWTO_ALLOW_PASSIVE_GUIDES !== '1' && process.env.HOWTO_REQUIRE_ACTIONABLE_STEPS !== '0',
    minActionableSteps: Number(process.env.HOWTO_MIN_ACTIONABLE_STEPS || 1),
    narrationActionLeadMs: Number(process.env.HOWTO_NARRATION_ACTION_LEAD_MS || 300),
    postActionHoldMs: Number(process.env.HOWTO_POST_ACTION_HOLD_MS || 250),
    actionTimeoutMs: Number(process.env.HOWTO_ACTION_TIMEOUT_MS || 10000),
    globalHoldMs: Number(process.env.HOWTO_GLOBAL_HOLD_MS || 0),
    noVoicePreHoldMs: Number(process.env.HOWTO_NO_VOICE_PRE_HOLD_MS || 250),
    noVoiceHoldMs: Number(process.env.HOWTO_NO_VOICE_HOLD_MS || 650),
    cutPageLoad: process.env.HOWTO_CUT_PAGE_LOAD !== '0',
    trimInitialLoad: process.env.HOWTO_TRIM_INITIAL_LOAD !== '0',
    initialLoadTrimThresholdMs: Number(process.env.HOWTO_INITIAL_LOAD_TRIM_THRESHOLD_MS || 1500),
    typingDelayMs: Number(process.env.HOWTO_TYPING_DELAY_MS || 75),
    pointerMoveMs: Number(process.env.HOWTO_POINTER_MOVE_MS || 650),
    help: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--base-url') args.baseUrl = next
    if (arg === '--output-dir') args.outputDir = next
    if (arg === '--public-dir') args.publicDir = next
    if (arg === '--docs-dir') args.docsDir = next
    if (arg === '--work-dir') args.workDir = next
    if (arg === '--topic') args.topicId = next
    if (arg === '--guide') args.guideId = next
    if (arg === '--storage-state') args.storageState = next
    if (arg === '--headed') args.headless = false
    if (arg === '--mock-api') args.mockApi = true
    if (arg === '--clean-browser-state') args.cleanBrowserState = true
    if (arg === '--keep-browser-state') args.cleanBrowserState = false
    if (arg === '--no-overlay') args.overlayCaptions = false
    if (arg === '--all') args.all = true
    if (arg === '--format') args.format = next
    if (arg === '--ffmpeg') args.ffmpegPath = next
    if (arg === '--voice') args.voiceProvider = next
    if (arg === '--language') args.language = next
    if (arg === '--voice-id') args.voiceId = next
    if (arg === '--model-id') args.elevenLabsModelId = next
    if (arg === '--audio-cache-dir') args.audioCacheDir = next
    if (arg === '--translate') args.translationProvider = next && !next.startsWith('--') ? next : 'anthropic'
    if (arg === '--no-translate') args.translationProvider = ''
    if (arg === '--translation-model') args.translationModel = next
    if (arg === '--translation-model-fallbacks') {
      args.translationModelFallbacks = (next || '').split(',').map(model => model.trim()).filter(Boolean)
    }
    if (arg === '--translation-fallback') args.translationFallback = next
    if (arg === '--translation-cache-dir') args.translationCacheDir = next
    if (arg === '--narration-padding-ms') args.narrationPaddingMs = Number(next)
    if (arg === '--list-voices') args.listVoices = true
    if (arg === '--voice-search') args.voiceSearch = next
    if (arg === '--voice-type') args.voiceType = next
    if (arg === '--voice-category') args.voiceCategory = next
    if (arg === '--voice-page-size') args.voicePageSize = Number(next)
    if (arg === '--elevenlabs-max-retries') args.elevenLabsMaxRetries = Number(next)
    if (arg === '--segmented-narration') args.segmentedNarration = true
    if (arg === '--linear-narration') args.segmentedNarration = false
    if (arg === '--sfx') args.sfx = true
    if (arg === '--no-sfx') args.sfx = false
    if (arg === '--cursor') args.cursor = true
    if (arg === '--no-cursor') args.cursor = false
    if (arg === '--context') args.contextSegments = true
    if (arg === '--no-context') args.contextSegments = false
    if (arg === '--context-hold-ms') args.contextHoldMs = Number(next)
    if (arg === '--require-actionable-steps') args.requireActionableSteps = true
    if (arg === '--allow-passive-guides') args.requireActionableSteps = false
    if (arg === '--min-actionable-steps') args.minActionableSteps = Number(next)
    if (arg === '--narration-action-lead-ms') args.narrationActionLeadMs = Number(next)
    if (arg === '--post-action-hold-ms') args.postActionHoldMs = Number(next)
    if (arg === '--action-timeout-ms') args.actionTimeoutMs = Number(next)
    if (arg === '--global-hold-ms') args.globalHoldMs = Number(next)
    if (arg === '--no-voice-pre-hold-ms') args.noVoicePreHoldMs = Number(next)
    if (arg === '--no-voice-hold-ms') args.noVoiceHoldMs = Number(next)
    if (arg === '--cut-page-load') args.cutPageLoad = true
    if (arg === '--keep-page-load') args.cutPageLoad = false
    if (arg === '--trim-initial-load') args.trimInitialLoad = true
    if (arg === '--keep-initial-load') args.trimInitialLoad = false
    if (arg === '--initial-load-trim-threshold-ms') args.initialLoadTrimThresholdMs = Number(next)
    if (arg === '--typing-delay-ms') args.typingDelayMs = Number(next)
    if (arg === '--pointer-move-ms') args.pointerMoveMs = Number(next)
    if (arg === '--help' || arg === '-h') args.help = true

    if (arg.startsWith('--') && next && !next.startsWith('--')) {
      index += 1
    }
  }

  if (!args.voiceId) {
    args.voiceId = getEnvVoiceIdForLanguage(args.language) || process.env.ELEVENLABS_VOICE_ID || ''
  }

  if (!args.outputDir) {
    args.outputDir = join(frontendRoot, 'public/howto-videos/prod', args.language)
  }

  if (!args.publicDir) {
    args.publicDir = join(frontendRoot, 'public/howto-videos/prod', args.language)
  }

  if (!args.workDir) {
    args.workDir = join(frontendRoot, 'howto-video-output/work', args.language)
  }

  args.recordingTempDir = join(args.workDir, recordingTempDirName, String(process.pid))

  return args
}

const printUsage = () => {
  console.log(`Generate how-to guide videos from markdown help files.

Usage:
  npm run howto:video -- --guide pages-create --base-url http://127.0.0.1:3173 --mock-api --format mp4
  npm run howto:video:all -- --base-url http://127.0.0.1:3173 --mock-api

Options:
  --all                    Record every help guide.
  --topic <id>             Record the first guide in a help topic.
  --guide <id>             Record one guide.
  --base-url <url>         Running frontend URL. Defaults to HOWTO_BASE_URL or http://127.0.0.1:3100.
  --output-dir <path>      Recording output folder. Defaults to frontend/public/howto-videos/prod/<language>.
  --public-dir <path>      Folder copied into the help site. Defaults to frontend/public/howto-videos/prod/<language>.
  --docs-dir <path>        Markdown guide folder. Defaults to frontend/src/docs/how-to.
  --work-dir <path>        Work folder for temporary audio/manifests. Defaults to frontend/howto-video-output/work/<language>.
  --format <webm|mp4|both> Output format. Defaults to webm.
  --voice elevenlabs        Generate narration audio with ElevenLabs and mux it into MP4.
  --language <code>         Narration language. Use "sv" for Swedish. Defaults to sv.
  --voice-id <id>           ElevenLabs voice ID. Also read from HOWTO_VOICE_ID,
                            ELEVENLABS_VOICE_ID_SWE, ELEVENLABS_VOICE_ID_ENG,
                            or ELEVENLABS_VOICE_ID.
  --model-id <id>           ElevenLabs model. Defaults to eleven_multilingual_v2.
  --audio-cache-dir <path>  MP3 cache for unchanged narration. Defaults to frontend/howto-audio-cache.
  --translate anthropic     Translate captions/subtitles/narration before TTS.
  --translation-model <id>  Translation model. Defaults to claude-3-5-haiku-20241022.
  --translation-model-fallbacks <ids>
                            Comma-separated Anthropic model fallbacks.
  --translation-fallback <original|error>
                            Use original text on translation failure, or fail.
  --narration-padding-ms <ms>
                            Extra time after narration before the MP4 ends. Defaults to 1200.
  --elevenlabs-max-retries <n>
                            Retry transient ElevenLabs failures. Defaults to 3.
  --linear-narration       Use one narration track instead of per-step audio.
  --segmented-narration    Pause, play step audio, run action, then repeat. Default.
  --list-voices             List available ElevenLabs voices, then exit.
  --voice-search <term>     Search voices by name, description, or labels.
  --voice-type <type>       Filter voices. Examples: default, community, workspace, saved.
  --voice-category <type>   Filter category. Examples: premade, generated, professional.
  --sfx                     Mix in simple computer sounds for clicks, typing, and navigation.
  --cursor                  Show a visible tutorial cursor, click pulse, and typing badge. Default.
  --no-cursor               Disable visible cursor overlays.
  --context                 Add intro/outcome context around each walkthrough. Default.
  --no-context              Disable automatic context segments.
  --context-hold-ms <ms>    Time to hold each context card. Defaults to 1800.
  --require-actionable-steps
                            Skip guides unless their video script contains user actions. Default.
  --allow-passive-guides    Allow screenshot-style guides with no click/fill/select steps.
  --min-actionable-steps <n>
                            Required click/fill/select steps before recording. Defaults to 1.
  --narration-action-lead-ms <ms>
                            Delay after voice starts before running the action. Defaults to 300.
  --post-action-hold-ms <ms>
                            Minimum pause after an action when narration timing already covers it. Defaults to 250.
  --action-timeout-ms <ms>  Max time to wait for click/fill/select targets before skipping that action. Defaults to 10000.
  --global-hold-ms <ms>     Extra pause added to every block holdMs. Defaults to 0.
  --no-voice-pre-hold-ms <ms>
                            Caption-only delay before running an action. Defaults to 250.
  --no-voice-hold-ms <ms>
                            Caption-only pause after an action. Defaults to 650.
  --cut-page-load          Cut marked page-load/wait intervals out of the final video. Default.
  --keep-page-load         Keep marked page-load/wait intervals in the final video.
  --trim-initial-load      Cut the initial browser page load before the first narrated part. Default.
  --keep-initial-load      Keep the initial browser page load in the final video.
  --initial-load-trim-threshold-ms <ms>
                            Only trim initial loading if it is at least this long. Defaults to 1500.
  --typing-delay-ms <ms>    Delay per typed character. Defaults to 75.
  --pointer-move-ms <ms>    Cursor move duration before an action. Defaults to 650.
  --mock-api               Stub admin API calls for documentation-only recordings.
  --clean-browser-state    Clear local/session storage except auth tokens before recording. Default.
  --keep-browser-state     Keep storage state exactly as loaded.
  --storage-state <path>   Playwright auth state for recording against a real backend.
  --headed                 Show the browser while recording.
  --no-overlay             Disable burned-in caption overlay.
  --ffmpeg <path>          ffmpeg executable for MP4 conversion.
`)
}

const validateArgs = (args) => {
  if (args.listVoices && !args.voiceProvider) {
    args.voiceProvider = 'elevenlabs'
  }

  if (!['webm', 'mp4', 'both'].includes(args.format)) {
    throw new Error(`Unsupported --format "${args.format}". Use "webm", "mp4", or "both".`)
  }

  if (args.voiceProvider && args.voiceProvider !== 'elevenlabs') {
    throw new Error(`Unsupported --voice "${args.voiceProvider}". Use "elevenlabs".`)
  }

  if ((args.voiceProvider || args.sfx) && args.format === 'webm') {
    args.format = 'mp4'
  }

  if (args.voiceProvider === 'elevenlabs' && !args.elevenLabsApiKey) {
    throw new Error('ELEVENLABS_API_KEY is required when using --voice elevenlabs.')
  }

  if (args.voiceProvider === 'elevenlabs' && !args.voiceId && !args.listVoices) {
    throw new Error('Set --voice-id or ELEVENLABS_VOICE_ID when using --voice elevenlabs. Use --list-voices to browse options.')
  }

  if (args.translationProvider && !['anthropic', 'openai'].includes(args.translationProvider)) {
    throw new Error(`Unsupported --translate "${args.translationProvider}". Use "anthropic" or "openai".`)
  }

  if (!['original', 'error'].includes(args.translationFallback)) {
    throw new Error(`Unsupported --translation-fallback "${args.translationFallback}". Use "original" or "error".`)
  }

  if (args.translationProvider === 'openai' && !isEnglishLanguage(args.language) && !args.openAiApiKey) {
    throw new Error('OPENAI_API_KEY is required when using --translate openai.')
  }

  if (args.translationProvider === 'anthropic' && !isEnglishLanguage(args.language) && !args.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is required when using --translate anthropic.')
  }

  if (!Number.isFinite(args.narrationPaddingMs) || args.narrationPaddingMs < 0) {
    throw new Error('--narration-padding-ms must be a non-negative number.')
  }

  if (!Number.isFinite(args.elevenLabsMaxRetries) || args.elevenLabsMaxRetries < 0) {
    throw new Error('--elevenlabs-max-retries must be a non-negative number.')
  }

  if (!Number.isFinite(args.typingDelayMs) || args.typingDelayMs < 0) {
    throw new Error('--typing-delay-ms must be a non-negative number.')
  }

  if (!Number.isFinite(args.pointerMoveMs) || args.pointerMoveMs < 0) {
    throw new Error('--pointer-move-ms must be a non-negative number.')
  }

  if (!Number.isFinite(args.initialLoadTrimThresholdMs) || args.initialLoadTrimThresholdMs < 0) {
    throw new Error('--initial-load-trim-threshold-ms must be a non-negative number.')
  }

  if (!Number.isFinite(args.contextHoldMs) || args.contextHoldMs < 0) {
    throw new Error('--context-hold-ms must be a non-negative number.')
  }

  if (!Number.isInteger(args.minActionableSteps) || args.minActionableSteps < 0) {
    throw new Error('--min-actionable-steps must be a non-negative integer.')
  }

  for (const [name, value] of [
    ['--narration-action-lead-ms', args.narrationActionLeadMs],
    ['--post-action-hold-ms', args.postActionHoldMs],
    ['--action-timeout-ms', args.actionTimeoutMs],
    ['--global-hold-ms', args.globalHoldMs],
    ['--no-voice-pre-hold-ms', args.noVoicePreHoldMs],
    ['--no-voice-hold-ms', args.noVoiceHoldMs]
  ]) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${name} must be a non-negative number.`)
    }
  }
}

const loadDocs = async (docsDir) => {
  const modules = {}

  const readMarkdownFiles = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        await readMarkdownFiles(entryPath)
      } else if (entry.name.endsWith('.md')) {
        modules[entryPath] = await readFile(entryPath, 'utf8')
      }
    }
  }

  await readMarkdownFiles(docsDir)
  return parseHowToMarkdownCollection(modules)
}

const findGuide = (docs, { topicId, guideId }) => {
  if (guideId) {
    for (const doc of docs) {
      const guide = doc.guides.find(candidate => candidate.id === guideId)
      if (guide) return { doc, guide }
    }
  }

  if (topicId) {
    const doc = docs.find(candidate => candidate.id === topicId)
    if (doc?.guides?.[0]) return { doc, guide: doc.guides[0] }
  }

  return { doc: docs[0], guide: docs[0]?.guides?.[0] }
}

const findGuides = (docs, args) => {
  if (args.all) {
    return docs.flatMap(doc => doc.guides.map(guide => ({ doc, guide })))
  }

  const match = findGuide(docs, args)
  return match.doc && match.guide ? [match] : []
}

const actionableActionTypes = new Set(['click', 'fill', 'select'])

const countActionableSteps = (guide) => (
  (guide.actions || []).filter(action => actionableActionTypes.has(action.type)).length
)

const filterActionableTargets = (targets, args) => {
  if (!args.requireActionableSteps) {
    return {
      recordableTargets: targets,
      skippedTargets: []
    }
  }

  const recordableTargets = []
  const skippedTargets = []

  targets.forEach(target => {
    const actionableSteps = countActionableSteps(target.guide)

    if (actionableSteps >= args.minActionableSteps) {
      recordableTargets.push(target)
      return
    }

    skippedTargets.push({
      ...target,
      actionableSteps
    })
  })

  return {
    recordableTargets,
    skippedTargets
  }
}

const pluralizeSteps = (count) => `${count} actionable step${count === 1 ? '' : 's'}`

const escapeVtt = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const formatTimestamp = (milliseconds) => {
  const totalSeconds = Math.max(0, milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const ms = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 1000)

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0')
  ].join(':') + `.${String(ms).padStart(3, '0')}`
}

const writeVtt = async (path, cues) => {
  const body = cues
    .filter(cue => cue.text)
    .map((cue, index) => [
      String(index + 1),
      `${formatTimestamp(cue.start)} --> ${formatTimestamp(Math.max(cue.end, cue.start + 500))}`,
      escapeVtt(cue.text)
    ].join('\n'))
    .join('\n\n')

  await writeFile(path, `WEBVTT\n\n${body}\n`, 'utf8')
}

const runCommand = (command, commandArgs) => new Promise((resolveCommand, rejectCommand) => {
  const child = spawn(command, commandArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
  const output = []

  child.stdout.on('data', chunk => output.push(chunk.toString()))
  child.stderr.on('data', chunk => output.push(chunk.toString()))
  child.on('error', rejectCommand)
  child.on('close', code => {
    if (code === 0) {
      resolveCommand(output.join(''))
      return
    }

    rejectCommand(new Error(`${command} exited with code ${code}\n${output.join('')}`))
  })
})

const runCommandCapture = (command, commandArgs) => new Promise((resolveCommand, rejectCommand) => {
  const child = spawn(command, commandArgs, { stdio: ['ignore', 'pipe', 'pipe'] })
  const stdout = []
  const stderr = []

  child.stdout.on('data', chunk => stdout.push(chunk.toString()))
  child.stderr.on('data', chunk => stderr.push(chunk.toString()))
  child.on('error', rejectCommand)
  child.on('close', code => {
    if (code === 0) {
      resolveCommand({ stdout: stdout.join(''), stderr: stderr.join('') })
      return
    }

    rejectCommand(new Error(`${command} exited with code ${code}\n${stderr.join('')}${stdout.join('')}`))
  })
})

const ffprobePathFor = (ffmpegPath) => {
  if (ffmpegPath.endsWith('/ffmpeg')) {
    return `${ffmpegPath.slice(0, -'ffmpeg'.length)}ffprobe`
  }

  return 'ffprobe'
}

const getMediaDurationSeconds = async (path, ffmpegPath) => {
  const { stdout } = await runCommandCapture(ffprobePathFor(ffmpegPath), [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    path
  ])
  const duration = Number(stdout.trim())

  if (!Number.isFinite(duration)) {
    throw new Error(`Could not read media duration for ${path}`)
  }

  return duration
}

const formatDuration = (seconds) => `${seconds.toFixed(1)}s`

const normalizeTimelineCuts = (cuts = [], minDurationMs = 120) => {
  const sorted = cuts
    .map(cut => ({
      start: Math.max(0, Math.round(cut.start || 0)),
      end: Math.max(0, Math.round(cut.end || 0)),
      reason: cut.reason || 'cut'
    }))
    .filter(cut => cut.end - cut.start >= minDurationMs)
    .sort((a, b) => a.start - b.start)
  const merged = []

  sorted.forEach(cut => {
    const previous = merged.at(-1)

    if (previous && cut.start <= previous.end) {
      previous.end = Math.max(previous.end, cut.end)
      previous.reason = `${previous.reason}, ${cut.reason}`
      return
    }

    merged.push({ ...cut })
  })

  return merged
}

const timelineCutDurationBefore = (timeMs, cuts) => cuts.reduce((duration, cut) => {
  if (timeMs >= cut.end) return duration + (cut.end - cut.start)
  if (timeMs > cut.start) return duration + (timeMs - cut.start)
  return duration
}, 0)

const mapTimelineTime = (timeMs, cuts) => Math.max(0, Math.round(timeMs - timelineCutDurationBefore(timeMs, cuts)))

const remapTimelineEvents = (items, cuts, keys = ['at']) => items.map(item => {
  const next = { ...item }

  keys.forEach(key => {
    if (Number.isFinite(next[key])) next[key] = mapTimelineTime(next[key], cuts)
  })

  return next
})

const remapTimelineCues = (cues, cuts) => cues
  .map(cue => ({
    ...cue,
    start: mapTimelineTime(cue.start, cuts),
    end: mapTimelineTime(cue.end, cuts)
  }))
  .filter(cue => cue.end > cue.start)

const createCutVideo = async (inputPath, outputPath, args, cuts) => {
  const durationMs = Math.ceil(await getMediaDurationSeconds(inputPath, args.ffmpegPath) * 1000)
  const ranges = []
  let cursor = 0

  cuts.forEach(cut => {
    if (cut.start > cursor) ranges.push({ start: cursor, end: Math.min(cut.start, durationMs) })
    cursor = Math.max(cursor, cut.end)
  })

  if (cursor < durationMs) ranges.push({ start: cursor, end: durationMs })

  const keptRanges = ranges.filter(range => range.end - range.start >= 40)

  if (keptRanges.length === 0) {
    throw new Error('Timeline cuts removed the whole video.')
  }

  const filters = keptRanges.map((range, index) => (
    `[0:v]trim=start=${(range.start / 1000).toFixed(3)}:end=${(range.end / 1000).toFixed(3)},setpts=PTS-STARTPTS[v${index}]`
  ))
  filters.push(`${keptRanges.map((_, index) => `[v${index}]`).join('')}concat=n=${keptRanges.length}:v=1:a=0[v]`)

  console.log(`    Cutting ${cuts.length} loading interval${cuts.length === 1 ? '' : 's'} from video timeline`)
  cuts.forEach(cut => console.log(`      - ${formatDuration(cut.start / 1000)}-${formatDuration(cut.end / 1000)} ${cut.reason}`))

  await runCommand(args.ffmpegPath, [
    '-y',
    '-i',
    inputPath,
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[v]',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    outputPath
  ])

  return outputPath
}

const convertWebmToMp4 = async (webmPath, mp4Path, args, audioPaths = []) => {
  const videoDuration = await getMediaDurationSeconds(webmPath, args.ffmpegPath)
  const audioDurations = []

  for (const audioPath of audioPaths) {
    audioDurations.push(await getMediaDurationSeconds(audioPath, args.ffmpegPath))
  }

  const audioDuration = audioDurations.length > 0 ? Math.max(...audioDurations) : 0
  const targetDuration = audioDuration > 0 ? audioDuration + (args.narrationPaddingMs / 1000) : videoDuration
  const padSeconds = Math.max(0, targetDuration - videoDuration)
  const videoFilterArgs = padSeconds > 0.05
    ? ['-vf', `tpad=stop_mode=clone:stop_duration=${padSeconds.toFixed(3)}`]
    : []

  console.log(`    Video duration: ${formatDuration(videoDuration)}`)
  if (audioDuration > 0) {
    console.log(`    Audio duration: ${formatDuration(audioDuration)}`)
  }

  if (padSeconds > 0.05) {
    console.log(`    Padding video tail: ${formatDuration(padSeconds)} so narration has room`)
  }

  const audioInputs = audioPaths.flatMap(path => ['-i', path])
  const audioArgs = audioPaths.length === 0
    ? ['-an']
    : [
        '-filter_complex',
        audioPaths.length === 1
          ? '[1:a]volume=1[a]'
          : `${audioPaths.map((_, index) => `[${index + 1}:a]`).join('')}amix=inputs=${audioPaths.length}:duration=longest:normalize=0[a]`,
        '-map',
        '0:v:0',
        '-map',
        '[a]',
        '-c:a',
        'aac',
        '-b:a',
        '128k'
      ]

  await runCommand(args.ffmpegPath, [
    '-y',
    '-i',
    webmPath,
    ...audioInputs,
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    ...videoFilterArgs,
    '-movflags',
    '+faststart',
    ...audioArgs,
    mp4Path
  ])
}

const hashValue = (value) => createHash('sha256').update(value).digest('hex').slice(0, 24)

const languageSuffix = (language) => language
  .split('-')
  .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  .join('')

const getLocalizedValue = (source, key, language) => {
  if (!source) return ''
  const suffix = languageSuffix(language)
  return source[`${key}${suffix}`] || source[`${key}_${language}`] || source[key] || ''
}

const getActionCaption = (action, guide, language) => {
  const actionCaption = getLocalizedValue(action, 'caption', language)

  if (actionCaption || action.type !== 'caption') return actionCaption

  return getLocalizedValue(guide, 'narration', language)
    || getLocalizedValue(guide, 'summary', language)
    || guide.title
}

const buildNarrationText = (guide, cues, language) => {
  const guideNarration = getLocalizedValue(guide, 'narration', language)
  if (guideNarration) return guideNarration

  return [...new Set(cues.map(cue => cue.text).filter(Boolean))].join(' ')
}

const isEnglishLanguage = (language) => {
  const normalized = language.toLowerCase()
  return normalized === 'en' || normalized.startsWith('en-') || normalized === 'eng' || normalized === 'english'
}

const languageName = (language) => {
  const normalized = language.toLowerCase()

  if (normalized === 'sv' || normalized.startsWith('sv-') || normalized === 'swe' || normalized === 'swedish') {
    return 'Swedish'
  }

  if (isEnglishLanguage(language)) {
    return 'English'
  }

  return language
}

const requireFetch = () => {
  if (typeof fetch !== 'function') {
    throw new Error('This script needs Node 18+ fetch support for ElevenLabs API calls.')
  }
}

const extractOpenAiText = (response) => {
  if (response.output_text) return response.output_text

  return (response.output || [])
    .flatMap(item => item.content || [])
    .map(content => content.text || '')
    .filter(Boolean)
    .join('\n')
}

const extractAnthropicText = (response) => (response.content || [])
  .filter(item => item.type === 'text')
  .map(item => item.text || '')
  .filter(Boolean)
  .join('\n')

const handleTranslationFallback = (text, args, message) => {
  if (args.translationFallback === 'original') {
    console.warn(`  ! Translation skipped for ${args.language}: ${message}`)
    console.warn('    Continuing with original text. Set HOWTO_TRANSLATION_FALLBACK=error to fail instead.')
    return text
  }

  throw new Error(message)
}

const isAnthropicModelMissing = (status, body) => status === 404 && body.includes('not_found_error') && body.includes('model:')

const translateWithOpenAi = async (text, args) => {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.openAiApiKey}`
    },
    body: JSON.stringify({
      model: args.translationModel,
      instructions: [
        `Translate the user's admin how-to video text into ${languageName(args.language)}.`,
        'Preserve product names, UI labels, URLs, file paths, keyboard shortcuts, placeholders, and markdown-like punctuation.',
        'Return only the translated text, with no commentary.'
      ].join(' '),
      input: text,
      max_output_tokens: 900
    })
  })

  if (!response.ok) {
    return handleTranslationFallback(text, args, `OpenAI translation failed: ${response.status} ${await response.text()}`)
  }

  const translated = extractOpenAiText(await response.json()).trim()
  if (!translated) {
    return handleTranslationFallback(text, args, 'OpenAI translation returned no text.')
  }

  return translated
}

const translateWithAnthropicModel = async (text, args, model) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': args.anthropicApiKey,
      'anthropic-version': args.anthropicVersion
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      system: [
        `Translate admin how-to video text into ${languageName(args.language)}.`,
        'Preserve product names, UI labels, URLs, file paths, keyboard shortcuts, placeholders, and markdown-like punctuation.',
        'Return only the translated text, with no commentary.'
      ].join(' '),
      messages: [{
        role: 'user',
        content: text
      }]
    })
  })

  const responseBody = await response.text()
  if (!response.ok) {
    return {
      ok: false,
      missingModel: isAnthropicModelMissing(response.status, responseBody),
      message: `Anthropic translation failed with ${model}: ${response.status} ${responseBody}`
    }
  }

  const translated = extractAnthropicText(JSON.parse(responseBody)).trim()
  if (!translated) {
    return {
      ok: false,
      missingModel: false,
      message: `Anthropic translation with ${model} returned no text.`
    }
  }

  return {
    ok: true,
    model,
    text: translated
  }
}

const translateWithAnthropic = async (text, args) => {
  const models = [...new Set([args.translationModel, ...args.translationModelFallbacks].filter(Boolean))]

  for (const [index, model] of models.entries()) {
    if (index > 0) {
      console.log(`    Retrying Anthropic translation with fallback model ${model}`)
    }

    const result = await translateWithAnthropicModel(text, args, model)
    if (result.ok) return result.text

    console.warn(`    ${result.message}`)
    if (!result.missingModel) {
      return handleTranslationFallback(text, args, result.message)
    }
  }

  return handleTranslationFallback(text, args, `Anthropic translation failed: none of these models were available (${models.join(', ')})`)
}

const translateText = async (text, args) => {
  if (!text || !args.translationProvider || isEnglishLanguage(args.language)) {
    return text
  }

  requireFetch()

  await mkdir(args.translationCacheDir, { recursive: true })

  const cacheKey = hashValue(JSON.stringify({
    provider: args.translationProvider,
    model: args.translationModel,
    language: args.language,
    text
  }))
  const translationPath = join(args.translationCacheDir, `${cacheKey}.txt`)

  if (existsSync(translationPath)) {
    console.log(`    Translation cache hit (${args.translationProvider})`)
    return readFile(translationPath, 'utf8')
  }

  console.log(`    Translating to ${languageName(args.language)} with ${args.translationProvider}/${args.translationModel}`)
  const translated = args.translationProvider === 'anthropic'
    ? await translateWithAnthropic(text, args)
    : await translateWithOpenAi(text, args)

  if (translated !== text || args.translationFallback === 'error') {
    await writeFile(translationPath, translated, 'utf8')
  }

  return translated
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const elevenLabsVoiceSettings = Object.freeze({
  stability: 0.48,
  similarity_boost: 0.78,
  style: 0.18,
  use_speaker_boost: true
})

const elevenLabsHeaders = (args) => ({
  'Content-Type': 'application/json',
  'xi-api-key': args.elevenLabsApiKey
})

const isRetryableElevenLabsStatus = (status) => status === 408 || status === 409 || status === 425 || status === 429 || status >= 500

const requestElevenLabsSpeech = async (url, text, args) => fetch(url, {
  method: 'POST',
  headers: elevenLabsHeaders(args),
  body: JSON.stringify({
    text,
    model_id: args.elevenLabsModelId,
    language_code: args.language,
    voice_settings: elevenLabsVoiceSettings
  })
})

const createElevenLabsSpeech = async (text, args) => {
  requireFetch()

  await mkdir(args.audioCacheDir, { recursive: true })

  const cachePayload = {
    provider: 'elevenlabs',
    voiceId: args.voiceId,
    modelId: args.elevenLabsModelId,
    outputFormat: args.elevenLabsOutputFormat,
    voiceSettings: elevenLabsVoiceSettings,
    language: args.language,
    text
  }
  const cacheKey = hashValue(JSON.stringify(cachePayload))
  const audioPath = join(args.audioCacheDir, `${cacheKey}.mp3`)
  const metadataPath = join(args.audioCacheDir, `${cacheKey}.json`)

  if (existsSync(audioPath)) {
    console.log(`    Narration cache hit: ${audioPath}`)
    return { audioPath, cached: true }
  }

  console.log(`    Calling ElevenLabs TTS (${text.length} chars)`)
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${args.voiceId}`)
  url.searchParams.set('output_format', args.elevenLabsOutputFormat)

  let response
  let errorText = ''

  for (let attempt = 1; attempt <= args.elevenLabsMaxRetries + 1; attempt += 1) {
    response = await requestElevenLabsSpeech(url, text, args)

    if (response.ok) break

    errorText = await response.text()
    if (!isRetryableElevenLabsStatus(response.status) || attempt > args.elevenLabsMaxRetries) {
      break
    }

    const delayMs = Math.min(8000, 750 * (2 ** (attempt - 1)))
    console.warn(`    ElevenLabs TTS failed (${response.status}), retrying in ${delayMs}ms [${attempt}/${args.elevenLabsMaxRetries}]`)
    await sleep(delayMs)
  }

  if (!response?.ok) {
    throw new Error(`ElevenLabs speech generation failed: ${response?.status} ${errorText}`)
  }

  await writeFile(audioPath, Buffer.from(await response.arrayBuffer()))
  await writeFile(metadataPath, JSON.stringify({
    ...cachePayload,
    createdAt: new Date().toISOString(),
    audioPath
  }, null, 2))
  console.log(`    Saved narration: ${audioPath}`)
  return { audioPath, cached: false }
}

const voiceMatchesLanguage = (voice, language) => {
  if (!language) return true
  const normalized = language.toLowerCase()
  const labels = Object.values(voice.labels || {}).join(' ').toLowerCase()
  const verifiedLanguages = voice.verified_languages || []

  return labels.includes(normalized)
    || (normalized === 'sv' && labels.includes('swedish'))
    || verifiedLanguages.some(candidate => (
      candidate.language?.toLowerCase() === normalized
      || candidate.locale?.toLowerCase().startsWith(normalized)
    ))
}

const listElevenLabsVoices = async (args) => {
  requireFetch()

  const url = new URL('https://api.elevenlabs.io/v2/voices')
  url.searchParams.set('page_size', String(args.voicePageSize))
  url.searchParams.set('sort', 'name')
  url.searchParams.set('sort_direction', 'asc')

  const searchTerm = args.voiceSearch || (args.language === 'sv' ? 'Swedish' : '')
  if (searchTerm) url.searchParams.set('search', searchTerm)
  if (args.voiceType) url.searchParams.set('voice_type', args.voiceType)
  if (args.voiceCategory) url.searchParams.set('category', args.voiceCategory)

  const response = await fetch(url, {
    headers: { 'xi-api-key': args.elevenLabsApiKey }
  })

  if (!response.ok) {
    throw new Error(`ElevenLabs voice search failed: ${response.status} ${await response.text()}`)
  }

  const data = await response.json()
  const voices = (data.voices || []).filter(voice => voiceMatchesLanguage(voice, args.language))

  if (voices.length === 0) {
    console.log(`No ${args.language} voices matched. Try --voice-search with another term or browse the ElevenLabs voice library.`)
    return
  }

  console.log(`Found ${voices.length} ElevenLabs voice candidate${voices.length === 1 ? '' : 's'} for language "${args.language}":`)
  voices.forEach(voice => {
    const labels = Object.entries(voice.labels || {})
      .map(([key, value]) => `${key}:${value}`)
      .join(', ')
    const verified = (voice.verified_languages || [])
      .map(language => [language.language, language.locale, language.accent].filter(Boolean).join('/'))
      .join(', ')

    console.log(`- ${voice.name} (${voice.voice_id})`)
    if (voice.category) console.log(`  category: ${voice.category}`)
    if (labels) console.log(`  labels: ${labels}`)
    if (verified) console.log(`  verified: ${verified}`)
    if (voice.description) console.log(`  description: ${voice.description}`)
    if (voice.preview_url) console.log(`  preview: ${voice.preview_url}`)
  })
}

const createSfxTrack = async (events, durationMs, outputPath, args) => {
  if (events.length === 0) return ''

  const durationSeconds = Math.max(1, Math.ceil(durationMs / 1000) + 1)
  console.log(`    Building ${events.length} interface sound event${events.length === 1 ? '' : 's'} over ${formatDuration(durationSeconds)}`)
  const inputs = ['-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo:d=${durationSeconds}`]
  const filters = []
  const mixInputs = ['[0:a]']

  events.slice(0, 80).forEach((event, index) => {
    const inputIndex = index + 1
    const delay = Math.max(0, Math.round(event.at))
    const frequency = event.type === 'key' ? 1350 : event.type === 'navigate' ? 620 : 920
    const duration = event.type === 'key' ? 0.018 : 0.045
    const volume = event.type === 'key' ? 0.045 : 0.08

    inputs.push('-f', 'lavfi', '-i', `sine=frequency=${frequency}:duration=${duration}:sample_rate=44100`)
    filters.push(`[${inputIndex}:a]volume=${volume},adelay=${delay}|${delay}[s${index}]`)
    mixInputs.push(`[s${index}]`)
  })

  filters.push(`${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:normalize=0[a]`)

  await runCommand(args.ffmpegPath, [
    '-y',
    ...inputs,
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[a]',
    '-c:a',
    'mp3',
    outputPath
  ])

  return outputPath
}

const createTimelineAudioTrack = async (events, outputPath, args, label = 'timeline audio') => {
  if (events.length === 0) return ''

  const endMs = Math.max(...events.map(event => event.at + event.durationMs)) + args.narrationPaddingMs
  const durationSeconds = Math.max(1, Math.ceil(endMs / 1000))
  const inputs = ['-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo:d=${durationSeconds}`]
  const filters = []
  const mixInputs = ['[0:a]']

  events.forEach((event, index) => {
    const inputIndex = index + 1
    const delay = Math.max(0, Math.round(event.at))

    inputs.push('-i', event.audioPath)
    filters.push(`[${inputIndex}:a]adelay=${delay}|${delay}[n${index}]`)
    mixInputs.push(`[n${index}]`)
  })

  filters.push(`${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:normalize=0[a]`)
  console.log(`    Building ${label}: ${events.length} part${events.length === 1 ? '' : 's'} over ${formatDuration(durationSeconds)}`)

  await runCommand(args.ffmpegPath, [
    '-y',
    ...inputs,
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[a]',
    '-c:a',
    'mp3',
    outputPath
  ])

  return outputPath
}

const setCaptionOverlay = async (page, text) => {
  await page.evaluate((caption) => {
    let overlay = document.querySelector('[data-howto-caption-overlay]')

    if (!overlay) {
      overlay = document.createElement('div')
      overlay.setAttribute('data-howto-caption-overlay', 'true')
      overlay.style.position = 'fixed'
      overlay.style.left = '50%'
      overlay.style.bottom = '32px'
      overlay.style.transform = 'translateX(-50%)'
      overlay.style.zIndex = '2147483647'
      overlay.style.maxWidth = 'min(920px, calc(100vw - 48px))'
      overlay.style.padding = '12px 18px'
      overlay.style.borderRadius = '8px'
      overlay.style.background = 'rgba(17, 24, 39, 0.92)'
      overlay.style.color = 'white'
      overlay.style.font = '600 18px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      overlay.style.textAlign = 'center'
      overlay.style.boxShadow = '0 14px 30px rgba(15, 23, 42, 0.28)'
      document.body.appendChild(overlay)
    }

    overlay.textContent = caption
    overlay.style.display = caption ? 'block' : 'none'
  }, text)
}

const ensureCursorOverlay = async (page, args) => {
  if (!args.cursor) return

  await page.evaluate(() => {
    if (document.querySelector('[data-howto-cursor-overlay]')) return

    const style = document.createElement('style')
    style.setAttribute('data-howto-cursor-style', 'true')
    style.textContent = `
      [data-howto-cursor-overlay] {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 2147483647;
        width: 48px;
        height: 64px;
        pointer-events: none;
        transform: translate3d(28px, 64px, 0);
        transition: transform 650ms cubic-bezier(.22, .9, .25, 1);
        filter: drop-shadow(0 2px 5px rgba(15, 23, 42, .35));
      }

      [data-howto-cursor-overlay] svg {
        display: block;
        height: 100%;
        width: 100%;
        overflow: visible;
      }

      [data-howto-click-rays] {
        opacity: 0;
        transform-origin: 65px 64px;
      }

      [data-howto-cursor-overlay].is-clicking [data-howto-click-rays] {
        animation: howto-click-rays 520ms ease-out forwards;
      }

      [data-howto-typing-badge] {
        position: fixed;
        z-index: 2147483646;
        padding: 5px 9px;
        border-radius: 9999px;
        background: rgba(17, 24, 39, .9);
        color: white;
        font: 700 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        pointer-events: none;
        transform: translate(18px, -8px);
        box-shadow: 0 8px 18px rgba(15, 23, 42, .28);
      }

      @keyframes howto-click-rays {
        0% { opacity: 0; transform: scale(.92); }
        18% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.08); }
      }
    `
    document.head.appendChild(style)

    const cursor = document.createElement('div')
    cursor.setAttribute('data-howto-cursor-overlay', 'true')
    cursor.innerHTML = `
      <svg viewBox="0 0 150 200" aria-hidden="true">
        <g
          data-howto-click-rays
          fill="none"
          stroke="black"
          stroke-width="10"
          stroke-linecap="round"
        >
          <line x1="62" y1="12" x2="66" y2="44" />
          <line x1="28" y1="34" x2="53" y2="55" />
          <line x1="13" y1="77" x2="46" y2="72" />
          <line x1="44" y1="94" x2="25" y2="120" />
          <line x1="89" y1="39" x2="109" y2="13" />
          <line x1="96" y1="64" x2="128" y2="59" />
        </g>
        <path
          d="M64 64 L139 132 L106 143 L132 184 L115 195 L89 152 L58 177 Z"
          fill="white"
          stroke="black"
          stroke-width="12"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </svg>
    `
    document.body.appendChild(cursor)
  })
}

const moveTutorialCursor = async (page, args, x, y) => {
  if (!args.cursor) return

  await ensureCursorOverlay(page, args)
  await page.evaluate(({ nextX, nextY, durationMs }) => {
    const cursor = document.querySelector('[data-howto-cursor-overlay]')
    if (!cursor) return

    cursor.style.transitionDuration = `${durationMs}ms`
    cursor.style.transform = `translate3d(${Math.round(nextX - 20)}px, ${Math.round(nextY - 20)}px, 0)`
  }, { nextX: x, nextY: y, durationMs: args.pointerMoveMs })
  await page.mouse.move(x, y, { steps: 16 })
  await page.waitForTimeout(Math.min(args.pointerMoveMs + 120, 1200))
}

const flashClickPulse = async (page, args, x, y) => {
  if (!args.cursor) return

  await page.evaluate(() => {
    const cursor = document.querySelector('[data-howto-cursor-overlay]')
    if (!cursor) return

    cursor.classList.remove('is-clicking')
    void cursor.offsetWidth
    cursor.classList.add('is-clicking')
    window.setTimeout(() => cursor.classList.remove('is-clicking'), 540)
  }, { nextX: x, nextY: y })
  await page.waitForTimeout(360)
}

const showTypingBadge = async (page, args, x, y, text = 'Typing') => {
  if (!args.cursor) return

  await page.evaluate(({ nextX, nextY, label }) => {
    let badge = document.querySelector('[data-howto-typing-badge]')
    if (!badge) {
      badge = document.createElement('div')
      badge.setAttribute('data-howto-typing-badge', 'true')
      document.body.appendChild(badge)
    }

    badge.textContent = label
    badge.style.left = `${Math.round(nextX)}px`
    badge.style.top = `${Math.round(nextY)}px`
    badge.style.display = 'block'
  }, { nextX: x, nextY: y, label: text })
}

const hideTypingBadge = async (page, args) => {
  if (!args.cursor) return

  await page.evaluate(() => {
    const badge = document.querySelector('[data-howto-typing-badge]')
    if (badge) badge.style.display = 'none'
  })
}

const locatorCenter = async (locator, timeout = 10000) => {
  await locator.first().scrollIntoViewIfNeeded({ timeout })
  const box = await locator.first().boundingBox({ timeout })

  if (!box) {
    throw new Error('Unable to locate visible element for tutorial action.')
  }

  return {
    x: box.x + (box.width / 2),
    y: box.y + (box.height / 2)
  }
}

const pageTreeAddChildPoint = async (page, rowText) => page.evaluate(({ targetText }) => {
  const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim().toLowerCase()
  const wanted = normalize(targetText)

  const isVisible = (element) => {
    if (!element) return false

    const style = window.getComputedStyle(element)
    const rect = element.getBoundingClientRect()

    return style.visibility !== 'hidden'
      && style.display !== 'none'
      && rect.width > 0
      && rect.height > 0
      && rect.bottom >= 0
      && rect.right >= 0
      && rect.top <= window.innerHeight
      && rect.left <= window.innerWidth
  }

  const buttonScore = (button, index, buttons) => {
    const testId = button.getAttribute('data-testid') || ''
    const label = [
      button.getAttribute('aria-label'),
      button.getAttribute('title'),
      button.textContent,
      button.className
    ].join(' ').toLowerCase()

    if (testId.startsWith('page-tree-add-child-')) return 100
    if (label.includes('add child') || label.includes('add page') || label.includes('underordnad')) return 90
    if (label.includes('green')) return 80
    if (buttons.length >= 6 && index === 5) return 70
    if (buttons.length >= 5 && index === 4) return 60
    return 0
  }

  const textNodes = Array.from(document.querySelectorAll('span, mark, button, a, div'))
    .filter(element => {
      if (!isVisible(element)) return false

      const rect = element.getBoundingClientRect()
      const text = normalize(element.textContent)

      return text.includes(wanted) && rect.height < 120
    })

  for (const textNode of textNodes) {
    let candidate = textNode

    for (let depth = 0; candidate && depth < 10; depth += 1) {
      const rect = candidate.getBoundingClientRect()
      const buttons = Array.from(candidate.querySelectorAll('button'))
        .filter(button => isVisible(button) && !button.disabled)

      if (buttons.length >= 4 && rect.width > 240 && rect.height <= 140) {
        const scoredButtons = buttons
          .map((button, index) => ({ button, score: buttonScore(button, index, buttons) }))
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score)

        if (scoredButtons.length > 0) {
          const buttonRect = scoredButtons[0].button.getBoundingClientRect()

          return {
            x: buttonRect.left + (buttonRect.width / 2),
            y: buttonRect.top + (buttonRect.height / 2),
            rowText: normalize(candidate.textContent),
            buttonIndex: buttons.indexOf(scoredButtons[0].button),
            buttonClass: scoredButtons[0].button.className,
            buttonAria: scoredButtons[0].button.getAttribute('aria-label') || '',
            score: scoredButtons[0].score
          }
        }
      }

      candidate = candidate.parentElement
    }
  }

  return null
}, { targetText: rowText })

const resolveLocator = (page, action) => {
  if (action.rowText && action.rowActionSelector) {
    const rowLocator = action.rowSelector
      ? page.locator(action.rowSelector).filter({ hasText: action.rowText })
      : page
        .locator("[data-testid^='page-tree-node-']")
        .filter({ hasText: action.rowText })
        .or(page.getByText(action.rowText, { exact: Boolean(action.exactRowText) }).locator(
          'xpath=ancestor::div[contains(@class, "group") and contains(@class, "relative")][1]'
        ))

    return rowLocator.locator(action.rowActionSelector)
  }

  if (Array.isArray(action.selectors) && action.selectors.length > 0) {
    return action.selectors
      .map(selector => page.locator(selector))
      .reduce((combined, locator) => combined.or(locator))
  }

  if (action.selector) return page.locator(action.selector)
  if (action.label) return page.getByLabel(action.label, { exact: Boolean(action.exact) })
  if (action.placeholder) return page.getByPlaceholder(action.placeholder, { exact: Boolean(action.exact) })
  if (action.role) return page.getByRole(action.role, { name: action.name ? new RegExp(action.name, 'i') : undefined })
  if (!action.text) {
    throw new Error(`Action "${action.type || 'unknown'}" needs a target. Add text, label, placeholder, role, selector, selectors, rowText/rowActionSelector, or pageTreeAddChildForText.`)
  }
  return page.getByText(action.text, { exact: Boolean(action.exact) })
}

const resolveActionPath = (path = '') => path.replace(/\$\{([A-Z0-9_]+)\}/g, (match, envName) => {
  const value = process.env[envName]

  if (!value) {
    throw new Error(`Missing environment variable ${envName} for video action path "${path}".`)
  }

  return value
})

const mockCmsApi = async (page) => {
  const json = (route, body, status = 200) => route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
  })
  const pages = [
    {
      id: 101,
      title: 'ECEEE Example Site',
      slug: 'eceee-example-site',
      parent: null,
      sortOrder: 10,
      children: [],
      childrenCount: 3,
      hostnames: ['example.local'],
      publicationStatus: 'published'
    },
    {
      id: 171,
      title: 'Venue and travel',
      slug: 'venue-travel',
      parent: 101,
      sortOrder: 30,
      children: [],
      childrenCount: 2,
      hostnames: [],
      publicationStatus: 'published'
    },
    {
      id: 172,
      title: 'Accommodation',
      slug: 'accommodation',
      parent: 171,
      sortOrder: 10,
      children: [],
      childrenCount: 0,
      hostnames: [],
      publicationStatus: 'published'
    },
    {
      id: 173,
      title: 'Getting there',
      slug: 'getting-there',
      parent: 171,
      sortOrder: 20,
      children: [],
      childrenCount: 0,
      hostnames: [],
      publicationStatus: 'published'
    },
    {
      id: 271,
      title: 'Papers',
      slug: 'papers',
      parent: 101,
      sortOrder: 20,
      children: [],
      childrenCount: 0,
      hostnames: [],
      publicationStatus: 'published'
    },
    {
      id: 371,
      title: 'Programme',
      slug: 'programme',
      parent: 101,
      sortOrder: 40,
      children: [],
      childrenCount: 0,
      hostnames: [],
      publicationStatus: 'published'
    }
  ]
  const createdPage = {
    id: 999,
    title: 'Getting around town',
    slug: 'getting-around-town',
    parent: 171,
    sortOrder: 0,
    children: [],
    childrenCount: 0,
    hostnames: [],
    publicationStatus: 'unpublished',
    codeLayout: 'main_layout'
  }
  const demoPage = {
    id: 101,
    title: 'ECEEE Example Site',
    slug: 'eceee-example-site',
    parent: null,
    hostnames: ['example.local'],
    publicationStatus: 'published',
    codeLayout: 'main_layout'
  }
  const demoVersion = {
    id: 501,
    versionId: 501,
    versionNumber: 1,
    page: 101,
    pageId: 101,
    codeLayout: 'main_layout',
    pageData: {},
    widgets: {
      header: [{ id: 'header-1', type: 'easy_widgets.HeaderWidget', config: { title: 'ECEEE Example Site' }, slotName: 'header' }],
      navigation: [{ id: 'navigation-1', type: 'easy_widgets.NavigationWidget', config: { items: [{ label: 'Papers', url: '/papers' }] }, slotName: 'navigation' }],
      content: [{ id: 'content-1', type: 'easy_widgets.ContentWidget', config: { content: '<p>Example content</p>' }, slotName: 'content' }],
      sidebar: [{ id: 'sidebar-1', type: 'easy_widgets.SidebarWidget', config: { title: 'Sidebar' }, slotName: 'sidebar' }]
    },
    metaTitle: 'ECEEE Example Site',
    metaDescription: ''
  }
  const layouts = {
    count: 2,
    next: null,
    previous: null,
    results: [
      {
        name: 'main_layout',
        description: 'Default page layout with header, navigation, content, sidebar, and footer slots.',
        isActive: true,
        slotConfiguration: {
          slots: [
            { name: 'header', label: 'Page Header' },
            { name: 'navigation', label: 'Navigation Bar' },
            { name: 'content', label: 'Main Content' },
            { name: 'sidebar', label: 'Sidebar' },
            { name: 'footer', label: 'Footer' }
          ]
        }
      },
      {
        name: 'landing_page',
        description: 'Landing page layout with hero and flexible content slots.',
        isActive: true,
        slotConfiguration: {
          slots: [
            { name: 'hero', label: 'Hero slot' },
            { name: 'content', label: 'Main Content' }
          ]
        }
      }
    ]
  }
  const objectTypes = [
    {
      id: 1,
      name: 'news',
      label: 'News',
      pluralLabel: 'News',
      description: 'Articles and updates.',
      isActive: true,
      instanceCount: 3,
      schemaFieldsCount: 4,
      slotsCount: 1
    },
    {
      id: 2,
      name: 'speaker',
      label: 'Speaker',
      pluralLabel: 'Speakers',
      description: 'People shown in the programme.',
      isActive: true,
      instanceCount: 8,
      schemaFieldsCount: 5,
      slotsCount: 0
    }
  ]
  const widgetTypes = [
    ['easy_widgets.BannerWidget', 'Banner widget', 'Focused visual band with text and media.'],
    ['easy_widgets.BioWidget', 'Bio widget', 'Concise person profile with image and text.'],
    ['easy_widgets.ContentCardWidget', 'Content card widget', 'Compact reusable content card.'],
    ['easy_widgets.ContentWidget', 'Content widget', 'Rich text content for page slots.'],
    ['easy_widgets.FooterWidget', 'Footer widget', 'Reusable footer content and child widgets.'],
    ['easy_widgets.FormsWidget', 'Forms widget', 'Schema-driven visitor form.'],
    ['easy_widgets.HeaderWidget', 'Header widget', 'Top page area styled by the active theme.'],
    ['easy_widgets.HeadlineWidget', 'Headline widget', 'Structured heading text for a page section.'],
    ['easy_widgets.HeroWidget', 'Hero widget', 'Prominent visual page introduction.'],
    ['easy_widgets.ImageWidget', 'Image widget', 'Single image, gallery, or media display.'],
    ['easy_widgets.NavbarWidget', 'Navbar widget', 'Compact navigation bar with menu items.'],
    ['easy_widgets.NavigationWidget', 'Navigation widget', 'Menu and navigation configuration.'],
    ['easy_widgets.NewsDetailWidget', 'News detail widget', 'Single article detail page content.'],
    ['easy_widgets.NewsListWidget', 'News list widget', 'Filtered article list.'],
    ['easy_widgets.PathDebugWidget', 'Path debug widget', 'Routing and path context diagnostics.'],
    ['easy_widgets.SectionWidget', 'Section widget', 'Section container with child slots.'],
    ['easy_widgets.SidebarTopNewsWidget', 'Sidebar top news widget', 'Compact featured-news list for sidebars.'],
    ['easy_widgets.SidebarWidget', 'Sidebar widget', 'Container for secondary page content.'],
    ['easy_widgets.TableWidget', 'Table widget', 'Responsive data table.'],
    ['easy_widgets.ThreeColumnsWidget', 'Three columns widget', 'Three balanced child-widget columns.'],
    ['easy_widgets.TopNewsPlugWidget', 'Top news plug widget', 'Visual featured-news grid.'],
    ['easy_widgets.TwoColumnsWidget', 'Two columns widget', 'Two balanced child-widget columns.']
  ].map(([type, name, description]) => ({ type, name, description, category: 'core', isActive: true }))
  const theme = {
    id: 1,
    name: 'Demo Theme',
    description: 'Theme used for help recordings.',
    isActive: true
  }
  const paginated = (results) => ({
    count: results.length,
    next: null,
    previous: null,
    results
  })

  await page.route('**/api/v1/**', async (route, request) => {
    const url = new URL(request.url())

    if (url.pathname.endsWith('/current-user/')) {
      return json(route, {
        id: 1,
        username: 'howto',
        email: 'howto@example.com',
        isStaff: true,
        isSuperuser: true
      })
    }

    const pageIdMatch = url.pathname.match(/\/webpages\/pages\/(101|71)\//)
    const demoPageId = pageIdMatch ? Number(pageIdMatch[1]) : 101
    const versionForPage = {
      ...demoVersion,
      page: demoPageId,
      pageId: demoPageId
    }
    const pageForId = {
      ...demoPage,
      id: demoPageId
    }

    if (url.pathname.match(/\/webpages\/pages\/(101|71)\/versions\/current\/?$/)) {
      return json(route, versionForPage)
    }

    if (url.pathname.match(/\/webpages\/pages\/(101|71)\/versions\/501\/?$/)) {
      return json(route, versionForPage)
    }

    if (url.pathname.match(/\/webpages\/pages\/(101|71)\/versions\/?$/)) {
      return json(route, paginated([{ id: 501, versionNumber: 1, status: 'draft', createdAt: '2026-05-25T00:00:00Z' }]))
    }

    if (url.pathname.match(/\/webpages\/pages\/(101|71)\/widget-inheritance\/?$/)) {
      return json(route, { widgets: {}, rules: {}, hasInheritedContent: false })
    }

    if (url.pathname.match(/\/webpages\/pages\/(101|71)\/?$/)) {
      return json(route, pageForId)
    }

    if (url.pathname.includes('/webpages/page-data-schemas/')) {
      return json(route, { schema: { type: 'object', properties: {} }, fields: [] })
    }

    if (url.pathname.includes('/namespaces')) {
      return json(route, paginated([
        { id: 1, name: 'Default', slug: 'default', isDefault: true }
      ]))
    }

    if (url.pathname.includes('/webpages/layouts/combined')) {
      return json(route, { codeLayouts: layouts.results, slots: layouts.results.flatMap(layout => layout.slotConfiguration.slots) })
    }

    if (url.pathname.includes('/webpages/layouts/')) {
      if (url.pathname.endsWith('/json/')) {
        return json(route, {
          name: 'main_layout',
          slots: layouts.results[0].slotConfiguration.slots
        })
      }

      if (url.pathname.includes('/all_slots')) {
        return json(route, { slots: layouts.results.flatMap(layout => layout.slotConfiguration.slots), total: 5 })
      }

      return json(route, layouts)
    }

    if (url.pathname.match(/\/webpages\/widget-types\/.+\/config-ui-schema\/?$/)) {
      return json(route, {
        schema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              title: 'Title',
              placeholder: 'Enter widget title...'
            },
            label: {
              type: 'string',
              title: 'Label',
              placeholder: 'Enter menu label...'
            },
            url: {
              type: 'string',
              title: 'Link URL',
              placeholder: 'Enter link URL...'
            },
            content: {
              type: 'string',
              title: 'Content',
              placeholder: 'Enter content...',
              controlType: 'textarea'
            }
          }
        },
        uiSchema: {}
      })
    }

    if (url.pathname.match(/\/webpages\/widget-types\/.+\/validate\/?$/)) {
      return json(route, { isValid: true, errors: {}, warnings: {} })
    }

    if (url.pathname.includes('/webpages/widget-types/')) {
      return json(route, widgetTypes)
    }

    if (url.pathname.includes('/webpages/themes/')) {
      if (request.method() === 'POST') return json(route, { ...theme, id: 2, name: 'Tutorial Theme' }, 201)
      return json(route, paginated([theme]))
    }

    if (url.pathname.includes('/objects/object-types/main_browser_types')) {
      return json(route, objectTypes)
    }

    if (url.pathname.includes('/objects/object-types/')) {
      return json(route, paginated(objectTypes))
    }

    if (url.pathname.includes('/objects/objects/')) {
      return json(route, paginated([
        { id: 11, title: 'Opening keynote', status: 'draft', objectType: objectTypes[0], parent: null }
      ]))
    }

    if (url.pathname.includes('/tags/')) {
      return json(route, paginated([
        { id: 1, name: 'conference', slug: 'conference', color: '#2563eb', usageCount: 4 },
        { id: 2, name: 'venue', slug: 'venue', color: '#16a34a', usageCount: 2 }
      ]))
    }

    if (url.pathname.includes('/media/')) {
      return json(route, paginated([
        { id: 1, title: 'Venue logo', filename: 'venue-logo.png', fileType: 'image', tags: [], namespace: 'default' }
      ]))
    }

    if (url.pathname.match(/\/webpages\/pages\/?$/) && request.method() === 'POST') {
      return json(route, createdPage, 201)
    }

    if (url.pathname.match(/\/webpages\/pages\/999\/?$/)) {
      return json(route, createdPage)
    }

    if (url.pathname.includes('/webpages/pages/')) {
      const search = (url.searchParams.get('search') || '').toLowerCase()
      const parent = url.searchParams.get('parent')
      const parentIsNull = url.searchParams.get('parent_isnull')
      let results = pages

      if (search) {
        results = results.filter(item => `${item.title} ${item.slug}`.toLowerCase().includes(search))
      } else if (parent) {
        results = results.filter(item => String(item.parent) === parent)
      } else if (parentIsNull === 'true') {
        results = results.filter(item => item.parent === null)
      } else if (parentIsNull === 'false') {
        results = results.filter(item => item.parent !== null)
      }

      return json(route, {
        count: results.length,
        next: null,
        previous: null,
        results
      })
    }

    return json(route, { count: 0, next: null, previous: null, results: [] })
  })

  await page.route('**/health/**', route => json(route, { status: 'healthy', service: 'eceee-v4-backend' }))
}

const runAction = async (page, action, baseUrl, args) => {
  await ensureCursorOverlay(page, args)
  const actionTimeout = action.timeout || args.actionTimeoutMs

  if (action.type === 'goto') {
    const targetUrl = new URL(resolveActionPath(action.path || '/'), baseUrl)
    const currentUrl = page.url() ? new URL(page.url()) : null
    const isAlreadyThere = currentUrl
      && currentUrl.origin === targetUrl.origin
      && currentUrl.pathname === targetUrl.pathname
      && currentUrl.search === targetUrl.search
      && currentUrl.hash === targetUrl.hash

    if (!isAlreadyThere) {
      await page.goto(targetUrl.toString(), { waitUntil: 'networkidle' })
    }

    await ensureCursorOverlay(page, args)
    await moveTutorialCursor(page, args, action.cursorX || 92, action.cursorY || 112)
    return
  }

  if (action.type === 'reload') {
    await page.reload({ waitUntil: 'networkidle' })
    await ensureCursorOverlay(page, args)
    await moveTutorialCursor(page, args, action.cursorX || 92, action.cursorY || 112)
    return
  }

  if (action.type === 'click') {
    if (action.pageTreeAddChildForText) {
      const point = await pageTreeAddChildPoint(page, action.pageTreeAddChildForText)

      if (!point) {
        throw new Error(`Unable to find the add child page button for page tree row "${action.pageTreeAddChildForText}".`)
      }

      await moveTutorialCursor(page, args, point.x, point.y)
      await flashClickPulse(page, args, point.x, point.y)
      if (action.mockOnly && !args.mockApi) return
      await page.mouse.click(point.x, point.y)
      console.log(`      Clicked page-tree add child at ${Math.round(point.x)},${Math.round(point.y)} (${point.rowText || 'unknown row'}, button ${point.buttonIndex}, score ${point.score})`)
      return
    }

    const locator = resolveLocator(page, action)
    const point = await locatorCenter(locator, actionTimeout)

    await moveTutorialCursor(page, args, point.x, point.y)
    await flashClickPulse(page, args, point.x, point.y)
    if (action.mockOnly && !args.mockApi) return
    await locator.first().click()
    return
  }

  if (action.type === 'fill') {
    const locator = resolveLocator(page, action)
    const point = await locatorCenter(locator, actionTimeout)

    await moveTutorialCursor(page, args, point.x, point.y)
    await flashClickPulse(page, args, point.x, point.y)
    await locator.first().click()
    await locator.first().fill('')
    await showTypingBadge(page, args, point.x, point.y, action.typingLabel || 'Typing')
    await locator.first().pressSequentially(action.value || '', { delay: action.delayMs ?? args.typingDelayMs })
    await hideTypingBadge(page, args)
    return
  }

  if (action.type === 'select') {
    const locator = resolveLocator(page, action)
    const point = await locatorCenter(locator, actionTimeout)

    await moveTutorialCursor(page, args, point.x, point.y)
    await flashClickPulse(page, args, point.x, point.y)
    await locator.first().selectOption(action.value || action.label || '')
    return
  }

  if (action.type === 'waitForText') {
    await page.getByText(action.text, { exact: Boolean(action.exact) }).first().waitFor({ timeout: action.timeout || 10000 })
    return
  }

  if (action.type === 'caption') {
    await page.waitForTimeout(action.ms || 1200)
    return
  }

  if (action.type === 'pause') {
    await page.waitForTimeout(action.ms || 1000)
  }
}

const describeActionTarget = (action = {}) => {
  const targetFields = [
    ['selector', action.selector],
    ['label', action.label],
    ['placeholder', action.placeholder],
    ['text', action.text],
    ['role', action.role ? `${action.role}${action.name ? `:${action.name}` : ''}` : ''],
    ['rowText', action.rowText],
    ['pageTreeAddChildForText', action.pageTreeAddChildForText],
    ['path', action.path]
  ].filter(([, value]) => value)

  if (targetFields.length === 0) return 'no target'
  return targetFields.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(', ')
}

const actionErrorMessage = (error) => {
  if (!error) return 'Unknown error'
  if (error.name && error.message) return `${error.name}: ${error.message}`
  if (error.message) return error.message
  return String(error)
}

const runActionBestEffort = async (page, action, baseUrl, args, segment) => {
  try {
    await runAction(page, action, baseUrl, args)
    return { ok: true }
  } catch (error) {
    await hideTypingBadge(page, args).catch(() => {})
    const target = describeActionTarget(action)
    console.warn(`    ! Part ${segment.partIndex}: ${action.type || 'unknown'} action failed (${target}); continuing without this action.`)
    console.warn(`      ${actionErrorMessage(error)}`)
    return { ok: false, error }
  }
}

const addSfxEventsForAction = (sfxEvents, action, actionStart) => {
  if (action.type === 'goto' || action.type === 'reload') {
    sfxEvents.push({ type: 'navigate', at: actionStart + 250 })
  }

  if (action.type === 'click') {
    sfxEvents.push({ type: 'click', at: actionStart + 250 })
  }

  if (action.type === 'fill') {
    const valueLength = String(action.value || '').length
    for (let index = 0; index < valueLength; index += 1) {
      sfxEvents.push({ type: 'key', at: actionStart + 180 + (index * 55) })
    }
  }
}

const createContextOptions = (args) => {
  const contextOptions = {
    baseURL: args.baseUrl,
    viewport: { width: args.width, height: args.height },
    serviceWorkers: 'block',
    recordVideo: {
      dir: args.recordingTempDir,
      size: { width: args.width, height: args.height }
    }
  }

  if (args.storageState && existsSync(args.storageState)) {
    contextOptions.storageState = args.storageState
  }

  return contextOptions
}

const installRecordingStateReset = async (page, args) => {
  if (!args.cleanBrowserState) return

  await page.addInitScript(() => {
    const accessToken = window.localStorage.getItem('access_token')
    const refreshToken = window.localStorage.getItem('refresh_token')

    window.localStorage.clear()
    window.sessionStorage.clear()

    if (accessToken) window.localStorage.setItem('access_token', accessToken)
    if (refreshToken) window.localStorage.setItem('refresh_token', refreshToken)

    window.__HOWTO_RECORDING__ = true
  })
}

const guideLabel = ({ doc, guide }) => `${doc.title || doc.id} / ${guide.title || guide.id}`

const safeGuideName = (doc, guide) => `${doc.id}-${guide.id}`.replace(/[^a-z0-9_-]+/gi, '-')

const ensureSentence = (value = '') => {
  const trimmed = value.toString().trim()
  if (!trimmed) return ''
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

const lowerFirst = (value = '') => {
  const trimmed = value.toString().trim()
  if (!trimmed) return ''
  return `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`
}

const contextAction = (caption, args, overrides = {}) => ({
  type: 'caption',
  caption,
  preHoldMs: 250,
  ms: args.contextHoldMs,
  holdMs: 250,
  ...overrides
})

const guideContextActions = (guide, args) => {
  if (!args.contextSegments) return []

  const title = getLocalizedValue(guide, 'title', args.language) || guide.title
  const summary = getLocalizedValue(guide, 'summary', args.language) || guide.summary
  const goal = getLocalizedValue(guide, 'goal', args.language)
  const why = getLocalizedValue(guide, 'why', args.language)
  const outcome = getLocalizedValue(guide, 'outcome', args.language)

  const intro = goal
    || `In this walkthrough, we are going to ${lowerFirst(title)}. ${ensureSentence(summary)}`
  const purpose = why
    || 'This is useful because it shows the path through the admin interface before you need to do the same task on real content.'
  const wrapUp = outcome
    || 'By the end, you should know where to start, what to click, and what to check before you save or publish your work.'

  return [
    contextAction(intro, args, { preHoldMs: 350 }),
    contextAction(purpose, args),
    { after: true, action: contextAction(wrapUp, args, { holdMs: 500 }) }
  ]
}

const guideActions = (guide, args) => {
  const baseActions = guide.actions.length > 0
    ? guide.actions
    : [{ type: 'goto', path: `/help/how-to/${guide.id}`, caption: guide.narration || guide.summary }]
  const contextActions = guideContextActions(guide, args)
  const beforeActions = contextActions.filter(item => !item.after)
  const afterActions = contextActions.filter(item => item.after).map(item => item.action)

  return [
    ...beforeActions,
    ...baseActions,
    ...afterActions
  ]
}

const copyAudioPart = async (sourcePath, partPath) => {
  if (resolve(sourcePath) !== resolve(partPath)) {
    await copyFile(sourcePath, partPath)
  }
}

const prepareActionSegments = async (args, guide, actions, safeName) => {
  console.log('  - Preparing per-step narration')

  const segments = []

  for (const [index, action] of actions.entries()) {
    const sourceCaption = getActionCaption(action, guide, args.language)
    const caption = await translateText(sourceCaption, args)
    const segment = {
      action,
      caption,
      audioPath: '',
      audioDurationMs: 0,
      cached: false,
      partIndex: index + 1
    }

    if (args.voiceProvider === 'elevenlabs' && args.segmentedNarration && caption) {
      const narration = await createElevenLabsSpeech(caption, args)
      const partPath = join(args.workDir, `${safeName}-part-${String(index + 1).padStart(2, '0')}.mp3`)

      await copyAudioPart(narration.audioPath, partPath)

      const durationSeconds = await getMediaDurationSeconds(partPath, args.ffmpegPath)
      segment.audioPath = partPath
      segment.audioDurationMs = Math.ceil(durationSeconds * 1000)
      segment.cached = narration.cached

      console.log(`    Part ${index + 1}: ${formatDuration(durationSeconds)} -> ${partPath}`)
    }

    segments.push(segment)
  }

  return segments
}

const getInitialFramePath = (guide) => {
  const firstGoto = (guide.actions || []).find(action => action.type === 'goto')

  return firstGoto?.path || '/'
}

const shouldCutActionFromVideo = (action, caption, args) => {
  if (!args.cutPageLoad) return false
  if (action.cutFromVideo === false) return false
  if (action.cutFromVideo === true) return true

  return !caption && ['waitForText', 'goto', 'reload'].includes(action.type)
}

const loadInitialFrame = async (page, args, initialPath = '/') => {
  console.log('  - Loading initial frame')
  await page.goto(new URL(resolveActionPath(initialPath), args.baseUrl).toString(), { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
}

const publishHelpVideoArtifacts = async (args, safeName, videoPath, subtitlesPath) => {
  await mkdir(args.publicDir, { recursive: true })

  const publishedVideoPath = join(args.publicDir, `${safeName}.mp4`)
  const publishedSubtitlesPath = join(args.publicDir, `${safeName}.vtt`)

  if (videoPath.endsWith('.mp4') && resolve(videoPath) !== resolve(publishedVideoPath)) {
    await copyFile(videoPath, publishedVideoPath)
  }

  if (subtitlesPath && resolve(subtitlesPath) !== resolve(publishedSubtitlesPath)) {
    await copyFile(subtitlesPath, publishedSubtitlesPath)
  }

  return {
    videoPath: videoPath.endsWith('.mp4') ? publishedVideoPath : '',
    subtitlesPath: publishedSubtitlesPath
  }
}

const recordGuide = async (browser, args, { doc, guide }) => {
  const actions = guideActions(guide, args)
  const safeName = safeGuideName(doc, guide)
  const webmPath = join(args.outputDir, `${safeName}.webm`)
  const mp4Path = join(args.outputDir, `${safeName}.mp4`)
  const subtitlesPath = join(args.outputDir, `${safeName}.vtt`)
  const segments = await prepareActionSegments(args, guide, actions, safeName)

  console.log('  - Capturing browser actions')
  const context = await browser.newContext(createContextOptions(args))
  const page = await context.newPage()
  await installRecordingStateReset(page, args)

  if (args.mockApi) {
    await mockCmsApi(page)
    await page.addInitScript(() => {
      window.localStorage.setItem('access_token', 'howto-video-token')
      window.localStorage.setItem('refresh_token', 'howto-video-refresh-token')
    })
  }

  const cues = []
  const sfxEvents = []
  const narrationEvents = []
  const timelineCuts = []
  const startedAt = Date.now()

  await loadInitialFrame(page, args, getInitialFramePath(guide))
  const initialLoadMs = Date.now() - startedAt

  if (args.trimInitialLoad && initialLoadMs >= args.initialLoadTrimThresholdMs) {
    timelineCuts.push({
      start: 0,
      end: initialLoadMs,
      reason: 'initial page load'
    })
    console.log(`    Detected initial page load: ${formatDuration(initialLoadMs / 1000)}; trimming it from the final MP4`)
  }

  for (const segment of segments) {
    const { action, caption } = segment
    const narrationStart = Date.now() - startedAt

    if (caption) {
      console.log(`    Part ${segment.partIndex}: narrating "${caption.slice(0, 72)}${caption.length > 72 ? '...' : ''}"`)
    } else {
      console.log(`    Part ${segment.partIndex}: silent ${action.type}`)
    }

    if (args.overlayCaptions && caption) {
      await setCaptionOverlay(page, caption)
    }

    if (segment.audioPath) {
      narrationEvents.push({
        audioPath: segment.audioPath,
        at: narrationStart,
        durationMs: segment.audioDurationMs,
        text: caption,
        partIndex: segment.partIndex
      })
      await page.waitForTimeout(action.narrationLeadMs ?? args.narrationActionLeadMs)
    } else if (caption) {
      await page.waitForTimeout(action.preHoldMs ?? args.noVoicePreHoldMs)
    }

    const actionStart = Date.now() - startedAt

    console.log(`    Part ${segment.partIndex}: running ${action.type}`)
    const actionResult = await runActionBestEffort(page, action, args.baseUrl, args, segment)
    const actionEnd = Date.now() - startedAt

    if (actionResult.ok && args.sfx) {
      addSfxEventsForAction(sfxEvents, action, actionStart)
    }

    if (actionResult.ok && shouldCutActionFromVideo(action, caption, args)) {
      timelineCuts.push({
        start: actionStart,
        end: actionEnd,
        reason: `${action.type} loading/wait`
      })
    }

    const elapsedSegmentMs = Date.now() - startedAt - narrationStart
    const actionHoldMs = Number.isFinite(Number(action.holdMs)) ? Number(action.holdMs) : null
    const targetHoldMs = (actionHoldMs ?? (segment.audioPath ? 0 : args.noVoiceHoldMs)) + args.globalHoldMs
    const targetSegmentMs = segment.audioPath
      ? Math.max(segment.audioDurationMs + 120, targetHoldMs)
      : targetHoldMs
    const remainingSegmentMs = targetSegmentMs - elapsedSegmentMs
    const postActionHoldMs = action.postHoldMs ?? args.postActionHoldMs

    await page.waitForTimeout(Math.max(postActionHoldMs, remainingSegmentMs, 0))

    if (caption) {
      cues.push({
        start: narrationStart,
        end: Date.now() - startedAt,
        text: caption
      })
    }
  }

  if (args.overlayCaptions) {
    await setCaptionOverlay(page, '')
  }

  const video = page.video()
  await page.close()
  await context.close()

  const audioPaths = []
  const manifestAudio = {}
  const cuts = normalizeTimelineCuts(timelineCuts)

  if (cuts.length > 0) {
    const originalCueCount = cues.length
    const originalNarrationCount = narrationEvents.length
    const originalSfxCount = sfxEvents.length

    cues.splice(0, cues.length, ...remapTimelineCues(cues, cuts))
    narrationEvents.splice(0, narrationEvents.length, ...remapTimelineEvents(narrationEvents, cuts, ['at']))
    sfxEvents.splice(0, sfxEvents.length, ...remapTimelineEvents(sfxEvents, cuts, ['at']))

    console.log(`  - Removed ${formatDuration(cuts.reduce((total, cut) => total + (cut.end - cut.start), 0) / 1000)} of loading/waiting from the timeline`)
    console.log(`    Remapped ${originalCueCount} subtitle cue${originalCueCount === 1 ? '' : 's'}, ${originalNarrationCount} narration event${originalNarrationCount === 1 ? '' : 's'}, ${originalSfxCount} sound event${originalSfxCount === 1 ? '' : 's'}`)
  }

  if (narrationEvents.length > 0) {
    console.log('  - Building segmented narration track')
    const narrationTrackPath = join(args.workDir, `${safeName}-narration.mp3`)
    const narrationAudioPath = await createTimelineAudioTrack(narrationEvents, narrationTrackPath, args, 'narration timeline')

    if (narrationAudioPath) {
      audioPaths.push(narrationAudioPath)
      manifestAudio.narration = {
        provider: 'elevenlabs',
        mode: 'segmented',
        language: args.language,
        voiceId: args.voiceId,
        modelId: args.elevenLabsModelId,
        audio: narrationAudioPath,
        parts: narrationEvents.map(event => ({
          index: event.partIndex,
          audio: event.audioPath,
          at: event.at,
          durationMs: event.durationMs,
          text: event.text
        }))
      }
    }
  } else if (args.voiceProvider === 'elevenlabs') {
    console.log('  - Generating narration')
    const sourceNarrationText = buildNarrationText(guide, cues, args.language)
    const narrationText = await translateText(sourceNarrationText, args)

    if (narrationText) {
      const narration = await createElevenLabsSpeech(narrationText, args)
      audioPaths.push(narration.audioPath)
      manifestAudio.narration = {
        provider: 'elevenlabs',
        language: args.language,
        voiceId: args.voiceId,
        modelId: args.elevenLabsModelId,
        mode: 'linear',
        audio: narration.audioPath,
        cached: narration.cached,
        text: narrationText
      }
    }
  }

  if (args.sfx) {
    console.log('  - Generating interface sounds')
    const sfxPath = join(args.workDir, `${safeName}-sfx.mp3`)
    const sfxAudioPath = await createSfxTrack(sfxEvents, cues.at(-1)?.end || 1000, sfxPath, args)

    if (sfxAudioPath) {
      audioPaths.push(sfxAudioPath)
      manifestAudio.sfx = {
        audio: sfxAudioPath,
        events: sfxEvents.length
      }
    }
  }

  const rawVideoPath = await video.path()
  const cutVideoPath = cuts.length > 0
    ? await createCutVideo(rawVideoPath, join(args.workDir, `${safeName}-cut.mp4`), args, cuts)
    : rawVideoPath

  try {
    if (args.format === 'webm' || args.format === 'both') {
      if (cuts.length > 0) {
        console.warn('    Timeline cuts are applied to the MP4 output; WebM copy keeps the raw browser recording.')
      }
      await copyFile(rawVideoPath, webmPath)
    }

  if (args.format === 'mp4' || args.format === 'both') {
    console.log('  - Encoding MP4')
    if (audioPaths.length === 0) {
      console.warn('    No audio track will be muxed. Use --voice elevenlabs for narrated videos.')
    }
    await convertWebmToMp4(cutVideoPath, mp4Path, args, audioPaths)
  }
  } finally {
    await rm(rawVideoPath, { force: true })
    if (cutVideoPath !== rawVideoPath) {
      await rm(cutVideoPath, { force: true })
    }
  }

  await writeVtt(subtitlesPath, cues)
  const videoPath = args.format === 'webm' ? webmPath : mp4Path
  const published = await publishHelpVideoArtifacts(args, safeName, videoPath, subtitlesPath)

  const manifestPath = join(args.workDir, `${safeName}.json`)
  const manifest = {
    topicId: doc.id,
    guideId: guide.id,
    title: guide.title,
    format: args.format,
    video: videoPath,
    subtitles: subtitlesPath,
    publicVideo: published.videoPath,
    publicSubtitles: published.subtitlesPath,
    timelineCuts: cuts,
    sourceMarkdown: guide.sourcePath || join(args.docsDir, `${doc.id}.md`)
  }

  if (args.format === 'webm' || args.format === 'both') {
    manifest.webm = webmPath
  }

  if (args.format === 'mp4' || args.format === 'both') {
    manifest.mp4 = mp4Path
  }

  if (Object.keys(manifestAudio).length > 0) {
    manifest.audio = manifestAudio
  }

  await writeFile(manifestPath, JSON.stringify({
    ...manifest
  }, null, 2), 'utf8')

  console.log(`Recorded ${guide.title}`)
  console.log(`Video: ${videoPath}`)
  console.log(`Subtitles: ${subtitlesPath}`)
  if (published.videoPath) {
    console.log(`Published video: ${published.videoPath}`)
  }
  console.log(`Published subtitles: ${published.subtitlesPath}`)
  console.log(`Manifest: ${manifestPath}`)

  return {
    title: guide.title,
    videoPath,
    subtitlesPath,
    manifestPath
  }
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printUsage()
    return
  }

  validateArgs(args)

  if (args.listVoices) {
    await listElevenLabsVoices(args)
    return
  }

  const docs = await loadDocs(args.docsDir)
  const targets = findGuides(docs, args)

  if (targets.length === 0) {
    console.error('No matching how-to guide found.')
    process.exitCode = 1
    return
  }

  const { recordableTargets, skippedTargets } = filterActionableTargets(targets, args)

  if (skippedTargets.length > 0) {
    console.warn(
      `Skipping ${skippedTargets.length} how-to guide${skippedTargets.length === 1 ? '' : 's'} with fewer than ${pluralizeSteps(args.minActionableSteps)}.`
    )
    skippedTargets.forEach(target => {
      console.warn(`  - ${guideLabel(target)} (${pluralizeSteps(target.actionableSteps)})`)
    })
    console.warn('    Add click/fill/select actions to the guide video block, or run with --allow-passive-guides.')
  }

  if (recordableTargets.length === 0) {
    console.error('No recordable how-to guides found.')
    process.exitCode = 1
    return
  }

  await mkdir(args.outputDir, { recursive: true })
  await mkdir(args.workDir, { recursive: true })
  console.log(`Preparing ${recordableTargets.length} how-to guide${recordableTargets.length === 1 ? '' : 's'}.`)
  console.log(`Base URL: ${args.baseUrl}`)
  console.log(`Docs: ${args.docsDir}`)
  console.log(`Output: ${args.outputDir}`)
  console.log(`Public output: ${args.publicDir}`)
  console.log(`Work dir: ${args.workDir}`)
  console.log(`Language: ${args.language}`)

  const browser = await chromium.launch({ headless: args.headless })
  const recordings = []

  try {
    for (const [index, target] of recordableTargets.entries()) {
      const label = guideLabel(target)
      console.log(`[${index + 1}/${recordableTargets.length}] Recording ${label}`)
      recordings.push(await recordGuide(browser, args, target))
      console.log(`[${index + 1}/${recordableTargets.length}] Done ${label}`)
    }
  } finally {
    await browser.close()
    await rm(args.recordingTempDir, { force: true, recursive: true })
  }

  console.log(`Recorded ${recordings.length} how-to guide${recordings.length === 1 ? '' : 's'}.`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
