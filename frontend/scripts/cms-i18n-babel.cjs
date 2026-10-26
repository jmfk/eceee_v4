const path = require('node:path')
const { normalizeJsxText, isTranslatable } = require('./cms-jsx-text.cjs')
const translations = require('../src/locales/sv.json')
const englishTranslations = require('../src/locales/en.json')

const attributeNames = new Set(['title', 'placeholder', 'aria-label', 'alt'])
const skippedTags = new Set(['style', 'script', 'code', 'pre', 'svg', 'text', 'textarea'])
const eligible = (state) => {
  const filename = (state.file.opts.filename || '').replaceAll(path.sep, '/')
  return /\/src\/(?:pages|components)\//.test(filename)
    && !/\/(?:__tests__|demos|widgets)\//.test(filename)
    && !/\.(?:test|spec)\.[jt]sx?$/.test(filename)
}

module.exports = ({ types: t }) => ({
  visitor: {
    Program: {
      exit(program, state) {
        if (!state.file.get('cmsI18nChanged')) return
        const filename = state.file.opts.filename || ''
        let relative = path.relative(path.dirname(filename), path.resolve(__dirname, '../src/utils/cmsCopy.js'))
        if (!relative.startsWith('.')) relative = `./${relative}`
        program.unshiftContainer('body', t.importDeclaration(
          [t.importSpecifier(t.identifier('cmsTextGlobal'), t.identifier('cmsTextGlobal'))],
          t.stringLiteral(relative.replaceAll(path.sep, '/'))
        ))
      }
    },
    JSXText(nodePath, state) {
      if (!eligible(state)) return
      const parentName = nodePath.parentPath.node.openingElement?.name?.name
      if (skippedTags.has(parentName)) return
      const text = normalizeJsxText(nodePath.node.value)
      if (!isTranslatable(text) || !(translations[text.trim()] || englishTranslations[text.trim()])) return
      nodePath.replaceWith(t.jsxExpressionContainer(t.callExpression(t.identifier('cmsTextGlobal'), [t.stringLiteral(text)])))
      state.file.set('cmsI18nChanged', true)
    },
    JSXAttribute(nodePath, state) {
      if (!eligible(state)) return
      if (!attributeNames.has(nodePath.node.name.name) || !t.isStringLiteral(nodePath.node.value)) return
      const text = nodePath.node.value.value
      if (!isTranslatable(text) || !(translations[text.trim()] || englishTranslations[text.trim()])) return
      nodePath.node.value = t.jsxExpressionContainer(t.callExpression(t.identifier('cmsTextGlobal'), [t.stringLiteral(text)]))
      state.file.set('cmsI18nChanged', true)
    },
    StringLiteral(nodePath, state) {
      if (!eligible(state) || !nodePath.getFunctionParent()) return
      const documentTitle = nodePath.parentPath.isCallExpression()
        && nodePath.parentPath.node.callee.name === 'useDocumentTitle'
        && nodePath.key === 0
      if (!((documentTitle && translations[nodePath.node.value])
        || (/[åäöÅÄÖ]/.test(nodePath.node.value) && englishTranslations[nodePath.node.value]))) return
      if (nodePath.parentPath.isJSXAttribute() || (nodePath.parentPath.isObjectProperty() && nodePath.key === 'key')) return
      if (nodePath.findParent(parent => parent.isCallExpression() && parent.node.callee.name === 'cmsTextGlobal')) return
      nodePath.replaceWith(t.callExpression(t.identifier('cmsTextGlobal'), [t.stringLiteral(nodePath.node.value)]))
      state.file.set('cmsI18nChanged', true)
      nodePath.skip()
    }
  }
})
