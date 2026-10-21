/** Emit portable candidate observations using actual contract evaluation, never frozen answers. */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { canonical } from './index.mjs'
import { observeRequest, buildRenderManifest } from './transport.mjs'

const [casesPath, outputPath] = process.argv.slice(2)
if (!casesPath || !outputPath || process.argv.length !== 4) throw new Error('Usage: node observe.mjs cases.json output.json')
const bytes = readFileSync(casesPath)
const cases = JSON.parse(bytes)
if (cases.formatVersion !== 1) throw new Error('Unsupported pilot cases version')
if (new Set(cases.contracts.map(item => item.id)).size !== cases.contracts.length) throw new Error('Duplicate scenario IDs')
const observations = Object.fromEntries(cases.contracts.map(item => [item.id, observeRequest(item)]))
const manifest = buildRenderManifest()
observations['render-manifest'] = {
    formatVersion: manifest.formatVersion, types: Object.keys(manifest.widgets).sort(),
    sha256: createHash('sha256').update(JSON.stringify(canonical(manifest))).digest('hex'),
}
writeFileSync(outputPath, JSON.stringify({
    formatVersion: 1, casesSha256: createHash('sha256').update(bytes).digest('hex'), observations,
    candidateRuntime: { node: process.version, validator: 'comparison-only', authentication: 'fixture-policy-only' },
}, null, 2) + '\n')
console.log(`Observed ${cases.contracts.length} cases and the complete catalog with Node ${process.version}`)
