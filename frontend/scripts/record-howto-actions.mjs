import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(__dirname, '..')

const parseArgs = (argv) => {
  const args = {
    baseUrl: process.env.HOWTO_BASE_URL || 'http://localhost:3000',
    outputDir: '',
    storageState: '',
    width: Number(process.env.HOWTO_VIDEO_WIDTH || 1440),
    height: Number(process.env.HOWTO_VIDEO_HEIGHT || 900),
    sessionId: ''
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--base-url') args.baseUrl = next
    if (arg === '--output-dir') args.outputDir = next
    if (arg === '--storage-state') args.storageState = next
    if (arg === '--width') args.width = Number(next)
    if (arg === '--height') args.height = Number(next)
    if (arg === '--session-id') args.sessionId = next
  }

  if (!args.outputDir) {
    args.outputDir = join(frontendRoot, '.howto-script-preview', 'recordings', args.sessionId || String(process.pid))
  }

  return args
}

const recorderInitScript = () => {
  const now = () => Date.now()
  const normalizeText = value => (value || '').replace(/\s+/g, ' ').trim()
  const cssString = value => String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const cssEscape = value => {
    if (window.CSS?.escape) return window.CSS.escape(value)
    return String(value).replace(/[^a-zA-Z0-9_-]/g, character => `\\${character}`)
  }
  const isVisible = element => {
    if (!element || !(element instanceof Element)) return false
    const style = window.getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && rect.width > 0
      && rect.height > 0
  }
  const accessibleName = element => {
    const ariaLabel = element.getAttribute('aria-label')
    if (ariaLabel) return normalizeText(ariaLabel)
    const labelledBy = element.getAttribute('aria-labelledby')
    if (labelledBy) {
      const label = labelledBy
        .split(/\s+/)
        .map(id => document.getElementById(id)?.textContent || '')
        .join(' ')
      if (normalizeText(label)) return normalizeText(label)
    }
    const title = element.getAttribute('title')
    if (title) return normalizeText(title)
    return normalizeText(element.innerText || element.textContent || '')
  }
  const roleFor = element => {
    const explicitRole = element.getAttribute('role')
    if (explicitRole) return explicitRole
    const tagName = element.tagName.toLowerCase()
    if (tagName === 'button') return 'button'
    if (tagName === 'a' && element.getAttribute('href')) return 'link'
    if (tagName === 'select') return 'combobox'
    if (tagName === 'textarea') return 'textbox'
    if (tagName === 'input') {
      const type = (element.getAttribute('type') || 'text').toLowerCase()
      if (['button', 'submit', 'reset'].includes(type)) return 'button'
      if (type === 'checkbox') return 'checkbox'
      if (type === 'radio') return 'radio'
      return 'textbox'
    }
    return ''
  }
  const labelFor = element => {
    if (element.id) {
      const label = document.querySelector(`label[for="${cssEscape(element.id)}"]`)
      if (label) return normalizeText(label.textContent)
    }
    const wrappingLabel = element.closest('label')
    if (wrappingLabel) return normalizeText(wrappingLabel.textContent)
    return ''
  }
  const shortText = element => {
    const text = normalizeText(element.innerText || element.textContent || '')
    return text.length > 90 ? '' : text
  }
  const selectorFor = element => {
    if (!element || !(element instanceof Element)) return ''
    const testId = element.getAttribute('data-testid')
    if (testId) return `[data-testid="${cssString(testId)}"]`
    if (element.id) return `#${cssEscape(element.id)}`

    const ariaLabel = element.getAttribute('aria-label')
    const tagName = element.tagName.toLowerCase()
    if (ariaLabel) return `${tagName}[aria-label="${cssString(ariaLabel)}"]`

    const parent = element.parentElement
    if (!parent) return tagName

    const siblings = [...parent.children].filter(candidate => candidate.tagName === element.tagName)
    const index = siblings.indexOf(element) + 1
    return `${selectorFor(parent)} > ${tagName}${siblings.length > 1 ? `:nth-of-type(${index})` : ''}`
  }
  const describeElement = source => {
    const element = source?.closest?.('button,a,input,textarea,select,[role],[data-testid],[aria-label]') || source
    if (!element || !(element instanceof Element)) return {}
    const tagName = element.tagName.toLowerCase()
    const role = roleFor(element)
    const name = role ? accessibleName(element) : ''

    return {
      selector: selectorFor(element),
      testId: element.getAttribute('data-testid') || '',
      tagName,
      role,
      name,
      label: labelFor(element),
      placeholder: element.getAttribute('placeholder') || '',
      text: shortText(element),
      inputType: tagName === 'input' ? (element.getAttribute('type') || 'text') : '',
      visible: isVisible(element)
    }
  }
  const record = event => {
    if (!window.__eceeeRecordActionEvent) return
    window.__eceeeRecordActionEvent({
      ...event,
      url: window.location.href,
      timestamp: now()
    }).catch(() => {})
  }
  const isInteractiveTarget = target => (
    ['button', 'a', 'input', 'textarea', 'select', 'option'].includes(target.tagName)
    || ['button', 'link', 'menuitem', 'checkbox', 'radio', 'textbox', 'combobox'].includes(target.role)
  )

  let lastHover = null
  let lastHoverTrigger = null
  document.addEventListener('mouseover', event => {
    const target = describeElement(event.target)
    if (!target.selector || target.selector === 'html' || target.selector === 'body') return
    lastHover = { ...target, timestamp: now() }
    if (!isInteractiveTarget(target)) lastHoverTrigger = lastHover
    record({ kind: 'hover', target })
  }, true)
  document.addEventListener('click', event => {
    const target = describeElement(event.target)
    if (!target.selector) return
    record({ kind: 'click', target, hoverTarget: lastHoverTrigger || lastHover })
  }, true)
  document.addEventListener('input', event => {
    const target = describeElement(event.target)
    if (!['input', 'textarea'].includes(target.tagName)) return
    record({ kind: 'input', target, value: event.target.value || '' })
  }, true)
  document.addEventListener('change', event => {
    const target = describeElement(event.target)
    if (target.tagName === 'select') {
      const option = event.target.selectedOptions?.[0]
      record({
        kind: 'select',
        target,
        value: event.target.value || '',
        selectedLabel: option?.textContent ? normalizeText(option.textContent) : ''
      })
      return
    }

    if (['input', 'textarea'].includes(target.tagName)) {
      record({ kind: 'input', target, value: event.target.value || '' })
    }
  }, true)
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  const events = []
  const rawVideoDir = join(args.outputDir, 'raw-video')
  const eventsPath = join(args.outputDir, 'events.json')
  const metadataPath = join(args.outputDir, 'metadata.json')
  let browser = null
  let context = null
  let stopped = false

  const writeEvents = () => {
    writeFileSync(eventsPath, JSON.stringify(events, null, 2), 'utf8')
  }
  const writeMetadata = (metadata = {}) => {
    writeFileSync(metadataPath, JSON.stringify({
      sessionId: args.sessionId,
      baseUrl: args.baseUrl,
      status: metadata.status || 'running',
      rawVideos: metadata.rawVideos || [],
      stoppedAt: metadata.stoppedAt || '',
      eventCount: events.length
    }, null, 2), 'utf8')
  }
  const record = event => {
    events.push({ id: events.length + 1, ...event })
    writeEvents()
    writeMetadata({ status: 'running' })
  }
  const shutdown = async (status = 'stopped') => {
    if (stopped) return
    stopped = true
    console.log(`Stopping recording session ${args.sessionId || process.pid}...`)
    const pages = context ? context.pages() : []
    await context?.close().catch(() => {})
    await browser?.close().catch(() => {})
    const rawVideos = []

    for (const page of pages) {
      const video = page.video?.()
      if (!video) continue
      const videoPath = await video.path().catch(() => '')
      if (videoPath) rawVideos.push(videoPath)
    }

    writeEvents()
    writeMetadata({ status, rawVideos, stoppedAt: new Date().toISOString() })
    console.log(`Recorded ${events.length} browser event${events.length === 1 ? '' : 's'}.`)
    if (rawVideos[0]) console.log(`Raw reference video: ${rawVideos[0]}`)
  }

  await mkdir(args.outputDir, { recursive: true })
  await mkdir(rawVideoDir, { recursive: true })
  writeEvents()
  writeMetadata({ status: 'starting' })

  process.on('SIGINT', () => {
    shutdown('stopped').then(() => process.exit(0))
  })
  process.on('SIGTERM', () => {
    shutdown('stopped').then(() => process.exit(0))
  })

  browser = await chromium.launch({ headless: false })
  context = await browser.newContext({
    viewport: { width: args.width, height: args.height },
    storageState: args.storageState && existsSync(args.storageState) ? args.storageState : undefined,
    recordVideo: {
      dir: rawVideoDir,
      size: { width: args.width, height: args.height }
    }
  })

  await context.exposeBinding('__eceeeRecordActionEvent', (_source, event) => record(event))
  await context.addInitScript(recorderInitScript)
  const page = await context.newPage()
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      record({ kind: 'navigation', url: frame.url(), timestamp: Date.now() })
    }
  })
  page.on('close', () => {
    if (!stopped && context.pages().length <= 1) {
      shutdown('closed').then(() => process.exit(0))
    }
  })

  console.log(`Recording browser actions against ${args.baseUrl}`)
  console.log('Use the opened browser window to perform the demo, then stop recording from the editor.')
  await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
  writeMetadata({ status: 'running' })
  console.log(`READY ${args.sessionId}`)

  await new Promise(resolve => {
    browser.on('disconnected', resolve)
  })

  await shutdown('closed')
}

main().catch(error => {
  console.error(error.stack || error.message)
  process.exit(1)
})
