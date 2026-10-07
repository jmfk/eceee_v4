import { PUBLIC_RENDER_CSS } from '../rendering/publicRenderCss'
import { googleFontsStylesheetUrl } from '../rendering/primitives'
import { generateColorsCSS, generateDesignGroupsCSS, getBreakpoints } from './themeUtils'

const EDITOR_WIDGET_BASE_CSS = `
.content-widget{box-sizing:border-box;width:100%;min-height:32px;font-family:inherit;line-height:1.6;color:inherit;margin-bottom:30px}
.content-widget.border-enabled{padding-top:50px;padding-bottom:50px;outline:1px solid rgb(0 0 0/.3)}
.content-widget .media-insert,.content-widget .media-insert img{max-width:100%}.content-widget .media-insert img{height:auto}
.banner-widget{box-sizing:border-box;display:flex;flex-direction:column;width:100%;height:140px;outline:1px solid rgb(0 0 0/.3);border-width:0;overflow:hidden;border-radius:0;box-shadow:none;margin-bottom:30px;position:relative}
.banner-widget.border-disabled{outline:none;border:none}.banner-widget:last-child{margin-bottom:0}
.banner-background{position:absolute;inset:0;width:100%;height:100%;background-size:cover;background-position:center;background-repeat:no-repeat;z-index:0}
.banner-body{display:flex;flex:1;min-height:0;height:140px;position:relative;z-index:1}.banner-body.mode-text{justify-content:flex-start;align-items:flex-start}
.banner-body.mode-text .banner-text{flex:1;padding:26px 30px 30px;font-size:16px;font-family:'Source Sans 3',sans-serif;font-weight:300;line-height:22px;overflow:hidden}
.banner-body.mode-text .banner-text h3{font-size:18px;font-family:'Source Sans 3',sans-serif;font-weight:700;line-height:22px;overflow:hidden;margin:0 0 3px}
.banner-body.mode-text .banner-text p{font-size:14px;font-family:'Source Sans 3',sans-serif;font-weight:300;line-height:17px;overflow:hidden;margin:0}
.banner-body.mode-text .banner-images{display:flex;justify-content:flex-end;padding:0}.banner-body.mode-header{justify-content:center;align-items:center}
.banner-body.mode-header .banner-text{width:100%;padding:30px;text-align:center;font-size:36px;font-family:'Source Sans 3',sans-serif;font-weight:500;line-height:32px;overflow:hidden;margin:0}
.banner-image{width:140px;height:140px;object-fit:cover;border:5px solid #fff}.banner-body.image-size-rectangle .banner-image{width:280px;height:140px;border:5px solid #fff}
.section-widget,.section-content-only-widget{margin-bottom:30px}.section-widget.border-enabled,.section-content-only-widget.border-enabled{outline:1px solid rgb(0 0 0/.3)}
.section-widget:last-child,.section-content-only-widget:last-child{margin-bottom:0}.section-header{padding:30px;user-select:none}
.section-remaining-content{display:block;margin-bottom:30px}.section-collapsed .section-remaining-content{display:none}
.section-banner{display:flex;align-items:center;justify-content:center;height:30px;outline:1px solid rgb(0 0 0/.3);border-width:0;overflow:hidden;border-radius:0;box-shadow:none;padding:0;cursor:pointer;user-select:none;transition:opacity .2s ease;font-size:16px;font-weight:300}
.section-banner:hover{opacity:.8}.contract-banner{display:flex}.section-collapsed .contract-banner{display:none}.expand-banner{display:none}.section-collapsed .expand-banner{display:flex}
.nav-container{display:flex;flex-direction:column;list-style:none;margin:0 0 30px;padding:0;gap:10px;height:var(--nav-height,auto);width:100%}
.nav-container li{height:24px;width:100%}.nav-container a{color:inherit;text-decoration:none;transition:opacity .2s}.nav-container a:hover{opacity:.7}
@media(max-width:768px){.banner-body.mode-text{flex-direction:column}}
`

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
        EDITOR_WIDGET_BASE_CSS,
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
