import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const testDir = dirname(fileURLToPath(import.meta.url))
const pageSource = readFileSync(resolve(testDir, '../ObjectInstanceEditPage.jsx'), 'utf8')

describe('ObjectInstanceEditPage editor chrome', () => {
    it('mounts the global WYSIWYG toolbar used by detached content editors', () => {
        expect(pageSource).toMatch(
            /import GlobalWysiwygToolbar from ['"]\.\.\/components\/wysiwyg\/GlobalWysiwygToolbar['"]/
        )
        expect(pageSource.match(/<GlobalWysiwygToolbar\s*\/>/g)).toHaveLength(1)
    })
})
