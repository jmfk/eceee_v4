import { readFile, readdir, stat } from 'node:fs/promises'
import { howToSourceFingerprint } from './howto-source.mjs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseHowToMarkdown, parseHowToMarkdownCollection } from '../src/utils/howToMarkdown.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const requirePreviews = process.argv.includes('--require-previews')
const markdownFiles = async (directory) => {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await markdownFiles(path))
    else if (entry.name.endsWith('.md')) files.push(path)
  }
  return files
}
const modules = Object.fromEntries(await Promise.all((await markdownFiles(join(root, 'frontend/src/docs/how-to')))
  .map(async path => [path, await readFile(path, 'utf8')])))
const helpIds = new Set(parseHowToMarkdownCollection(modules).flatMap(section => section.guides.map(guide => guide.id)))
const manuscripts = (await markdownFiles(join(root, 'docs/manus/instruktionsvideos'))).filter(path => path.endsWith('/manus.md'))
const failures = []
const timeMs = value => value.split(':').reduce((total, part) => total * 60 + Number(part), 0) * 1000
for (const source of manuscripts) {
  try {
    const parsed = parseHowToMarkdown(await readFile(source, 'utf8'))
    const guide = parsed.guide
    if (!guide?.helpGuideId || !helpIds.has(guide.helpGuideId)) throw new Error('missing or unknown helpGuideId')
    if (!guide.actions?.length) throw new Error('missing executable video-script')
    if (requirePreviews) {
      const prefix = join(dirname(source), 'video', `${guide.id}-preview-sv`)
      const video = await stat(`${prefix}.mp4`)
      if (!video.size) throw new Error('empty MP4')
      const manifest = JSON.parse(await readFile(`${prefix}.json`, 'utf8'))
      if (manifest.helpGuideId !== guide.helpGuideId || manifest.preview !== true || manifest.language !== 'sv') {
        throw new Error('preview manifest does not match manuscript identity/language')
      }
      if (manifest.sourceFingerprint !== howToSourceFingerprint(guide, 'sv')) throw new Error('preview source is stale or unverifiable; re-record the current manuscript')
      const vtt = await readFile(`${prefix}.vtt`, 'utf8')
      const cues = [...vtt.matchAll(/(\d\d:\d\d:\d\d\.\d{3}) --> (\d\d:\d\d:\d\d\.\d{3})\n(.*?)(?=\n\n|$)/gs)]
      const parts = manifest.audio?.narration?.parts || []
      if (!vtt.startsWith('WEBVTT') || cues.length !== guide.actions.length || parts.length !== cues.length) throw new Error('missing narration/subtitle cues')
      let end = 0
      cues.forEach((cue, index) => {
        const startMs = timeMs(cue[1]); const endMs = timeMs(cue[2]); const part = parts[index]
        const caption = guide.actions[index].captionSv || guide.actions[index].caption
        if (cue[3].trim() !== caption || part.text !== caption) throw new Error(`narration differs at cue ${index + 1}`)
        if (startMs < end || endMs <= startMs || Math.abs(startMs - part.at) > 2 || Math.abs(endMs - part.at - part.durationMs) > 2) throw new Error(`invalid audio/subtitle timing at cue ${index + 1}`)
        end = endMs
      })
    }
    console.log(`PASS ${guide.id} -> ${guide.helpGuideId}${requirePreviews ? ' (MP4/VTT/narration verified)' : ''}`)
  } catch (error) {
    failures.push(`${source}: ${error.message}`)
  }
}
if (failures.length) {
  failures.forEach(failure => console.error(failure))
  process.exitCode = 1
} else {
  console.log(`Verified ${manuscripts.length} manuscripts against ${helpIds.size} source-owned help guides. No upload or publication performed.`)
}
