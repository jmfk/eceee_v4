/** Batch direct-model comparisons for the Python adapter tests (JSON stdin/stdout). */
import { readFileSync } from 'node:fs'
import { validateConfiguration } from './index.mjs'
const inputs = JSON.parse(readFileSync(0, 'utf8'))
process.stdout.write(JSON.stringify(inputs.map(({ typeId, configuration }) => validateConfiguration(typeId, configuration))))
