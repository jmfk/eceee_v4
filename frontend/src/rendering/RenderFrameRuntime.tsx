import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import RenderDocument from './RenderDocument'
import type { RenderFrameMessage, RenderPageModel } from './types'
import { normalizeCssName } from './primitives'

const DESIGNER_STYLE_PROPERTIES: Record<string, string> = {
    fontFamily: 'font-family', fontSize: 'font-size', fontWeight: 'font-weight', fontStyle: 'font-style',
    lineHeight: 'line-height', letterSpacing: 'letter-spacing',
    margin: 'margin', marginTop: 'margin-top', marginRight: 'margin-right', marginBottom: 'margin-bottom', marginLeft: 'margin-left',
    padding: 'padding', paddingTop: 'padding-top', paddingRight: 'padding-right', paddingBottom: 'padding-bottom', paddingLeft: 'padding-left',
    gap: 'gap', width: 'width', height: 'height',
}

const EDITABLE_TEXT_SELECTOR = 'a,blockquote,caption,code,em,figcaption,h1,h2,h3,h4,h5,h6,li,p,pre,span,strong'
const ADDED_SEMANTIC_TEXT_SELECTOR = [
    '.content-card-widget > .content-card-header',
    '.widget-type-easy-widgets-formswidget .form-description',
    '.news-list-widget .news-excerpt',
    '.top-news-plug-widget .news-excerpt',
    'caption',
    'figcaption',
].join(',')
const RICH_TEXT_SELECTOR = '.content-widget,.banner-text,.object-data-preview-field dd'
const editableTextLabel = (node: HTMLElement) => {
    if (/^H[1-6]$/.test(node.tagName)) return `Heading ${node.tagName.slice(1)} text`
    return ({ A: 'Link text', BLOCKQUOTE: 'Quote text', CAPTION: 'Table caption', CODE: 'Code text', FIGCAPTION: 'Image caption', LI: 'List item text', P: 'Paragraph text', PRE: 'Preformatted text' } as Record<string, string>)[node.tagName] || 'Text'
}

const DESIGNER_CSS = `.designer-preview [data-designer-target]{cursor:pointer}.designer-selection-outline{position:fixed!important;z-index:2147483646!important;box-sizing:border-box!important;border:1px solid!important;background:transparent!important;pointer-events:none!important}.designer-selection-outline-slot{border-color:#eab308!important}.designer-selection-outline-widget{border-color:#16a34a!important}.designer-selection-outline-element{border-color:#2563eb!important}[data-designer-target].designer-highlighted{outline:3px dashed #d97706!important;outline-offset:2px!important;box-shadow:0 0 0 3px rgba(245,158,11,.2)!important}.designer-guides .designer-hovered:not(.designer-selected):not(.designer-highlighted){outline:2px dotted #2563eb!important;outline-offset:-2px!important}
.designer-context-menu{position:fixed!important;z-index:2147483647!important;min-width:180px!important;max-width:260px!important;padding:6px!important;border:1px solid #d1d5db!important;border-radius:8px!important;background:#fff!important;box-shadow:0 10px 24px rgba(15,23,42,.2)!important;color:#111827!important;font:500 13px/1.35 system-ui,sans-serif!important}.designer-context-menu-title{overflow:hidden!important;padding:5px 8px 7px!important;color:#6b7280!important;font-size:11px!important;font-weight:600!important;text-overflow:ellipsis!important;white-space:nowrap!important}.designer-context-menu button{display:block!important;width:100%!important;padding:7px 8px!important;border:0!important;border-radius:5px!important;background:transparent!important;color:#111827!important;font:inherit!important;text-align:left!important;cursor:pointer!important}.designer-context-menu button:hover,.designer-context-menu button:focus-visible{background:#eff6ff!important;color:#1d4ed8!important;outline:none!important}
.designer-spacing-guide{position:fixed!important;pointer-events:none!important;z-index:2147483644!important}.designer-spacing-margin{background:rgba(245,158,11,.22)!important}.designer-spacing-padding{background:rgba(6,182,212,.2)!important}.designer-spacing-size{background:transparent!important}.designer-spacing-content{border:1px dashed rgba(8,145,178,.8)!important}.designer-spacing-measure{position:fixed!important;z-index:2147483645!important;background:#111827!important;box-shadow:none!important;pointer-events:none!important}.designer-spacing-measure::before,.designer-spacing-measure::after{content:""!important;position:absolute!important;background:#111827!important;box-shadow:none!important}.designer-spacing-measure-horizontal{height:1px!important}.designer-spacing-measure-horizontal::before,.designer-spacing-measure-horizontal::after{top:50%!important;width:1px!important;height:7px!important;transform:translateY(-50%)}.designer-spacing-measure-horizontal::before{left:0!important}.designer-spacing-measure-horizontal::after{right:0!important}.designer-spacing-measure-vertical{width:1px!important}.designer-spacing-measure-vertical::before,.designer-spacing-measure-vertical::after{left:50%!important;width:7px!important;height:1px!important;transform:translateX(-50%)}.designer-spacing-measure-vertical::before{top:0!important}.designer-spacing-measure-vertical::after{bottom:0!important}.designer-spacing-value{position:fixed!important;z-index:2147483645!important;transform:translate(-50%,-50%);padding:2px 3px!important;border:0!important;border-radius:3px!important;background:#fff!important;font:700 10px/1 system-ui,sans-serif;white-space:nowrap;pointer-events:none!important;box-shadow:0 0 0 1px rgba(255,255,255,.9)!important}.designer-spacing-value[data-editable="true"]{pointer-events:auto!important;cursor:pointer!important;box-shadow:0 0 0 1px currentColor!important}.designer-spacing-value[data-editable="true"]:hover,.designer-spacing-value[data-editable="true"]:focus-visible,.designer-spacing-value[data-selected="true"]{outline:2px solid #2563eb!important;outline-offset:2px!important}.designer-spacing-value[data-selected="true"]{background:#dbeafe!important;color:#1e3a8a!important}.designer-spacing-margin-value{color:#92400e}.designer-spacing-padding-value{color:#0e7490}.designer-spacing-size-value{color:#4338ca}
.designer-spacing-guide.designer-spacing-level-slot.designer-spacing-margin{background:rgba(234,179,8,.2)!important}.designer-spacing-guide.designer-spacing-level-slot.designer-spacing-padding{background:rgba(234,179,8,.32)!important}.designer-spacing-guide.designer-spacing-level-widget.designer-spacing-margin{background:rgba(22,163,74,.18)!important}.designer-spacing-guide.designer-spacing-level-widget.designer-spacing-padding,.designer-spacing-guide.designer-spacing-level-widget.designer-spacing-gap{background:rgba(22,163,74,.3)!important}.designer-spacing-guide.designer-spacing-level-element.designer-spacing-margin{background:rgba(37,99,235,.18)!important}.designer-spacing-guide.designer-spacing-level-element.designer-spacing-padding{background:rgba(37,99,235,.3)!important}.designer-spacing-content.designer-spacing-level-slot,.designer-spacing-content.designer-spacing-level-widget,.designer-spacing-content.designer-spacing-level-element{box-sizing:border-box!important;border-width:1px!important}.designer-spacing-content.designer-spacing-level-slot{border-color:#ca8a04!important;border-style:solid!important}.designer-spacing-content.designer-spacing-level-widget{border-color:#16a34a!important;border-style:dashed!important}.designer-spacing-content.designer-spacing-level-element{border-color:#2563eb!important;border-style:dotted!important}.designer-column-slot-guide{box-sizing:border-box!important;border:1px solid #eab308!important;background:rgba(234,179,8,.06)!important}.designer-spacing-value.designer-spacing-level-slot{background:#fefce8!important;color:#854d0e!important}.designer-spacing-value.designer-spacing-level-widget{background:#f0fdf4!important;color:#166534!important}.designer-spacing-value.designer-spacing-level-element{background:#eff6ff!important;color:#1d4ed8!important}.designer-spacing-measure.designer-spacing-level-slot,.designer-spacing-measure.designer-spacing-level-slot::before,.designer-spacing-measure.designer-spacing-level-slot::after{background:#eab308!important}.designer-spacing-measure.designer-spacing-level-widget,.designer-spacing-measure.designer-spacing-level-widget::before,.designer-spacing-measure.designer-spacing-level-widget::after{background:#16a34a!important}.designer-spacing-measure.designer-spacing-level-element,.designer-spacing-measure.designer-spacing-level-element::before,.designer-spacing-measure.designer-spacing-level-element::after{background:#2563eb!important}.designer-spacing-guide[data-editable="false"]{background:rgba(107,114,128,.14)!important}.designer-spacing-size[data-editable="false"]{background:#4b5563!important}.designer-spacing-measure[data-editable="false"],.designer-spacing-measure[data-editable="false"]::before,.designer-spacing-measure[data-editable="false"]::after{background:#4b5563!important;box-shadow:none!important}.designer-spacing-value[data-editable="false"]{background:#fff!important;color:#374151!important;box-shadow:0 0 0 1px #9ca3af!important}
.layout-designer-preview [data-layout-node-id]{position:relative!important;box-shadow:inset 0 0 0 1px rgba(30,64,175,.42)!important}.layout-designer-preview [data-layout-node-id]::before{content:attr(data-layout-node-type) " · " attr(data-layout-node-size)!important;display:none;position:absolute!important;z-index:20!important;top:3px!important;right:3px!important;max-width:calc(100% - 6px)!important;overflow:hidden!important;padding:2px 5px!important;border:1px solid rgba(255,255,255,.8)!important;border-radius:4px!important;background:rgba(15,23,42,.82)!important;color:#fff!important;font:600 10px/1.2 system-ui,sans-serif!important;text-overflow:ellipsis!important;text-transform:capitalize!important;white-space:nowrap!important;pointer-events:none!important}.layout-designer-preview [data-layout-node-type="slot"]::before,.layout-designer-preview [data-layout-node-id].designer-selected::before,.layout-designer-preview [data-layout-node-id].designer-highlighted::before,.layout-designer-preview [data-layout-node-id].designer-hovered::before{display:block}.layout-designer-preview [data-layout-node-type="container"]{background-color:rgba(59,130,246,.10)!important}.layout-designer-preview [data-layout-node-type="section"]{background-color:rgba(6,182,212,.12)!important}.layout-designer-preview [data-layout-node-type="grid"]{background-color:rgba(168,85,247,.12)!important}.layout-designer-preview [data-layout-node-type="row"]{background-color:rgba(99,102,241,.12)!important}.layout-designer-preview [data-layout-node-type="column"]{background-color:rgba(34,197,94,.12)!important}.layout-designer-preview [data-layout-node-type="semantic"]{background-color:rgba(245,158,11,.14)!important}.layout-designer-preview [data-layout-node-type="slot"]{min-height:40px;background-color:rgba(244,63,94,.13)!important;color:#881337!important;text-align:center!important}.layout-designer-preview [data-layout-node-type="slot"]::after{content:attr(data-layout-node-label)!important;position:absolute!important;z-index:10!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:5px 9px!important;color:#881337!important;font:600 13px/1.25 system-ui,sans-serif!important;text-align:center!important;pointer-events:none!important}.layout-designer-preview [data-layout-presentation-color]{background-color:color-mix(in srgb,var(--layout-presentation-color) 16%,transparent)!important;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--layout-presentation-color) 62%,transparent)!important}
`

const computedThemeValues = (node: HTMLElement) => {
    const style = getComputedStyle(node)
    return Object.fromEntries(Object.entries(DESIGNER_STYLE_PROPERTIES).map(([name, cssName]) => [name, style.getPropertyValue(cssName)]))
}

const isRichTextNode = (node: HTMLElement) => node.matches(RICH_TEXT_SELECTOR)

const editableValue = (node: HTMLElement, richText = isRichTextNode(node)) => richText ? node.innerHTML : node.innerText || node.textContent || ''

const nodeTargets = (node: HTMLElement) => {
    try { return JSON.parse(node.dataset.designerTargets || '[]') } catch { return [] }
}

const designerInstanceId = (node: HTMLElement) => {
    if (node.dataset.designerInstance) return node.dataset.designerInstance
    const path: number[] = []
    let current: HTMLElement | null = node
    while (current?.parentElement) {
        path.unshift([...current.parentElement.children].indexOf(current))
        current = current.parentElement
    }
    const instanceId = `node:${path.join('.')}`
    node.dataset.designerInstance = instanceId
    return instanceId
}

const findTargetNode = (root: ParentNode, targetId: string, widgetId = '', instanceId = '') => [...root.querySelectorAll<HTMLElement>('[data-designer-target]')].find((node) => (
    (!widgetId || node.closest<HTMLElement>('[data-widget-id]')?.dataset.widgetId === widgetId)
    && (!instanceId || designerInstanceId(node) === instanceId)
    && nodeTargets(node).some((target: any) => target.id === targetId || target.styleTargetId === targetId)
))

const compactText = (node: HTMLElement) => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim()

const widgetTypeLabel = (node: HTMLElement) => {
    const type = node.closest<HTMLElement>('[data-widget-type]')?.dataset.widgetType?.split('.').pop() || ''
    return type.replace(/Widget$/i, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim()
}

const widgetTypeKey = (type: string) => normalizeCssName(type.split('.').pop()?.replace(/Widget$/i, '') || type)

const descendantDisplayLabel = (node: HTMLElement, target: any) => {
    const label = String(target.label || 'Element').replace(/\s+text$/i, '')
    const text = compactText(node)
    const excerpt = text.length > 42 ? `${text.slice(0, 39).trimEnd()}…` : text
    if (excerpt && excerpt.toLocaleLowerCase() !== label.toLocaleLowerCase()) return `${label}: “${excerpt}”`
    const widgetLabel = widgetTypeLabel(node)
    if (widgetLabel && !label.toLocaleLowerCase().includes(widgetLabel.toLocaleLowerCase())) return `${widgetLabel} · ${label}`
    return label
}

const descendantTargets = (node: HTMLElement) => {
    const seen = new Set<string>()
    return [...node.querySelectorAll<HTMLElement>('[data-designer-target]')].map((descendant) => {
        const targets = applicableNodeTargets(descendant)
        const primary = targets[0]
        const widgetNode = descendant.closest<HTMLElement>('[data-widget-id]')
        const widgetType = widgetNode?.dataset.widgetType || ''
        const widgetId = widgetNode?.dataset.widgetId || ''
        const instanceKey = `${widgetId}:${primary?.id || ''}:${primary?.instanceId || ''}`
        if (!primary?.id || seen.has(instanceKey)) return null
        seen.add(instanceKey)
        const parentNode = descendant.parentElement?.closest<HTMLElement>('[data-designer-target]') || null
        const parentId = parentNode && (parentNode === node || node.contains(parentNode)) ? primaryNodeTarget(parentNode)?.id || '' : ''
        const parentWidgetId = parentNode?.closest<HTMLElement>('[data-widget-id]')?.dataset.widgetId || ''
        const parentInstanceId = parentNode ? designerInstanceId(parentNode) : ''
        let depth = 1
        let ancestor = parentNode
        while (ancestor && ancestor !== node) {
            depth += 1
            ancestor = ancestor.parentElement?.closest<HTMLElement>('[data-designer-target]') || null
        }
        const richText = Boolean(primary.richText || isRichTextNode(descendant))
        return {
            ...primary,
            displayLabel: descendantDisplayLabel(descendant, primary),
            parentId,
            parentWidgetId,
            parentInstanceId,
            depth,
            widgetType,
            widgetId,
            text: editableValue(descendant, richText),
            richText,
            sourceUrl: primary.sourceUrl || (descendant instanceof HTMLImageElement ? descendant.currentSrc || descendant.src : ''),
            computedStyles: computedThemeValues(descendant),
            alternatives: targets.map((target: any) => ({
                ...target,
                widgetType: target.widgetType || widgetType,
                widgetId: target.widgetId || widgetId,
                text: editableValue(descendant, Boolean(target.richText || richText)),
                richText: Boolean(target.richText || richText),
                computedStyles: computedThemeValues(descendant),
            })),
        }
    }).filter(Boolean).slice(0, 100)
}

const targetPath = (node: HTMLElement, preferredTarget?: any) => {
    const path: any[] = []
    const seen = new Set<string>()
    let current: HTMLElement | null = node
    let first = true
    while (current) {
        const candidate = first && preferredTarget ? preferredTarget : primaryNodeTarget(current)
        const target = selectionKind(candidate) === 'widget' && candidate?.kind !== 'widget' ? null : candidate
        const widgetNode = current.closest<HTMLElement>('[data-widget-id]')
        const widgetId = target?.widgetId || widgetNode?.dataset.widgetId || ''
        const key = `${widgetId}:${target?.id || ''}:${target?.instanceId || ''}`
        if (target?.id && !seen.has(key)) {
            seen.add(key)
            path.unshift({
                ...target,
                widgetType: target.widgetType || widgetNode?.dataset.widgetType || '',
                widgetId,
            })
        }
        first = false
        current = current.parentElement?.closest<HTMLElement>('[data-designer-target]') || null
    }
    return path
}

const selectionKind = (target: any): 'slot' | 'widget' | 'element' => target?.kind === 'layoutSlot' || target?.kind === 'slot'
    ? 'slot'
    : ['widget', 'part', 'group'].includes(target?.kind)
        ? 'widget'
        : 'element'

const groupPartSelectors = (group: any, part: any) => {
    const normalize = (value: string) => normalizeCssName(value)
    const targeting = group.previewTargeting || {}
    const variants = (targeting.variants || []).map((variant: string) => `.${variant}`).join('')
    const modifier = targeting.cssModifier || ''
    const partSelector = `.${normalize(part.part)}${variants}${modifier}`
    let bases: string[] = []
    if (targeting.targetingMode === 'css-classes') {
        bases = splitTargetSelectorList(String(targeting.targetCssClasses || ''))
    } else {
        const widgetTypes = group.widgetTypes || []
        const slots = group.slots || []
        if (widgetTypes.length && slots.length) {
            bases = widgetTypes.flatMap((widgetType: string) => slots.map((slot: string) => (
                `.slot-${normalize(slot)} > .widget-type-${normalize(widgetType)}`
            )))
        } else if (widgetTypes.length) bases = widgetTypes.map((widgetType: string) => `.widget-type-${normalize(widgetType)}`)
        else if (slots.length) bases = slots.map((slot: string) => `.slot-${normalize(slot)}`)
        else bases = ['']
    }
    return bases.flatMap((base) => base ? [`${base}${partSelector}`, `${base} ${partSelector}`] : [partSelector])
}

const matchesCascadeTarget = (node: HTMLElement, target: any) => {
    const selectors = Array.isArray(target?.cascadeSelectors) ? target.cascadeSelectors : []
    if (!selectors.length) return true
    return selectors.some((selector: string) => {
        try { return node.matches(selector) } catch { return false }
    })
}

const applicableNodeTargets = (node: HTMLElement) => nodeTargets(node)
    .filter((target: any) => matchesCascadeTarget(node, target))

const primaryNodeTarget = (node: HTMLElement) => applicableNodeTargets(node)[0]

type SelectorSpecificity = [number, number, number]

const compareSelectorSpecificity = (left: SelectorSpecificity, right: SelectorSpecificity) => (
    left[0] - right[0] || left[1] - right[1] || left[2] - right[2]
)

const addSelectorSpecificity = (left: SelectorSpecificity, right: SelectorSpecificity): SelectorSpecificity => [
    left[0] + right[0],
    left[1] + right[1],
    left[2] + right[2],
]

const splitSelectorList = (value: string) => {
    const selectors: string[] = []
    let start = 0
    let depth = 0
    let quote = ''
    for (let index = 0; index < value.length; index += 1) {
        const character = value[index]
        if (quote) {
            if (character === '\\') index += 1
            else if (character === quote) quote = ''
        } else if (character === '"' || character === "'") quote = character
        else if (character === '(' || character === '[') depth += 1
        else if (character === ')' || character === ']') depth = Math.max(0, depth - 1)
        else if (character === ',' && depth === 0) {
            selectors.push(value.slice(start, index).trim())
            start = index + 1
        }
    }
    selectors.push(value.slice(start).trim())
    return selectors.filter(Boolean)
}

const splitTargetSelectorList = (value: string) => {
    const selectors: string[] = []
    let start = 0
    let depth = 0
    let quote = ''
    for (let index = 0; index < value.length; index += 1) {
        const character = value[index]
        if (quote) {
            if (character === '\\') index += 1
            else if (character === quote) quote = ''
        } else if (character === '"' || character === "'") quote = character
        else if (character === '(' || character === '[') depth += 1
        else if (character === ')' || character === ']') depth = Math.max(0, depth - 1)
        else if (depth === 0 && (character === ',' || character === '\n' || character === '\r')) {
            selectors.push(value.slice(start, index).trim())
            start = index + 1
        }
    }
    selectors.push(value.slice(start).trim())
    return selectors.filter(Boolean)
}

const selectorSpecificity = (selector: string): SelectorSpecificity => {
    let specificity: SelectorSpecificity = [0, 0, 0]
    const consumeName = (start: number) => {
        let end = start
        while (end < selector.length) {
            if (/[\w-]/.test(selector[end])) end += 1
            else if (selector[end] === '\\' && end + 1 < selector.length) {
                end += 1
                let hexadecimalDigits = 0
                while (end < selector.length && /[\da-f]/i.test(selector[end]) && hexadecimalDigits < 6) {
                    end += 1
                    hexadecimalDigits += 1
                }
                if (!hexadecimalDigits) end += 1
                else if (/\s/.test(selector[end] || '')) end += 1
            } else break
        }
        return end
    }
    const consumeBlock = (start: number, opener: string, closer: string) => {
        let depth = 1
        let quote = ''
        let end = start + 1
        for (; end < selector.length && depth; end += 1) {
            const character = selector[end]
            if (quote) {
                if (character === '\\') end += 1
                else if (character === quote) quote = ''
            } else if (character === '"' || character === "'") quote = character
            else if (character === opener) depth += 1
            else if (character === closer) depth -= 1
        }
        return end
    }
    const maxArgumentSpecificity = (argument: string) => splitSelectorList(argument)
        .map(selectorSpecificity)
        .sort(compareSelectorSpecificity)
        .at(-1) || [0, 0, 0] as SelectorSpecificity
    const nthOfSelector = (argument: string) => {
        let depth = 0
        let quote = ''
        for (let index = 0; index < argument.length - 1; index += 1) {
            const character = argument[index]
            if (quote) {
                if (character === '\\') index += 1
                else if (character === quote) quote = ''
            } else if (character === '"' || character === "'") quote = character
            else if (character === '(' || character === '[') depth += 1
            else if (character === ')' || character === ']') depth = Math.max(0, depth - 1)
            else if (depth === 0 && argument.slice(index).match(/^of(?:\s|$)/i)) return argument.slice(index + 2).trim()
        }
        return ''
    }

    for (let index = 0; index < selector.length;) {
        const character = selector[index]
        if (character === '[') {
            specificity[1] += 1
            index = consumeBlock(index, '[', ']')
        } else if (character === '#') {
            specificity[0] += 1
            index = consumeName(index + 1)
        } else if (character === '.') {
            specificity[1] += 1
            index = consumeName(index + 1)
        } else if (character === ':') {
            const pseudoElement = selector[index + 1] === ':'
            const nameStart = index + (pseudoElement ? 2 : 1)
            const nameEnd = consumeName(nameStart)
            const name = selector.slice(nameStart, nameEnd).toLowerCase()
            const legacyPseudoElement = ['after', 'before', 'first-letter', 'first-line'].includes(name)
            if (pseudoElement || legacyPseudoElement) specificity[2] += 1
            else if (selector[nameEnd] !== '(') specificity[1] += 1
            if (selector[nameEnd] !== '(') index = nameEnd
            else {
                const end = consumeBlock(nameEnd, '(', ')')
                const argument = selector.slice(nameEnd + 1, Math.max(nameEnd + 1, end - 1))
                if (!pseudoElement && ['is', 'not', 'has'].includes(name)) {
                    specificity = addSelectorSpecificity(specificity, maxArgumentSpecificity(argument))
                } else if (!pseudoElement && ['nth-child', 'nth-last-child'].includes(name)) {
                    specificity[1] += 1
                    const ofSelector = nthOfSelector(argument)
                    if (ofSelector) specificity = addSelectorSpecificity(specificity, maxArgumentSpecificity(ofSelector))
                } else if (!pseudoElement && name !== 'where') specificity[1] += 1
                index = end
            }
        } else if (/[a-z_]/i.test(character)) {
            specificity[2] += 1
            index = consumeName(index)
        } else if (character === '\\') index += 2
        else index += 1
    }
    return specificity
}

type DeclaredStyleCandidate = {
    value: string
    important: boolean
    inline: boolean
    specificity: SelectorSpecificity
    sourceOrder: number
}

const declaredThemeValues = (node: HTMLElement) => {
    const candidates = new Map<string, DeclaredStyleCandidate>()
    let sourceOrder = 0
    const candidateWins = (candidate: DeclaredStyleCandidate, current?: DeclaredStyleCandidate) => (
        !current
        || Number(candidate.important) > Number(current.important)
        || candidate.important === current.important && (
            Number(candidate.inline) > Number(current.inline)
            || candidate.inline === current.inline && (
                compareSelectorSpecificity(candidate.specificity, current.specificity) > 0
                || compareSelectorSpecificity(candidate.specificity, current.specificity) === 0
                    && candidate.sourceOrder >= current.sourceOrder
            )
        )
    )
    const collectDeclaration = (declaration: CSSStyleDeclaration, specificity: SelectorSpecificity, inline = false) => {
        sourceOrder += 1
        Object.entries(DESIGNER_STYLE_PROPERTIES).forEach(([name, cssName]) => {
            let value = declaration.getPropertyValue(cssName).trim()
            let priorityName = cssName
            if (!value && /^(?:margin|padding)-/.test(cssName)) {
                const shorthand = cssName.split('-')[0]
                const shorthandValue = declaration.getPropertyValue(shorthand).trim()
                if (shorthandValue) {
                    const expansion = document.createElement('div').style
                    expansion.setProperty(shorthand, shorthandValue)
                    value = expansion.getPropertyValue(cssName).trim()
                    priorityName = shorthand
                }
            }
            if (!value) return
            const candidate = {
                value,
                important: declaration.getPropertyPriority(priorityName) === 'important',
                inline,
                specificity,
                sourceOrder,
            }
            if (candidateWins(candidate, candidates.get(name))) candidates.set(name, candidate)
        })
    }
    const collectRules = (rules: CSSRuleList) => {
        ;[...rules].forEach((rule) => {
            const media = (rule as CSSMediaRule).media?.mediaText
            if (media && !window.matchMedia(media).matches) return
            const condition = (rule as CSSSupportsRule).conditionText
            if (condition && rule.constructor?.name === 'CSSSupportsRule' && !CSS.supports(condition)) return
            const styleRule = rule as CSSStyleRule
            if (styleRule.selectorText && styleRule.style) {
                const specificity = splitSelectorList(styleRule.selectorText)
                    .filter((selector) => {
                        try { return node.matches(selector) } catch { return false }
                    })
                    .map(selectorSpecificity)
                    .sort(compareSelectorSpecificity)
                    .at(-1)
                if (specificity) collectDeclaration(styleRule.style, specificity)
            }
            const nested = (rule as CSSGroupingRule).cssRules
            if (nested?.length) collectRules(nested)
        })
    }
    ;[...document.styleSheets].forEach((sheet) => {
        try { collectRules(sheet.cssRules) } catch { /* Cross-origin stylesheets are not inspectable. */ }
    })
    collectDeclaration(node.style, [0, 0, 0], true)
    return Object.fromEntries([...candidates].map(([name, candidate]) => [name, candidate.value]))
}

const inspectedThemeValues = (node: HTMLElement) => ({
    computedStyles: computedThemeValues(node),
    declaredStyles: declaredThemeValues(node),
})

const fallbackCascadeWinner = (node: HTMLElement, targets: any[]) => [...targets]
    .map((target) => {
        const specificity = (target.cascadeSelectors || [])
            .filter((selector: string) => {
                try { return node.matches(selector) } catch { return false }
            })
            .map(selectorSpecificity)
            .sort(compareSelectorSpecificity)
            .at(-1) || [0, 0, 0]
        return { target, specificity: specificity as SelectorSpecificity }
    })
    .sort((left, right) => (
        compareSelectorSpecificity(left.specificity, right.specificity)
        || Number(left.target.cascadeSourceOrder ?? -1) - Number(right.target.cascadeSourceOrder ?? -1)
    ))
    .at(-1)?.target || null

const selectorCascadeWinner = (node: HTMLElement, targets: any[]) => {
    const applicable = targets.filter((target) => matchesCascadeTarget(node, target))
    if (applicable.length < 2) return applicable[0] || null
    return fallbackCascadeWinner(node, applicable)
}

const editableCascadeWinner = (node: HTMLElement, targets: any[], property: string) => {
    const applicable = targets.filter((target) => matchesCascadeTarget(node, target))
    const declaring = applicable.filter((target) => (target.activeSpacingProperties || []).includes(property))
    const candidates = declaring.length ? declaring : applicable
    const cascadeCandidates = candidates.filter((target) => (target.cascadeSelectors || []).length)
    if (cascadeCandidates.length) return selectorCascadeWinner(node, cascadeCandidates)
    return [...candidates].sort(compareCascadePriorityForProperty(property)).at(-1) || null
}

const compareCascadePriority = (left: any, right: any) => {
    const leftPriority = Array.isArray(left?.cascadePriority) ? left.cascadePriority : [0, 0, 0, -1]
    const rightPriority = Array.isArray(right?.cascadePriority) ? right.cascadePriority : [0, 0, 0, -1]
    for (let index = 0; index < Math.max(leftPriority.length, rightPriority.length); index += 1) {
        const difference = Number(leftPriority[index] || 0) - Number(rightPriority[index] || 0)
        if (difference) return difference
    }
    return 0
}

const compareCascadePriorityForProperty = (property: string) => (left: any, right: any) => (
    Number((left.activeSpacingProperties || []).includes(property))
    - Number((right.activeSpacingProperties || []).includes(property))
    || compareCascadePriority(left, right)
)

const widgetSpacingConfigurationTargets = (
    node: HTMLElement,
    designer: RenderPageModel['designer'],
    target?: any,
) => {
    if (!designer || target?.kind !== 'widget') return []
    const widgetRoot = node.closest<HTMLElement>('[data-widget-id][data-widget-type]')
    if (!widgetRoot) return []
    const seen = new Set<string>()
    const candidates = [...widgetRoot.querySelectorAll<HTMLElement>('[data-designer-target]')].flatMap((configurationNode) => {
        if (configurationNode.closest<HTMLElement>('[data-widget-id]') !== widgetRoot) return []
        return nodeTargets(configurationNode).flatMap((candidate: any) => {
            const targetId = candidate.styleTargetId || candidate.id
            const editableFields = designer.editableSpacingTargets?.[targetId] || []
            if (!targetId || !editableFields.length || !candidate.isWidgetSurface || seen.has(targetId)
                || !matchesCascadeTarget(configurationNode, candidate)) return []
            seen.add(targetId)
            return [{
                ...candidate,
                _cascadeNode: configurationNode,
                widgetId: candidate.widgetId || widgetRoot.dataset.widgetId || '',
                widgetType: candidate.widgetType || widgetRoot.dataset.widgetType || '',
                ...inspectedThemeValues(configurationNode),
            }]
        })
    })
    const properties = [...new Set(candidates.flatMap((candidate: any) => (
        designer.editableSpacingTargets?.[candidate.styleTargetId || candidate.id] || []
    )))]
    const winningProperties = new Map<string, string[]>()
    properties.forEach((property) => {
        const eligible = candidates.filter((candidate: any) => (
            designer.editableSpacingTargets?.[candidate.styleTargetId || candidate.id]?.includes(property)
        ))
        const node = eligible[0]?._cascadeNode
        const winner = node ? editableCascadeWinner(node, eligible, property) : null
        const winnerId = winner?.styleTargetId || winner?.id
        if (winnerId) winningProperties.set(winnerId, [...(winningProperties.get(winnerId) || []), property])
    })
    return candidates.map(({ _cascadeNode, ...candidate }: any) => ({
        ...candidate,
        cascadeWinningProperties: winningProperties.get(candidate.styleTargetId || candidate.id) || [],
    }))
}

const selectionPaths = (node: HTMLElement, preferredTarget?: any, designer?: RenderPageModel['designer']) => {
    const paths: Record<'slot' | 'widget' | 'element', any[]> = { slot: [], widget: [], element: [] }
    const selectionRank = { slot: 0, widget: 1, element: 2 }
    const preferredKind = selectionKind(preferredTarget)
    const seen = new Set<string>()
    let current: HTMLElement | null = node
    let first = true
    while (current) {
        const targets = applicableNodeTargets(current)
        const primaryTarget = primaryNodeTarget(current)
        const candidates = first && preferredTarget
            ? [preferredTarget, ...targets.filter((target: any) => target.id !== preferredTarget.id)]
            : primaryTarget ? [primaryTarget, ...targets.filter((target: any) => target !== primaryTarget)] : targets
        ;(['slot', 'widget', 'element'] as const).forEach((kind) => {
            if (preferredTarget && preferredKind !== 'element' && kind === 'element') return
            if (first && preferredTarget && selectionRank[kind] > selectionRank[preferredKind]) return
            const target = candidates.find((candidate: any) => (
                selectionKind(candidate) === kind
                && (kind !== 'widget' || candidate.kind === 'widget')
            ))
            const widgetNode = current?.closest<HTMLElement>('[data-widget-id]')
            const widgetId = target?.widgetId || widgetNode?.dataset.widgetId || ''
            const key = `${kind}:${widgetId}:${target?.id || ''}:${target?.instanceId || ''}`
            if (!target?.id || seen.has(key)) return
            seen.add(key)
            paths[kind].unshift({
                ...target,
                widgetType: target.widgetType || widgetNode?.dataset.widgetType || '',
                widgetId,
                ...inspectedThemeValues(current),
                ...(target.kind === 'widget' ? {
                    configurationSpacingTargets: widgetSpacingConfigurationTargets(current, designer, target),
                } : {}),
            })
        })
        first = false
        current = current.parentElement?.closest<HTMLElement>('[data-designer-target]') || null
    }
    return paths
}

const clearSelectionClasses = (root: ParentNode) => root.querySelectorAll('.designer-selected,.designer-selected-slot,.designer-selected-widget,.designer-selected-element')
    .forEach((selected) => selected.classList.remove('designer-selected', 'designer-selected-slot', 'designer-selected-widget', 'designer-selected-element'))

const applySelectionClasses = (root: ParentNode, node: HTMLElement, preferredTarget?: any) => {
    clearSelectionClasses(root)
    node.classList.add('designer-selected')
    const paths = selectionPaths(node, preferredTarget)
    ;(['slot', 'widget', 'element'] as const).forEach((kind) => {
        const target = paths[kind].at(-1)
        if (!target) return
        findTargetNode(root, target.id, target.widgetId, target.instanceId)?.classList.add(`designer-selected-${kind}`)
    })
    return paths
}

const applyIndependentSelectionClasses = (root: ParentNode, selections: NonNullable<RenderFrameMessage['selectedTargets']>) => {
    clearSelectionClasses(root)
    selections.forEach((selection) => {
        const node = findTargetNode(root, selection.targetId, selection.widgetId, selection.targetInstanceId)
        if (!node) return
        node.classList.add('designer-selected', `designer-selected-${selection.selectionLevel}`)
    })
}

const ancestorTargets = (node: HTMLElement, designer: NonNullable<RenderPageModel['designer']>) => {
    const seen = new Set<string>()
    const ancestors: any[] = []
    let foundTypography = false
    let foundSpacing = false
    let ancestor = node.parentElement?.closest<HTMLElement>('[data-designer-target]') || null
    while (ancestor) {
        applicableNodeTargets(ancestor).forEach((target: any) => {
            const typographyTarget = Boolean(designer.editableTypographyTargets?.[target.id])
            const spacingTarget = Boolean(designer.editableSpacingTargets?.[target.styleTargetId || target.id])
            if (!target.id || seen.has(target.id) || (!typographyTarget || foundTypography) && (!spacingTarget || foundSpacing)) return
            seen.add(target.id)
            ancestors.push({ ...target, ...inspectedThemeValues(ancestor) })
            if (typographyTarget) foundTypography = true
            if (spacingTarget) foundSpacing = true
        })
        if (foundTypography && foundSpacing) break
        ancestor = ancestor.parentElement?.closest<HTMLElement>('[data-designer-target]') || null
    }
    return ancestors.slice(0, 100)
}

const postDesignerEvent = (node: HTMLElement, designer?: RenderPageModel['designer'], action = 'select', preferredTarget?: any, extra: Record<string, unknown> = {}) => {
    const targets = JSON.parse(node.dataset.designerTargets || '[]')
    const primary = preferredTarget || targets[0]
    if (!primary) return
    const richText = Boolean(primary.richText || isRichTextNode(node))
    const widgetNode = node.closest<HTMLElement>('[data-widget-id]')
    const styleInspection = inspectedThemeValues(node)
    window.parent.postMessage({
        source: 'eceee-designer-preview', action, targetId: primary.id, styleTargetId: primary.styleTargetId || '', kind: primary.kind,
        label: primary.label, text: editableValue(node, richText), editable: primary.editable, richText,
        layoutNodeId: primary.layoutNodeId || '',
        editableParameters: primary.editableParameters || [],
        widgetType: primary.widgetType || widgetNode?.dataset.widgetType || '',
        widgetId: primary.widgetId || widgetNode?.dataset.widgetId || '',
        sourceUrl: primary.sourceUrl || '',
        sourceOccurrence: primary.sourceOccurrence ?? 0,
        sourcePath: primary.sourcePath || [],
        sourceMatchIndex: primary.sourceMatchIndex ?? 0,
        targetInstanceId: primary.instanceId || designerInstanceId(node),
        ...styleInspection,
        ...(primary.kind === 'widget' ? {
            configurationSpacingTargets: widgetSpacingConfigurationTargets(node, designer, primary),
        } : {}),
        alternatives: targets.map((target: any) => ({
            ...target,
            widgetType: target.widgetType || widgetNode?.dataset.widgetType || '',
            widgetId: target.widgetId || widgetNode?.dataset.widgetId || '',
            text: editableValue(node, Boolean(target.richText || richText)),
            richText: Boolean(target.richText || richText),
            ...styleInspection,
        })),
        path: targetPath(node, primary),
        selectionPaths: selectionPaths(node, primary, designer),
        ancestors: designer ? ancestorTargets(node, designer) : [],
        descendants: descendantTargets(node),
        ...extra,
    }, '*')
}

const registerTarget = (node: HTMLElement, target: any, primary = false) => {
    let targets: any[] = []
    try { targets = JSON.parse(node.dataset.designerTargets || '[]') } catch { targets = [] }
    const instanceTarget = { ...target, instanceId: target.instanceId || designerInstanceId(node) }
    if (!targets.some((candidate) => candidate.id === target.id)) {
        if (primary) targets.unshift(instanceTarget)
        else targets.push(instanceTarget)
    }
    node.dataset.designerTargets = JSON.stringify(targets)
    node.dataset.designerTarget = targets[0].id
    node.dataset.designerKind = targets[0].kind
    node.dataset.designerLabel = targets[0].label
}

type DesignerFocusState = {
    selectedTargetId: string
    selectedWidgetId: string
    selectedInstanceId: string
    selectedTargets: NonNullable<RenderFrameMessage['selectedTargets']>
    selectedMeasurementKeys: string[]
    highlightedTargetId: string
    highlightedWidgetId: string
    highlightedInstanceId: string
}

const applyDesignerOverlay = (model: RenderPageModel, root: HTMLElement, focusState: DesignerFocusState) => {
    const designer = model.designer
    if (!designer) return () => undefined
    const cleanups: Array<() => void> = []
    let guides: HTMLElement[] = []
    let selectionOutlines: HTMLElement[] = []
    let hoveredNode: HTMLElement | null = null
    let selectedNode: HTMLElement | null = null
    let selectedNodes: Record<'slot' | 'widget' | 'element', HTMLElement | null> = { slot: null, widget: null, element: null }
    let previewedSelectionLevel: 'slot' | 'widget' | 'element' | null = null
    let contextMenu: HTMLElement | null = null
    let dynamicSelectionRefreshFrame = 0
    const measurementTargets = new Map<string, {
        node: HTMLElement
        property: string
        targetId: string
        targetIds: string[]
        editableTargetIds: string[]
        editableTargets: any[]
        axis: 'horizontal' | 'vertical'
    }>()
    if (designer.layoutCanvas) {
        const layoutNodes = [...root.querySelectorAll<HTMLElement>('[data-layout-node-id]')]
        const updateNodeSize = (node: HTMLElement) => {
            const rect = node.getBoundingClientRect()
            node.dataset.layoutNodeSize = `${Math.round(rect.width)} × ${Math.round(rect.height)}`
        }
        const updateAllNodeSizes = () => layoutNodes.forEach(updateNodeSize)
        updateAllNodeSizes()
        const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver((entries) => {
            entries.forEach((entry) => updateNodeSize(entry.target as HTMLElement))
        })
        layoutNodes.forEach((node) => resizeObserver?.observe(node))
        window.addEventListener('resize', updateAllNodeSizes)
        cleanups.push(() => {
            resizeObserver?.disconnect()
            window.removeEventListener('resize', updateAllNodeSizes)
            layoutNodes.forEach((node) => delete node.dataset.layoutNodeSize)
        })
    }
    const closeContextMenu = () => { contextMenu?.remove(); contextMenu = null }
    const removeSelectionOutlines = () => {
        selectionOutlines.forEach((outline) => outline.remove())
        selectionOutlines = []
    }
    const removeGuides = () => {
        guides.forEach((guide) => guide.remove())
        guides = []
        measurementTargets.clear()
    }
    const clearGuides = () => {
        removeGuides()
        hoveredNode?.classList.remove('designer-hovered')
        hoveredNode = null
    }
    let showSelectedSpacing: () => void = () => undefined
    type SizeGuideLayout = {
        centerLeft: number
        centerTop: number
        widthLane: number
        heightLane: number
        widthMaxLane: number
        heightMaxLane: number
    }
    const showSpacing = (
        node: HTMLElement,
        append = false,
        selectionLevel?: 'slot' | 'widget' | 'element',
        includeDescendantGrid = true,
        sizeGuideLayout?: SizeGuideLayout,
    ) => {
        if (!append) {
            removeGuides()
            hoveredNode?.classList.remove('designer-hovered')
            hoveredNode = node
            node.classList.add('designer-hovered')
        }
        if (designer.guidesEnabled === false) return
        const guideIsVisible = (spacing?: 'margin' | 'padding' | 'gap' | 'size') => (
            !spacing || designer.guideVisibility?.[spacing] !== false
        )
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        const number = (name: string) => Number.parseFloat(style.getPropertyValue(name)) || 0
        const margin = { top: number('margin-top'), right: number('margin-right'), bottom: number('margin-bottom'), left: number('margin-left') }
        const padding = { top: number('padding-top'), right: number('padding-right'), bottom: number('padding-bottom'), left: number('padding-left') }
        const border = { top: number('border-top-width'), right: number('border-right-width'), bottom: number('border-bottom-width'), left: number('border-left-width') }
        const columnGrid = node.matches('.two-columns-widget,.three-columns-widget')
            ? node
            : includeDescendantGrid ? node.querySelector<HTMLElement>('.two-columns-widget,.three-columns-widget') : null
        const levelClass = selectionLevel
            ? ` designer-spacing-level-${selectionLevel}`
            : columnGrid === node ? ' designer-spacing-level-widget' : ''
        const addGuide = (
            className: string,
            left: number,
            top: number,
            width: number,
            height: number,
            side?: string,
            spacing?: 'margin' | 'padding' | 'gap' | 'size',
            value?: number,
            propertyOverride?: 'width' | 'height',
            labelPosition?: { left: number, top: number },
        ) => {
            if (!guideIsVisible(spacing)) return
            const property = propertyOverride || (spacing === 'gap' ? 'gap' : `${spacing}${side ? side[0].toUpperCase() + side.slice(1) : ''}`)
            const editNode = spacing === 'gap' && columnGrid ? columnGrid : node
            const directTargets = nodeTargets(editNode)
            const directTargetIds = directTargets.flatMap((target: any) => [target.id, target.styleTargetId]).filter(Boolean)
            const targetIds: string[] = []
            let targetNode: HTMLElement | null = editNode
            while (targetNode && root.contains(targetNode)) {
                nodeTargets(targetNode).forEach((target: any) => {
                    if (target.id && !targetIds.includes(target.id)) targetIds.push(target.id)
                    if (target.styleTargetId && !targetIds.includes(target.styleTargetId)) targetIds.push(target.styleTargetId)
                })
                targetNode = targetNode.parentElement?.closest<HTMLElement>('[data-designer-target]') || null
            }
            const explicitlyConfigured = targetIds.some((targetId) => (
                designer.activeSpacingPropertiesByTarget?.[targetId]?.includes(property)
            ))
            if (spacing && value === 0 && !explicitlyConfigured) return
            if (width <= 0 || height <= 0) {
                if (!spacing || value !== 0) return
                width = Math.max(1, width)
                height = Math.max(1, height)
            }
            const guide = document.createElement('div')
            guide.className = `designer-spacing-guide ${className}${levelClass}`
            guide.setAttribute('aria-hidden', 'true')
            if (side) guide.dataset.side = side
            guide.dataset.property = property
            Object.assign(guide.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` })
            document.body.append(guide)
            guides.push(guide)

            const viewportWidth = window.innerWidth
            const viewportHeight = window.innerHeight
            const visibleLeft = Math.max(0, left)
            const visibleRight = Math.min(viewportWidth, left + width)
            const visibleTop = Math.max(0, top)
            const visibleBottom = Math.min(viewportHeight, top + height)
            if (!spacing || value === undefined || visibleRight <= visibleLeft || visibleBottom <= visibleTop) return

            const measure = document.createElement('div')
            const horizontalMeasure = side === 'left' || side === 'right'
            measure.className = `designer-spacing-measure designer-spacing-measure-${horizontalMeasure ? 'horizontal' : 'vertical'} designer-spacing-${spacing}-measure${levelClass}`
            measure.setAttribute('aria-hidden', 'true')
            if (side) measure.dataset.side = side
            measure.dataset.property = property
            Object.assign(measure.style, horizontalMeasure ? {
                left: `${visibleLeft}px`,
                top: `${(visibleTop + visibleBottom) / 2}px`,
                width: `${visibleRight - visibleLeft}px`,
            } : {
                left: `${(visibleLeft + visibleRight) / 2}px`,
                top: `${visibleTop}px`,
                height: `${visibleBottom - visibleTop}px`,
            })
            document.body.append(measure)
            guides.push(measure)

            const label = document.createElement('div')
            label.className = `designer-spacing-value designer-spacing-${spacing}-value${levelClass}`
            if (side) label.dataset.side = side
            label.dataset.property = property
            label.textContent = `${value}px`
            const labelWidth = Math.max(20, label.textContent.length * 6)
            const labelHeight = 14
            const labelGap = 3
            const halfWidth = labelWidth / 2
            const halfHeight = labelHeight / 2
            let labelLeft = labelPosition?.left ?? (visibleLeft + visibleRight) / 2
            let labelTop = labelPosition?.top ?? (visibleTop + visibleBottom) / 2
            const keepOutsidePositionVisible = (preferred: number, halfSize: number, viewportSize: number) => Math.min(viewportSize - halfSize, Math.max(halfSize, preferred))
            if (!labelPosition && (side === 'top' || side === 'bottom') && visibleBottom - visibleTop < labelHeight + 4) {
                const above = visibleTop - halfHeight - labelGap
                const below = visibleBottom + halfHeight + labelGap
                labelTop = keepOutsidePositionVisible(side === 'top' ? above : below, halfHeight, viewportHeight)
                label.dataset.placement = 'outside'
            } else if (!labelPosition && (side === 'left' || side === 'right') && visibleRight - visibleLeft < labelWidth + 4) {
                const before = visibleLeft - halfWidth - labelGap
                const after = visibleRight + halfWidth + labelGap
                labelLeft = keepOutsidePositionVisible(side === 'left' ? before : after, halfWidth, viewportWidth)
                label.dataset.placement = 'outside'
            }
            labelLeft = Math.min(viewportWidth - halfWidth, Math.max(halfWidth, labelLeft))
            labelTop = Math.min(viewportHeight - halfHeight, Math.max(halfHeight, labelTop))
            if (spacing === 'size') {
                if (property === 'width') {
                    guide.style.top = `${labelTop - 0.5}px`
                    measure.style.top = `${labelTop}px`
                } else if (property === 'height') {
                    guide.style.left = `${labelLeft - 0.5}px`
                    measure.style.left = `${labelLeft}px`
                }
            }
            Object.assign(label.style, {
                left: `${labelLeft}px`,
                top: `${labelTop}px`,
            })
            const spacingDescription = propertyOverride || (spacing === 'gap' ? 'column gap' : `${spacing} ${side}`)
            const emptySlot = editNode.matches('[data-slot],[data-slot-name]')
                && !editNode.querySelector('[data-widget-id]')
            const editableTargets = emptySlot ? [] : directTargets.flatMap((target: any) => (
                [target.id, target.styleTargetId].filter(Boolean).flatMap((targetId) => (
                    designer.editableSpacingTargets?.[targetId]?.includes(property) ? [{ ...target, targetId }] : []
                ))
            ))
            const editableTarget = editableCascadeWinner(editNode, editableTargets, property)
            const editableTargetIds = editableTarget ? [editableTarget.targetId] : []
            const spacingTargetId = editableTargetIds[0] || ''
            const editable = Boolean(spacingTargetId)
            guide.dataset.editable = String(editable)
            measure.dataset.editable = String(editable)
            label.dataset.editable = String(editable)
            label.setAttribute('aria-hidden', editable ? 'false' : 'true')
            if (editable) {
                const widgetId = editNode.closest<HTMLElement>('[data-widget-id]')?.dataset.widgetId || ''
                const measurementKey = `${widgetId}:${spacingTargetId}:${property}`
                const axis = property === 'width' || side === 'left' || side === 'right'
                    ? 'horizontal'
                    : 'vertical'
                measurementTargets.set(measurementKey, {
                    node: editNode,
                    property,
                    targetId: spacingTargetId,
                    targetIds,
                    editableTargetIds,
                    editableTargets,
                    axis,
                })
                label.dataset.selected = String(focusState.selectedMeasurementKeys.includes(measurementKey))
                label.tabIndex = 0
                label.setAttribute('role', 'button')
                label.setAttribute('aria-pressed', String(focusState.selectedMeasurementKeys.includes(measurementKey)))
                label.setAttribute('aria-label', `Select ${spacingDescription}`)
                const toggleMeasurement = (event: Event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    const selected = new Set(focusState.selectedMeasurementKeys)
                    if (selected.has(measurementKey)) selected.delete(measurementKey)
                    else selected.add(measurementKey)
                    focusState.selectedMeasurementKeys = [...selected]
                    label.dataset.selected = String(selected.has(measurementKey))
                    label.setAttribute('aria-pressed', String(selected.has(measurementKey)))
                }
                label.addEventListener('click', toggleMeasurement)
                label.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') toggleMeasurement(event)
                })
            }
            document.body.append(label)
            guides.push(label)
        }

        const marginLeft = Math.max(0, margin.left)
        const marginRight = Math.max(0, margin.right)
        const marginTop = Math.max(0, margin.top)
        const marginBottom = Math.max(0, margin.bottom)
        const outerLeft = rect.left - marginLeft
        const outerWidth = rect.width + marginLeft + marginRight
        addGuide('designer-spacing-margin', outerLeft, rect.top - marginTop, outerWidth, marginTop, 'top', 'margin', marginTop)
        addGuide('designer-spacing-margin', rect.right, rect.top, marginRight, rect.height, 'right', 'margin', marginRight)
        addGuide('designer-spacing-margin', outerLeft, rect.bottom, outerWidth, marginBottom, 'bottom', 'margin', marginBottom)
        addGuide('designer-spacing-margin', outerLeft, rect.top, marginLeft, rect.height, 'left', 'margin', marginLeft)

        const innerLeft = rect.left + border.left
        const innerTop = rect.top + border.top
        const innerWidth = Math.max(0, rect.width - border.left - border.right)
        const innerHeight = Math.max(0, rect.height - border.top - border.bottom)
        const contentLeft = innerLeft + padding.left
        const contentTop = innerTop + padding.top
        const contentWidth = Math.max(0, innerWidth - padding.left - padding.right)
        const contentHeight = Math.max(0, innerHeight - padding.top - padding.bottom)
        addGuide('designer-spacing-padding', innerLeft, innerTop, innerWidth, Math.max(0, padding.top), 'top', 'padding', Math.max(0, padding.top))
        addGuide('designer-spacing-padding', contentLeft + contentWidth, contentTop, Math.max(0, padding.right), contentHeight, 'right', 'padding', Math.max(0, padding.right))
        addGuide('designer-spacing-padding', innerLeft, contentTop + contentHeight, innerWidth, Math.max(0, padding.bottom), 'bottom', 'padding', Math.max(0, padding.bottom))
        addGuide('designer-spacing-padding', innerLeft, contentTop, Math.max(0, padding.left), contentHeight, 'left', 'padding', Math.max(0, padding.left))
        const sizeLabelCenter = {
            left: sizeGuideLayout?.centerLeft ?? rect.left + rect.width / 2,
            top: sizeGuideLayout?.centerTop ?? rect.top + rect.height / 2,
        }
        const sizeLaneGap = 52
        const sizeLabelInset = 2
        const widthLane = sizeGuideLayout?.widthLane ?? 0
        const heightLane = sizeGuideLayout?.heightLane ?? 0
        const clampInside = (preferred: number, start: number, end: number) => (
            start <= end ? Math.min(end, Math.max(start, preferred)) : (start + end) / 2
        )
        const valueHalfWidth = (value: number) => Math.max(20, `${value}px`.length * 6) / 2
        const widthValue = Math.round(rect.width)
        const heightValue = Math.round(rect.height)
        const labelHalfHeight = 7
        const widthMeasureTop = clampInside(
            sizeLabelCenter.top + widthLane * sizeLaneGap,
            rect.top + labelHalfHeight + sizeLabelInset,
            rect.bottom - labelHalfHeight - sizeLabelInset,
        )
        const heightMeasureLeft = clampInside(
            sizeLabelCenter.left + heightLane * sizeLaneGap,
            rect.left + valueHalfWidth(heightValue) + sizeLabelInset,
            rect.right - valueHalfWidth(heightValue) - sizeLabelInset,
        )
        const widthLabelOffset = ((sizeGuideLayout?.heightMaxLane ?? 0) + 1) * sizeLaneGap
        const heightLabelOffset = ((sizeGuideLayout?.widthMaxLane ?? 0) + 1) * sizeLaneGap
        const widthLabelLeft = clampInside(
            sizeLabelCenter.left - widthLabelOffset,
            rect.left + valueHalfWidth(widthValue) + sizeLabelInset,
            rect.right - valueHalfWidth(widthValue) - sizeLabelInset,
        )
        const heightLabelTop = clampInside(
            sizeLabelCenter.top + heightLabelOffset,
            rect.top + labelHalfHeight + sizeLabelInset,
            rect.bottom - labelHalfHeight - sizeLabelInset,
        )
        addGuide('designer-spacing-size', rect.left, widthMeasureTop - 0.5, rect.width, 1, 'right', 'size', widthValue, 'width', {
            left: widthLabelLeft,
            top: widthMeasureTop,
        })
        addGuide('designer-spacing-size', heightMeasureLeft - 0.5, rect.top, 1, rect.height, 'bottom', 'size', heightValue, 'height', {
            left: heightMeasureLeft,
            top: heightLabelTop,
        })
        addGuide(
            'designer-spacing-content',
            rect.left,
            rect.top,
            rect.width,
            rect.height,
        )
        if (columnGrid && (selectionLevel === 'widget' || columnGrid === node)) {
            const slots = [...columnGrid.children]
                .filter((child): child is HTMLElement => child instanceof HTMLElement && child.matches('[data-slot]'))
            const slotRects = slots.map((slot) => slot.getBoundingClientRect())
            slotRects.forEach((slotRect) => addGuide(
                'designer-column-slot-guide',
                slotRect.left,
                slotRect.top,
                slotRect.width,
                slotRect.height,
            ))
            for (let index = 0; index < slotRects.length - 1; index += 1) {
                const current = slotRects[index]
                const next = slotRects[index + 1]
                const horizontalGap = Math.max(0, next.left - current.right)
                const verticalGap = Math.max(0, next.top - current.bottom)
                const verticalOverlap = Math.max(0, Math.min(current.bottom, next.bottom) - Math.max(current.top, next.top))
                const horizontalOverlap = Math.max(0, Math.min(current.right, next.right) - Math.max(current.left, next.left))
                if (horizontalGap > 0) {
                    addGuide(
                        'designer-spacing-gap',
                        current.right,
                        Math.max(current.top, next.top),
                        horizontalGap,
                        verticalOverlap,
                        'right',
                        'gap',
                        horizontalGap,
                    )
                } else if (verticalGap > 0) {
                    addGuide(
                        'designer-spacing-gap',
                        Math.max(current.left, next.left),
                        current.bottom,
                        horizontalOverlap,
                        verticalGap,
                        'bottom',
                        'gap',
                        verticalGap,
                    )
                } else if (verticalOverlap > 0) {
                    addGuide('designer-spacing-gap', current.right, Math.max(current.top, next.top), 0, verticalOverlap, 'right', 'gap', 0)
                } else if (horizontalOverlap > 0) {
                    addGuide('designer-spacing-gap', Math.max(current.left, next.left), current.bottom, horizontalOverlap, 0, 'bottom', 'gap', 0)
                }
            }
        }
    }
    const selectedNodeEntries = () => (Object.entries(selectedNodes) as Array<['slot' | 'widget' | 'element', HTMLElement | null]>)
        .filter((entry): entry is ['slot' | 'widget' | 'element', HTMLElement] => Boolean(entry[1] && root.contains(entry[1])))
    const selectedNodeList = () => [...new Set(selectedNodeEntries().map(([, node]) => node))]
    const drawSelectionOutlines = () => {
        removeSelectionOutlines()
        const entries = selectedNodeEntries()
        const selectedEntry = previewedSelectionLevel
            ? entries.find(([kind]) => kind === previewedSelectionLevel)
            : entries.at(-1)
        if (!selectedEntry) return
        const [kind, node] = selectedEntry
        const rect = node.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return
        const outline = document.createElement('div')
        outline.className = `designer-selection-outline designer-selection-outline-${kind}`
        outline.setAttribute('aria-hidden', 'true')
        Object.assign(outline.style, {
            left: `${rect.left - 1}px`,
            top: `${rect.top - 1}px`,
            width: `${rect.width + 2}px`,
            height: `${rect.height + 2}px`,
        })
        document.body.append(outline)
        selectionOutlines.push(outline)
    }
    showSelectedSpacing = () => {
        const entries = selectedNodeEntries()
        drawSelectionOutlines()
        if (!entries.length) {
            if (selectedNode && root.contains(selectedNode)) showSpacing(selectedNode)
            return
        }
        removeGuides()
        hoveredNode?.classList.remove('designer-hovered')
        hoveredNode = selectedNode && root.contains(selectedNode) ? selectedNode : entries.at(-1)?.[1] || null
        hoveredNode?.classList.add('designer-hovered')
        const levelByNode = new Map<HTMLElement, 'slot' | 'widget' | 'element'>()
        entries.forEach(([kind, node]) => levelByNode.set(node, kind))
        const selectedWidgetRoot = selectedNodes.widget
        const widgetConfigurationNodes: HTMLElement[] = []
        if (selectedWidgetRoot) {
            selectedWidgetRoot.querySelectorAll<HTMLElement>('[data-designer-target]').forEach((configurationNode) => {
                if (configurationNode.closest<HTMLElement>('[data-widget-id]') !== selectedWidgetRoot) return
                const hasEditableWidgetTarget = nodeTargets(configurationNode).some((target: any) => (
                    selectionKind(target) === 'widget'
                    && [target.id, target.styleTargetId].filter(Boolean).some((targetId) => (
                        (designer.editableSpacingTargets?.[targetId] || []).length > 0
                    ))
                ))
                if (hasEditableWidgetTarget && !levelByNode.has(configurationNode)) widgetConfigurationNodes.push(configurationNode)
            })
        }
        const spacingEntries = [...levelByNode].map(([node, kind]) => ({
            node,
            kind,
            includeDescendantGrid: node !== selectedWidgetRoot || widgetConfigurationNodes.length === 0,
        }))
        widgetConfigurationNodes.forEach((node) => spacingEntries.push({ node, kind: 'widget', includeDescendantGrid: true }))
        if (selectedNode?.matches('.two-columns-widget,.three-columns-widget')
            && !levelByNode.has(selectedNode) && !widgetConfigurationNodes.includes(selectedNode)) {
            spacingEntries.push({ node: selectedNode, kind: 'widget', includeDescendantGrid: true })
        }
        const centerRect = (entries.at(-1)?.[1] || spacingEntries.at(-1)?.node)?.getBoundingClientRect()
        const centerLeft = centerRect ? centerRect.left + centerRect.width / 2 : 0
        const centerTop = centerRect ? centerRect.top + centerRect.height / 2 : 0
        const alternatingLane = (rank: number) => rank === 0 ? 0 : Math.ceil(rank / 2) * (rank % 2 ? -1 : 1)
        const lanes = new Map<HTMLElement, { widthLane: number, heightLane: number }>(
            spacingEntries.map(({ node }) => [node, { widthLane: 0, heightLane: 0 }]),
        )
        const assignLanes = (dimension: 'width' | 'height') => {
            spacingEntries
                .map((entry, index) => ({ ...entry, index, value: entry.node.getBoundingClientRect()[dimension] }))
                .sort((left, right) => right.value - left.value || left.index - right.index)
                .forEach(({ node }, rank) => {
                    const lane = lanes.get(node)!
                    if (dimension === 'width') lane.widthLane = alternatingLane(rank)
                    else lane.heightLane = alternatingLane(rank)
                })
        }
        assignLanes('width')
        assignLanes('height')
        const widthMaxLane = Math.max(0, ...[...lanes.values()].map(({ widthLane }) => Math.abs(widthLane)))
        const heightMaxLane = Math.max(0, ...[...lanes.values()].map(({ heightLane }) => Math.abs(heightLane)))
        spacingEntries.forEach(({ node, kind, includeDescendantGrid }) => {
            const lane = lanes.get(node)!
            showSpacing(node, true, kind, includeDescendantGrid, {
                centerLeft,
                centerTop,
                widthLane: lane.widthLane,
                heightLane: lane.heightLane,
                widthMaxLane,
                heightMaxLane,
            })
        })
    }
    const setSelectedNodesFromPaths = (paths: ReturnType<typeof selectionPaths>) => {
        ;(['slot', 'widget', 'element'] as const).forEach((kind) => {
            const target = paths[kind].at(-1)
            selectedNodes[kind] = target ? findTargetNode(root, target.id, target.widgetId, target.instanceId) : null
        })
    }
    const setSelectedNodesFromTargets = (targets: NonNullable<RenderFrameMessage['selectedTargets']>) => {
        selectedNodes = { slot: null, widget: null, element: null }
        targets.forEach((target) => {
            selectedNodes[target.selectionLevel] = findTargetNode(root, target.targetId, target.widgetId, target.targetInstanceId)
        })
    }
    const selectedTargetsFromPaths = (paths: ReturnType<typeof selectionPaths>): NonNullable<RenderFrameMessage['selectedTargets']> => (
        (['slot', 'widget', 'element'] as const).flatMap((selectionLevel) => {
            const target = paths[selectionLevel].at(-1)
            return target ? [{
                targetId: target.id,
                targetInstanceId: target.instanceId,
                widgetId: target.widgetId,
                selectionLevel,
            }] : []
        })
    )
    const groups = (designer.catalog?.designGroups || []).map((group: any) => ({
        ...group,
        previewTargeting: designer.designGroupTargeting?.[group.id] || {},
        parts: (group.parts || []).map((part: any) => ({
            ...part,
            activeSpacingProperties: designer.activeSpacingPropertiesByTarget?.[part.id] || [],
        })),
    }))
    const widgetParts = designer.catalog?.widgetParts || []
    const layouts = designer.catalog?.layouts || []
    const layout = layouts.find((candidate: any) => candidate.key === model.layout)

    root.querySelectorAll<HTMLElement>('[data-slot-name]').forEach((node) => {
        const slotName = node.dataset.slotName || ''
        if (!slotName) return
        const slot = (layout?.slots || []).find((candidate: any) => candidate.name === slotName)
        const layoutNodeTarget = nodeTargets(node).find((candidate: any) => candidate.layoutNodeId)
        registerTarget(node, {
            id: `layout:${model.layout}:slot:${slotName}`,
            styleTargetId: `layout:${model.layout}:slot:${slotName}`,
            kind: 'layoutSlot',
            label: slot?.label || slotName.replace(/[-_]+/g, ' ').replace(/^./, (character) => character.toUpperCase()),
            editable: false,
            layoutNodeId: layoutNodeTarget?.layoutNodeId || '',
            editableParameters: layoutNodeTarget?.editableParameters || [],
        }, true)
    })

    const widgetRoots = [...root.querySelectorAll<HTMLElement>('[data-widget-id][data-widget-type]')]
    widgetRoots.forEach((node) => {
        const widgetId = node.dataset.widgetId || ''
        const widgetType = node.dataset.widgetType || ''
        if (!widgetId) return
        registerTarget(node, {
            id: `widget:${widgetId}`,
            styleTargetId: `widget-type:${widgetType}`,
            kind: 'widget',
            label: `${widgetTypeLabel(node) || 'Widget'} widget`,
            widgetId,
            widgetType,
            editable: false,
        })
    })

    const themedWidgetTypes = new Set(groups.flatMap((group: any) => (group.widgetTypes || []).map(widgetTypeKey)))
    widgetRoots.forEach((widgetRoot) => {
        const widgetType = widgetRoot.dataset.widgetType || ''
        const widgetId = widgetRoot.dataset.widgetId || ''
        if (!widgetType) return
        const themedWidget = themedWidgetTypes.has(widgetTypeKey(widgetType))
        const definition = widgetParts.find((candidate: any) => widgetTypeKey(candidate.widgetType) === widgetTypeKey(widgetType))
        ;(definition?.parts || []).filter((part: any) => part.designerLevel !== 'widget' || !themedWidget).forEach((part: any) => {
            widgetRoot.querySelectorAll<HTMLElement>(`.${normalizeCssName(part.part)}`).forEach((node) => registerTarget(node, {
                id: part.id || `widget-part:${widgetType}:${part.part}`,
                styleTargetId: part.id || `widget-part:${widgetType}:${part.part}`,
                kind: part.designerLevel === 'widget' ? 'part' : 'element',
                label: part.label,
                isWidgetSurface: part.isWidgetSurface === true,
                widgetId,
                widgetType,
                editable: false,
            }, true))
        })
    })

    root.querySelectorAll<HTMLElement>('[data-slot]').forEach((node) => {
        const slotName = node.dataset.slot || ''
        const owner = node.parentElement?.closest<HTMLElement>('[data-widget-id]')
        const ownerWidgetId = owner?.dataset.widgetId || ''
        if (!slotName || !ownerWidgetId) return
        registerTarget(node, {
            id: `slot:${ownerWidgetId}:${slotName}`,
            styleTargetId: `widget-slot:${owner?.dataset.widgetType || ''}:${slotName}`,
            kind: 'slot',
            label: `${slotName.replace(/[-_]+/g, ' ').replace(/^./, (character) => character.toUpperCase())} slot`,
            widgetId: ownerWidgetId,
            widgetType: owner?.dataset.widgetType || '',
            editable: false,
        }, true)
    })

    groups.forEach((group: any) => {
        const roots = new Set<HTMLElement>()
        const customClassTargeting = group.previewTargeting?.targetingMode === 'css-classes'
        const registerElements = (groupRoot: HTMLElement) => {
            ;(group.elements || []).forEach((element: any) => {
                const selector = element.element === 'a:hover' ? 'a' : element.element
                try {
                    groupRoot.querySelectorAll<HTMLElement>(selector).forEach((node) => {
                        registerTarget(node, { id: element.id, kind: 'element', label: element.label, editable: false })
                    })
                } catch { /* Invalid theme selector metadata is ignored in preview. */ }
            })
        }
        const registerParts = (searchRoot: HTMLElement) => {
            ;(group.parts || []).forEach((part: any) => searchRoot.querySelectorAll<HTMLElement>(`.${normalizeCssName(part.part)}`).forEach((node) => {
                const widgetLevel = part.designerLevel !== 'element'
                registerTarget(node, {
                    id: part.id,
                    kind: widgetLevel ? 'part' : 'element',
                    label: part.label,
                    isWidgetSurface: part.isWidgetSurface === true,
                    cascadePriority: [0,
                        Number((group.widgetTypes || []).length > 0) + Number((group.slots || []).length > 0) + 1,
                        0, Number(group.groupIndex) || 0],
                    cascadeSelectors: groupPartSelectors(group, part),
                    cascadeSourceOrder: Number(group.groupIndex) || 0,
                    activeSpacingProperties: part.activeSpacingProperties || [],
                    editable: false,
                }, widgetLevel)
            }))
        }
        const allowedSlots = new Set<string>(group.slots || [])
        const groupWidgetTypes = new Set<string>((group.widgetTypes || []).map(widgetTypeKey))
        if (customClassTargeting) {
            registerParts(root)
            splitTargetSelectorList(String(group.previewTargeting?.targetCssClasses || '')).forEach((selector) => {
                try {
                    if (root.matches(selector)) roots.add(root)
                    root.querySelectorAll<HTMLElement>(selector).forEach((node) => roots.add(node))
                } catch { /* Invalid theme selector metadata is ignored in preview. */ }
            })
        }
        widgetRoots.forEach((node) => {
            if (customClassTargeting) return
            if (!groupWidgetTypes.has(widgetTypeKey(node.dataset.widgetType || ''))) return
            const slotName = node.closest<HTMLElement>('[data-slot-name]')?.dataset.slotName || ''
            if (allowedSlots.size && !allowedSlots.has(slotName)) return
            roots.add(node)
        })
        if (!customClassTargeting && !(group.widgetTypes || []).length) {
            if (allowedSlots.size) {
                allowedSlots.forEach((slot) => {
                    root.querySelectorAll<HTMLElement>(`.slot-${normalizeCssName(slot)}`).forEach((slotRoot) => {
                        registerParts(slotRoot)
                        registerElements(slotRoot)
                    })
                })
            } else {
                registerParts(root)
                registerElements(root)
            }
            return
        }
        roots.forEach((groupRoot) => {
            registerTarget(groupRoot, { id: group.id, kind: 'group', label: group.label, editable: false })
            registerParts(groupRoot)
            ;(group.assetKeys || []).forEach((assetKey: string) => {
                const asset = designer.assets.find((candidate: any) => candidate.assetKey === assetKey)
                const targetNode = asset?.part ? groupRoot.querySelector<HTMLElement>(`.${normalizeCssName(asset.part)}`) || groupRoot : groupRoot
                registerTarget(targetNode, { id: `asset:${assetKey}`, kind: 'asset', label: asset?.displayName || 'Theme image', editable: false })
            })
            registerElements(groupRoot)
        })
    })

    let editableTextIndex = 0
    const richTextRoots = designer.contentEditable === true
        ? [...root.querySelectorAll<HTMLElement>(RICH_TEXT_SELECTOR)].filter((node) => (node.innerText || node.textContent || '').trim())
        : []
    richTextRoots.forEach((node) => {
        const contentId = `content:${editableTextIndex}`
        editableTextIndex += 1
        registerTarget(node, { id: contentId, kind: 'element', label: 'Rich text', editable: true, richText: true }, true)
        if (designer.texts[contentId] !== undefined) {
            const saved = designer.texts[contentId]
            if (/<\/?[A-Za-z][^>]*>/.test(saved)) node.innerHTML = DOMPurify.sanitize(saved)
            else {
                const textLeaf = [...node.querySelectorAll<HTMLElement>(EDITABLE_TEXT_SELECTOR)].find((candidate) => !candidate.querySelector(EDITABLE_TEXT_SELECTOR))
                if (textLeaf) textLeaf.textContent = saved
                else node.textContent = saved
            }
        }
        node.contentEditable = 'false'
    })
    const addedSemanticTextNodes = [...root.querySelectorAll<HTMLElement>(ADDED_SEMANTIC_TEXT_SELECTOR)]
    const addedSemanticTextSet = new Set(addedSemanticTextNodes)
    const editableTextNodes = [
        ...[...root.querySelectorAll<HTMLElement>(EDITABLE_TEXT_SELECTOR)].filter((node) => !addedSemanticTextSet.has(node)),
        ...addedSemanticTextNodes,
    ]
    editableTextNodes.forEach((node) => {
        if (!(node.innerText || node.textContent || '').trim()) return
        let targets: any[] = []
        try { targets = JSON.parse(node.dataset.designerTargets || '[]') } catch { targets = [] }
        const legacyTextTarget = targets.find((target) => designer.texts[target.id] !== undefined)
        if (legacyTextTarget) node.textContent = designer.texts[legacyTextTarget.id]
        if (richTextRoots.some((richRoot) => richRoot === node || richRoot.contains(node))) return
        const hasEditableTextDescendant = [...node.querySelectorAll<HTMLElement>(EDITABLE_TEXT_SELECTOR)]
            .some((descendant) => (descendant.innerText || descendant.textContent || '').trim())
        if (designer.contentEditable !== true || hasEditableTextDescendant) return
        const contentId = `content:${editableTextIndex}`
        editableTextIndex += 1
        registerTarget(node, { id: contentId, kind: 'element', label: editableTextLabel(node), editable: true }, true)
        if (designer.texts[contentId] !== undefined) node.textContent = designer.texts[contentId]
        node.contentEditable = 'false'
    })

    if (designer.contentEditable === true) {
        let imageIndex = 0
        const remainingReferences = [...(designer.previewImageReferences || [])]
        const referencesByWidgetId = new Map<string, NonNullable<RenderPageModel['designer']>['previewImageReferences']>()
        const collectWidgetReferences = (widgets: any[]) => widgets.forEach((widget) => {
            referencesByWidgetId.set(widget.id, widget.previewImageReferences || [])
            Object.values(widget.config?.slots || {}).forEach((children) => {
                if (Array.isArray(children)) collectWidgetReferences(children)
            })
        })
        Object.values(model.slots).forEach(collectWidgetReferences)
        const resolvedUrl = (value: string) => {
            try { return new URL(value, document.baseURI).href } catch { return value }
        }
        root.querySelectorAll<HTMLImageElement>('img[src]').forEach((node) => {
            const sourceUrl = node.currentSrc || node.src
            if (!sourceUrl) return
            const widgetId = node.closest<HTMLElement>('[data-widget-id]')?.dataset.widgetId
            const widgetReferences = widgetId ? referencesByWidgetId.get(widgetId) || [] : []
            const preferredReferences = widgetReferences.length ? widgetReferences : remainingReferences
            const preferredReference = preferredReferences.find((reference) => resolvedUrl(reference.sourceUrl) === resolvedUrl(sourceUrl))
                || (widgetReferences.length === 1 ? widgetReferences[0] : undefined)
            const referenceIndex = preferredReference
                ? remainingReferences.findIndex((reference) => reference.sourceUrl === preferredReference.sourceUrl && reference.sourceOccurrence === preferredReference.sourceOccurrence)
                : remainingReferences.findIndex((reference) => resolvedUrl(reference.sourceUrl) === resolvedUrl(sourceUrl))
            const reference = referenceIndex >= 0 ? remainingReferences.splice(referenceIndex, 1)[0] : null
            if (reference && widgetId) referencesByWidgetId.set(widgetId, widgetReferences.filter((candidate) => candidate !== preferredReference))
            registerTarget(node, {
                id: `content-image:${imageIndex}`,
                kind: 'previewImage',
                label: node.alt?.trim() || 'Content image',
                sourceUrl: reference?.sourceUrl || sourceUrl,
                sourceOccurrence: reference?.sourceOccurrence ?? 0,
                sourcePath: reference?.sourcePath || [],
                sourceMatchIndex: reference?.sourceMatchIndex ?? 0,
                editable: false,
            }, true)
            imageIndex += 1
        })
    }

    const restoredSelection = focusState.selectedTargetId
        ? findTargetNode(root, focusState.selectedTargetId, focusState.selectedWidgetId, focusState.selectedInstanceId)
        : null
    const restoredHighlight = focusState.highlightedTargetId
        ? findTargetNode(root, focusState.highlightedTargetId, focusState.highlightedWidgetId, focusState.highlightedInstanceId)
        : null
    if (restoredSelection) {
        const restoredTarget = applicableNodeTargets(restoredSelection)
            .find((target: any) => target.id === focusState.selectedTargetId)
        if (focusState.selectedTargets.length) {
            applyIndependentSelectionClasses(root, focusState.selectedTargets)
            setSelectedNodesFromTargets(focusState.selectedTargets)
        } else {
            const paths = applySelectionClasses(root, restoredSelection, restoredTarget)
            setSelectedNodesFromPaths(paths)
            focusState.selectedTargets = selectedTargetsFromPaths(paths)
        }
        selectedNode = restoredSelection
        showSelectedSpacing()
    }
    restoredHighlight?.classList.add('designer-highlighted')

    root.querySelectorAll<HTMLElement>('[data-designer-target]').forEach((node) => {
        const click = (event: Event) => {
            if (!node.isContentEditable) event.preventDefault()
            event.stopPropagation()
            let selectionNode: HTMLElement | null = node
            let primaryTarget = primaryNodeTarget(selectionNode)
            while (!primaryTarget) {
                selectionNode = selectionNode.parentElement?.closest<HTMLElement>('[data-designer-target]') || null
                if (!selectionNode || !root.contains(selectionNode)) return
                primaryTarget = primaryNodeTarget(selectionNode)
            }
            const paths = applySelectionClasses(root, selectionNode, primaryTarget)
            setSelectedNodesFromPaths(paths)
            root.querySelectorAll('.designer-highlighted').forEach((highlighted) => highlighted.classList.remove('designer-highlighted'))
            selectedNode = selectionNode
            focusState.selectedMeasurementKeys = []
            focusState.selectedTargetId = primaryTarget?.id || ''
            focusState.selectedWidgetId = selectionNode.closest<HTMLElement>('[data-widget-id]')?.dataset.widgetId || ''
            focusState.selectedInstanceId = designerInstanceId(selectionNode)
            focusState.selectedTargets = selectedTargetsFromPaths(paths)
            focusState.highlightedTargetId = ''
            focusState.highlightedWidgetId = ''
            focusState.highlightedInstanceId = ''
            showSelectedSpacing()
            postDesignerEvent(selectionNode, designer, 'select', primaryTarget)
        }
        let primaryTarget: any = null
        try { primaryTarget = JSON.parse(node.dataset.designerTargets || '[]')[0] } catch { primaryTarget = null }
        const activateEditing = (event?: Event) => {
            if (!primaryTarget?.editable) return
            event?.preventDefault()
            event?.stopPropagation()
            root.querySelectorAll<HTMLElement>('[contenteditable="true"]').forEach((editable) => { if (editable !== node) editable.contentEditable = 'false' })
            node.contentEditable = 'true'
            node.focus()
            postDesignerEvent(node, designer, 'editText', primaryTarget)
        }
        const input = (event: Event) => {
            if (!primaryTarget?.editable || !(event.target instanceof Node) || !node.contains(event.target)) return
            event.stopPropagation()
            postDesignerEvent(node, designer, 'contentChange')
        }
        const blur = (event: FocusEvent) => {
            if (!primaryTarget?.editable || (event.relatedTarget instanceof Node && node.contains(event.relatedTarget))) return
            node.contentEditable = 'false'
        }
        const doubleClick = (event: Event) => activateEditing(event)
        node.addEventListener('click', click)
        node.addEventListener('input', input)
        node.addEventListener('dblclick', doubleClick, true)
        node.addEventListener('blur', blur)
        cleanups.push(() => { node.removeEventListener('click', click); node.removeEventListener('input', input); node.removeEventListener('dblclick', doubleClick, true); node.removeEventListener('blur', blur) })
    })
    const openContextMenu = (event: MouseEvent) => {
        const eventNode = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-designer-target]') : null
        if (!eventNode || !root.contains(eventNode)) return
        const targets: any[] = []
        let targetNode: HTMLElement | null = eventNode
        while (targetNode && root.contains(targetNode)) {
            try {
                applicableNodeTargets(targetNode).forEach((target: any) => {
                    if (!targets.some((candidate) => candidate.id === target.id)) targets.push(target)
                })
            } catch { /* Invalid target metadata is ignored. */ }
            targetNode = targetNode.parentElement?.closest<HTMLElement>('[data-designer-target]') || null
        }
        const primary = targets[0]
        if (!primary) return
        event.preventDefault()
        event.stopPropagation()
        closeContextMenu()
        clearSelectionClasses(root)
        root.querySelectorAll('.designer-highlighted').forEach((highlighted) => highlighted.classList.remove('designer-highlighted'))
        const paths = applySelectionClasses(root, eventNode, primary)
        setSelectedNodesFromPaths(paths)
        selectedNode = eventNode
        focusState.selectedMeasurementKeys = []
        focusState.selectedTargetId = primary.id
        focusState.selectedWidgetId = eventNode.closest<HTMLElement>('[data-widget-id]')?.dataset.widgetId || ''
        focusState.selectedInstanceId = designerInstanceId(eventNode)
        focusState.selectedTargets = selectedTargetsFromPaths(paths)
        focusState.highlightedTargetId = ''
        focusState.highlightedWidgetId = ''
        focusState.highlightedInstanceId = ''
        showSelectedSpacing()
        postDesignerEvent(eventNode, designer, 'select', primary)

        const menu = document.createElement('div')
        menu.className = 'designer-context-menu'
        menu.setAttribute('role', 'menu')
        menu.setAttribute('aria-label', `Actions for ${primary.label}`)
        const title = document.createElement('div')
        title.className = 'designer-context-menu-title'
        title.textContent = primary.label
        menu.append(title)

        const addAction = (label: string, target: any, command: string, onInvoke?: () => void) => {
            const button = document.createElement('button')
            button.type = 'button'
            button.setAttribute('role', 'menuitem')
            button.textContent = label
            button.addEventListener('click', () => {
                if (onInvoke) onInvoke()
                else postDesignerEvent(eventNode, designer, 'contextAction', target, { command })
                closeContextMenu()
            })
            menu.append(button)
            return button
        }

        const editableTarget = targets.find((target) => target.editable)
        if (editableTarget) addAction('Edit text', editableTarget, 'editText', () => {
            eventNode.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
            const selection = window.getSelection()
            selection?.selectAllChildren(eventNode)
            selection?.collapseToEnd()
        })

        const assetTarget = targets.find((target) => target.kind === 'asset')
        if (assetTarget) addAction('Edit image in inspector', assetTarget, 'inspect')

        const imageTargets = targets.filter((target) => target.kind === 'previewImage')
        imageTargets.forEach((target) => addAction(
            imageTargets.length > 1 ? `Replace ${target.label}` : 'Replace image',
            target,
            'replaceImage',
        ))

        addAction('Edit in inspector', primary, 'inspect')
        document.body.append(menu)
        contextMenu = menu
        const rect = menu.getBoundingClientRect()
        menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - rect.width - 8))}px`
        menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - rect.height - 8))}px`
        menu.querySelector<HTMLButtonElement>('button')?.focus()
    }
    const dismissContextMenu = (event: Event) => {
        if (contextMenu && !(event.target instanceof Node && contextMenu.contains(event.target))) closeContextMenu()
    }
    const handleMeasurementKeyboard = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            closeContextMenu()
            focusState.selectedMeasurementKeys = []
            refreshGuides()
            return
        }
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
        if (event.target instanceof HTMLElement
            && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return
        const axis = event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? 'horizontal' : 'vertical'
        const targets = focusState.selectedMeasurementKeys
            .map((key) => measurementTargets.get(key))
            .filter((target) => target?.axis === axis)
        if (!targets.length) return
        event.preventDefault()
        event.stopPropagation()
        const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
        const step = event.shiftKey ? 10 : 1
        const resolvedChanges = targets.flatMap((target) => {
            if (!target) return []
            const cssProperty = target.property.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)
            const currentValue = getComputedStyle(target.node).getPropertyValue(cssProperty).trim()
            const match = currentValue.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))\s*([a-z%]*)$/i)
            if (!match) return []
            const value = `${Math.max(0, Math.round((Number(match[1]) + direction * step) * 1000) / 1000)}${match[2] || 'px'}`
            const editableTarget = editableCascadeWinner(target.node, target.editableTargets, target.property)
            const targetId = editableTarget?.targetId
            return targetId ? [{
                node: target.node,
                cssProperty,
                targetId,
                targetIds: target.targetIds,
                property: target.property,
                value,
            }] : []
        })
        resolvedChanges.forEach(({ node, cssProperty, value }) => node.style.setProperty(cssProperty, value))
        const changes = resolvedChanges.map(({ node: _node, cssProperty: _cssProperty, ...change }) => change)
        if (changes.length === 1) window.parent.postMessage({
            source: 'eceee-designer-preview',
            action: 'spacingChange',
            ...changes[0],
            viewportWidth: window.innerWidth,
        }, '*')
        else if (changes.length > 1) window.parent.postMessage({
            source: 'eceee-designer-preview',
            action: 'spacingChanges',
            changes,
            viewportWidth: window.innerWidth,
        }, '*')
        refreshGuides()
    }
    root.addEventListener('contextmenu', openContextMenu)
    document.addEventListener('pointerdown', dismissContextMenu)
    document.addEventListener('keydown', handleMeasurementKeyboard)
    const findHoveredNode = (target: EventTarget | null) => target instanceof HTMLElement ? target : null
    const refreshSelectedInspectorTargets = () => {
        if (!selectedNode || !root.contains(selectedNode)) return
        cancelAnimationFrame(dynamicSelectionRefreshFrame)
        dynamicSelectionRefreshFrame = requestAnimationFrame(() => {
            if (!selectedNode || !root.contains(selectedNode)) return
            postDesignerEvent(selectedNode, designer, 'select', primaryNodeTarget(selectedNode))
        })
    }
    document.addEventListener('pointerup', refreshSelectedInspectorTargets)
    document.addEventListener('pointercancel', refreshSelectedInspectorTargets)
    const over = (event: MouseEvent) => {
        if (selectedNode && root.contains(selectedNode)) {
            if (hoveredNode !== selectedNode) showSelectedSpacing()
            refreshSelectedInspectorTargets()
            return
        }
        const node = findHoveredNode(event.target)
        if (node && root.contains(node) && node !== hoveredNode) showSpacing(node)
        refreshSelectedInspectorTargets()
    }
    const out = (event: MouseEvent) => {
        if (!hoveredNode || (event.relatedTarget instanceof Node && hoveredNode.contains(event.relatedTarget))) return
        const next = findHoveredNode(event.relatedTarget)
        if (next && root.contains(next)) showSpacing(next)
        else if (selectedNode && root.contains(selectedNode)) showSelectedSpacing()
        else clearGuides()
        refreshSelectedInspectorTargets()
    }
    const selectFromInspector = (event: Event) => {
        const node = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-designer-target]') : null
        if (!node || !root.contains(node)) return
        selectedNode = node
        const selectedTargets = event instanceof CustomEvent ? event.detail?.selectedTargets : null
        if (selectedTargets?.length) setSelectedNodesFromTargets(selectedTargets)
        else setSelectedNodesFromPaths(selectionPaths(node))
        showSelectedSpacing()
    }
    const clearFocus = () => {
        selectedNode = null
        selectedNodes = { slot: null, widget: null, element: null }
        previewedSelectionLevel = null
        focusState.selectedMeasurementKeys = []
        removeSelectionOutlines()
        closeContextMenu()
        clearGuides()
    }
    const refreshGuides = () => {
        if (selectedNodeList().length || selectedNode && root.contains(selectedNode)) showSelectedSpacing()
        else if (hoveredNode && root.contains(hoveredNode)) showSpacing(hoveredNode)
    }
    root.addEventListener('mouseover', over)
    root.addEventListener('mouseout', out)
    root.addEventListener('focusin', refreshSelectedInspectorTargets)
    root.addEventListener('focusout', refreshSelectedInspectorTargets)
    root.addEventListener('pointerdown', refreshSelectedInspectorTargets)
    root.addEventListener('keydown', refreshSelectedInspectorTargets)
    root.addEventListener('keyup', refreshSelectedInspectorTargets)
    root.addEventListener('designerselect', selectFromInspector)
    root.addEventListener('designerclear', clearFocus)
    const previewSelectionLevel = (event: Event) => {
        const selectionLevel = event instanceof CustomEvent ? event.detail?.selectionLevel : null
        previewedSelectionLevel = ['slot', 'widget', 'element'].includes(selectionLevel) ? selectionLevel : null
        drawSelectionOutlines()
    }
    root.addEventListener('designerpreviewselectionlevel', previewSelectionLevel)
    window.addEventListener('scroll', refreshGuides, true)
    window.addEventListener('resize', refreshGuides)
    cleanups.push(() => {
        closeContextMenu()
        root.removeEventListener('contextmenu', openContextMenu)
        document.removeEventListener('pointerdown', dismissContextMenu)
        document.removeEventListener('pointerup', refreshSelectedInspectorTargets)
        document.removeEventListener('pointercancel', refreshSelectedInspectorTargets)
        document.removeEventListener('keydown', handleMeasurementKeyboard)
        root.removeEventListener('mouseover', over)
        root.removeEventListener('mouseout', out)
        root.removeEventListener('focusin', refreshSelectedInspectorTargets)
        root.removeEventListener('focusout', refreshSelectedInspectorTargets)
        root.removeEventListener('pointerdown', refreshSelectedInspectorTargets)
        root.removeEventListener('keydown', refreshSelectedInspectorTargets)
        root.removeEventListener('keyup', refreshSelectedInspectorTargets)
        cancelAnimationFrame(dynamicSelectionRefreshFrame)
        root.removeEventListener('designerselect', selectFromInspector)
        root.removeEventListener('designerclear', clearFocus)
        root.removeEventListener('designerpreviewselectionlevel', previewSelectionLevel)
        window.removeEventListener('scroll', refreshGuides, true)
        window.removeEventListener('resize', refreshGuides)
    })
    return () => { clearGuides(); removeSelectionOutlines(); cleanups.forEach((cleanup) => cleanup()) }
}

export const RenderFrameRuntime = () => {
    const [model, setModel] = useState<RenderPageModel | null>(null)
    const modelRef = useRef<RenderPageModel | null>(null)
    const rootRef = useRef<HTMLDivElement>(null)
    const focusStateRef = useRef<DesignerFocusState>({ selectedTargetId: '', selectedWidgetId: '', selectedInstanceId: '', selectedTargets: [], selectedMeasurementKeys: [], highlightedTargetId: '', highlightedWidgetId: '', highlightedInstanceId: '' })

    useEffect(() => {
        const receive = (event: MessageEvent<RenderFrameMessage>) => {
            if (event.source !== window.parent) return
            if (event.data?.source !== 'eceee-render-host') return
            if (event.data.action === 'render' && event.data.model) {
                modelRef.current = event.data.model
                setModel(event.data.model)
            }
            if (event.data.action === 'selectTarget' && event.data.targetId) {
                focusStateRef.current.selectedTargetId = event.data.targetId
                focusStateRef.current.selectedWidgetId = event.data.widgetId || ''
                focusStateRef.current.selectedInstanceId = event.data.targetInstanceId || ''
                focusStateRef.current.selectedTargets = event.data.selectedTargets || []
                focusStateRef.current.selectedMeasurementKeys = []
                focusStateRef.current.highlightedTargetId = ''
                focusStateRef.current.highlightedWidgetId = ''
                focusStateRef.current.highlightedInstanceId = ''
                clearSelectionClasses(document)
                document.querySelectorAll('.designer-highlighted').forEach((node) => node.classList.remove('designer-highlighted'))
                const match = findTargetNode(document, event.data.targetId, event.data.widgetId, event.data.targetInstanceId)
                const preferredTarget = match
                    ? applicableNodeTargets(match).find((target: any) => target.id === event.data.targetId) || primaryNodeTarget(match)
                    : null
                if (event.data.selectedTargets?.length) applyIndependentSelectionClasses(document, event.data.selectedTargets)
                else if (match) applySelectionClasses(document, match, preferredTarget)
                match?.dispatchEvent(new CustomEvent('designerselect', {
                    bubbles: true,
                    detail: { selectedTargets: focusStateRef.current.selectedTargets },
                }))
                if (match && preferredTarget) postDesignerEvent(match, modelRef.current?.designer, 'select', preferredTarget, {
                    ...(event.data.selectionLevel ? { selectionLevel: event.data.selectionLevel } : {}),
                })
                match?.scrollIntoView?.({ block: 'nearest' })
            }
            if (event.data.action === 'clearTarget') {
                focusStateRef.current.selectedTargetId = ''
                focusStateRef.current.selectedWidgetId = ''
                focusStateRef.current.selectedInstanceId = ''
                focusStateRef.current.selectedTargets = []
                focusStateRef.current.selectedMeasurementKeys = []
                focusStateRef.current.highlightedTargetId = ''
                focusStateRef.current.highlightedWidgetId = ''
                focusStateRef.current.highlightedInstanceId = ''
                clearSelectionClasses(document)
                document.querySelectorAll('.designer-highlighted').forEach((node) => node.classList.remove('designer-highlighted'))
                rootRef.current?.dispatchEvent(new CustomEvent('designerclear'))
            }
            if (event.data.action === 'highlightTarget') {
                focusStateRef.current.highlightedTargetId = event.data.active && event.data.targetId ? event.data.targetId : ''
                focusStateRef.current.highlightedWidgetId = event.data.active ? event.data.widgetId || '' : ''
                focusStateRef.current.highlightedInstanceId = event.data.active ? event.data.targetInstanceId || '' : ''
                document.querySelectorAll('.designer-highlighted').forEach((node) => node.classList.remove('designer-highlighted'))
                if (event.data.active && event.data.targetId) {
                    const match = findTargetNode(document, event.data.targetId, event.data.widgetId, event.data.targetInstanceId)
                    match?.classList.add('designer-highlighted')
                    match?.scrollIntoView?.({ block: 'nearest' })
                }
            }
            if (event.data.action === 'previewSelectionLevel') {
                rootRef.current?.dispatchEvent(new CustomEvent('designerpreviewselectionlevel', {
                    detail: { selectionLevel: event.data.selectionLevel },
                }))
            }
            if (event.data.action === 'readTargetStyles' && event.data.targetId) {
                const match = findTargetNode(document, event.data.targetId, event.data.widgetId, event.data.targetInstanceId)
                if (match) window.parent.postMessage({
                    source: 'eceee-designer-preview', action: 'targetStyles', targetId: event.data.targetId,
                    ...inspectedThemeValues(match),
                }, '*')
            }
            if (event.data.action === 'updateText' && event.data.targetId && typeof event.data.text === 'string') {
                const match = findTargetNode(document, event.data.targetId, event.data.widgetId, event.data.targetInstanceId)
                const richText = match ? primaryNodeTarget(match)?.richText : false
                if (match && richText && match.innerHTML !== event.data.text) match.innerHTML = DOMPurify.sanitize(event.data.text)
                if (match && !richText && match.textContent !== event.data.text) match.textContent = event.data.text
            }
            if (event.data.action === 'formatText' && event.data.targetId && event.data.command) {
                const match = findTargetNode(document, event.data.targetId, event.data.widgetId, event.data.targetInstanceId)
                if (!match || !primaryNodeTarget(match)?.richText) return
                match.contentEditable = 'true'
                match.focus()
                const selection = window.getSelection()
                const selectionInside = Boolean(selection?.rangeCount && match.contains(selection.getRangeAt(0).commonAncestorContainer))
                if (!selectionInside) {
                    const range = document.createRange()
                    range.selectNodeContents(match)
                    selection?.removeAllRanges()
                    selection?.addRange(range)
                }
                const value = event.data.command === 'formatBlock' && event.data.value
                    ? `<${event.data.value.replace(/[<>]/g, '')}>`
                    : event.data.value || undefined
                document.execCommand(event.data.command, false, value)
                postDesignerEvent(match, modelRef.current?.designer, 'contentChange')
            }
        }
        window.addEventListener('message', receive)
        window.parent.postMessage({ source: 'eceee-render-frame', action: 'ready' }, '*')
        return () => window.removeEventListener('message', receive)
    }, [])

    useLayoutEffect(() => {
        if (!model || !rootRef.current) return undefined
        return applyDesignerOverlay(model, rootRef.current, focusStateRef.current)
    }, [model])

    const handleNavigate = (href: string) => {
        window.parent.postMessage({ source: 'eceee-render-frame', action: 'navigate', href }, '*')
    }

    return <RenderDocument
        model={model}
        rootRef={rootRef}
        additionalCss={DESIGNER_CSS}
        onNavigate={handleNavigate}
    />
}

export default RenderFrameRuntime
