#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const parseArgs = (argv) => {
  const args = {
    input: process.env.HOWTO_VIDEO || process.env.VIDEO || '',
    output: process.env.HOWTO_VIDEO_OUTPUT || process.env.OUTPUT || '',
    cuts: process.env.HOWTO_VIDEO_CUTS || process.env.CUTS || '',
    ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
    help: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]

    if (arg === '--input') args.input = next
    if (arg === '--output') args.output = next
    if (arg === '--cuts') args.cuts = next
    if (arg === '--ffmpeg') args.ffmpegPath = next
    if (arg === '--help' || arg === '-h') args.help = true

    if (arg.startsWith('--') && next && !next.startsWith('--')) index += 1
  }

  return args
}

const printUsage = () => {
  console.log(`Trim an existing how-to MP4 without recording the demo again.

Usage:
  node scripts/edit-howto-video.mjs --input public/howto-videos/editor-preview/sv/pages-pages-create.mp4 --cuts 0:10 --output public/howto-videos/editor-preview/sv/pages-pages-create-trimmed.mp4

Options:
  --input <path>       Source MP4.
  --output <path>      Edited MP4. Defaults to <input>-edited.mp4.
  --cuts <ranges>      Comma-separated seconds to remove, for example 0:10,45.5:48.
  --ffmpeg <path>      ffmpeg executable. Defaults to ffmpeg.
`)
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

const ffprobePathFor = (ffmpegPath) => {
  if (ffmpegPath.endsWith('/ffmpeg')) return `${ffmpegPath.slice(0, -'ffmpeg'.length)}ffprobe`
  return 'ffprobe'
}

const getDurationSeconds = async (inputPath, ffmpegPath) => {
  const output = await runCommand(ffprobePathFor(ffmpegPath), [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    inputPath
  ])
  const duration = Number(output.trim())

  if (!Number.isFinite(duration)) throw new Error(`Could not read duration for ${inputPath}`)

  return duration
}

const hasAudioStream = async (inputPath, ffmpegPath) => {
  const output = await runCommand(ffprobePathFor(ffmpegPath), [
    '-v',
    'error',
    '-select_streams',
    'a',
    '-show_entries',
    'stream=index',
    '-of',
    'csv=p=0',
    inputPath
  ])

  return Boolean(output.trim())
}

const parseCuts = (value) => String(value || '')
  .split(',')
  .map(part => part.trim())
  .filter(Boolean)
  .map(part => {
    const [start, end] = part.split(':').map(Number)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start < 0) {
      throw new Error(`Invalid cut range "${part}". Use start:end in seconds, for example 0:10.`)
    }

    return { start, end }
  })
  .sort((a, b) => a.start - b.start)

const defaultOutputPath = (inputPath) => {
  const parsed = path.parse(inputPath)
  return path.join(parsed.dir, `${parsed.name}-edited${parsed.ext || '.mp4'}`)
}

const buildKeepRanges = (duration, cuts) => {
  const ranges = []
  let cursor = 0

  cuts.forEach(cut => {
    if (cut.start > cursor) ranges.push({ start: cursor, end: Math.min(cut.start, duration) })
    cursor = Math.max(cursor, cut.end)
  })

  if (cursor < duration) ranges.push({ start: cursor, end: duration })

  return ranges.filter(range => range.end - range.start >= 0.04)
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printUsage()
    return
  }

  if (!args.input) throw new Error('Missing --input.')
  if (!args.cuts) throw new Error('Missing --cuts. Example: --cuts 0:10')

  const inputPath = path.resolve(args.input)
  const outputPath = path.resolve(args.output || defaultOutputPath(inputPath))

  if (!existsSync(inputPath)) throw new Error(`Input video not found: ${inputPath}`)

  const cuts = parseCuts(args.cuts)
  const duration = await getDurationSeconds(inputPath, args.ffmpegPath)
  const hasAudio = await hasAudioStream(inputPath, args.ffmpegPath)
  const keepRanges = buildKeepRanges(duration, cuts)

  if (keepRanges.length === 0) throw new Error('Cuts remove the whole video.')

  await mkdir(path.dirname(outputPath), { recursive: true })

  const filters = keepRanges.flatMap((range, index) => {
    const videoFilter = `[0:v]trim=start=${range.start.toFixed(3)}:end=${range.end.toFixed(3)},setpts=PTS-STARTPTS[v${index}]`
    const audioFilter = hasAudio
      ? `[0:a]atrim=start=${range.start.toFixed(3)}:end=${range.end.toFixed(3)},asetpts=PTS-STARTPTS[a${index}]`
      : ''

    return [videoFilter, audioFilter].filter(Boolean)
  })
  filters.push(hasAudio
    ? `${keepRanges.map((_, index) => `[v${index}][a${index}]`).join('')}concat=n=${keepRanges.length}:v=1:a=1[v][a]`
    : `${keepRanges.map((_, index) => `[v${index}]`).join('')}concat=n=${keepRanges.length}:v=1:a=0[v]`
  )

  console.log(`Editing ${inputPath}`)
  cuts.forEach(cut => console.log(`  cutting ${cut.start.toFixed(3)}s-${cut.end.toFixed(3)}s`))
  console.log(`Writing ${outputPath}`)

  await runCommand(args.ffmpegPath, [
    '-y',
    '-i',
    inputPath,
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[v]',
    ...(hasAudio ? ['-map', '[a]'] : ['-an']),
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '128k'] : []),
    '-movflags',
    '+faststart',
    outputPath
  ])

  console.log('Done.')
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
