import { PUBLIC_RENDER_CSS } from '../rendering/publicRenderCss'
import { googleFontsStylesheetUrl } from '../rendering/primitives'
import { generateColorsCSS, generateDesignGroupsCSS, getBreakpoints } from './themeUtils'

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
        return `${rewriteDocumentRoots(rule.selectorText)} { ${serializeDeclarations(rule.style, keyframeNames)} }`
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

const responsiveCSS = (css, theme) => {
    if (typeof css === 'string') return css
    if (!css || typeof css !== 'object') return ''
    const breakpoints = getBreakpoints(theme)
    const parts = []
    const base = css.xs || css.default
    if (base) parts.push(base)
    for (const breakpoint of ['sm', 'md', 'lg', 'xl']) {
        if (css[breakpoint] && breakpoints[breakpoint]) {
            parts.push(`@media (min-width: ${breakpoints[breakpoint]}px) {\n${css[breakpoint]}\n}`)
        }
    }
    return parts.join('\n')
}

const styleCollectionCSS = (styles, theme) => Object.values(styles || {})
    .map(style => responsiveCSS(style?.css, theme))
    .filter(Boolean)
    .join('\n')

const legacyElementsCSS = elements => Object.entries(elements || {}).map(([selector, properties]) => {
    const declarations = Object.entries(properties || {}).map(([property, value]) => {
        const cssProperty = property.replace(/_/g, '-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
        return `  ${cssProperty}: ${value};`
    })
    return declarations.length ? `${selector} {\n${declarations.join('\n')}\n}` : ''
}).filter(Boolean).join('\n')

const variablesCSS = variables => {
    const declarations = Object.entries(variables || {}).map(([name, value]) => {
        const variable = name.startsWith('--') ? name : `--${name}`
        return `  ${variable}: ${value};`
    })
    return declarations.length ? `:root {\n${declarations.join('\n')}\n}` : ''
}

export const buildEditorThemeCSS = ({
    theme,
    pageCssVariables,
    pageCustomCss,
    enableCssInjection = true,
    scopeId,
}) => {
    if (!scopeId) return ''

    const colors = theme?.colors || theme?.cssVariables || {}
    const designGroups = theme?.designGroups || theme?.typography
    const fontUrl = googleFontsStylesheetUrl(theme?.fonts)
    const rawCSS = [
        PUBLIC_RENDER_CSS,
        generateColorsCSS(colors),
        designGroups?.groups?.length
            ? generateDesignGroupsCSS(designGroups, colors, '', null, null, false, getBreakpoints(theme))
            : legacyElementsCSS(theme?.htmlElements),
        styleCollectionCSS(theme?.componentStyles, theme),
        styleCollectionCSS(theme?.galleryStyles, theme),
        styleCollectionCSS(theme?.carouselStyles, theme),
        theme?.customCss || '',
        enableCssInjection ? variablesCSS(pageCssVariables) : '',
        enableCssInjection ? pageCustomCss || '' : '',
    ].filter(Boolean).join('\n\n')

    const rootSelector = `.eceee-theme-scope[data-eceee-theme-scope="${scopeId}"]`
    const compiled = compileEditorCSS(rawCSS, {
        rootSelector,
        namespace: `eceee-${scopeId.replace(/[^a-zA-Z0-9_-]/g, '-')}-`,
    })
    return fontUrl ? `@import url("${fontUrl}");\n\n${compiled}` : compiled
}
