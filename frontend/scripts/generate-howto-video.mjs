import { chromium } from 'playwright'
import { mkdir, readdir, readFile, copyFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseHowToMarkdownCollection } from '../src/utils/howToMarkdown.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(__dirname, '..')
const docsDir = join(frontendRoot, 'src/docs/how-to')

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
    overlayCaptions: process.env.HOWTO_NO_OVERLAY !== '1'
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

    if (arg.startsWith('--') && next && !next.startsWith('--')) {
      index += 1
    }
  }

  return args
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

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  const docs = await loadDocs()
  const { doc, guide } = findGuide(docs, args)

  if (!doc || !guide) {
    console.error('No matching how-to guide found.')
    process.exitCode = 1
    return
  }

  await mkdir(args.outputDir, { recursive: true })

  const browser = await chromium.launch({ headless: args.headless })
  const contextOptions = {
    baseURL: args.baseUrl,
    viewport: { width: args.width, height: args.height },
    recordVideo: {
      dir: args.outputDir,
      size: { width: args.width, height: args.height }
    }
  }

  if (args.storageState && existsSync(args.storageState)) {
    contextOptions.storageState = args.storageState
  }

  const context = await browser.newContext(contextOptions)
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
  const startedAt = Date.now()

  for (const action of actions) {
    const caption = action.caption || guide.narration || guide.summary || guide.title
    const start = Date.now() - startedAt

    if (args.overlayCaptions) {
      await setCaptionOverlay(page, caption)
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
  await browser.close()

  const safeName = `${doc.id}-${guide.id}`.replace(/[^a-z0-9_-]+/gi, '-')
  const videoPath = join(args.outputDir, `${safeName}.webm`)
  const subtitlesPath = join(args.outputDir, `${safeName}.vtt`)

  await copyFile(await video.path(), videoPath)
  await writeVtt(subtitlesPath, cues)

  const manifestPath = join(args.outputDir, `${safeName}.json`)
  await writeFile(manifestPath, JSON.stringify({
    topicId: doc.id,
    guideId: guide.id,
    title: guide.title,
    video: videoPath,
    subtitles: subtitlesPath,
    sourceMarkdown: join(docsDir, `${doc.id}.md`)
  }, null, 2), 'utf8')

  console.log(`Recorded ${guide.title}`)
  console.log(`Video: ${videoPath}`)
  console.log(`Subtitles: ${subtitlesPath}`)
  console.log(`Manifest: ${manifestPath}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
