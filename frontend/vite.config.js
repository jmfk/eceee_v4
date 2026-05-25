import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const readGitHashFromGitDir = (gitDir) => {
  try {
    const headPath = path.join(gitDir, 'HEAD')

    if (!existsSync(headPath)) {
      return ''
    }

    const head = readFileSync(headPath, 'utf8').trim()

    if (!head.startsWith('ref:')) {
      return head.slice(0, 8)
    }

    const ref = head.replace('ref:', '').trim()
    const refPath = path.join(gitDir, ref)

    if (existsSync(refPath)) {
      return readFileSync(refPath, 'utf8').trim().slice(0, 8)
    }

    const packedRefsPath = path.join(gitDir, 'packed-refs')

    if (!existsSync(packedRefsPath)) {
      return ''
    }

    const packedRef = readFileSync(packedRefsPath, 'utf8')
      .split('\n')
      .find(line => line.endsWith(` ${ref}`))

    return packedRef ? packedRef.split(' ')[0].slice(0, 8) : ''
  } catch {
    return ''
  }
}

const getGitCommitHash = () => {
  const explicitHash = process.env.VITE_GIT_COMMIT_HASH || process.env.GIT_COMMIT_HASH || process.env.IMAGE_TAG

  if (explicitHash) {
    return explicitHash.trim()
  }

  const commands = [
    { command: 'git rev-parse --short HEAD', cwd: path.resolve(__dirname, '..') },
    { command: 'git --git-dir=/repo/.git rev-parse --short HEAD', cwd: __dirname },
  ]

  for (const { command, cwd } of commands) {
    try {
      const hash = execSync(command, {
        cwd,
        stdio: ['ignore', 'pipe', 'ignore'],
      }).toString().trim()

      if (hash) {
        return hash
      }
    } catch {
      // Continue through known dev/prod locations.
    }
  }

  const gitDirs = [
    path.resolve(__dirname, '..', '.git'),
    '/repo/.git',
  ]

  for (const gitDir of gitDirs) {
    const hash = readGitHashFromGitDir(gitDir)

    if (hash) {
      return hash
    }
  }

  return ''
}

const readRequestJson = (req) => new Promise((resolve, reject) => {
  const chunks = []

  req.on('data', chunk => chunks.push(chunk))
  req.on('end', () => {
    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
    } catch (error) {
      reject(error)
    }
  })
  req.on('error', reject)
})

const runHowToRender = (args, onChunk = () => {}) => new Promise((resolveRun, rejectRun) => {
  const child = spawn(process.execPath, ['scripts/generate-howto-video.mjs', ...args], {
    cwd: __dirname,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const output = []
  const appendOutput = (chunk) => {
    const text = chunk.toString()
    output.push(text)
    onChunk(text)
  }

  child.stdout.on('data', appendOutput)
  child.stderr.on('data', appendOutput)
  child.on('error', rejectRun)
  child.on('close', code => {
    const text = output.join('')

    if (code === 0) {
      resolveRun(text)
      return
    }

    rejectRun(new Error(text || `Video generator exited with code ${code}`))
  })
})

const runCodexAgent = ({ prompt, outputPath, sandbox = 'workspace-write' }, onChunk = () => {}) => new Promise((resolveRun, rejectRun) => {
  const codexCommand = process.env.CODEX_CLI || '/Applications/Codex.app/Contents/Resources/codex'
  const repoRoot = path.resolve(__dirname, '..')
  const child = spawn(codexCommand, [
    'exec',
    '-C', repoRoot,
    '--sandbox', sandbox,
    '--ask-for-approval', 'never',
    '--color', 'never',
    '--output-last-message', outputPath,
    '-'
  ], {
    cwd: repoRoot,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe']
  })
  const output = []
  const appendOutput = (chunk) => {
    const text = chunk.toString()
    output.push(text)
    onChunk(text)
  }

  child.stdout.on('data', appendOutput)
  child.stderr.on('data', appendOutput)
  child.on('error', rejectRun)
  child.on('close', code => {
    const text = output.join('')

    if (code === 0) {
      const finalMessage = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : ''
      resolveRun({ log: text, finalMessage })
      return
    }

    rejectRun(new Error(text || `Codex exited with code ${code}`))
  })
  child.stdin.end(prompt)
})

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

const startEventStream = (res) => {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('X-Accel-Buffering', 'no')
}

const writeEvent = (res, type, payload = {}) => {
  res.write(`${JSON.stringify({ type, ...payload })}\n`)
}

const safeSegment = (value, fallback) => String(value || fallback)
  .trim()
  .replace(/[^a-z0-9_-]+/gi, '-')
  .replace(/^-+|-+$/g, '')
  || fallback

const normalizeRenderLanguages = (value) => {
  const allowed = new Set(['sv', 'en'])
  const languages = Array.isArray(value) ? value : [value]
  const normalized = [...new Set(languages
    .map(language => String(language || '').trim().toLowerCase())
    .filter(language => allowed.has(language)))]

  return normalized.length > 0 ? normalized : ['sv']
}

const docsRoot = path.join(__dirname, 'src/docs/how-to')
const translationsRoot = path.join(__dirname, 'src/docs/how-to-translations')
const publicRoot = path.join(__dirname, 'public')
let lastOverwriteUndo = null

const languageName = (language) => {
  const normalized = String(language || '').toLowerCase()
  if (normalized === 'sv' || normalized.startsWith('sv-')) return 'Swedish'
  if (normalized === 'en' || normalized.startsWith('en-')) return 'English'
  return language || 'target language'
}

const extractAnthropicText = (response) => (response.content || [])
  .filter(item => item.type === 'text')
  .map(item => item.text || '')
  .filter(Boolean)
  .join('\n')

const translationPathFor = (sectionId, guideId, language) => path.join(
  translationsRoot,
  safeSegment(language, 'sv'),
  safeSegment(sectionId, 'editor'),
  `${safeSegment(guideId, 'guide')}.md`
)

const setFrontmatterValue = (markdown, key, value) => {
  const source = String(markdown || '').trim()
  const line = `${key}: ${value}`

  if (!source.startsWith('---')) {
    return ['---', line, '---', '', source].join('\n')
  }

  const endIndex = source.indexOf('\n---', 3)
  if (endIndex === -1) return source

  const frontmatterLines = source.slice(3, endIndex).trim().split('\n').filter(Boolean)
  const keyPattern = new RegExp(`^${key}:`, 'i')
  let didReplace = false
  const nextFrontmatter = frontmatterLines.map(frontmatterLine => {
    if (!keyPattern.test(frontmatterLine)) return frontmatterLine
    didReplace = true
    return line
  })

  if (!didReplace) nextFrontmatter.push(line)

  return ['---', ...nextFrontmatter, '---', source.slice(endIndex + 4).trim()].join('\n').trimEnd().concat('\n')
}

const translateMarkdownWithHaiku = async ({ markdown, language }) => {
  const apiKey = process.env.ANTHROPIC_API_KEY || ''
  const model = process.env.HOWTO_TRANSLATION_MODEL || 'claude-3-5-haiku-20241022'

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required to translate help markdown with Haiku.')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 6000,
      system: [
        `Translate this help markdown from English to ${languageName(language)}.`,
        'Return only the translated markdown, with no commentary.',
        'Preserve markdown structure, frontmatter keys, ids, order numbers, paths, URLs, and video URLs.',
        'In video-script JSON blocks, translate caption strings only.',
        'Do not translate action fields such as selector, text, label, placeholder, role, name, value, path, rowText, or rowSelector because they target the UI.'
      ].join(' '),
      messages: [{
        role: 'user',
        content: markdown
      }]
    })
  })

  const responseBody = await response.text()
  if (!response.ok) {
    throw new Error(`Haiku translation failed: ${response.status} ${responseBody}`)
  }

  const translated = extractAnthropicText(JSON.parse(responseBody)).trim()
  if (!translated) throw new Error('Haiku translation returned no markdown.')

  return setFrontmatterValue(
    setFrontmatterValue(
      setFrontmatterValue(translated, 'language', language),
      'sourceLanguage',
      'en'
    ),
    'translationOf',
    'english-origin'
  )
}

const resolveHowToSourcePath = (sourcePath, sectionId, guideId) => {
  const normalizedSourcePath = String(sourcePath || '').trim()
  const fallbackPath = path.join(docsRoot, safeSegment(sectionId, 'editor'), `${safeSegment(guideId, 'guide')}.md`)
  let targetPath = fallbackPath

  if (normalizedSourcePath.startsWith('../docs/how-to-translations/')) {
    targetPath = path.join(__dirname, 'src', normalizedSourcePath.replace(/^\.\.\//, ''))
  } else if (normalizedSourcePath.startsWith('src/docs/how-to-translations/')) {
    targetPath = path.join(__dirname, normalizedSourcePath)
  } else if (normalizedSourcePath.startsWith('frontend/src/docs/how-to-translations/')) {
    targetPath = path.join(__dirname, normalizedSourcePath.replace(/^frontend\//, ''))
  } else if (normalizedSourcePath.startsWith('../docs/how-to/')) {
    targetPath = path.join(__dirname, 'src', normalizedSourcePath.replace(/^\.\.\//, ''))
  } else if (normalizedSourcePath.startsWith('src/docs/how-to/')) {
    targetPath = path.join(__dirname, normalizedSourcePath)
  } else if (normalizedSourcePath.startsWith('frontend/src/docs/how-to/')) {
    targetPath = path.join(__dirname, normalizedSourcePath.replace(/^frontend\//, ''))
  } else if (normalizedSourcePath) {
    targetPath = path.resolve(__dirname, normalizedSourcePath)
  }

  const relativeDocsPath = path.relative(docsRoot, targetPath)
  const relativeTranslationsPath = path.relative(translationsRoot, targetPath)
  const isInDocs = !relativeDocsPath.startsWith('..') && !path.isAbsolute(relativeDocsPath)
  const isInTranslations = !relativeTranslationsPath.startsWith('..') && !path.isAbsolute(relativeTranslationsPath)

  if (!isInDocs && !isInTranslations) {
    throw new Error('Can only save files under frontend/src/docs/how-to or frontend/src/docs/how-to-translations.')
  }

  if (!targetPath.endsWith('.md')) {
    throw new Error('Source path must be a markdown file.')
  }

  return targetPath
}

const createUndoOperation = (label) => ({
  id: randomUUID(),
  label,
  createdAt: new Date().toISOString(),
  files: []
})

const backupFileForUndo = async (operation, targetPath) => {
  if (!operation || !existsSync(targetPath)) return

  const absolutePath = path.resolve(targetPath)
  if (operation.files.some(file => file.absolutePath === absolutePath)) return

  operation.files.push({
    absolutePath,
    relativePath: path.relative(__dirname, absolutePath),
    content: await readFile(absolutePath)
  })
}

const commitUndoOperation = (operation) => {
  if (!operation?.files?.length) return null

  lastOverwriteUndo = operation

  return {
    id: operation.id,
    label: operation.label,
    files: operation.files.map(file => file.relativePath)
  }
}

const getUndoOperation = (label, appendToUndoId = '') => {
  if (appendToUndoId && lastOverwriteUndo?.id === appendToUndoId) {
    lastOverwriteUndo.label = label || lastOverwriteUndo.label
    return lastOverwriteUndo
  }

  return createUndoOperation(label)
}

const writeFileWithUndo = async (operation, targetPath, content, encoding) => {
  await backupFileForUndo(operation, targetPath)
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, content, encoding)
}

const copyFileWithUndo = async (operation, sourcePath, targetPath) => {
  await backupFileForUndo(operation, targetPath)
  await copyFile(sourcePath, targetPath)
}

const restoreLastOverwriteUndo = async () => {
  const operation = lastOverwriteUndo

  if (!operation?.files?.length) {
    throw new Error('No overwritten files to undo.')
  }

  for (const file of [...operation.files].reverse()) {
    await mkdir(path.dirname(file.absolutePath), { recursive: true })
    await writeFile(file.absolutePath, file.content)
  }

  lastOverwriteUndo = null

  return {
    id: operation.id,
    label: operation.label,
    files: operation.files.map(file => file.relativePath)
  }
}

const resolvePublicUrlPath = (url) => {
  const cleanUrl = String(url || '').split('?')[0]
  if (!cleanUrl.startsWith('/')) return ''

  const targetPath = path.join(publicRoot, cleanUrl.replace(/^\/+/, ''))
  const relativePath = path.relative(publicRoot, targetPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Can only publish files from frontend/public.')
  }

  return targetPath
}

const findGeneratedVideo = async ({ sectionId, guideId, language }) => {
  const safeName = `${safeSegment(sectionId, 'editor')}-${safeSegment(guideId, 'guide')}`
  const candidates = ['editor-preview', 'prod', 'demo'].map(folder => {
    const videoPath = path.join(publicRoot, 'howto-videos', folder, language, `${safeName}.mp4`)
    const captionsPath = path.join(publicRoot, 'howto-videos', folder, language, `${safeName}.vtt`)

    return {
      folder,
      videoPath,
      captionsPath,
      videoUrl: `/howto-videos/${folder}/${language}/${safeName}.mp4`,
      captionsUrl: `/howto-videos/${folder}/${language}/${safeName}.vtt`
    }
  })
  const existing = []

  for (const candidate of candidates) {
    if (!existsSync(candidate.videoPath)) continue

    const videoStat = await stat(candidate.videoPath)
    existing.push({
      ...candidate,
      captionsUrl: existsSync(candidate.captionsPath) ? candidate.captionsUrl : '',
      mtimeMs: videoStat.mtimeMs
    })
  }

  return existing.sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null
}

const publishReviewedVideos = async ({ sectionId, guideId, languages, videos, undoOperation }) => {
  const safeName = `${safeSegment(sectionId, 'editor')}-${safeSegment(guideId, 'guide')}`
  const videoList = Array.isArray(videos) ? videos : []
  const copied = []
  const warnings = []
  const videoLinks = {}

  for (const language of languages) {
    const video = videoList.find(candidate => candidate.language === language) || {}
    const outputDir = path.join(publicRoot, 'howto-videos/prod', language)
    const targetVideoPath = path.join(outputDir, `${safeName}.mp4`)
    const targetCaptionsPath = path.join(outputDir, `${safeName}.vtt`)
    const sourceVideoPath = resolvePublicUrlPath(video.videoUrl)
    const sourceCaptionsPath = resolvePublicUrlPath(video.captionsUrl || video.subtitlesUrl)

    await mkdir(outputDir, { recursive: true })

    if (sourceVideoPath && existsSync(sourceVideoPath)) {
      if (path.resolve(sourceVideoPath) !== path.resolve(targetVideoPath)) {
        await copyFileWithUndo(undoOperation, sourceVideoPath, targetVideoPath)
      }
      copied.push(path.relative(__dirname, targetVideoPath))
    } else {
      warnings.push(`No reviewed MP4 preview found for ${language}.`)
    }

    if (sourceCaptionsPath && existsSync(sourceCaptionsPath)) {
      if (path.resolve(sourceCaptionsPath) !== path.resolve(targetCaptionsPath)) {
        await copyFileWithUndo(undoOperation, sourceCaptionsPath, targetCaptionsPath)
      }
      copied.push(path.relative(__dirname, targetCaptionsPath))
    } else {
      warnings.push(`No reviewed captions preview found for ${language}.`)
    }

    videoLinks[language] = {
      videoUrl: `/howto-videos/prod/${language}/${safeName}.mp4`,
      captionsUrl: `/howto-videos/prod/${language}/${safeName}.vtt`
    }
  }

  return { copied, warnings, videoLinks }
}

const buildHelpDocAgentPrompt = ({ userPrompt, sectionId, languages }) => {
  const requestedSection = safeSegment(sectionId, '')
  const languageList = normalizeRenderLanguages(languages || 'sv').join(', ')

  return `You are Codex working in /Users/jmfk/code/eceee_v4.

Create a new EASY v4 help document from this request:

${userPrompt}

Target section hint: ${requestedSection || '(choose the best existing section)'}
Video languages: ${languageList}

Requirements:
- Create exactly one new markdown file under frontend/src/docs/how-to/<section>/<guide-id>.md.
- Use the existing help-doc format in frontend/src/docs/how-to as the source of truth.
- Include frontmatter with id, title, summary, order, sectionId, sectionTitle, sectionSummary, sectionOrder, videoLanguage, and videoLanguages.
- Use the sequential editor format: a \`\`\`video-script JSON block with blocks that can be caption-only, action-only, or both.
- Use "caption" for spoken text. Do not introduce the old Narration/Goal/Why/Outcome sections unless an existing local pattern requires it.
- Add practical action instructions for video recording when the UI workflow is known. Prefer robust actions such as goto, click, fill, select, waitForText, pause, or caption.
- Do not generate or publish video files. Leave MP4/captions URLs empty unless the user explicitly supplied final URLs.
- Do not modify unrelated files, generated videos, package files, or production/deploy files.
- Follow AGENTS.md and existing project conventions.

When finished, respond with:
HELP_DOC_PATH: <relative path>
GUIDE_ID: <guide id>
SUMMARY: <one sentence>
`
}

const buildScriptBlockAgentPrompt = ({ userPrompt, blockKind, initialActionType, language, draft, nearbyBlocks }) => {
  const safeBlockKind = blockKind === 'action'
    ? 'action'
    : blockKind === 'caption'
    ? 'caption'
    : 'script block'
  const draftContext = JSON.stringify({
    id: draft?.id,
    title: draft?.title,
    summary: draft?.summary,
    sectionId: draft?.sectionId,
    sectionTitle: draft?.sectionTitle,
    language,
    nearbyBlocks
  }, null, 2)

  return `You are Codex working in /Users/jmfk/code/eceee_v4.

Create one video-script block for the EASY v4 Video Script Editor.

User request:
${userPrompt}

Requested block kind: ${safeBlockKind}
Preferred action type when useful: ${initialActionType || '(choose best action type)'}
Language: ${language || 'en'}
Current guide context:
${draftContext}

Available action types:
- goto: { "type": "goto", "path": "/pages", "holdMs": 500 }
- click: { "type": "click", "targetMode": "text", "text": "Save", "holdMs": 500 }
- fill: { "type": "fill", "targetMode": "label", "label": "Title", "value": "Demo title", "holdMs": 500 }
- select: { "type": "select", "targetMode": "label", "label": "Status", "value": "Draft", "holdMs": 500 }
- waitForText: { "type": "waitForText", "text": "Saved", "timeout": 10000, "cutFromVideo": true }
- caption: { "type": "caption", "ms": 1200 }
- pause: { "type": "pause", "ms": 1000 }
- reload: { "type": "reload", "holdMs": 500 }

Rules:
- Return exactly one JSON object and no Markdown.
- Shape: { "caption": "...", "action": null | { ... } }
- For a generic script block, choose caption-only, action-only, or caption plus action based on the request.
- For caption blocks, set action to null unless the user clearly asks for a visible action.
- For action blocks, include a useful action and add a short caption only if it helps the viewer.
- Keep captions short, concrete, and in the requested language.
- Prefer robust target modes: text, label, placeholder, role, or selector.
- Do not edit files. Do not include explanations.
`
}

const extractJsonObject = (value = '') => {
  const text = String(value || '').trim()

  if (!text) throw new Error('Codex did not return a script block.')

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : text

  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')

    if (start === -1 || end === -1 || end <= start) {
      throw new Error('Codex did not return valid JSON.')
    }

    return JSON.parse(candidate.slice(start, end + 1))
  }
}

const createAuthState = async ({ baseUrl, username, password, outputPath }) => {
  if (!username && !password) return ''
  if (!username || !password) throw new Error('Both username and password are required for demo login.')

  const tokenUrl = new URL('/api/v1/auth/token/', baseUrl)
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  const tokens = await response.json().catch(() => ({}))

  if (!response.ok || !tokens.access || !tokens.refresh) {
    throw new Error(`Could not log in as ${username} at ${new URL(baseUrl).origin}.`)
  }

  await writeFile(outputPath, JSON.stringify({
    cookies: [],
    origins: [{
      origin: new URL(baseUrl).origin,
      localStorage: [
        { name: 'access_token', value: tokens.access },
        { name: 'refresh_token', value: tokens.refresh }
      ]
    }]
  }, null, 2), 'utf8')

  return outputPath
}

const howToScriptEditorPlugin = () => ({
  name: 'howto-script-editor-preview',
  configureServer(server) {
    server.middlewares.use('/__howto-script-editor/undo-overwrite', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        sendJson(res, 200, { restored: await restoreLastOverwriteUndo() })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/__howto-script-editor/open-source', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const body = await readRequestJson(req)
        const targetPath = resolveHowToSourcePath(body.sourcePath, body.sectionId, body.guideId)

        if (!existsSync(targetPath)) {
          throw new Error(`Markdown file not found: ${path.relative(__dirname, targetPath)}`)
        }

        sendJson(res, 200, {
          sourcePath: path.relative(__dirname, targetPath),
          absolutePath: targetPath,
          markdown: await readFile(targetPath, 'utf8')
        })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/__howto-script-editor/generated-video', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const body = await readRequestJson(req)
        const language = safeSegment(body.language || 'en', 'en')
        const generatedVideo = await findGeneratedVideo({
          sectionId: body.sectionId,
          guideId: body.guideId,
          language
        })

        if (!generatedVideo) {
          sendJson(res, 200, { exists: false, language })
          return
        }

        sendJson(res, 200, {
          exists: true,
          language,
          source: generatedVideo.folder,
          videoUrl: generatedVideo.videoUrl,
          captionsUrl: generatedVideo.captionsUrl
        })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/__howto-script-editor/translation-status', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const body = await readRequestJson(req)
        const targetPath = translationPathFor(body.sectionId, body.guideId, body.language || 'sv')

        sendJson(res, 200, {
          exists: existsSync(targetPath),
          sourcePath: path.relative(__dirname, targetPath),
          absolutePath: targetPath
        })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/__howto-script-editor/open-translation', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const body = await readRequestJson(req)
        const targetPath = translationPathFor(body.sectionId, body.guideId, body.language || 'sv')

        if (!existsSync(targetPath)) {
          sendJson(res, 200, {
            exists: false,
            sourcePath: path.relative(__dirname, targetPath),
            markdown: ''
          })
          return
        }

        sendJson(res, 200, {
          exists: true,
          sourcePath: path.relative(__dirname, targetPath),
          absolutePath: targetPath,
          markdown: await readFile(targetPath, 'utf8')
        })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/__howto-script-editor/translate', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const body = await readRequestJson(req)
        const markdown = String(body.markdown || '')
        const language = safeSegment(body.language || 'sv', 'sv')
        const targetPath = translationPathFor(body.sectionId, body.guideId, language)
        const overwrite = Boolean(body.overwrite)

        if (!markdown.trim()) {
          throw new Error('Markdown is empty.')
        }

        startEventStream(res)

        if (existsSync(targetPath) && !overwrite) {
          writeEvent(res, 'error', {
            error: `Translation already exists at ${path.relative(__dirname, targetPath)}.`,
            exists: true,
            sourcePath: path.relative(__dirname, targetPath)
          })
          res.end()
          return
        }

        writeEvent(res, 'log', { text: `Translating English origin to ${languageName(language)} with Claude Haiku...\n` })
        const translatedMarkdown = await translateMarkdownWithHaiku({ markdown, language })
        const undoOperation = getUndoOperation(`Translate ${language.toUpperCase()} markdown`)

        await writeFileWithUndo(undoOperation, targetPath, translatedMarkdown, 'utf8')
        const undo = commitUndoOperation(undoOperation)

        writeEvent(res, 'log', { text: `Saved translated markdown to ${path.relative(__dirname, targetPath)}\n` })
        writeEvent(res, 'done', {
          markdown: translatedMarkdown,
          sourcePath: path.relative(__dirname, targetPath),
          language,
          undo
        })
        res.end()
      } catch (error) {
        if (res.headersSent) {
          writeEvent(res, 'error', { error: error.message })
          res.end()
          return
        }

        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/__howto-script-editor/save', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const body = await readRequestJson(req)
        const markdown = String(body.markdown || '')

        if (!markdown.trim()) {
          throw new Error('Markdown is empty.')
        }

        const targetPath = resolveHowToSourcePath(body.sourcePath, body.sectionId, body.guideId)

        if (body.requireExisting && !existsSync(targetPath)) {
          throw new Error(`Refusing to overwrite missing file: ${path.relative(__dirname, targetPath)}`)
        }

        const undoOperation = getUndoOperation(
          body.undoLabel || `Overwrite ${path.basename(targetPath)}`,
          body.appendToUndoId || ''
        )

        await writeFileWithUndo(undoOperation, targetPath, markdown, 'utf8')
        const undo = commitUndoOperation(undoOperation)

        sendJson(res, 200, {
          sourcePath: path.relative(__dirname, targetPath),
          absolutePath: targetPath,
          undo
        })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/__howto-script-editor/render', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const body = await readRequestJson(req)
        const guideId = safeSegment(body.guideId, 'editor-preview')
        const sectionId = safeSegment(body.sectionId, 'editor')
        const markdown = String(body.markdown || '')
        const markdowns = body.markdowns && typeof body.markdowns === 'object' ? body.markdowns : {}
        const baseUrl = String(body.baseUrl || 'http://localhost:3000').trim()
        const username = String(body.username || '').trim()
        const password = String(body.password || '')
        const languages = normalizeRenderLanguages(body.languages || body.language || 'sv')

        if (!markdown.trim()) {
          throw new Error('Markdown is empty.')
        }

        const runId = randomUUID().slice(0, 8)
        const previewRoot = path.join(__dirname, '.howto-script-preview', runId)
        const docsDir = path.join(previewRoot, 'docs')
        const outputRoot = path.join(__dirname, 'public/howto-videos/editor-preview')
        const workRoot = path.join(previewRoot, 'work')
        const storageStatePath = path.join(previewRoot, 'storage-state.json')
        const safeName = `${sectionId}-${guideId}`.replace(/[^a-z0-9_-]+/gi, '-')
        const globalHoldMs = Number(body.globalHoldMs || 0)

        if (!Number.isFinite(globalHoldMs) || globalHoldMs < 0) {
          throw new Error('Global holdMs must be a non-negative number.')
        }

        startEventStream(res)
        writeEvent(res, 'log', { text: `Preparing editor preview for ${guideId} against ${baseUrl}\nLanguages: ${languages.join(', ')}\nGlobal extra holdMs: ${globalHoldMs}\n` })
        await mkdir(docsDir, { recursive: true })
        await mkdir(outputRoot, { recursive: true })
        await mkdir(workRoot, { recursive: true })
        writeEvent(res, 'log', { text: `Temporary scripts folder: ${docsDir}\n` })

        if (username || password) {
          writeEvent(res, 'log', { text: `Logging in as ${username || '(missing username)'} at ${new URL(baseUrl).origin}\n` })
        }

        const storageState = await createAuthState({
          baseUrl,
          username,
          password,
          outputPath: storageStatePath
        })

        const videos = []
        let log = ''
        const undoOperation = getUndoOperation(`Render ${languages.join(', ')} preview video`)

        for (const language of languages) {
          const outputDir = path.join(outputRoot, language)
          const workDir = path.join(workRoot, language)
          const languageMarkdown = String(markdowns[language] || markdown)
          const outputVideoPath = path.join(outputDir, `${safeName}.mp4`)
          const outputCaptionsPath = path.join(outputDir, `${safeName}.vtt`)

          await mkdir(outputDir, { recursive: true })
          await mkdir(workDir, { recursive: true })
          await writeFile(path.join(docsDir, `${guideId}.md`), languageMarkdown, 'utf8')
          writeEvent(res, 'log', { text: `\n[${language}] Wrote ${language.toUpperCase()} script to ${path.join(docsDir, `${guideId}.md`)}\n` })
          await backupFileForUndo(undoOperation, outputVideoPath)
          await backupFileForUndo(undoOperation, outputCaptionsPath)

          const generatorArgs = [
            '--docs-dir', docsDir,
            '--guide', guideId,
            '--base-url', baseUrl,
            '--output-dir', outputDir,
            '--public-dir', outputDir,
            '--work-dir', workDir,
            '--format', 'mp4',
            '--language', language,
            '--allow-passive-guides',
            '--no-context',
            '--no-translate',
            '--global-hold-ms', String(globalHoldMs)
          ]

          if (storageState) {
            generatorArgs.push('--storage-state', storageState)
          }

          if (body.voice) {
            generatorArgs.push('--voice', 'elevenlabs')
          }

          writeEvent(res, 'log', { text: `\n[${language}] Starting video generator: node scripts/generate-howto-video.mjs ${generatorArgs.join(' ')}\n` })
          const languageLog = await runHowToRender(generatorArgs, text => writeEvent(res, 'log', { text }))
          log += languageLog
          videos.push({
            language,
            videoUrl: `/howto-videos/editor-preview/${language}/${safeName}.mp4?t=${Date.now()}`,
            captionsUrl: `/howto-videos/editor-preview/${language}/${safeName}.vtt?t=${Date.now()}`
          })
        }

        const currentVideo = videos.at(-1) || {}
        const undo = commitUndoOperation(undoOperation)

        writeEvent(res, 'done', {
          videoUrl: currentVideo.videoUrl || '',
          subtitlesUrl: currentVideo.captionsUrl || '',
          language: currentVideo.language || languages.at(-1),
          videos,
          log,
          undo
        })
        res.end()
      } catch (error) {
        if (res.headersSent) {
          writeEvent(res, 'error', { error: error.message })
          res.end()
          return
        }

        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/__howto-script-editor/publish', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const body = await readRequestJson(req)
        const markdown = String(body.markdown || '')
        const languages = normalizeRenderLanguages(body.languages || body.language || 'sv')

        if (!markdown.trim()) {
          throw new Error('Markdown is empty.')
        }

        const targetPath = resolveHowToSourcePath(body.sourcePath, body.sectionId, body.guideId)
        const undoOperation = getUndoOperation(`Publish ${safeSegment(body.guideId, 'guide')}`)
        const publishedVideos = await publishReviewedVideos({
          sectionId: body.sectionId,
          guideId: body.guideId,
          languages,
          videos: body.videos,
          undoOperation
        })

        await writeFileWithUndo(undoOperation, targetPath, markdown, 'utf8')
        const undo = commitUndoOperation(undoOperation)

        sendJson(res, 200, {
          sourcePath: path.relative(__dirname, targetPath),
          absolutePath: targetPath,
          ...publishedVideos,
          undo
        })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/__howto-script-editor/generate-doc', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const body = await readRequestJson(req)
        const userPrompt = String(body.prompt || '').trim()

        if (!userPrompt) {
          throw new Error('Prompt is empty.')
        }

        const runId = randomUUID().slice(0, 8)
        const workDir = path.join(__dirname, '.howto-script-preview', 'codex', runId)
        const outputPath = path.join(workDir, 'last-message.txt')
        const agentPrompt = buildHelpDocAgentPrompt({
          userPrompt,
          sectionId: body.sectionId,
          languages: body.languages
        })

        await mkdir(workDir, { recursive: true })
        startEventStream(res)
        writeEvent(res, 'log', { text: `Starting Codex help-document agent (${runId})\n` })
        writeEvent(res, 'log', { text: `Working tree: ${path.resolve(__dirname, '..')}\n` })
        writeEvent(res, 'log', { text: `Target section: ${body.sectionId || '(agent decides)'}\n` })

        const result = await runCodexAgent({ prompt: agentPrompt, outputPath }, text => writeEvent(res, 'log', { text }))

        writeEvent(res, 'done', {
          log: result.log,
          finalMessage: result.finalMessage
        })
        res.end()
      } catch (error) {
        if (res.headersSent) {
          writeEvent(res, 'error', { error: error.message })
          res.end()
          return
        }

        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/__howto-script-editor/generate-block', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const body = await readRequestJson(req)
        const userPrompt = String(body.prompt || '').trim()

        if (!userPrompt) {
          throw new Error('Prompt is empty.')
        }

        const runId = randomUUID().slice(0, 8)
        const workDir = path.join(__dirname, '.howto-script-preview', 'codex-block', runId)
        const outputPath = path.join(workDir, 'script-block.json')
        const agentPrompt = buildScriptBlockAgentPrompt({
          userPrompt,
          blockKind: body.blockKind,
          initialActionType: body.initialActionType,
          language: body.language,
          draft: body.draft,
          nearbyBlocks: body.nearbyBlocks
        })

        await mkdir(workDir, { recursive: true })
        startEventStream(res)
        writeEvent(res, 'log', { text: `Starting Codex script-block agent (${runId})\n` })
        writeEvent(res, 'log', { text: `Block kind: ${body.blockKind || 'caption'}\n` })
        writeEvent(res, 'log', { text: `Language: ${body.language || 'en'}\n` })

        const result = await runCodexAgent({
          prompt: agentPrompt,
          outputPath,
          sandbox: 'read-only'
        }, text => writeEvent(res, 'log', { text }))
        const block = extractJsonObject(result.finalMessage)

        writeEvent(res, 'done', {
          block,
          log: result.log,
          finalMessage: result.finalMessage
        })
        res.end()
      } catch (error) {
        if (res.headersSent) {
          writeEvent(res, 'error', { error: error.message })
          res.end()
          return
        }

        sendJson(res, 500, { error: error.message })
      }
    })
  }
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), howToScriptEditorPlugin()],

  // Path aliases for cleaner imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@api': path.resolve(__dirname, './src/api'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },

  // Development server configuration
  server: {
    host: '0.0.0.0', // Allow external connections for Docker
    port: 3000,
    allowedHosts: true, // Allow all hosts (dev only) to support custom hostnames like 'summerstudy'
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:8000',
        changeOrigin: true,
        secure: false,
        timeout: 300000, // 5 minutes for large uploads
        proxyTimeout: 300000,
      },
      '/admin': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      },
      '/imgproxy': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      },
      '/static': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      },
      '/csrf-token': {
        target: process.env.VITE_BACKEND_URL || 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      },
    },
    watch: {
      usePolling: true, // Required for Docker on some systems
      interval: 1000,
    },
  },

  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          ui: ['@headlessui/react', 'lucide-react'],
          state: ['zustand', '@tanstack/react-query'],
          http: ['axios'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },

  // Environment variables
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    'import.meta.env.VITE_GIT_COMMIT_HASH': JSON.stringify(getGitCommitHash()),
  },

  // CSS configuration
  css: {
    devSourcemap: true,
  },
})
