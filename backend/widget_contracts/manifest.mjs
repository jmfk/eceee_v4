import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { serializeManifest } from './index.mjs'

const args = process.argv.slice(2)
let output = fileURLToPath(new URL('../../frontend/src/rendering/generated/render-manifest.json', import.meta.url))
let check = false
for (let index = 0; index < args.length; index++) {
    if (args[index] === '--check') check = true
    else if (args[index] === '--output' && args[index + 1] && !args[index + 1].startsWith('--')) output = args[++index]
    else throw new Error('Usage: node manifest.mjs [--check] [--output path]')
}
const generated = serializeManifest()
if (check) {
    if (readFileSync(output, 'utf8') !== generated) throw new Error(`Shared render manifest is stale: ${output}`)
    console.log('Publisher render manifest is current (Node; no Django).')
} else {
    writeFileSync(output, generated)
    console.log(`Wrote ${output}`)
}
