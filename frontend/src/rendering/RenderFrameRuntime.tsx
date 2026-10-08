import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import PageRenderer from './PageRenderer'
import { RENDER_LAYOUT_CSS } from './layoutRenderers'
import { PUBLIC_RENDER_CSS } from './publicRenderCss'
import type { RenderFrameMessage, RenderPageModel } from './types'
import { normalizeCssName } from './primitives'
import { rewriteDirectRenderHref } from './directRenderNavigation'

const DESIGNER_STYLE_PROPERTIES: Record<string, string> = {
    fontFamily: 'font-family', fontSize: 'font-size', fontWeight: 'font-weight', fontStyle: 'font-style',
    lineHeight: 'line-height', letterSpacing: 'letter-spacing',
    margin: 'margin', marginTop: 'margin-top', marginRight: 'margin-right', marginBottom: 'margin-bottom', marginLeft: 'margin-left',
    padding: 'padding', paddingTop: 'padding-top', paddingRight: 'padding-right', paddingBottom: 'padding-bottom', paddingLeft: 'padding-left',
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

const FRAME_CSS = `${PUBLIC_RENDER_CSS}
    .designer-preview [data-designer-target]{cursor:pointer}[data-designer-target].designer-selected-slot{outline:3px solid #eab308!important;outline-offset:-3px!important}[data-designer-target].designer-selected-widget{box-shadow:inset 0 0 0 3px #16a34a!important}[data-designer-target].designer-selected-element{outline:3px solid #2563eb!important;outline-offset:-3px!important}[data-designer-target].designer-selected-widget.designer-selected-element{box-shadow:inset 0 0 0 3px #16a34a,0 0 0 3px #2563eb!important}[data-designer-target].designer-highlighted{outline:3px dashed #d97706!important;outline-offset:2px!important;box-shadow:0 0 0 3px rgba(245,158,11,.2)!important}[data-designer-target].designer-selected.designer-highlighted{outline-offset:-3px!important}[data-designer-target].designer-selected-slot.designer-highlighted{outline:3px solid #eab308!important;outline-offset:-3px!important}[data-designer-target].designer-selected-widget.designer-highlighted{outline:3px dashed #d97706!important;outline-offset:2px!important;box-shadow:inset 0 0 0 3px #16a34a!important}[data-designer-target].designer-selected-element.designer-highlighted{outline:3px solid #2563eb!important;outline-offset:-3px!important}[data-designer-target].designer-selected-widget.designer-selected-element.designer-highlighted{outline:3px dashed #d97706!important;outline-offset:2px!important;box-shadow:inset 0 0 0 3px #16a34a,0 0 0 3px #2563eb!important}.designer-guides .designer-hovered:not(.designer-selected):not(.designer-highlighted){outline:2px dotted #2563eb!important;outline-offset:-2px!important}
.designer-context-menu{position:fixed!important;z-index:2147483647!important;min-width:180px!important;max-width:260px!important;padding:6px!important;border:1px solid #d1d5db!important;border-radius:8px!important;background:#fff!important;box-shadow:0 10px 24px rgba(15,23,42,.2)!important;color:#111827!important;font:500 13px/1.35 system-ui,sans-serif!important}.designer-context-menu-title{overflow:hidden!important;padding:5px 8px 7px!important;color:#6b7280!important;font-size:11px!important;font-weight:600!important;text-overflow:ellipsis!important;white-space:nowrap!important}.designer-context-menu button{display:block!important;width:100%!important;padding:7px 8px!important;border:0!important;border-radius:5px!important;background:transparent!important;color:#111827!important;font:inherit!important;text-align:left!important;cursor:pointer!important}.designer-context-menu button:hover,.designer-context-menu button:focus-visible{background:#eff6ff!important;color:#1d4ed8!important;outline:none!important}
.designer-spacing-guide{position:fixed!important;pointer-events:none!important;z-index:2147483644!important}.designer-spacing-margin{background:rgba(245,158,11,.22)!important}.designer-spacing-padding{background:rgba(6,182,212,.2)!important}.designer-spacing-content{border:1px dashed rgba(8,145,178,.8)!important}.designer-spacing-measure{position:fixed!important;z-index:2147483645!important;background:#fff!important;box-shadow:0 0 0 1px rgba(0,0,0,.9)!important;pointer-events:none!important}.designer-spacing-measure::before,.designer-spacing-measure::after{content:""!important;position:absolute!important;background:#fff!important;box-shadow:0 0 0 1px rgba(0,0,0,.9)!important}.designer-spacing-measure-horizontal{height:1px!important}.designer-spacing-measure-horizontal::before,.designer-spacing-measure-horizontal::after{top:50%!important;width:1px!important;height:7px!important;transform:translateY(-50%)}.designer-spacing-measure-horizontal::before{left:0!important}.designer-spacing-measure-horizontal::after{right:0!important}.designer-spacing-measure-vertical{width:1px!important}.designer-spacing-measure-vertical::before,.designer-spacing-measure-vertical::after{left:50%!important;width:7px!important;height:1px!important;transform:translateX(-50%)}.designer-spacing-measure-vertical::before{top:0!important}.designer-spacing-measure-vertical::after{bottom:0!important}.designer-spacing-value{position:fixed!important;z-index:2147483645!important;transform:translate(-50%,-50%);padding:2px 3px!important;border:0!important;border-radius:3px!important;background:#fff!important;font:700 10px/1 system-ui,sans-serif;white-space:nowrap;pointer-events:none!important;box-shadow:0 0 0 1px rgba(255,255,255,.9)!important}.designer-spacing-value[data-editable="true"]{pointer-events:auto!important;cursor:pointer!important;box-shadow:0 0 0 1px currentColor!important}.designer-spacing-value[data-editable="true"]:hover,.designer-spacing-value[data-editable="true"]:focus-visible{outline:2px solid #2563eb!important;outline-offset:1px!important}.designer-spacing-margin-value{color:#92400e}.designer-spacing-padding-value{color:#0e7490}.designer-spacing-editor{position:fixed!important;z-index:2147483647!important;display:flex!important;gap:4px!important;padding:5px!important;border:1px solid #93c5fd!important;border-radius:6px!important;background:#fff!important;box-shadow:0 8px 24px rgba(15,23,42,.22)!important}.designer-spacing-editor input{width:72px!important;padding:5px 6px!important;border:1px solid #d1d5db!important;border-radius:4px!important;font:500 12px/1.2 system-ui,sans-serif!important}.designer-spacing-editor button{padding:5px 7px!important;border:0!important;border-radius:4px!important;background:#2563eb!important;color:#fff!important;font:600 12px/1.2 system-ui,sans-serif!important;cursor:pointer!important}
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
    && nodeTargets(node).some((target: any) => target.id === targetId)
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
        const targets = nodeTargets(descendant)
        const primary = targets[0]
        const widgetNode = descendant.closest<HTMLElement>('[data-widget-id]')
        const widgetType = widgetNode?.dataset.widgetType || ''
        const widgetId = widgetNode?.dataset.widgetId || ''
        const instanceKey = `${widgetId}:${primary?.id || ''}:${primary?.instanceId || ''}`
        if (!primary?.id || seen.has(instanceKey)) return null
        seen.add(instanceKey)
        const parentNode = descendant.parentElement?.closest<HTMLElement>('[data-designer-target]') || null
        const parentId = parentNode && (parentNode === node || node.contains(parentNode)) ? nodeTargets(parentNode)[0]?.id || '' : ''
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
        const target = first && preferredTarget ? preferredTarget : nodeTargets(current)[0]
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
    : target?.kind === 'widget'
        ? 'widget'
        : 'element'

const selectionPaths = (node: HTMLElement, preferredTarget?: any) => {
    const paths: Record<'slot' | 'widget' | 'element', any[]> = { slot: [], widget: [], element: [] }
    const selectionRank = { slot: 0, widget: 1, element: 2 }
    const preferredKind = selectionKind(preferredTarget)
    const seen = new Set<string>()
    let current: HTMLElement | null = node
    let first = true
    while (current) {
        const targets = nodeTargets(current)
        const candidates = first && preferredTarget
            ? [preferredTarget, ...targets.filter((target: any) => target.id !== preferredTarget.id)]
            : targets
        ;(['slot', 'widget', 'element'] as const).forEach((kind) => {
            if (first && preferredTarget && selectionRank[kind] > selectionRank[preferredKind]) return
            const target = candidates.find((candidate: any) => selectionKind(candidate) === kind)
            const widgetNode = current?.closest<HTMLElement>('[data-widget-id]')
            const widgetId = target?.widgetId || widgetNode?.dataset.widgetId || ''
            const key = `${kind}:${widgetId}:${target?.id || ''}:${target?.instanceId || ''}`
            if (!target?.id || seen.has(key)) return
            seen.add(key)
            paths[kind].unshift({
                ...target,
                widgetType: target.widgetType || widgetNode?.dataset.widgetType || '',
                widgetId,
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

const ancestorTargets = (node: HTMLElement, designer: NonNullable<RenderPageModel['designer']>) => {
    const seen = new Set<string>()
    const ancestors: any[] = []
    let foundTypography = false
    let foundSpacing = false
    let ancestor = node.parentElement?.closest<HTMLElement>('[data-designer-target]') || null
    while (ancestor) {
        nodeTargets(ancestor).forEach((target: any) => {
            const typographyTarget = Boolean(designer.editableTypographyTargets?.[target.id])
            const spacingTarget = Boolean(designer.editableSpacingTargets?.[target.id])
            if (!target.id || seen.has(target.id) || (!typographyTarget || foundTypography) && (!spacingTarget || foundSpacing)) return
            seen.add(target.id)
            ancestors.push({ ...target, computedStyles: computedThemeValues(ancestor) })
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
    window.parent.postMessage({
        source: 'eceee-designer-preview', action, targetId: primary.id, kind: primary.kind,
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
        computedStyles: computedThemeValues(node),
        alternatives: targets.map((target: any) => ({
            ...target,
            widgetType: target.widgetType || widgetNode?.dataset.widgetType || '',
            widgetId: target.widgetId || widgetNode?.dataset.widgetId || '',
            text: editableValue(node, Boolean(target.richText || richText)),
            richText: Boolean(target.richText || richText),
            computedStyles: computedThemeValues(node),
        })),
        path: targetPath(node, primary),
        selectionPaths: selectionPaths(node, primary),
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
    highlightedTargetId: string
    highlightedWidgetId: string
    highlightedInstanceId: string
}

const applyDesignerOverlay = (model: RenderPageModel, root: HTMLElement, focusState: DesignerFocusState) => {
    const designer = model.designer
    if (!designer) return () => undefined
    const cleanups: Array<() => void> = []
    let guides: HTMLElement[] = []
    let hoveredNode: HTMLElement | null = null
    let selectedNode: HTMLElement | null = null
    let contextMenu: HTMLElement | null = null
    let spacingEditor: { element: HTMLFormElement, node: HTMLElement, property: string } | null = null
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
    const closeSpacingEditor = () => { spacingEditor?.element.remove(); spacingEditor = null }
    const positionSpacingEditor = (editor: HTMLFormElement, labelLeft: number, labelTop: number) => {
        const gap = 12
        const width = editor.offsetWidth || 164
        const height = editor.offsetHeight || 44
        const left = Math.max(8, Math.min(window.innerWidth - width - 8, labelLeft - width / 2))
        const preferredTop = labelTop + gap
        const top = preferredTop + height <= window.innerHeight - 8
            ? preferredTop
            : Math.max(8, labelTop - height - gap)
        Object.assign(editor.style, { left: `${left}px`, top: `${top}px` })
    }
    const removeGuides = () => { guides.forEach((guide) => guide.remove()); guides = [] }
    const clearGuides = () => {
        removeGuides()
        hoveredNode?.classList.remove('designer-hovered')
        hoveredNode = null
    }
    const showSpacing = (node: HTMLElement) => {
        removeGuides()
        hoveredNode?.classList.remove('designer-hovered')
        hoveredNode = node
        node.classList.add('designer-hovered')
        if (designer.guidesEnabled === false) return
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        const number = (name: string) => Number.parseFloat(style.getPropertyValue(name)) || 0
        const margin = { top: number('margin-top'), right: number('margin-right'), bottom: number('margin-bottom'), left: number('margin-left') }
        const padding = { top: number('padding-top'), right: number('padding-right'), bottom: number('padding-bottom'), left: number('padding-left') }
        const border = { top: number('border-top-width'), right: number('border-right-width'), bottom: number('border-bottom-width'), left: number('border-left-width') }
        const addGuide = (
            className: string,
            left: number,
            top: number,
            width: number,
            height: number,
            side?: string,
            spacing?: 'margin' | 'padding',
            value?: number,
        ) => {
            if (width <= 0 || height <= 0) return
            const guide = document.createElement('div')
            guide.className = `designer-spacing-guide ${className}`
            guide.setAttribute('aria-hidden', 'true')
            if (side) guide.dataset.side = side
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
            measure.className = `designer-spacing-measure designer-spacing-measure-${horizontalMeasure ? 'horizontal' : 'vertical'} designer-spacing-${spacing}-measure`
            measure.setAttribute('aria-hidden', 'true')
            if (side) measure.dataset.side = side
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
            label.className = `designer-spacing-value designer-spacing-${spacing}-value`
            if (side) label.dataset.side = side
            label.textContent = `${value}px`
            const labelWidth = Math.max(20, label.textContent.length * 6)
            const labelHeight = 14
            const labelGap = 3
            const halfWidth = labelWidth / 2
            const halfHeight = labelHeight / 2
            let labelLeft = (visibleLeft + visibleRight) / 2
            let labelTop = (visibleTop + visibleBottom) / 2
            const keepOutsidePositionVisible = (preferred: number, halfSize: number, viewportSize: number) => Math.min(viewportSize - halfSize, Math.max(halfSize, preferred))
            if ((side === 'top' || side === 'bottom') && visibleBottom - visibleTop < labelHeight + 4) {
                const above = visibleTop - halfHeight - labelGap
                const below = visibleBottom + halfHeight + labelGap
                labelTop = keepOutsidePositionVisible(side === 'top' ? above : below, halfHeight, viewportHeight)
                label.dataset.placement = 'outside'
            } else if ((side === 'left' || side === 'right') && visibleRight - visibleLeft < labelWidth + 4) {
                const before = visibleLeft - halfWidth - labelGap
                const after = visibleRight + halfWidth + labelGap
                labelLeft = keepOutsidePositionVisible(side === 'left' ? before : after, halfWidth, viewportWidth)
                label.dataset.placement = 'outside'
            }
            labelLeft = Math.min(viewportWidth - halfWidth, Math.max(halfWidth, labelLeft))
            labelTop = Math.min(viewportHeight - halfHeight, Math.max(halfHeight, labelTop))
            Object.assign(label.style, {
                left: `${labelLeft}px`,
                top: `${labelTop}px`,
            })
            const property = `${spacing}${side ? side[0].toUpperCase() + side.slice(1) : ''}`
            const targetIds: string[] = []
            let targetNode: HTMLElement | null = node
            while (targetNode && root.contains(targetNode)) {
                nodeTargets(targetNode).forEach((target: any) => {
                    if (target.id && !targetIds.includes(target.id)) targetIds.push(target.id)
                })
                targetNode = targetNode.parentElement?.closest<HTMLElement>('[data-designer-target]') || null
            }
            const editable = targetIds.some((targetId) => designer.editableSpacingTargets?.[targetId]?.includes(property))
            label.setAttribute('aria-hidden', editable ? 'false' : 'true')
            if (editable) {
                label.dataset.editable = 'true'
                label.tabIndex = 0
                label.setAttribute('role', 'button')
                label.setAttribute('aria-label', `Edit ${spacing} ${side}`)
                const openEditor = (event: Event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    closeSpacingEditor()
                    const editor = document.createElement('form')
                    editor.className = 'designer-spacing-editor'
                    editor.setAttribute('aria-label', `Edit ${spacing} ${side}`)
                    const input = document.createElement('input')
                    input.setAttribute('aria-label', `${spacing} ${side} value`)
                    input.value = `${value}px`
                    const save = document.createElement('button')
                    save.type = 'submit'
                    save.textContent = 'Apply'
                    editor.append(input, save)
                    const applyValue = () => {
                        if (!editor.isConnected) return
                        window.parent.postMessage({
                            source: 'eceee-designer-preview', action: 'spacingChange', targetIds, property,
                            value: input.value.trim(), viewportWidth: window.innerWidth,
                        }, '*')
                        closeSpacingEditor()
                    }
                    editor.addEventListener('submit', (submitEvent) => {
                        submitEvent.preventDefault()
                        applyValue()
                    })
                    save.addEventListener('click', (clickEvent) => {
                        clickEvent.preventDefault()
                        applyValue()
                    })
                    input.addEventListener('keydown', (keyEvent) => {
                        if (keyEvent.key === 'Escape') {
                            keyEvent.preventDefault()
                            keyEvent.stopPropagation()
                            closeSpacingEditor()
                            showSpacing(node)
                            return
                        }
                        if (keyEvent.key === 'Enter') {
                            keyEvent.preventDefault()
                            applyValue()
                            return
                        }
                        if (keyEvent.key !== 'ArrowUp' && keyEvent.key !== 'ArrowDown') return
                        const match = input.value.match(/^\s*(-?(?:\d+(?:\.\d*)?|\.\d+))\s*([a-z%]*)\s*$/i)
                        if (!match) return
                        keyEvent.preventDefault()
                        const direction = keyEvent.key === 'ArrowUp' ? 1 : -1
                        const step = keyEvent.shiftKey ? 10 : 1
                        const nextValue = Math.round((Number(match[1]) + direction * step) * 1000) / 1000
                        input.value = `${nextValue}${match[2] || 'px'}`
                        input.select()
                    })
                    document.body.append(editor)
                    spacingEditor = { element: editor, node, property }
                    positionSpacingEditor(editor, labelLeft, labelTop)
                    input.focus()
                    input.select()
                }
                label.addEventListener('click', openEditor)
                label.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') openEditor(event)
                })
            }
            document.body.append(label)
            guides.push(label)
            if (spacingEditor?.node === node && spacingEditor.property === property) {
                positionSpacingEditor(spacingEditor.element, labelLeft, labelTop)
            }
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
        addGuide('designer-spacing-content', contentLeft, contentTop, contentWidth, contentHeight)
    }
    const groups = designer.catalog?.designGroups || []
    const layouts = designer.catalog?.layouts || []
    const layout = layouts.find((candidate: any) => candidate.key === model.layout)

    root.querySelectorAll<HTMLElement>('[data-slot-name]').forEach((node) => {
        const slotName = node.dataset.slotName || ''
        if (!slotName) return
        const slot = (layout?.slots || []).find((candidate: any) => candidate.name === slotName)
        registerTarget(node, {
            id: `layout:${model.layout}:slot:${slotName}`,
            kind: 'layoutSlot',
            label: slot?.label || slotName.replace(/[-_]+/g, ' ').replace(/^./, (character) => character.toUpperCase()),
            editable: false,
        })
    })

    const widgetRoots = [...root.querySelectorAll<HTMLElement>('[data-widget-id][data-widget-type]')]
    widgetRoots.forEach((node) => {
        const widgetId = node.dataset.widgetId || ''
        const widgetType = node.dataset.widgetType || ''
        if (!widgetId) return
        registerTarget(node, {
            id: `widget:${widgetId}`,
            kind: 'widget',
            label: `${widgetTypeLabel(node) || 'Widget'} widget`,
            widgetId,
            widgetType,
            editable: false,
        })
    })

    root.querySelectorAll<HTMLElement>('[data-slot]').forEach((node) => {
        const slotName = node.dataset.slot || ''
        const owner = node.parentElement?.closest<HTMLElement>('[data-widget-id]')
        const ownerWidgetId = owner?.dataset.widgetId || ''
        if (!slotName || !ownerWidgetId) return
        registerTarget(node, {
            id: `slot:${ownerWidgetId}:${slotName}`,
            kind: 'slot',
            label: `${slotName.replace(/[-_]+/g, ' ').replace(/^./, (character) => character.toUpperCase())} slot`,
            widgetId: ownerWidgetId,
            widgetType: owner?.dataset.widgetType || '',
            editable: false,
        }, true)
    })

    groups.forEach((group: any) => {
        const roots = new Set<HTMLElement>()
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
        const allowedSlots = new Set<string>(group.slots || [])
        const groupWidgetTypes = new Set<string>((group.widgetTypes || []).map(widgetTypeKey))
        widgetRoots.forEach((node) => {
            if (!groupWidgetTypes.has(widgetTypeKey(node.dataset.widgetType || ''))) return
            const slotName = node.closest<HTMLElement>('[data-slot-name]')?.dataset.slotName || ''
            if (allowedSlots.size && !allowedSlots.has(slotName)) return
            roots.add(node)
        })
        if (!(group.widgetTypes || []).length) {
            if (allowedSlots.size) {
                allowedSlots.forEach((slot) => {
                    root.querySelectorAll<HTMLElement>(`.slot-${normalizeCssName(slot)}`).forEach(registerElements)
                })
            } else {
                registerElements(root)
            }
            return
        }
        roots.forEach((groupRoot) => {
            registerTarget(groupRoot, { id: group.id, kind: 'group', label: group.label, editable: false })
            ;(group.parts || []).forEach((part: any) => groupRoot.querySelectorAll<HTMLElement>(`.${normalizeCssName(part.part)}`).forEach((node) => registerTarget(node, { id: part.id, kind: 'part', label: part.label, editable: false })))
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
        const restoredTarget = nodeTargets(restoredSelection)
            .find((target: any) => target.id === focusState.selectedTargetId)
        applySelectionClasses(root, restoredSelection, restoredTarget)
        selectedNode = restoredSelection
        showSpacing(restoredSelection)
    }
    restoredHighlight?.classList.add('designer-highlighted')

    root.querySelectorAll<HTMLElement>('[data-designer-target]').forEach((node) => {
        const click = (event: Event) => { if (!node.isContentEditable) event.preventDefault(); event.stopPropagation(); applySelectionClasses(root, node); root.querySelectorAll('.designer-highlighted').forEach((highlighted) => highlighted.classList.remove('designer-highlighted')); selectedNode = node; focusState.selectedTargetId = nodeTargets(node)[0]?.id || ''; focusState.selectedWidgetId = node.closest<HTMLElement>('[data-widget-id]')?.dataset.widgetId || ''; focusState.selectedInstanceId = designerInstanceId(node); focusState.highlightedTargetId = ''; focusState.highlightedWidgetId = ''; focusState.highlightedInstanceId = ''; showSpacing(node); postDesignerEvent(node, designer) }
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
                JSON.parse(targetNode.dataset.designerTargets || '[]').forEach((target: any) => {
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
        applySelectionClasses(root, eventNode, primary)
        selectedNode = eventNode
        focusState.selectedTargetId = primary.id
        focusState.selectedWidgetId = eventNode.closest<HTMLElement>('[data-widget-id]')?.dataset.widgetId || ''
        focusState.selectedInstanceId = designerInstanceId(eventNode)
        focusState.highlightedTargetId = ''
        focusState.highlightedWidgetId = ''
        focusState.highlightedInstanceId = ''
        showSpacing(eventNode)
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
        imageTargets.forEach((target) => addAction(imageTargets.length > 1 ? `Replace ${target.label}` : 'Replace image', target, 'replaceImage', () => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml'
            input.hidden = true
            input.addEventListener('change', () => {
                const file = input.files?.[0]
                if (file) postDesignerEvent(eventNode, designer, 'contextAction', target, { command: 'replaceImage', file })
                input.remove()
            }, { once: true })
            document.body.append(input)
            window.addEventListener('focus', () => window.setTimeout(() => input.remove(), 0), { once: true })
            input.click()
        }))

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
    const dismissSpacingEditor = (event: Event) => {
        if (spacingEditor && !(event.target instanceof Node && spacingEditor.element.contains(event.target))) {
            closeSpacingEditor()
        }
    }
    const dismissSpacingEditorOnBlur = () => closeSpacingEditor()
    const dismissOverlaysWithKeyboard = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return
        closeContextMenu()
        const pinnedNode = spacingEditor?.node
        closeSpacingEditor()
        if (pinnedNode && root.contains(pinnedNode)) showSpacing(pinnedNode)
    }
    root.addEventListener('contextmenu', openContextMenu)
    document.addEventListener('pointerdown', dismissContextMenu)
    document.addEventListener('pointerdown', dismissSpacingEditor)
    document.addEventListener('keydown', dismissOverlaysWithKeyboard)
    window.addEventListener('blur', dismissSpacingEditorOnBlur)
    const findHoveredNode = (target: EventTarget | null) => target instanceof HTMLElement ? target : null
    const over = (event: MouseEvent) => {
        if (spacingEditor) return
        const node = findHoveredNode(event.target)
        if (node && root.contains(node) && node !== hoveredNode) showSpacing(node)
    }
    const out = (event: MouseEvent) => {
        if (spacingEditor) {
            showSpacing(spacingEditor.node)
            return
        }
        if (!hoveredNode || (event.relatedTarget instanceof Node && hoveredNode.contains(event.relatedTarget))) return
        const next = findHoveredNode(event.relatedTarget)
        if (next && root.contains(next)) showSpacing(next)
        else if (selectedNode && root.contains(selectedNode)) showSpacing(selectedNode)
        else clearGuides()
    }
    const selectFromInspector = (event: Event) => {
        const node = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-designer-target]') : null
        if (!node || !root.contains(node)) return
        selectedNode = node
        showSpacing(node)
    }
    const clearFocus = () => {
        selectedNode = null
        closeContextMenu()
        closeSpacingEditor()
        clearGuides()
    }
    const refreshGuides = () => {
        const node = spacingEditor?.node || hoveredNode || selectedNode
        if (node && root.contains(node)) showSpacing(node)
    }
    root.addEventListener('mouseover', over)
    root.addEventListener('mouseout', out)
    root.addEventListener('designerselect', selectFromInspector)
    root.addEventListener('designerclear', clearFocus)
    window.addEventListener('scroll', refreshGuides, true)
    window.addEventListener('resize', refreshGuides)
    cleanups.push(() => {
        closeContextMenu()
        closeSpacingEditor()
        root.removeEventListener('contextmenu', openContextMenu)
        document.removeEventListener('pointerdown', dismissContextMenu)
        document.removeEventListener('pointerdown', dismissSpacingEditor)
        document.removeEventListener('keydown', dismissOverlaysWithKeyboard)
        window.removeEventListener('blur', dismissSpacingEditorOnBlur)
        root.removeEventListener('mouseover', over)
        root.removeEventListener('mouseout', out)
        root.removeEventListener('designerselect', selectFromInspector)
        root.removeEventListener('designerclear', clearFocus)
        window.removeEventListener('scroll', refreshGuides, true)
        window.removeEventListener('resize', refreshGuides)
    })
    return () => { clearGuides(); closeSpacingEditor(); cleanups.forEach((cleanup) => cleanup()) }
}

export const RenderFrameRuntime = () => {
    const [model, setModel] = useState<RenderPageModel | null>(null)
    const modelRef = useRef<RenderPageModel | null>(null)
    const rootRef = useRef<HTMLDivElement>(null)
    const focusStateRef = useRef<DesignerFocusState>({ selectedTargetId: '', selectedWidgetId: '', selectedInstanceId: '', highlightedTargetId: '', highlightedWidgetId: '', highlightedInstanceId: '' })

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
                focusStateRef.current.highlightedTargetId = ''
                focusStateRef.current.highlightedWidgetId = ''
                focusStateRef.current.highlightedInstanceId = ''
                clearSelectionClasses(document)
                document.querySelectorAll('.designer-highlighted').forEach((node) => node.classList.remove('designer-highlighted'))
                const match = findTargetNode(document, event.data.targetId, event.data.widgetId, event.data.targetInstanceId)
                const preferredTarget = match ? nodeTargets(match).find((target: any) => target.id === event.data.targetId) : null
                if (match) applySelectionClasses(document, match, preferredTarget)
                match?.dispatchEvent(new CustomEvent('designerselect', { bubbles: true }))
                if (match && preferredTarget) postDesignerEvent(match, modelRef.current?.designer, 'select', preferredTarget)
                match?.scrollIntoView?.({ block: 'nearest' })
            }
            if (event.data.action === 'clearTarget') {
                focusStateRef.current.selectedTargetId = ''
                focusStateRef.current.selectedWidgetId = ''
                focusStateRef.current.selectedInstanceId = ''
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
            if (event.data.action === 'readTargetStyles' && event.data.targetId) {
                const match = findTargetNode(document, event.data.targetId, event.data.widgetId, event.data.targetInstanceId)
                if (match) window.parent.postMessage({
                    source: 'eceee-designer-preview', action: 'targetStyles', targetId: event.data.targetId,
                    computedStyles: computedThemeValues(match),
                }, '*')
            }
            if (event.data.action === 'updateText' && event.data.targetId && typeof event.data.text === 'string') {
                const match = findTargetNode(document, event.data.targetId, event.data.widgetId, event.data.targetInstanceId)
                const richText = match ? nodeTargets(match)[0]?.richText : false
                if (match && richText && match.innerHTML !== event.data.text) match.innerHTML = DOMPurify.sanitize(event.data.text)
                if (match && !richText && match.textContent !== event.data.text) match.textContent = event.data.text
            }
            if (event.data.action === 'formatText' && event.data.targetId && event.data.command) {
                const match = findTargetNode(document, event.data.targetId, event.data.widgetId, event.data.targetInstanceId)
                if (!match || !nodeTargets(match)[0]?.richText) return
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

    useLayoutEffect(() => {
        const routePrefix = model?.context.renderRoutePrefix
        if (!routePrefix || !rootRef.current) return
        rootRef.current.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
            const href = anchor.getAttribute('href') || ''
            anchor.setAttribute('href', rewriteDirectRenderHref(href, {
                routePrefix,
                currentPath: model.context.simulatedPath,
                siteHostnames: model.context.siteHostnames,
            }))
        })
    }, [model])

    useEffect(() => {
        if (!model) return
        const preventNavigation = (event: Event) => {
            const target = event.target as HTMLElement
            const form = target.closest('form')
            if (form) {
                event.preventDefault()
                return
            }

            const anchor = target.closest<HTMLAnchorElement>('a[href]')
            if (!anchor) return
            const href = anchor.getAttribute('href') || ''
            const routePrefix = model.context.renderRoutePrefix
            if (routePrefix && (href === routePrefix || href.startsWith(`${routePrefix}/`))) {
                const mouseEvent = event as MouseEvent
                if (mouseEvent.button === 0 && !mouseEvent.metaKey && !mouseEvent.ctrlKey && !mouseEvent.shiftKey && !mouseEvent.altKey) {
                    event.preventDefault()
                    window.parent.postMessage({ source: 'eceee-render-frame', action: 'navigate', href }, '*')
                }
                return
            }
            if (routePrefix && href.startsWith('#')) return
            event.preventDefault()
        }
        document.addEventListener('click', preventNavigation)
        document.addEventListener('submit', preventNavigation)
        return () => { document.removeEventListener('click', preventNavigation); document.removeEventListener('submit', preventNavigation) }
    }, [model])

    return <>
        <style>{`${FRAME_CSS}\n${RENDER_LAYOUT_CSS}`}</style>
        {model?.fontUrl && <link rel="stylesheet" href={model.fontUrl} />}
        {model?.themeCss && <style>{model.themeCss}</style>}
        <div ref={rootRef} className={model?.designer
            ? `designer-preview${model.designer.guidesEnabled === false ? '' : ' designer-guides'}${model.designer.layoutCanvas ? ' layout-designer-preview' : ''}`
            : ''}>{model
            ? <PageRenderer model={model} />
            : <div className="p-4 text-gray-500">Preparing preview…</div>}</div>
    </>
}

export default RenderFrameRuntime
