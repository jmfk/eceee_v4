const fs = require('node:fs')
const path = require('node:path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const { normalizeJsxText, isTranslatable } = require('./cms-jsx-text.cjs')

const copy = new Set()
const attributeNames = new Set(['title', 'placeholder', 'aria-label', 'alt'])
const skippedTags = new Set(['style', 'script', 'code', 'pre', 'svg', 'text', 'textarea'])

const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'demos' && entry.name !== 'widgets') walk(filename)
    } else if (/\.(jsx|tsx)$/.test(filename) && !/\.(?:test|spec)\.[jt]sx?$/.test(filename)) {
      const ast = parser.parse(fs.readFileSync(filename, 'utf8'), { sourceType: 'module', plugins: ['jsx', 'typescript'] })
      traverse(ast, {
        JSXText(nodePath) {
          const parentName = nodePath.parentPath.node.openingElement?.name?.name
          if (skippedTags.has(parentName)) return
          const text = normalizeJsxText(nodePath.node.value).trim()
          if (isTranslatable(text)) copy.add(text)
        },
        JSXAttribute(nodePath) {
          if (!attributeNames.has(nodePath.node.name.name) || nodePath.node.value?.type !== 'StringLiteral') return
          const text = nodePath.node.value.value.trim()
          if (isTranslatable(text)) copy.add(text)
        }
      })
    }
  }
}

walk(path.resolve(__dirname, '../src/pages'))
walk(path.resolve(__dirname, '../src/components'))

const addHelpCopy = async () => {
  const { parseHowToMarkdown } = await import('../src/utils/howToMarkdown.js')
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(filename)
      else if (entry.name.endsWith('.md')) {
        const parsed = parseHowToMarkdown(fs.readFileSync(filename, 'utf8'), entry.name)
        const guide = parsed.guide
        if (!guide) continue
        for (const value of [parsed.sectionTitle, parsed.sectionSummary, guide.title, guide.summary, guide.narration, ...guide.steps]) {
          if (value && isTranslatable(value)) copy.add(value)
        }
      }
    }
  }
  visit(path.resolve(__dirname, '../src/docs/how-to'))
  process.stdout.write(JSON.stringify([...copy].sort()))
}

addHelpCopy().catch(error => { console.error(error); process.exitCode = 1 })
