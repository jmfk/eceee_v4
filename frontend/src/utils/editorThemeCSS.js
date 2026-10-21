import { compileRenderStyles } from '../rendering/themeCssCompiler'

const GLOBAL_AT_RULES = new Set([
    'charset',
    'counter-style',
    'font-face',
    'font-feature-values',
    'font-palette-values',
    'namespace',
    'page',
    'property',
])

const isIdentifierCharacter = character => /[\w-]/.test(character || '')

const parseStyleSheet = css => {
    // Imported stylesheets cannot inherit an @scope boundary. Theme fonts are
    // added separately; any custom imports are deliberately omitted here.
    const withoutImports = css.replace(/@import\s+(?:[^;"']|"[^"]*"|'[^']*')*;/gi, '')
    if (typeof CSSStyleSheet !== 'undefined' && CSSStyleSheet.prototype?.replaceSync) {
        const sheet = new CSSStyleSheet()
        sheet.replaceSync(withoutImports)
        return Array.from(sheet.cssRules)
    }

    const style = document.createElement('style')
    style.media = 'not all'
    style.textContent = withoutImports
    document.head.appendChild(style)
    const rules = Array.from(style.sheet?.cssRules || [])
    style.remove()
    return rules
}

const atRuleName = rule => rule.cssText.startsWith('@')
    ? rule.cssText.slice(1).match(/^[-\w]+/)?.[0]?.toLowerCase() || ''
    : ''

const rewriteDocumentRoots = selector => {
    let result = ''
    let quote = null
    let bracketDepth = 0

    for (let index = 0; index < selector.length;) {
        const character = selector[index]
        if (quote) {
            result += character
            if (character === '\\' && index + 1 < selector.length) {
                result += selector[index + 1]
                index += 2
                continue
            }
            if (character === quote) quote = null
            index += 1
            continue
        }
        if (character === '"' || character === "'") {
            quote = character
            result += character
            index += 1
            continue
        }
        if (character === '[') bracketDepth += 1
        if (character === ']') bracketDepth = Math.max(0, bracketDepth - 1)

        if (bracketDepth === 0 && selector.slice(index, index + 5).toLowerCase() === ':root') {
            const next = selector[index + 5]
            if (!isIdentifierCharacter(next)) {
                result += ':scope'
                index += 5
                continue
            }
        }

        if (bracketDepth === 0) {
            const match = selector.slice(index).match(/^(html|body)/i)
            if (match) {
                const previous = selector[index - 1]
                const next = selector[index + match[0].length]
                const beginsCompound = index === 0 || /\s/.test(previous) || [',', '>', '+', '~', '('].includes(previous)
                if (beginsCompound && previous !== '|' && next !== '|' && !isIdentifierCharacter(next)) {
                    result += ':scope'
                    index += match[0].length
                    continue
                }
            }
        }

        result += character
        index += 1
    }

    return result.replace(/:scope\s+(?:>\s*)?:scope/g, ':scope')
}

const replaceIdentifiers = (value, replacements) => value.replace(
    /[-_a-zA-Z][-_a-zA-Z0-9]*/g,
    identifier => replacements.get(identifier) || identifier,
)

const collectKeyframes = (rules, names, prefix) => {
    for (const rule of rules) {
        if (atRuleName(rule).endsWith('keyframes') && rule.name) {
            names.set(rule.name, `${prefix}${rule.name}`)
        }
        if (rule.cssRules) collectKeyframes(Array.from(rule.cssRules), names, prefix)
    }
}

const serializeDeclarations = (style, keyframeNames) => Array.from(style).map(property => {
    const originalValue = style.getPropertyValue(property)
    const value = property === 'animation' || property === 'animation-name'
        ? replaceIdentifiers(originalValue, keyframeNames)
        : originalValue
    const important = style.getPropertyPriority(property) ? ' !important' : ''
    return `${property}: ${value}${important};`
}).join(' ')

const serializeRule = (rule, keyframeNames) => {
    if (rule.type === 1) {
        const declarations = serializeDeclarations(rule.style, keyframeNames)
        const nestedRules = rule.cssRules
            ? Array.from(rule.cssRules).map(child => serializeRule(child, keyframeNames)).join(' ')
            : ''
        return `${rewriteDocumentRoots(rule.selectorText)} { ${[declarations, nestedRules].filter(Boolean).join(' ')} }`
    }
    if (rule.type === 7) {
        const name = keyframeNames.get(rule.name) || rule.name
        const frames = Array.from(rule.cssRules).map(frame => `${frame.keyText} { ${frame.style.cssText} }`).join(' ')
        return `@keyframes ${name} { ${frames} }`
    }
    if (rule.cssRules) {
        const header = rule.cssText.slice(0, rule.cssText.indexOf('{')).trim()
        const nested = Array.from(rule.cssRules).map(child => serializeRule(child, keyframeNames)).join('\n')
        return `${header} {\n${nested}\n}`
    }
    return rule.cssText
}

export const compileEditorCSS = (css, {
    rootSelector,
    limitSelector = '.eceee-editor-ui',
    namespace = 'editor-',
} = {}) => {
    if (!css?.trim() || !rootSelector) return ''

    const rules = parseStyleSheet(css)
    const keyframeNames = new Map()
    collectKeyframes(rules, keyframeNames, namespace)

    const topLevel = []
    const scoped = []
    for (const rule of rules) {
        const keyword = atRuleName(rule)
        if (GLOBAL_AT_RULES.has(keyword) || keyword.endsWith('keyframes')) {
            topLevel.push(serializeRule(rule, keyframeNames))
        } else {
            scoped.push(serializeRule(rule, keyframeNames))
        }
    }

    if (scoped.length) {
        topLevel.push(`@scope (${rootSelector}) to (${limitSelector}) {\n${scoped.join('\n')}\n}`)
    }
    return topLevel.join('\n\n')
}

export const buildEditorThemeCSS = ({
    theme,
    page,
    version,
    pageCssVariables,
    pageCustomCss,
    enableCssInjection = true,
    scopeId,
}) => {
    if (!scopeId) return ''

    const pageCss = page || version
        ? undefined
        : {
            enabled: enableCssInjection !== false,
            variables: pageCssVariables || {},
            customCss: pageCustomCss || '',
        }
    const compiledStyles = compileRenderStyles({ theme, page, version, pageCss })

    const rootSelector = `.eceee-theme-scope[data-eceee-theme-scope="${scopeId}"]`
    const compiled = compileEditorCSS(compiledStyles.css, {
        rootSelector,
        namespace: `eceee-${scopeId.replace(/[^a-zA-Z0-9_-]/g, '-')}-`,
    })
    return compiled
}

export const buildDesignerTheme = workspace => {
    if (!workspace?.themeConfig) return null

    const theme = structuredClone(workspace.themeConfig)
    theme.colors = Object.fromEntries((workspace.colors || []).map(({ name, value }) => [name, value]))
    theme.textOutlineStyles = structuredClone(workspace.textOutlineStyles || {})
    theme.widgetTypes = structuredClone(workspace.widgetTypes || theme.widgetTypes || { version: 1, items: [] })
    theme.layouts = structuredClone(workspace.layouts || theme.layouts)

    const fonts = theme.fonts || {}
    const googleFonts = (workspace.fonts || []).map(({ family, variants, display }) => ({ family, variants, display }))
    theme.fonts = { ...fonts, googleFonts }

    const designGroups = theme.designGroups || theme.design_groups || { groups: [] }
    const groups = designGroups.groups || []
    for (const row of workspace.typography || []) {
        const group = groups[row.groupIndex]
        if (!group) continue
        group.elements ||= {}
        group.elements[row.element] = { ...(group.elements[row.element] || {}), ...row.values }
    }
    for (const row of workspace.spacing || []) {
        if (['layoutSlot', 'widget', 'widgetSlot', 'widgetPart'].includes(row.scope)) continue
        const group = groups[row.groupIndex]
        if (!group) continue
        if (row.scope === 'layout') {
            const layoutProperties = group.layoutProperties || group.layout_properties || {}
            layoutProperties[row.part] ||= {}
            layoutProperties[row.part][row.breakpoint] = {
                ...(layoutProperties[row.part][row.breakpoint] || {}),
                ...row.values,
            }
            group.layoutProperties = layoutProperties
        } else {
            group.elements ||= {}
            group.elements[row.element] = { ...(group.elements[row.element] || {}), ...row.values }
        }
    }
    const structuralSpacing = (workspace.spacing || [])
        .filter(row => ['layoutSlot', 'widget', 'widgetSlot', 'widgetPart'].includes(row.scope))
        .map(({ scope, layout, slot, part, widgetType, breakpoint, values }) => ({
            scope, layout, slot, part, widgetType, breakpoint, values,
        }))
    theme.designGroups = { ...designGroups, groups, structuralSpacing }
    theme.breakpoints = workspace.breakpoints || theme.breakpoints
    return theme
}
