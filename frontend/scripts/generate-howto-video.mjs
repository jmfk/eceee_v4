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
    outputDir: process.env.HOWTO_OUTPUT_DIR || join(frontendRoot, 'howto-video-output'),
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
    language: process.env.HOWTO_LANGUAGE || 'en',
    voiceId: process.env.HOWTO_VOICE_ID || '',
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
    elevenLabsModelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
    elevenLabsOutputFormat: process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128',
    audioCacheDir: process.env.HOWTO_AUDIO_CACHE_DIR || join(frontendRoot, 'howto-audio-cache'),
    translationProvider: process.env.HOWTO_TRANSLATION_PROVIDER || '',
    translationModel: process.env.HOWTO_TRANSLATION_MODEL || 'gpt-5.4-mini',
    translationCacheDir: process.env.HOWTO_TRANSLATION_CACHE_DIR || join(frontendRoot, 'howto-translation-cache'),
    openAiApiKey: process.env.OPENAI_API_KEY || '',
    listVoices: false,
    voiceSearch: process.env.HOWTO_VOICE_SEARCH || '',
    voiceType: process.env.HOWTO_VOICE_TYPE || '',
    voiceCategory: process.env.HOWTO_VOICE_CATEGORY || '',
    voicePageSize: Number(process.env.HOWTO_VOICE_PAGE_SIZE || 20),
    sfx: process.env.HOWTO_SFX === '1',
    help: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--base-url') args.baseUrl = next
    if (arg === '--output-dir') args.outputDir = next
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
    if (arg === '--translate') args.translationProvider = next && !next.startsWith('--') ? next : 'openai'
    if (arg === '--no-translate') args.translationProvider = ''
    if (arg === '--translation-model') args.translationModel = next
    if (arg === '--translation-cache-dir') args.translationCacheDir = next
    if (arg === '--list-voices') args.listVoices = true
    if (arg === '--voice-search') args.voiceSearch = next
    if (arg === '--voice-type') args.voiceType = next
    if (arg === '--voice-category') args.voiceCategory = next
    if (arg === '--voice-page-size') args.voicePageSize = Number(next)
    if (arg === '--sfx') args.sfx = true
    if (arg === '--no-sfx') args.sfx = false
    if (arg === '--help' || arg === '-h') args.help = true

    if (arg.startsWith('--') && next && !next.startsWith('--')) {
      index += 1
    }
  }

  if (!args.voiceId) {
    args.voiceId = getEnvVoiceIdForLanguage(args.language) || process.env.ELEVENLABS_VOICE_ID || ''
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
  --output-dir <path>      Output folder. Defaults to frontend/howto-video-output.
  --format <webm|mp4|both> Output format. Defaults to webm.
  --voice elevenlabs        Generate narration audio with ElevenLabs and mux it into MP4.
  --language <code>         Narration language. Use "sv" for Swedish. Defaults to en.
  --voice-id <id>           ElevenLabs voice ID. Also read from HOWTO_VOICE_ID,
                            ELEVENLABS_VOICE_ID_SWE, ELEVENLABS_VOICE_ID_ENG,
                            or ELEVENLABS_VOICE_ID.
  --model-id <id>           ElevenLabs model. Defaults to eleven_multilingual_v2.
  --translate openai        Translate captions/subtitles/narration before TTS.
  --translation-model <id>  OpenAI translation model. Defaults to gpt-5.4-mini.
  --list-voices             List available ElevenLabs voices, then exit.
  --voice-search <term>     Search voices by name, description, or labels.
  --voice-type <type>       Filter voices. Examples: default, community, workspace, saved.
  --voice-category <type>   Filter category. Examples: premade, generated, professional.
  --sfx                     Mix in simple computer sounds for clicks, typing, and navigation.
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

  if (args.translationProvider && args.translationProvider !== 'openai') {
    throw new Error(`Unsupported --translate "${args.translationProvider}". Use "openai".`)
  }

  if (args.translationProvider === 'openai' && !isEnglishLanguage(args.language) && !args.openAiApiKey) {
    throw new Error('OPENAI_API_KEY is required when using --translate openai.')
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

const convertWebmToMp4 = async (webmPath, mp4Path, ffmpegPath, audioPaths = []) => {
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

  await runCommand(ffmpegPath, [
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
    return readFile(translationPath, 'utf8')
  }

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
    throw new Error(`OpenAI translation failed: ${response.status} ${await response.text()}`)
  }

  const translated = extractOpenAiText(await response.json()).trim()
  if (!translated) {
    throw new Error('OpenAI translation returned no text.')
  }

  await writeFile(translationPath, translated, 'utf8')
  return translated
}

const elevenLabsHeaders = (args) => ({
  'Content-Type': 'application/json',
  'xi-api-key': args.elevenLabsApiKey
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
    return { audioPath, cached: true }
  }

  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${args.voiceId}`)
  url.searchParams.set('output_format', args.elevenLabsOutputFormat)

  const response = await fetch(url, {
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

  if (!response.ok) {
    throw new Error(`ElevenLabs speech generation failed: ${response.status} ${await response.text()}`)
  }

  await writeFile(audioPath, Buffer.from(await response.arrayBuffer()))
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

const runAction = async (page, action, baseUrl) => {
  if (action.type === 'goto') {
    await page.goto(new URL(action.path || '/', baseUrl).toString(), { waitUntil: 'networkidle' })
    return
  }

  if (action.type === 'click') {
    const locator = action.selector
      ? page.locator(action.selector)
      : page.getByText(action.text, { exact: Boolean(action.exact) })
    await locator.first().click()
    return
  }

  if (action.type === 'fill') {
    const locator = action.selector
      ? page.locator(action.selector)
      : page.getByLabel(action.label)
    await locator.first().fill(action.value || '')
    return
  }

  if (action.type === 'waitForText') {
    await page.getByText(action.text, { exact: Boolean(action.exact) }).first().waitFor({ timeout: action.timeout || 10000 })
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
      dir: join(args.outputDir, recordingTempDirName),
      size: { width: args.width, height: args.height }
    }
  }

  if (args.storageState && existsSync(args.storageState)) {
    contextOptions.storageState = args.storageState
  }

  return contextOptions
}

const recordGuide = async (browser, args, { doc, guide }) => {
  const context = await browser.newContext(createContextOptions(args))
  const page = await context.newPage()

  if (args.mockApi) {
    await mockCmsApi(page)
    await page.addInitScript(() => {
      window.localStorage.setItem('access_token', 'howto-video-token')
      window.localStorage.setItem('refresh_token', 'howto-video-refresh-token')
    })
  }

  const actions = guide.actions.length > 0
    ? guide.actions
    : [{ type: 'goto', path: `/help/how-to/${guide.id}`, caption: guide.narration || guide.summary }]

  const cues = []
  const sfxEvents = []
  const startedAt = Date.now()

  for (const action of actions) {
    const sourceCaption = getActionCaption(action, guide, args.language)
    const caption = await translateText(sourceCaption, args)
    const start = Date.now() - startedAt

    if (args.overlayCaptions) {
      await setCaptionOverlay(page, caption)
    }

    if (args.sfx) {
      if (action.type === 'goto') {
        sfxEvents.push({ type: 'navigate', at: start + 250 })
      }

      if (action.type === 'click') {
        sfxEvents.push({ type: 'click', at: start + 250 })
      }

      if (action.type === 'fill') {
        const valueLength = String(action.value || '').length
        for (let index = 0; index < valueLength; index += 1) {
          sfxEvents.push({ type: 'key', at: start + 180 + (index * 55) })
        }
      }
    }

    await runAction(page, action, args.baseUrl)
    await page.waitForTimeout(action.holdMs || 1500)

    cues.push({
      start,
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

  const safeName = `${doc.id}-${guide.id}`.replace(/[^a-z0-9_-]+/gi, '-')
  const webmPath = join(args.outputDir, `${safeName}.webm`)
  const mp4Path = join(args.outputDir, `${safeName}.mp4`)
  const subtitlesPath = join(args.outputDir, `${safeName}.vtt`)
  const audioPaths = []
  const manifestAudio = {}

  if (args.voiceProvider === 'elevenlabs') {
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
        audio: narration.audioPath,
        cached: narration.cached,
        text: narrationText
      }
    }
  }

  if (args.sfx) {
    const sfxPath = join(args.outputDir, `${safeName}-sfx.mp3`)
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
      await convertWebmToMp4(rawVideoPath, mp4Path, args.ffmpegPath, audioPaths)
    }
  } finally {
    await rm(rawVideoPath, { force: true })
  }

  await writeVtt(subtitlesPath, cues)

  const manifestPath = join(args.outputDir, `${safeName}.json`)
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

  const browser = await chromium.launch({ headless: args.headless })
  const recordings = []

  try {
    for (const target of targets) {
      recordings.push(await recordGuide(browser, args, target))
    }
  } finally {
    await browser.close()
    await rm(join(args.outputDir, recordingTempDirName), { force: true, recursive: true })
  }

  console.log(`Recorded ${recordings.length} how-to guide${recordings.length === 1 ? '' : 's'}.`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
