import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync, spawn } from 'node:child_process'
import { createReadStream, existsSync, readFileSync, readdirSync } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import { convertRecordedEventsToScriptBlocks } from './src/utils/howToRecorder.js'

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

const readRequestBuffer = (req) => new Promise((resolve, reject) => {
  const chunks = []

  req.on('data', chunk => chunks.push(chunk))
  req.on('end', () => resolve(Buffer.concat(chunks)))
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

const runHowToRecorder = (args, onChunk = () => {}) => {
  const child = spawn(process.execPath, ['scripts/record-howto-actions.mjs', ...args], {
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

  return {
    child,
    getLog: () => output.join('')
  }
}

const waitForChildExit = (child, timeoutMs = 10000) => new Promise(resolve => {
  if (!child || child.exitCode !== null || child.signalCode) {
    resolve()
    return
  }

  const timeout = setTimeout(() => {
    child.kill('SIGKILL')
    resolve()
  }, timeoutMs)

  child.once('exit', () => {
    clearTimeout(timeout)
    resolve()
  })
})

const runProcess = (command, args, options = {}) => new Promise((resolveRun, rejectRun) => {
  const child = spawn(command, args, {
    cwd: options.cwd || __dirname,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const output = []
  const appendOutput = chunk => output.push(chunk.toString())

  child.stdout.on('data', appendOutput)
  child.stderr.on('data', appendOutput)
  child.on('error', rejectRun)
  child.on('close', code => {
    const text = output.join('')
    if (code === 0) {
      resolveRun(text)
      return
    }
    rejectRun(new Error(text || `${command} exited with code ${code}`))
  })
})

const runCodexAgent = ({ prompt, outputPath, sandbox = 'workspace-write' }, onChunk = () => {}) => new Promise((resolveRun, rejectRun) => {
  const codexCommand = process.env.CODEX_CLI || '/Applications/Codex.app/Contents/Resources/codex'
  const repoRoot = path.resolve(__dirname, '..')
  const child = spawn(codexCommand, [
    'exec',
    '-C', repoRoot,
    '--sandbox', sandbox,
    '-c', 'approval_policy="never"',
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

const resolveStartUrl = (baseUrl, startUrl = '') => {
  const value = String(startUrl || '').trim()
  if (!value) return baseUrl

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return baseUrl
  }
}

const docsRoot = path.join(__dirname, 'src/docs/how-to')
const translationsRoot = path.join(__dirname, 'src/docs/how-to-translations')
const publicRoot = path.join(__dirname, 'public')
const renderLogRoot = path.join(__dirname, '.howto-script-preview', 'render-logs')
const recordingRoot = path.join(__dirname, '.howto-script-preview', 'recordings')
const blockAudioRoot = path.join(__dirname, '.howto-script-preview', 'block-audio')
const videoOverrideFolder = 'overrides'
const usePolling = ['1', 'true', 'yes'].includes(String(process.env.VITE_USE_POLLING || '').toLowerCase())
let lastOverwriteUndo = null
const recordingSessions = new Map()

const publicAssetContentType = (filePath) => {
  const extension = path.extname(filePath).toLowerCase()

  if (extension === '.mp4' || extension === '.m4v') return 'video/mp4'
  if (extension === '.webm') {
    return filePath.includes(`${path.sep}audio-clips${path.sep}`)
      || filePath.includes(`${path.sep}block-audio${path.sep}`)
      || path.basename(filePath) === 'microphone.webm'
      ? 'audio/webm'
      : 'video/webm'
  }
  if (extension === '.mp3') return 'audio/mpeg'
  if (extension === '.m4a') return 'audio/mp4'
  if (extension === '.ogv' || extension === '.ogg') return 'video/ogg'
  if (extension === '.vtt') return 'text/vtt; charset=utf-8'
  if (extension === '.json') return 'application/json; charset=utf-8'
  if (extension === '.txt') return 'text/plain; charset=utf-8'
  return 'application/octet-stream'
}

const resolvePublicAssetPath = (mountPath, reqUrl = '/') => {
  const pathname = new URL(reqUrl, 'http://localhost').pathname
  const mountedPathname = pathname.startsWith(mountPath)
    ? pathname.slice(mountPath.length)
    : pathname
  const relativeUrlPath = decodeURIComponent(mountedPathname).replace(/^\/+/, '')
  const rootPath = path.join(publicRoot, mountPath.replace(/^\/+/, ''))
  const targetPath = path.join(rootPath, relativeUrlPath)
  const relativePath = path.relative(rootPath, targetPath)

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null
  }

  return targetPath
}

const servePublicAsset = async (req, res, targetPath) => {
  const fileStat = await stat(targetPath)

  if (!fileStat.isFile()) {
    return false
  }

  const contentType = publicAssetContentType(targetPath)
  const rangeHeader = req.headers.range
  res.setHeader('Content-Type', contentType)
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Last-Modified', fileStat.mtime.toUTCString())

  if (rangeHeader) {
    const rangeMatch = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader)

    if (!rangeMatch) {
      res.statusCode = 416
      res.setHeader('Content-Range', `bytes */${fileStat.size}`)
      res.end()
      return true
    }

    const [, rawStart, rawEnd] = rangeMatch
    let start = rawStart ? Number(rawStart) : 0
    let end = rawEnd ? Number(rawEnd) : fileStat.size - 1

    if (!rawStart && rawEnd) {
      const suffixLength = Number(rawEnd)
      start = Math.max(fileStat.size - suffixLength, 0)
      end = fileStat.size - 1
    }

    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= fileStat.size) {
      res.statusCode = 416
      res.setHeader('Content-Range', `bytes */${fileStat.size}`)
      res.end()
      return true
    }

    end = Math.min(end, fileStat.size - 1)
    res.statusCode = 206
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileStat.size}`)
    res.setHeader('Content-Length', String(end - start + 1))

    if (req.method === 'HEAD') {
      res.end()
      return true
    }

    createReadStream(targetPath, { start, end }).pipe(res)
    return true
  }

  res.statusCode = 200
  res.setHeader('Content-Length', String(fileStat.size))

  if (req.method === 'HEAD') {
    res.end()
    return true
  }

  createReadStream(targetPath).pipe(res)
  return true
}

const safeReadJsonFile = async (filePath, fallback) => {
  try {
    if (!existsSync(filePath)) return fallback
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

const recordingPathsFor = (id) => {
  const safeId = safeSegment(id, '')
  if (!safeId) throw new Error('Recording ID is required.')

  const outputDir = path.join(recordingRoot, safeId)
  const relativePath = path.relative(recordingRoot, outputDir)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Invalid recording ID.')
  }

  return {
    id: safeId,
    outputDir,
    eventsPath: path.join(outputDir, 'events.json'),
    metadataPath: path.join(outputDir, 'metadata.json'),
    storageStatePath: path.join(outputDir, 'storage-state.json')
  }
}

const readRecordingSnapshot = async (id, baseUrl = '') => {
  const paths = recordingPathsFor(id)
  const session = recordingSessions.get(paths.id)
  const events = await safeReadJsonFile(paths.eventsPath, [])
  const metadata = await safeReadJsonFile(paths.metadataPath, {})
  const rawVideoPath = Array.isArray(metadata.rawVideos) ? metadata.rawVideos[0] || '' : ''
  const referenceVideoPath = metadata.referenceVideoPath || ''
  const microphonePath = metadata.microphonePath || ''
  const status = session?.status || metadata.status || 'unknown'
  const log = session?.log || ''
  const hasAudioClips = Array.isArray(metadata.audioClips) && metadata.audioClips.length > 0
  const snapshotBaseUrl = baseUrl || session?.baseUrl || metadata.baseUrl || ''
  const snapshotStartUrl = session?.startUrl || metadata.startUrl || ''
  const blocks = convertRecordedEventsToScriptBlocks(events, {
    baseUrl: snapshotBaseUrl,
    audio: microphonePath && hasAudioClips ? {
      startedAt: metadata.microphoneStartedAt || 0,
      durationMs: metadata.microphoneStoppedAt && metadata.microphoneStartedAt ? metadata.microphoneStoppedAt - metadata.microphoneStartedAt : 0,
      fullAudioUrl: `/__howto-script-editor/record/${paths.id}/audio/full`,
      clipBaseUrl: `/__howto-script-editor/record/${paths.id}/audio`
    } : null
  })

  return {
    id: paths.id,
    status,
    baseUrl: snapshotBaseUrl,
    startUrl: snapshotStartUrl,
    log,
    events,
    blocks,
    eventCount: events.length,
    rawVideoPath,
    rawVideoUrl: rawVideoPath ? `/__howto-script-editor/record/${paths.id}/raw-video` : '',
    referenceVideoPath,
    referenceVideoUrl: referenceVideoPath ? `/__howto-script-editor/record/${paths.id}/reference-video` : '',
    microphonePath,
    microphoneUrl: microphonePath ? `/__howto-script-editor/record/${paths.id}/audio/full` : '',
    error: session?.error || metadata.error || ''
  }
}

const extractRecordingAudioClips = async (id, baseUrl = '') => {
  const paths = recordingPathsFor(id)
  const metadata = await safeReadJsonFile(paths.metadataPath, {})
  const microphonePath = metadata.microphonePath || ''
  if (!microphonePath || !existsSync(microphonePath)) return []

  const events = await safeReadJsonFile(paths.eventsPath, [])
  const blocks = convertRecordedEventsToScriptBlocks(events, {
    baseUrl: baseUrl || metadata.baseUrl || '',
    audio: {
      startedAt: metadata.microphoneStartedAt || 0,
      durationMs: metadata.microphoneStoppedAt && metadata.microphoneStartedAt ? metadata.microphoneStoppedAt - metadata.microphoneStartedAt : 0,
      fullAudioUrl: `/__howto-script-editor/record/${paths.id}/audio/full`,
      clipBaseUrl: `/__howto-script-editor/record/${paths.id}/audio`
    }
  })
  const clipsDir = path.join(paths.outputDir, 'audio-clips')
  const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg'
  const clips = []

  await mkdir(clipsDir, { recursive: true })

  for (const [index, block] of blocks.entries()) {
    if (!block.audio?.url) continue
    const clipName = `block-${String(index + 1).padStart(3, '0')}.webm`
    const clipPath = path.join(clipsDir, clipName)
    const startSeconds = Math.max(0, Number(block.audio.startMs || 0) / 1000)
    const durationSeconds = Math.max(0.25, (Number(block.audio.endMs || 0) - Number(block.audio.startMs || 0)) / 1000)

    await runProcess(ffmpegPath, [
      '-y',
      '-ss', String(startSeconds),
      '-t', String(durationSeconds),
      '-i', microphonePath,
      '-vn',
      '-c:a', 'libopus',
      '-b:a', '96k',
      clipPath
    ])

    clips.push({
      name: clipName,
      path: clipPath,
      url: `/__howto-script-editor/record/${paths.id}/audio/${clipName}`,
      startMs: block.audio.startMs,
      endMs: block.audio.endMs
    })
  }

  await writeFile(paths.metadataPath, JSON.stringify({
    ...metadata,
    audioClips: clips
  }, null, 2), 'utf8')

  return clips
}

const ensureRecordingAudioClips = async (id, baseUrl = '', session = null) => {
  const paths = recordingPathsFor(id)
  const metadata = await safeReadJsonFile(paths.metadataPath, {})
  if (Array.isArray(metadata.audioClips) && metadata.audioClips.length > 0) {
    return metadata.audioClips
  }

  const clips = await extractRecordingAudioClips(id, baseUrl)
  if (session && clips.length > 0) {
    session.log += `\nSplit microphone audio into ${clips.length} block clip${clips.length === 1 ? '' : 's'}.\n`
  }
  if (session && clips.length === 0) {
    session.log += '\nNo microphone audio clips were created for this recording.\n'
  }
  return clips
}

const muxRecordingReferenceVideo = async (id, session = null) => {
  const paths = recordingPathsFor(id)
  const metadata = await safeReadJsonFile(paths.metadataPath, {})
  const rawVideoPath = Array.isArray(metadata.rawVideos) ? metadata.rawVideos[0] || '' : ''
  const microphonePath = metadata.microphonePath || ''
  const referenceVideoPath = path.join(paths.outputDir, 'reference-with-audio.webm')

  if (metadata.referenceVideoPath && existsSync(metadata.referenceVideoPath)) {
    return metadata.referenceVideoPath
  }
  if (!rawVideoPath || !existsSync(rawVideoPath)) {
    if (session) session.log += '\nNo raw reference video was available to combine with microphone audio.\n'
    return ''
  }
  if (!microphonePath || !existsSync(microphonePath)) {
    if (session) session.log += '\nNo microphone audio was available to combine with the reference video.\n'
    return ''
  }

  if (session) session.log += '\nCombining raw reference video with microphone audio...\n'

  await runProcess(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-y',
    '-i', rawVideoPath,
    '-i', microphonePath,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'copy',
    '-c:a', 'libopus',
    '-shortest',
    referenceVideoPath
  ])

  await writeFile(paths.metadataPath, JSON.stringify({
    ...metadata,
    referenceVideoPath,
    referenceVideoWithAudio: true
  }, null, 2), 'utf8')

  if (session) session.log += `Reference video with audio: ${referenceVideoPath}\n`
  return referenceVideoPath
}

const finalizeRecordingAssets = (id, baseUrl = '', session = null, options = {}) => {
  if (session?.finalizePromise) return session.finalizePromise

  const terminalStatus = options.terminalStatus || session?.terminalStatus || session?.status || 'stopped'
  const promise = ensureRecordingAudioClips(id, baseUrl, session)
    .then(() => {
      const shouldMuxReferenceVideo = Boolean(options.recordReferenceVideoWithAudio || session?.recordReferenceVideoWithAudio)
      return shouldMuxReferenceVideo ? muxRecordingReferenceVideo(id, session) : null
    })
    .catch(error => {
      if (session) {
        session.log += `\nRecording finalization failed: ${error.message}\n`
        session.error = session.error || error.message
      }
      return null
    })
    .finally(() => {
      if (session) {
        session.status = session.error && terminalStatus !== 'stopped' ? 'error' : terminalStatus
        session.finalizePromise = null
      }
    })

  if (session) session.finalizePromise = promise
  return promise
}

const blockAudioPathFor = (kind, fileName) => {
  const safeKind = safeSegment(kind, '')
  const safeName = path.basename(fileName || '')
  if (!safeKind || !safeName) throw new Error('Audio path is required.')

  const targetPath = path.join(blockAudioRoot, safeKind, safeName)
  const relativePath = path.relative(blockAudioRoot, targetPath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Invalid audio path.')
  }

  return targetPath
}

const editorAudioPathFromUrl = (audioUrl = '') => {
  const rawValue = String(audioUrl || '').trim()
  if (!rawValue) throw new Error('Audio URL is required.')

  if (path.isAbsolute(rawValue)) return rawValue

  let pathname = rawValue
  try {
    pathname = new URL(rawValue, 'http://localhost').pathname
  } catch {
    pathname = rawValue.split('?')[0]
  }

  const parts = pathname.split('/').filter(Boolean)
  const blockAudioIndex = parts.indexOf('block-audio')
  if (blockAudioIndex >= 0) {
    return blockAudioPathFor(parts[blockAudioIndex + 1] || '', parts[blockAudioIndex + 2] || '')
  }

  const recordIndex = parts.indexOf('record')
  if (recordIndex >= 0) {
    const id = parts[recordIndex + 1] || ''
    const action = parts[recordIndex + 2] || ''
    const audioName = parts[recordIndex + 3] || ''
    if (action !== 'audio') throw new Error('Unsupported recording asset URL.')
    const paths = recordingPathsFor(id)
    return audioName === 'full'
      ? path.join(paths.outputDir, 'microphone.webm')
      : path.join(paths.outputDir, 'audio-clips', path.basename(audioName))
  }

  throw new Error('Unsupported audio URL.')
}

const transcribeAudioClip = async ({ audioUrl = '', language = 'en' } = {}) => {
  const audioPath = editorAudioPathFromUrl(audioUrl)
  if (!existsSync(audioPath)) throw new Error('Audio clip not found on disk.')

  const normalizedLanguage = safeSegment(language, 'en')
  const transcriptPath = `${audioPath}.${normalizedLanguage}.transcript.json`
  if (existsSync(transcriptPath)) {
    const cached = JSON.parse(await readFile(transcriptPath, 'utf8'))
    if (cached.text) return cached
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required to transcribe audio clips.')
  }

  const buffer = await readFile(audioPath)
  const form = new FormData()
  form.append('model', process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe')
  form.append('response_format', 'json')
  if (normalizedLanguage) form.append('language', normalizedLanguage)
  form.append('file', new Blob([buffer], { type: publicAssetContentType(audioPath) }), path.basename(audioPath))

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: form
  })

  const responseText = await response.text()
  if (!response.ok) {
    throw new Error(`Audio transcription failed: ${response.status} ${responseText}`)
  }

  const data = JSON.parse(responseText)
  const payload = {
    source: 'openai',
    model: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe',
    language: normalizedLanguage,
    text: data.text || '',
    audioPath,
    createdAt: new Date().toISOString()
  }

  await writeFile(transcriptPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return payload
}

const getEnvVoiceIdForLanguage = (language = '') => {
  const normalized = safeSegment(language, '').toUpperCase().replace(/-/g, '_')
  return normalized
    ? process.env[`ELEVENLABS_VOICE_ID_${normalized}`] || process.env[`HOWTO_VOICE_ID_${normalized}`] || process.env.ELEVENLABS_VOICE_ID || process.env.HOWTO_VOICE_ID || ''
    : process.env.ELEVENLABS_VOICE_ID || process.env.HOWTO_VOICE_ID || ''
}

const generateElevenLabsBlockAudio = async ({ text = '', language = 'en', guideId = 'guide', blockIndex = 0 } = {}) => {
  const trimmedText = String(text || '').trim()
  if (!trimmedText) throw new Error('Caption text is required to generate ElevenLabs audio.')
  if (!process.env.ELEVENLABS_API_KEY) throw new Error('ELEVENLABS_API_KEY is required to generate ElevenLabs audio.')

  const voiceId = getEnvVoiceIdForLanguage(language)
  if (!voiceId) throw new Error('Set ELEVENLABS_VOICE_ID or a language-specific ELEVENLABS_VOICE_ID_<LANG> value.')

  const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128'
  const payload = {
    provider: 'elevenlabs',
    voiceId,
    modelId,
    outputFormat,
    language,
    text: trimmedText
  }
  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 24)
  const fileName = [
    safeSegment(guideId, 'guide'),
    safeSegment(language, 'en'),
    `block-${String(Number(blockIndex || 0) + 1).padStart(3, '0')}`,
    hash
  ].join('-').concat('.mp3')
  const audioPath = blockAudioPathFor('elevenlabs', fileName)
  const metadataPath = audioPath.replace(/\.mp3$/, '.json')

  await mkdir(path.dirname(audioPath), { recursive: true })

  if (!existsSync(audioPath)) {
    const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`)
    url.searchParams.set('output_format', outputFormat)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: trimmedText,
        model_id: modelId
      })
    })

    if (!response.ok) {
      throw new Error(`ElevenLabs speech generation failed: ${response.status} ${await response.text()}`)
    }

    await writeFile(audioPath, Buffer.from(await response.arrayBuffer()))
    await writeFile(metadataPath, `${JSON.stringify({ ...payload, audioPath, createdAt: new Date().toISOString() }, null, 2)}\n`, 'utf8')
  }

  return {
    source: 'elevenlabs',
    url: `/__howto-script-editor/block-audio/elevenlabs/${fileName}`,
    startMs: 0,
    endMs: 0,
    trimStartMs: 0,
    trimEndMs: 0
  }
}

const saveRecordedBlockAudio = async ({ base64 = '', mimeType = '', language = 'en', guideId = 'guide', blockIndex = 0, durationMs = 0 } = {}) => {
  if (!base64) throw new Error('Recorded audio data is required.')
  const normalizedMimeType = String(mimeType || '').toLowerCase()
  const extension = normalizedMimeType.includes('mpeg')
    ? '.mp3'
    : normalizedMimeType.includes('mp4')
    ? '.m4a'
    : normalizedMimeType.includes('ogg')
    ? '.ogg'
    : '.webm'
  const fileName = [
    safeSegment(guideId, 'guide'),
    safeSegment(language, 'en'),
    `block-${String(Number(blockIndex || 0) + 1).padStart(3, '0')}`,
    randomUUID().slice(0, 8)
  ].join('-').concat(extension)
  const audioPath = blockAudioPathFor('recorded', fileName)

  await mkdir(path.dirname(audioPath), { recursive: true })
  await writeFile(audioPath, Buffer.from(base64, 'base64'))

  return {
    source: 'recorded',
    url: `/__howto-script-editor/block-audio/recorded/${fileName}`,
    startMs: 0,
    endMs: Math.max(0, Number(durationMs || 0)),
    trimStartMs: 0,
    trimEndMs: 0
  }
}

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

const markdownFileNameForIdentity = (guideId, language = '') => [
  safeSegment(guideId, 'guide'),
  safeSegment(language, 'en')
].filter(Boolean).join('.').concat('.md')

const translationPathFor = (sectionId, guideId, language) => path.join(
  translationsRoot,
  safeSegment(language, 'sv'),
  markdownFileNameForIdentity(guideId, language)
)

const originPathFor = (sectionId, guideId) => path.join(
  docsRoot,
  markdownFileNameForIdentity(guideId, 'en')
)

const readMarkdownFrontmatter = (filePath) => {
  if (!existsSync(filePath)) return {}

  const source = readFileSync(filePath, 'utf8')
  if (!source.startsWith('---')) return {}

  const endIndex = source.indexOf('\n---', 3)
  if (endIndex === -1) return {}

  return source
    .slice(3, endIndex)
    .trim()
    .split('\n')
    .reduce((frontmatter, line) => {
      const separatorIndex = line.indexOf(':')
      if (separatorIndex === -1) return frontmatter

      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')
      return {
        ...frontmatter,
        [key]: value
      }
    }, {})
}

const findMarkdownByIdentity = (rootDir, { guideId = '', uuid = '', language = '' } = {}) => {
  if (!existsSync(rootDir)) return ''

  const matches = []
  const canonicalName = guideId && language ? markdownFileNameForIdentity(guideId, language) : ''

  const visit = (dir) => {
    readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const entryPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        visit(entryPath)
        return
      }

      if (!entry.isFile() || !entry.name.endsWith('.md')) return

      const frontmatter = readMarkdownFrontmatter(entryPath)
      const fileUuid = frontmatter.uuid || frontmatter.guideUuid || ''
      const fileId = frontmatter.id || ''

      if (canonicalName && entry.name === canonicalName) {
        matches.push({ path: entryPath, score: 4 })
        return
      }

      if (guideId && fileId === guideId) {
        matches.push({ path: entryPath, score: 3 })
        return
      }

      if (uuid && fileUuid === uuid) {
        matches.push({ path: entryPath, score: 1 })
        return
      }
    })
  }

  visit(rootDir)

  return matches
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .at(0)?.path || ''
}

const saveRenderLog = async (record = {}) => {
  const createdAt = record.createdAt || new Date().toISOString()
  const id = record.id || randomUUID().slice(0, 8)
  const languages = Array.isArray(record.languages) ? record.languages : []
  const fileName = [
    createdAt.replace(/[:.]/g, '-'),
    safeSegment(record.guideId, 'guide'),
    safeSegment(languages.join('-') || record.language || 'language', 'language'),
    id
  ].join('-').concat('.json')
  const filePath = path.join(renderLogRoot, fileName)
  const payload = {
    id,
    createdAt,
    status: record.status || 'unknown',
    guideId: record.guideId || '',
    sectionId: record.sectionId || '',
    languages,
    baseUrl: record.baseUrl || '',
    username: record.username || '',
    voice: Boolean(record.voice),
    globalHoldMs: Number(record.globalHoldMs || 0),
    videos: Array.isArray(record.videos) ? record.videos : [],
    error: record.error || '',
    log: record.log || ''
  }

  await mkdir(renderLogRoot, { recursive: true })
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  return {
    ...payload,
    path: path.relative(__dirname, filePath)
  }
}

const listRenderLogs = async () => {
  const entries = await readdir(renderLogRoot, { withFileTypes: true }).catch(() => [])
  const logs = await Promise.all(entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(async entry => {
      const filePath = path.join(renderLogRoot, entry.name)

      try {
        const payload = JSON.parse(await readFile(filePath, 'utf8'))
        return {
          id: payload.id || entry.name.replace(/\.json$/, ''),
          createdAt: payload.createdAt || '',
          status: payload.status || 'unknown',
          guideId: payload.guideId || '',
          sectionId: payload.sectionId || '',
          languages: Array.isArray(payload.languages) ? payload.languages : [],
          baseUrl: payload.baseUrl || '',
          username: payload.username || '',
          voice: Boolean(payload.voice),
          globalHoldMs: Number(payload.globalHoldMs || 0),
          videos: Array.isArray(payload.videos) ? payload.videos : [],
          error: payload.error || '',
          log: payload.log || '',
          path: path.relative(__dirname, filePath)
        }
      } catch {
        return null
      }
    }))

  return logs
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

const markdownPathForLanguage = (sectionId, guideId, language, identity = {}) => {
  const normalizedLanguage = safeSegment(language || 'sv', 'sv')
  const uuid = identity.uuid || identity.guideUuid || ''
  const rootDir = normalizedLanguage === 'en'
    ? docsRoot
    : path.join(translationsRoot, normalizedLanguage)
  const existingPath = findMarkdownByIdentity(rootDir, { guideId, uuid, language: normalizedLanguage })

  if (existingPath) return existingPath

  return normalizedLanguage === 'en'
    ? originPathFor(sectionId, guideId)
    : translationPathFor(sectionId, guideId, normalizedLanguage)
}

const canonicalMarkdownPathForLanguage = (sectionId, guideId, language) => {
  const normalizedLanguage = safeSegment(language || 'en', 'en')

  return normalizedLanguage === 'en'
    ? originPathFor(sectionId, guideId)
    : translationPathFor(sectionId, guideId, normalizedLanguage)
}

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

const removeFrontmatterValue = (markdown, key) => {
  const source = String(markdown || '').trim()

  if (!source.startsWith('---')) return source

  const endIndex = source.indexOf('\n---', 3)
  if (endIndex === -1) return source

  const keyPattern = new RegExp(`^${key}:`, 'i')
  const frontmatterLines = source
    .slice(3, endIndex)
    .trim()
    .split('\n')
    .filter(line => line && !keyPattern.test(line))

  return ['---', ...frontmatterLines, '---', source.slice(endIndex + 4).trim()].join('\n').trimEnd().concat('\n')
}

const normalizeTranslatedMarkdownFrontmatter = (markdown, { language, sourceLanguage }) => {
  let next = setFrontmatterValue(
    setFrontmatterValue(
      setFrontmatterValue(markdown, 'language', language),
      'videoLanguage',
      language
    ),
    'videoLanguages',
    language
  )

  if (language === 'en') {
    next = removeFrontmatterValue(next, 'sourceLanguage')
    next = removeFrontmatterValue(next, 'translationOf')
    return next
  }

  return setFrontmatterValue(
    setFrontmatterValue(next, 'sourceLanguage', sourceLanguage || 'en'),
    'translationOf',
    sourceLanguage === 'en' ? 'english-origin' : `${sourceLanguage || 'source'}-origin`
  )
}

const translateMarkdownWithHaiku = async ({ markdown, language, sourceLanguage = 'en' }) => {
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
        `Translate this help markdown from ${languageName(sourceLanguage)} to ${languageName(language)}.`,
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

  return normalizeTranslatedMarkdownFrontmatter(translated, { language, sourceLanguage })
}

const resolveHowToSourcePath = (sourcePath, sectionId, guideId) => {
  const normalizedSourcePath = String(sourcePath || '').trim()
  const fallbackPath = originPathFor(sectionId, guideId)
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
  files: [],
  createdFiles: []
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

const trackCreatedFileForUndo = (operation, targetPath) => {
  if (!operation || existsSync(targetPath)) return

  const absolutePath = path.resolve(targetPath)
  if (operation.createdFiles?.some(file => file.absolutePath === absolutePath)) return

  operation.createdFiles = operation.createdFiles || []
  operation.createdFiles.push({
    absolutePath,
    relativePath: path.relative(__dirname, absolutePath)
  })
}

const commitUndoOperation = (operation) => {
  if (!operation?.files?.length && !operation?.createdFiles?.length) return null

  lastOverwriteUndo = operation

  return {
    id: operation.id,
    label: operation.label,
    files: [
      ...operation.files.map(file => file.relativePath),
      ...(operation.createdFiles || []).map(file => file.relativePath)
    ]
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
  trackCreatedFileForUndo(operation, targetPath)
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, content, encoding)
}

const copyFileWithUndo = async (operation, sourcePath, targetPath) => {
  await backupFileForUndo(operation, targetPath)
  await copyFile(sourcePath, targetPath)
}

const writeMarkdownWithOptionalMove = async (operation, sourcePath, targetPath, markdown, options = {}) => {
  const resolvedSourcePath = sourcePath ? path.resolve(sourcePath) : ''
  const resolvedTargetPath = path.resolve(targetPath)
  const allowOverwrite = Boolean(options.allowOverwrite)

  if (resolvedSourcePath && resolvedSourcePath !== resolvedTargetPath && existsSync(resolvedTargetPath) && !allowOverwrite) {
    throw new Error(`Refusing to overwrite existing markdown file: ${path.relative(__dirname, resolvedTargetPath)}`)
  }

  if (resolvedSourcePath && resolvedSourcePath !== resolvedTargetPath && existsSync(resolvedSourcePath)) {
    await backupFileForUndo(operation, resolvedSourcePath)
    await writeFileWithUndo(operation, resolvedTargetPath, markdown, 'utf8')
    await rm(resolvedSourcePath, { force: true })
    return
  }

  if (!resolvedSourcePath && existsSync(resolvedTargetPath) && !allowOverwrite) {
    throw new Error(`Markdown file already exists: ${path.relative(__dirname, resolvedTargetPath)}`)
  }

  await writeFileWithUndo(operation, resolvedTargetPath, markdown, 'utf8')
}

const restoreLastOverwriteUndo = async () => {
  const operation = lastOverwriteUndo

  if (!operation?.files?.length && !operation?.createdFiles?.length) {
    throw new Error('No overwritten files to undo.')
  }

  for (const file of [...(operation.createdFiles || [])].reverse()) {
    await rm(file.absolutePath, { force: true })
  }

  for (const file of [...operation.files].reverse()) {
    await mkdir(path.dirname(file.absolutePath), { recursive: true })
    await writeFile(file.absolutePath, file.content)
  }

  lastOverwriteUndo = null

  return {
    id: operation.id,
    label: operation.label,
    files: [
      ...operation.files.map(file => file.relativePath),
      ...(operation.createdFiles || []).map(file => file.relativePath)
    ]
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

const videoAssetSafeName = (sectionId, guideId) => `${safeSegment(sectionId, 'editor')}-${safeSegment(guideId, 'guide')}`

const videoOverridePathsFor = ({ sectionId, guideId, language }) => {
  const normalizedLanguage = safeSegment(language || 'en', 'en')
  const safeName = videoAssetSafeName(sectionId, guideId)
  const videoPath = path.join(publicRoot, 'howto-videos', videoOverrideFolder, normalizedLanguage, `${safeName}.mp4`)

  return {
    language: normalizedLanguage,
    safeName,
    videoPath,
    videoUrl: `/howto-videos/${videoOverrideFolder}/${normalizedLanguage}/${safeName}.mp4`
  }
}

const getVideoOverride = async ({ sectionId, guideId, language }) => {
  const paths = videoOverridePathsFor({ sectionId, guideId, language })

  if (!existsSync(paths.videoPath)) {
    return {
      exists: false,
      language: paths.language,
      videoUrl: paths.videoUrl,
      sourcePath: path.relative(__dirname, paths.videoPath)
    }
  }

  const videoStat = await stat(paths.videoPath)

  return {
    exists: true,
    language: paths.language,
    videoUrl: `${paths.videoUrl}?t=${Math.round(videoStat.mtimeMs)}`,
    cleanVideoUrl: paths.videoUrl,
    sourcePath: path.relative(__dirname, paths.videoPath),
    size: videoStat.size,
    updatedAt: videoStat.mtime.toISOString()
  }
}

const isOverrideVideoSource = (sourcePath, override) => (
  Boolean(sourcePath && override?.exists)
  && path.resolve(sourcePath) === path.resolve(resolvePublicUrlPath(override.cleanVideoUrl || override.videoUrl))
)

const findGeneratedVideo = async ({ sectionId, guideId, language }) => {
  const safeName = videoAssetSafeName(sectionId, guideId)
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
  const safeName = videoAssetSafeName(sectionId, guideId)
  const videoList = Array.isArray(videos) ? videos : []
  const copied = []
  const warnings = []
  const videoLinks = {}

  for (const language of languages) {
    const video = videoList.find(candidate => candidate.language === language) || {}
    const override = await getVideoOverride({ sectionId, guideId, language })
    const outputDir = path.join(publicRoot, 'howto-videos/prod', language)
    const targetVideoPath = path.join(outputDir, `${safeName}.mp4`)
    const targetCaptionsPath = path.join(outputDir, `${safeName}.vtt`)
    const sourceVideoPath = resolvePublicUrlPath(video.videoUrl)
    const sourceCaptionsPath = resolvePublicUrlPath(video.captionsUrl || video.subtitlesUrl)

    await mkdir(outputDir, { recursive: true })

    if (override.exists) {
      if (!isOverrideVideoSource(sourceVideoPath, override)) {
        throw new Error(`${language.toUpperCase()} has an override MP4. Remove the override before publishing a generated video.`)
      }

      copied.push(override.sourcePath)
      videoLinks[language] = {
        videoUrl: override.cleanVideoUrl || override.videoUrl,
        captionsUrl: ''
      }
      continue
    }

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
- Create exactly one new English markdown file under frontend/src/docs/how-to/<guide-id>.en.md. Do not put the section in the file path.
- Use the existing help-doc format in frontend/src/docs/how-to as the source of truth.
- Include frontmatter with id, title, summary, order, language, sectionId, sectionTitle, sectionSummary, sectionOrder, videoLanguage, and videoLanguages.
- The id frontmatter is the Guide ID and must match the markdown filename.
- Use sectionId/sectionTitle frontmatter to choose where the manuscript browser shows the guide.
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
- hoverClick: { "type": "hoverClick", "targetMode": "selector", "selector": ".row", "clickSelector": "button[aria-label='Edit']", "hoverHoldMs": 300, "holdMs": 500 }
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
    server.middlewares.use('/howto-videos', async (req, res, next) => {
      if (!['GET', 'HEAD'].includes(req.method || '')) {
        next()
        return
      }

      try {
        const targetPath = resolvePublicAssetPath('/howto-videos', req.url)

        if (!targetPath || !existsSync(targetPath)) {
          next()
          return
        }

        const served = await servePublicAsset(req, res, targetPath)

        if (!served) {
          next()
        }
      } catch (error) {
        next(error)
      }
    })

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
        const targetPath = body.sourcePath
          ? resolveHowToSourcePath(body.sourcePath, body.sectionId, body.guideId)
          : markdownPathForLanguage(body.sectionId, body.guideId, body.language || 'en', body)

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

    server.middlewares.use('/__howto-script-editor/video-override-status', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const body = await readRequestJson(req)
        sendJson(res, 200, await getVideoOverride({
          sectionId: body.sectionId,
          guideId: body.guideId,
          language: body.language || 'en'
        }))
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/__howto-script-editor/video-override', async (req, res) => {
      if (!['POST', 'DELETE'].includes(req.method || '')) {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const url = new URL(req.url || '', 'http://localhost')
        const identity = {
          sectionId: url.searchParams.get('sectionId') || '',
          guideId: url.searchParams.get('guideId') || '',
          language: url.searchParams.get('language') || 'en'
        }
        const overridePaths = videoOverridePathsFor(identity)

        if (!safeSegment(identity.guideId, '')) {
          throw new Error('Guide ID is required for video overrides.')
        }

        if (req.method === 'DELETE') {
          await rm(overridePaths.videoPath, { force: true })
          sendJson(res, 200, {
            deleted: true,
            ...(await getVideoOverride(identity))
          })
          return
        }

        const contentType = String(req.headers['content-type'] || '').toLowerCase()
        if (!contentType.includes('video/mp4') && !contentType.includes('application/octet-stream')) {
          throw new Error('Only MP4 uploads are supported.')
        }

        const fileBuffer = await readRequestBuffer(req)
        if (!fileBuffer.length) {
          throw new Error('Uploaded MP4 is empty.')
        }

        await mkdir(path.dirname(overridePaths.videoPath), { recursive: true })
        await writeFile(overridePaths.videoPath, fileBuffer)
        sendJson(res, 200, {
          uploaded: true,
          ...(await getVideoOverride(identity))
        })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/__howto-script-editor/record/start', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const body = await readRequestJson(req)
        const id = randomUUID().slice(0, 8)
        const paths = recordingPathsFor(id)
        const baseUrl = String(body.baseUrl || 'http://localhost:3000').trim()
        const startUrl = resolveStartUrl(baseUrl, body.startUrl || body.recordingStartUrl || '')
        const username = String(body.username || '').trim()
        const password = String(body.password || '')
        const recordReferenceVideoWithAudio = Boolean(body.recordReferenceVideoWithAudio || body.referenceVideoWithAudio)

        await mkdir(paths.outputDir, { recursive: true })
        const storageState = await createAuthState({
          baseUrl,
          username,
          password,
          outputPath: paths.storageStatePath
        })
        const session = {
          id,
          baseUrl,
          startUrl,
          outputDir: paths.outputDir,
          recordReferenceVideoWithAudio,
          log: `Starting action recorder against ${baseUrl}\nStart URL: ${startUrl}\nReference video with audio: ${recordReferenceVideoWithAudio ? 'on' : 'off'}\n`,
          status: 'starting',
          error: '',
          child: null,
          finalizePromise: null
        }
        const recorder = runHowToRecorder([
          '--session-id', id,
          '--base-url', baseUrl,
          '--start-url', startUrl,
          '--output-dir', paths.outputDir,
          ...(storageState ? ['--storage-state', storageState] : [])
        ], text => {
          session.log += text
        })

        session.child = recorder.child
        recordingSessions.set(id, session)
        recorder.child.once('spawn', () => {
          session.status = 'running'
        })
        recorder.child.once('error', error => {
          session.status = 'error'
          session.error = error.message
          session.log += `\nERROR: ${error.message}\n`
        })
        recorder.child.once('exit', code => {
          const terminalStatus = code === 0
            ? (session.status === 'stopping' || session.status === 'stopped' ? 'stopped' : 'closed')
            : 'error'
          if (code !== 0 && !session.error) {
            session.error = `Recorder exited with code ${code}`
          }
          session.terminalStatus = terminalStatus
          session.status = 'finalizing'
          finalizeRecordingAssets(id, baseUrl, session, { terminalStatus })
        })

        sendJson(res, 200, {
          id,
          status: session.status,
          log: session.log
        })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/__howto-script-editor/record/stop', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const body = await readRequestJson(req)
        const id = safeSegment(body.id, '')
        const session = recordingSessions.get(id)

        if (session?.child && session.child.exitCode === null && !session.child.signalCode) {
          session.status = 'stopping'
          session.log += '\nStopping action recorder...\n'
          session.child.kill('SIGINT')
          await waitForChildExit(session.child)
        }

        if (session) session.status = 'stopped'
        await finalizeRecordingAssets(id, session?.baseUrl || body.baseUrl || '', session, {
          recordReferenceVideoWithAudio: Boolean(body.recordReferenceVideoWithAudio || body.referenceVideoWithAudio)
        })
        sendJson(res, 200, await readRecordingSnapshot(id, session?.baseUrl || body.baseUrl || ''))
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/__howto-script-editor/record', async (req, res, next) => {
      const url = new URL(req.url || '', 'http://localhost')
      const parts = url.pathname.split('/').filter(Boolean)
      const recordIndex = parts.indexOf('record')
      const id = recordIndex >= 0 ? parts[recordIndex + 1] || '' : parts[0] || ''
      const action = recordIndex >= 0 ? parts[recordIndex + 2] || '' : parts[1] || ''

      if (!id || !['events', 'raw-video', 'reference-video', 'audio'].includes(action)) {
        next()
        return
      }

      try {
        if (action === 'events') {
          if (req.method !== 'GET') {
            sendJson(res, 405, { error: 'Method not allowed' })
            return
          }

          sendJson(res, 200, await readRecordingSnapshot(id, url.searchParams.get('baseUrl') || ''))
          return
        }

        if (!['GET', 'HEAD'].includes(req.method || '')) {
          sendJson(res, 405, { error: 'Method not allowed' })
          return
        }

        const snapshot = await readRecordingSnapshot(id, url.searchParams.get('baseUrl') || '')
        let assetPath = snapshot.rawVideoPath

        if (action === 'reference-video') {
          assetPath = snapshot.referenceVideoPath
        }

        if (action === 'audio') {
          const audioName = parts[recordIndex >= 0 ? recordIndex + 3 : 2] || ''
          assetPath = audioName === 'full'
            ? snapshot.microphonePath
            : path.join(recordingPathsFor(id).outputDir, 'audio-clips', path.basename(audioName))
        }

        if (!assetPath || !existsSync(assetPath)) {
          const missingMessage = action === 'audio'
            ? 'Recorded audio not found.'
            : action === 'reference-video'
              ? 'Reference video with audio not found.'
              : 'Raw recording video not found.'
          sendJson(res, 404, { error: missingMessage })
          return
        }

        const outputDir = recordingPathsFor(id).outputDir
        const relativePath = path.relative(outputDir, assetPath)
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
          throw new Error('Invalid recording asset path.')
        }

        await servePublicAsset(req, res, assetPath)
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/__howto-script-editor/block-audio/recorded', async (req, res, next) => {
      if (req.method !== 'POST') {
        next()
        return
      }

      try {
        const body = await readRequestJson(req)
        const clip = await saveRecordedBlockAudio(body)
        sendJson(res, 200, { audio: clip })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/__howto-script-editor/block-audio/elevenlabs', async (req, res, next) => {
      if (req.method === 'POST') {
        try {
          const body = await readRequestJson(req)
          const clip = await generateElevenLabsBlockAudio(body)
          sendJson(res, 200, { audio: clip })
        } catch (error) {
          sendJson(res, 500, { error: error.message })
        }
        return
      }

      next()
    })

    server.middlewares.use('/__howto-script-editor/block-audio/transcribe', async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const body = await readRequestJson(req)
        sendJson(res, 200, { transcript: await transcribeAudioClip(body) })
      } catch (error) {
        sendJson(res, 500, { error: error.message })
      }
    })

    server.middlewares.use('/__howto-script-editor/block-audio', async (req, res, next) => {
      const url = new URL(req.url || '', 'http://localhost')
      const parts = url.pathname.split('/').filter(Boolean)
      const blockAudioIndex = parts.indexOf('block-audio')
      const kind = blockAudioIndex >= 0 ? parts[blockAudioIndex + 1] || '' : parts[0] || ''
      const fileName = blockAudioIndex >= 0 ? parts[blockAudioIndex + 2] || '' : parts[1] || ''

      if (!kind || !fileName) {
        next()
        return
      }

      if (!['GET', 'HEAD'].includes(req.method || '')) {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const assetPath = blockAudioPathFor(kind, fileName)
        if (!existsSync(assetPath)) {
          sendJson(res, 404, { error: 'Block audio not found.' })
          return
        }

        await servePublicAsset(req, res, assetPath)
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

    server.middlewares.use('/__howto-script-editor/render-logs', async (req, res) => {
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' })
        return
      }

      try {
        const url = new URL(req.url || '', 'http://localhost')
        const guideId = String(url.searchParams.get('guideId') || '').trim()
        const language = String(url.searchParams.get('language') || '').trim().toLowerCase()
        const logs = (await listRenderLogs()).filter(log => {
          if (guideId && log.guideId !== guideId) return false
          if (language && !log.languages.includes(language)) return false
          return true
        })

        sendJson(res, 200, { logs })
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
        const targetPath = markdownPathForLanguage(body.sectionId, body.guideId, body.language || 'sv', body)

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
        const targetPath = markdownPathForLanguage(body.sectionId, body.guideId, body.language || 'sv', body)

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
        const sourceLanguage = safeSegment(body.sourceLanguage || 'en', 'en')
        const existingTargetPath = markdownPathForLanguage(body.sectionId, body.guideId, language, body)
        const targetPath = canonicalMarkdownPathForLanguage(body.sectionId, body.guideId, language, body)
        const overwrite = Boolean(body.overwrite)

        if (!markdown.trim()) {
          throw new Error('Markdown is empty.')
        }

        startEventStream(res)

        if (existsSync(existingTargetPath) && !overwrite) {
          writeEvent(res, 'error', {
            error: `Translation already exists at ${path.relative(__dirname, existingTargetPath)}.`,
            exists: true,
            sourcePath: path.relative(__dirname, existingTargetPath)
          })
          res.end()
          return
        }

        writeEvent(res, 'log', { text: `Translating ${languageName(sourceLanguage)} markdown to ${languageName(language)} with Claude Haiku...\n` })
        const translatedMarkdown = await translateMarkdownWithHaiku({ markdown, language, sourceLanguage })
        const undoOperation = getUndoOperation(`Translate ${language.toUpperCase()} markdown`)

        await writeMarkdownWithOptionalMove(
          undoOperation,
          existsSync(existingTargetPath) ? existingTargetPath : '',
          targetPath,
          translatedMarkdown
        )
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

        const sourcePath = body.sourcePath
          ? resolveHowToSourcePath(body.sourcePath, body.sectionId, body.guideId)
          : ''
        const targetPath = body.useCanonicalPath
          ? canonicalMarkdownPathForLanguage(body.sectionId, body.guideId, body.language || 'en', body)
          : sourcePath

        if (!targetPath) {
          throw new Error('Guide ID is required before saving markdown.')
        }

        if (body.requireExisting && (!sourcePath || !existsSync(sourcePath)) && !body.allowMissingSource) {
          throw new Error(`Refusing to overwrite missing file: ${path.relative(__dirname, sourcePath)}`)
        }

        const writableSourcePath = sourcePath && existsSync(sourcePath) ? sourcePath : ''
        const undoOperation = getUndoOperation(
          body.undoLabel || `Overwrite ${path.basename(targetPath)}`,
          body.appendToUndoId || ''
        )

        await writeMarkdownWithOptionalMove(undoOperation, writableSourcePath, targetPath, markdown, {
          allowOverwrite: Boolean(body.allowOverwrite)
        })
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

      let renderRun = null

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

        const lockedOverrides = (await Promise.all(languages.map(language => (
          getVideoOverride({ sectionId, guideId, language })
        )))).filter(override => override.exists)

        if (lockedOverrides.length > 0) {
          throw new Error(`Video generation is locked by override MP4 for: ${lockedOverrides.map(override => override.language.toUpperCase()).join(', ')}. Remove the override first.`)
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

        renderRun = {
          id: runId,
          guideId,
          sectionId,
          languages,
          baseUrl,
          username,
          voice: Boolean(body.voice),
          globalHoldMs,
          videos: [],
          log: ''
        }
        const appendRenderLog = (text) => {
          const output = String(text || '')
          renderRun.log += output
          writeEvent(res, 'log', { text: output })
        }

        startEventStream(res)
        appendRenderLog(`Preparing editor preview for ${guideId} against ${baseUrl}\nLanguages: ${languages.join(', ')}\nGlobal extra holdMs: ${globalHoldMs}\n`)
        await mkdir(docsDir, { recursive: true })
        await mkdir(outputRoot, { recursive: true })
        await mkdir(workRoot, { recursive: true })
        appendRenderLog(`Temporary scripts folder: ${docsDir}\n`)

        if (username || password) {
          appendRenderLog(`Logging in as ${username || '(missing username)'} at ${new URL(baseUrl).origin}\n`)
        }

        const storageState = await createAuthState({
          baseUrl,
          username,
          password,
          outputPath: storageStatePath
        })

        const videos = []
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
          appendRenderLog(`\n[${language}] Wrote ${language.toUpperCase()} script to ${path.join(docsDir, `${guideId}.md`)}\n`)
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

          appendRenderLog(`\n[${language}] Starting video generator: node scripts/generate-howto-video.mjs ${generatorArgs.join(' ')}\n`)
          await runHowToRender(generatorArgs, appendRenderLog)
          videos.push({
            language,
            videoUrl: `/howto-videos/editor-preview/${language}/${safeName}.mp4?t=${Date.now()}`,
            captionsUrl: `/howto-videos/editor-preview/${language}/${safeName}.vtt?t=${Date.now()}`
          })
          renderRun.videos = videos
        }

        const currentVideo = videos.at(-1) || {}
        const undo = commitUndoOperation(undoOperation)
        renderRun.videos = videos
        const renderLog = await saveRenderLog({
          ...renderRun,
          status: 'success'
        })

        writeEvent(res, 'done', {
          videoUrl: currentVideo.videoUrl || '',
          subtitlesUrl: currentVideo.captionsUrl || '',
          language: currentVideo.language || languages.at(-1),
          videos,
          log: renderRun.log,
          logId: renderLog.id,
          logPath: renderLog.path,
          undo
        })
        res.end()
      } catch (error) {
        if (renderRun) {
          const errorText = `\nERROR: ${error.message}\n`
          renderRun.log += errorText
          await saveRenderLog({
            ...renderRun,
            status: 'error',
            error: error.message
          }).catch(() => {})
        }

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

        const sourcePath = resolveHowToSourcePath(body.sourcePath, body.sectionId, body.guideId)
        const targetPath = canonicalMarkdownPathForLanguage(body.sectionId, body.guideId, languages[0] || body.language || 'en', body)
        const undoOperation = getUndoOperation(`Publish ${safeSegment(body.guideId, 'guide')}`)
        const publishedVideos = await publishReviewedVideos({
          sectionId: body.sectionId,
          guideId: body.guideId,
          languages,
          videos: body.videos,
          undoOperation
        })

        await writeMarkdownWithOptionalMove(undoOperation, sourcePath, targetPath, markdown, {
          allowOverwrite: true
        })
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
      usePolling,
      interval: 1000,
      ignored: [
        '**/coverage/**',
        '**/dist/**',
        '**/node_modules/**',
        '**/src/docs/how-to/**/*.md',
        '**/src/docs/how-to-translations/**/*.md',
        '**/public/howto-videos/editor-preview/**',
        '**/public/howto-videos/prod/**',
        '**/.howto-script-preview/**',
        '**/howto-audio-cache/**',
      ],
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
