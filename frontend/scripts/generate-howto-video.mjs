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
const docsDir = join(frontendRoot, 'src/docs/how-to')
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
    workDir: process.env.HOWTO_WORK_DIR || '',
    width: Number(process.env.HOWTO_VIDEO_WIDTH || 1440),
    height: Number(process.env.HOWTO_VIDEO_HEIGHT || 900),
    headless: process.env.HEADED !== '1',
    guideId: '',
    topicId: '',
    storageState: process.env.HOWTO_AUTH_STATE || '',
    mockApi: process.env.HOWTO_MOCK_API === '1',
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
    typingDelayMs: Number(process.env.HOWTO_TYPING_DELAY_MS || 75),
    pointerMoveMs: Number(process.env.HOWTO_POINTER_MOVE_MS || 650),
    help: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--base-url') args.baseUrl = next
    if (arg === '--output-dir') args.outputDir = next
    if (arg === '--work-dir') args.workDir = next
    if (arg === '--topic') args.topicId = next
    if (arg === '--guide') args.guideId = next
    if (arg === '--storage-state') args.storageState = next
    if (arg === '--headed') args.headless = false
    if (arg === '--mock-api') args.mockApi = true
    if (arg === '--no-overlay') args.overlayCaptions = false
    if (arg === '--all') args.all = true
    if (arg === '--format') args.format = next
    if (arg === '--ffmpeg') args.ffmpegPath = next
    if (arg === '--voice') args.voiceProvider = next
    if (arg === '--no-audio') args.voiceProvider = ''
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

  if (!args.workDir) {
    args.workDir = join(frontendRoot, 'howto-video-output/work', args.language)
  }

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
  --output-dir <path>      Public output folder. Defaults to frontend/public/howto-videos/prod/<language>.
  --work-dir <path>        Work folder for temporary audio/manifests. Defaults to frontend/howto-video-output/work/<language>.
  --format <webm|mp4|both> Output format. Defaults to webm.
  --voice elevenlabs        Generate narration audio with ElevenLabs and mux it into MP4.
  --language <code>         Narration language. Use "sv" for Swedish. Defaults to sv.
  --voice-id <id>           ElevenLabs voice ID. Also read from HOWTO_VOICE_ID,
                            ELEVENLABS_VOICE_ID_SWE, ELEVENLABS_VOICE_ID_ENG,
                            or ELEVENLABS_VOICE_ID.
  --model-id <id>           ElevenLabs model. Defaults to eleven_multilingual_v2.
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
  --typing-delay-ms <ms>    Delay per typed character. Defaults to 75.
  --pointer-move-ms <ms>    Cursor move duration before an action. Defaults to 650.
  --mock-api               Stub admin API calls for documentation-only recordings.
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
}

const loadDocs = async () => {
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

const getActionCaption = (action, guide, language) => (
  getLocalizedValue(action, 'caption', language)
  || getLocalizedValue(guide, 'narration', language)
  || getLocalizedValue(guide, 'summary', language)
  || guide.title
)

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
    voice_settings: {
      stability: 0.48,
      similarity_boost: 0.78,
      style: 0.18,
      use_speaker_boost: true
    }
  })
})

const createElevenLabsSpeech = async (text, args) => {
  requireFetch()

  await mkdir(args.audioCacheDir, { recursive: true })

  const cacheKey = hashValue(JSON.stringify({
    provider: 'elevenlabs',
    voiceId: args.voiceId,
    modelId: args.elevenLabsModelId,
    outputFormat: args.elevenLabsOutputFormat,
    language: args.language,
    text
  }))
  const audioPath = join(args.audioCacheDir, `${cacheKey}.mp3`)

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
        width: 96px;
        height: 128px;
        pointer-events: none;
        transform: translate3d(28px, 64px, 0);
        transition: transform 650ms cubic-bezier(.22, .9, .25, 1);
        filter: drop-shadow(0 4px 8px rgba(15, 23, 42, .35));
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
    cursor.style.transform = `translate3d(${Math.round(nextX - 41)}px, ${Math.round(nextY - 41)}px, 0)`
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

const locatorCenter = async (locator) => {
  await locator.first().scrollIntoViewIfNeeded()
  const box = await locator.first().boundingBox()

  if (!box) {
    throw new Error('Unable to locate visible element for tutorial action.')
  }

  return {
    x: box.x + (box.width / 2),
    y: box.y + (box.height / 2)
  }
}

const resolveLocator = (page, action) => {
  if (action.selector) return page.locator(action.selector)
  if (action.label) return page.getByLabel(action.label, { exact: Boolean(action.exact) })
  if (action.placeholder) return page.getByPlaceholder(action.placeholder, { exact: Boolean(action.exact) })
  if (action.role) return page.getByRole(action.role, { name: action.name ? new RegExp(action.name, 'i') : undefined })
  return page.getByText(action.text, { exact: Boolean(action.exact) })
}

const mockCmsApi = async (page) => {
  const json = (route, body, status = 200) => route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body)
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

    if (url.pathname.includes('/webpages/pages/')) {
      return json(route, {
        count: 1,
        next: null,
        previous: null,
        results: [{
          id: 101,
          title: 'Example Site',
          slug: 'example-site',
          parent: null,
          sortOrder: 10,
          children: [],
          childrenCount: 0,
          hostnames: ['example.local'],
          publicationStatus: 'published'
        }]
      })
    }

    return json(route, { count: 0, next: null, previous: null, results: [] })
  })

  await page.route('**/health/**', route => json(route, { status: 'healthy', service: 'eceee-v4-backend' }))
}

const runAction = async (page, action, baseUrl, args) => {
  await ensureCursorOverlay(page, args)

  if (action.type === 'goto') {
    await page.goto(new URL(action.path || '/', baseUrl).toString(), { waitUntil: 'networkidle' })
    await ensureCursorOverlay(page, args)
    await moveTutorialCursor(page, args, action.cursorX || 92, action.cursorY || 112)
    return
  }

  if (action.type === 'click') {
    const locator = resolveLocator(page, action)
    const point = await locatorCenter(locator)

    await moveTutorialCursor(page, args, point.x, point.y)
    await flashClickPulse(page, args, point.x, point.y)
    await locator.first().click()
    return
  }

  if (action.type === 'fill') {
    const locator = resolveLocator(page, action)
    const point = await locatorCenter(locator)

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
    const point = await locatorCenter(locator)

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

const createContextOptions = (args) => {
  const contextOptions = {
    baseURL: args.baseUrl,
    viewport: { width: args.width, height: args.height },
    recordVideo: {
      dir: join(args.workDir, recordingTempDirName),
      size: { width: args.width, height: args.height }
    }
  }

  if (args.storageState && existsSync(args.storageState)) {
    contextOptions.storageState = args.storageState
  }

  return contextOptions
}

const guideLabel = ({ doc, guide }) => `${doc.title || doc.id} / ${guide.title || guide.id}`

const safeGuideName = (doc, guide) => `${doc.id}-${guide.id}`.replace(/[^a-z0-9_-]+/gi, '-')

const guideActions = (guide) => (
  guide.actions.length > 0
    ? guide.actions
    : [{ type: 'goto', path: `/help/how-to/${guide.id}`, caption: guide.narration || guide.summary }]
)

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

const loadInitialFrame = async (page, args) => {
  console.log('  - Loading initial frame')
  await page.goto(new URL('/', args.baseUrl).toString(), { waitUntil: 'networkidle' })
  await page.waitForTimeout(750)
}

const recordGuide = async (browser, args, { doc, guide }) => {
  const actions = guideActions(guide)
  const safeName = safeGuideName(doc, guide)
  const webmPath = join(args.outputDir, `${safeName}.webm`)
  const mp4Path = join(args.outputDir, `${safeName}.mp4`)
  const subtitlesPath = join(args.outputDir, `${safeName}.vtt`)
  const segments = await prepareActionSegments(args, guide, actions, safeName)

  console.log('  - Capturing browser actions')
  const context = await browser.newContext(createContextOptions(args))
  const page = await context.newPage()

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
  const startedAt = Date.now()

  await loadInitialFrame(page, args)

  for (const segment of segments) {
    const { action, caption } = segment
    const narrationStart = Date.now() - startedAt

    console.log(`    Part ${segment.partIndex}: narrating "${caption.slice(0, 72)}${caption.length > 72 ? '...' : ''}"`)
    if (args.overlayCaptions) {
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
      await page.waitForTimeout(segment.audioDurationMs + 300)
    } else {
      await page.waitForTimeout(action.preHoldMs || 900)
    }

    const actionStart = Date.now() - startedAt

    if (args.sfx) {
      if (action.type === 'goto') {
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

    console.log(`    Part ${segment.partIndex}: running ${action.type}`)
    await runAction(page, action, args.baseUrl, args)
    await page.waitForTimeout(action.holdMs || 1500)

    cues.push({
      start: narrationStart,
      end: Date.now() - startedAt,
      text: caption
    })
  }

  if (args.overlayCaptions) {
    await setCaptionOverlay(page, '')
  }

  const video = page.video()
  await page.close()
  await context.close()

  const audioPaths = []
  const manifestAudio = {}

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

  try {
    if (args.format === 'webm' || args.format === 'both') {
      await copyFile(rawVideoPath, webmPath)
    }

    if (args.format === 'mp4' || args.format === 'both') {
      console.log('  - Encoding MP4')
      await convertWebmToMp4(rawVideoPath, mp4Path, args, audioPaths)
    }
  } finally {
    await rm(rawVideoPath, { force: true })
  }

  await writeVtt(subtitlesPath, cues)

  const manifestPath = join(args.workDir, `${safeName}.json`)
  const videoPath = args.format === 'webm' ? webmPath : mp4Path
  const manifest = {
    topicId: doc.id,
    guideId: guide.id,
    title: guide.title,
    format: args.format,
    video: videoPath,
    subtitles: subtitlesPath,
    sourceMarkdown: guide.sourcePath || join(docsDir, `${doc.id}.md`)
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

  const docs = await loadDocs()
  const targets = findGuides(docs, args)

  if (targets.length === 0) {
    console.error('No matching how-to guide found.')
    process.exitCode = 1
    return
  }

  await mkdir(args.outputDir, { recursive: true })
  await mkdir(args.workDir, { recursive: true })
  console.log(`Preparing ${targets.length} how-to guide${targets.length === 1 ? '' : 's'}.`)
  console.log(`Base URL: ${args.baseUrl}`)
  console.log(`Output: ${args.outputDir}`)
  console.log(`Work dir: ${args.workDir}`)
  console.log(`Language: ${args.language}`)

  const browser = await chromium.launch({ headless: args.headless })
  const recordings = []

  try {
    for (const [index, target] of targets.entries()) {
      const label = guideLabel(target)
      console.log(`[${index + 1}/${targets.length}] Recording ${label}`)
      recordings.push(await recordGuide(browser, args, target))
      console.log(`[${index + 1}/${targets.length}] Done ${label}`)
    }
  } finally {
    await browser.close()
    await rm(join(args.workDir, recordingTempDirName), { force: true, recursive: true })
  }

  console.log(`Recorded ${recordings.length} how-to guide${recordings.length === 1 ? '' : 's'}.`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
