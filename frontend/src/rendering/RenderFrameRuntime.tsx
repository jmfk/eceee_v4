import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import PageRenderer from './PageRenderer'
import { RENDER_LAYOUT_CSS } from './layoutRenderers'
import type { RenderFrameMessage, RenderPageModel } from './types'
import { normalizeCssName } from './primitives'
import { rewriteDirectRenderHref } from './directRenderNavigation'

const DESIGNER_STYLE_PROPERTIES: Record<string, string> = {
    fontFamily: 'font-family', fontSize: 'font-size', fontWeight: 'font-weight', fontStyle: 'font-style',
    lineHeight: 'line-height', letterSpacing: 'letter-spacing',
    margin: 'margin', marginTop: 'margin-top', marginRight: 'margin-right', marginBottom: 'margin-bottom', marginLeft: 'margin-left',
    padding: 'padding', paddingTop: 'padding-top', paddingRight: 'padding-right', paddingBottom: 'padding-bottom', paddingLeft: 'padding-left',
}

const EDITABLE_TEXT_SELECTOR = 'a,blockquote,code,em,h1,h2,h3,h4,h5,h6,li,p,pre,span,strong'
const RICH_TEXT_SELECTOR = '.content-widget,.banner-text,.object-data-preview-field dd'
const editableTextLabel = (node: HTMLElement) => {
    if (/^H[1-6]$/.test(node.tagName)) return `Heading ${node.tagName.slice(1)} text`
    return ({ A: 'Link text', BLOCKQUOTE: 'Quote text', CODE: 'Code text', LI: 'List item text', P: 'Paragraph text', PRE: 'Preformatted text' } as Record<string, string>)[node.tagName] || 'Text'
}

const FRAME_CSS = `
html,body,#root{margin:0;min-height:100%;background:#fff}body{font-family:system-ui,sans-serif}
*,*::before,*::after{box-sizing:border-box}.site-renderer{min-height:100vh}.widget-item{position:relative}
.site-renderer .layout-slot{position:relative;display:flex;flex-direction:column;gap:0;min-height:0}
.site-renderer .layout-slot>.widget-item:not(:last-child)>.banner-widget{margin-bottom:30px}
.two-columns-widget{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.three-columns-widget{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.hero-widget,.banner-widget,.content-card-widget,.bio-widget{position:relative}.hero-background,.image-widget img,.content-card-widget img,.bio-widget img{max-width:100%;height:auto}.navbar-widget{min-height:28px}.navbar-desktop-menu{display:flex;position:relative;justify-content:space-between;align-items:center;height:28px;width:100%}.navbar-menu-list{display:flex;gap:1.5rem;list-style:none;margin:0;padding:0 0 0 20px;align-items:center}.navbar-secondary-menu{margin-left:auto;padding-left:0}.navbar-mobile-menu{position:absolute;top:100%;left:0;width:16rem;background:#fff;box-shadow:0 10px 15px -3px rgba(0,0,0,.1);z-index:50;border:1px solid #e5e7eb;padding:.5rem 0}.navbar-mobile-menu a{display:block;padding:.5rem 1rem;font-size:.875rem;color:#374151;text-decoration:none}
.forms-widget{display:grid;gap:12px}.forms-widget label{display:grid;gap:4px}.table-widget{overflow:auto}.table-widget table{width:100%;border-collapse:collapse}.table-widget th,.table-widget td{padding:8px;border:1px solid #d1d5db;text-align:left}
.news-items{display:grid;gap:18px}.news-item{display:grid;gap:12px}.render-error-state{border:1px solid #fecaca;background:#fef2f2}
.designer-preview [data-designer-target]{cursor:pointer}.designer-guides [data-designer-target]{outline:1px dashed rgba(100,116,139,.5)!important;outline-offset:-1px}[data-designer-target].designer-selected{outline:3px solid #2563eb!important;outline-offset:-3px!important}.designer-guides .designer-hovered{outline:2px dotted #2563eb!important;outline-offset:-2px!important}
.designer-context-menu{position:fixed!important;z-index:2147483647!important;min-width:180px!important;max-width:260px!important;padding:6px!important;border:1px solid #d1d5db!important;border-radius:8px!important;background:#fff!important;box-shadow:0 10px 24px rgba(15,23,42,.2)!important;color:#111827!important;font:500 13px/1.35 system-ui,sans-serif!important}.designer-context-menu-title{overflow:hidden!important;padding:5px 8px 7px!important;color:#6b7280!important;font-size:11px!important;font-weight:600!important;text-overflow:ellipsis!important;white-space:nowrap!important}.designer-context-menu button{display:block!important;width:100%!important;padding:7px 8px!important;border:0!important;border-radius:5px!important;background:transparent!important;color:#111827!important;font:inherit!important;text-align:left!important;cursor:pointer!important}.designer-context-menu button:hover,.designer-context-menu button:focus-visible{background:#eff6ff!important;color:#1d4ed8!important;outline:none!important}
.designer-spacing-guide{position:fixed!important;pointer-events:none!important;z-index:2147483646!important}.designer-spacing-margin{background:rgba(245,158,11,.22)!important}.designer-spacing-padding{background:rgba(6,182,212,.2)!important}.designer-spacing-content{border:1px dashed rgba(8,145,178,.8)!important}.designer-spacing-measure{position:fixed!important;z-index:2147483647!important;background:#fff!important;box-shadow:0 0 0 1px rgba(0,0,0,.9)!important;pointer-events:none!important}.designer-spacing-measure::before,.designer-spacing-measure::after{content:""!important;position:absolute!important;background:#fff!important;box-shadow:0 0 0 1px rgba(0,0,0,.9)!important}.designer-spacing-measure-horizontal{height:1px!important}.designer-spacing-measure-horizontal::before,.designer-spacing-measure-horizontal::after{top:50%!important;width:1px!important;height:7px!important;transform:translateY(-50%)}.designer-spacing-measure-horizontal::before{left:0!important}.designer-spacing-measure-horizontal::after{right:0!important}.designer-spacing-measure-vertical{width:1px!important}.designer-spacing-measure-vertical::before,.designer-spacing-measure-vertical::after{left:50%!important;width:7px!important;height:1px!important;transform:translateX(-50%)}.designer-spacing-measure-vertical::before{top:0!important}.designer-spacing-measure-vertical::after{bottom:0!important}.designer-spacing-value{position:fixed!important;z-index:2147483647!important;transform:translate(-50%,-50%);padding:2px 3px!important;border:0!important;border-radius:3px!important;background:#fff!important;font:700 10px/1 system-ui,sans-serif;white-space:nowrap;pointer-events:none!important;box-shadow:0 0 0 1px rgba(255,255,255,.9)!important}.designer-spacing-value[data-editable="true"]{pointer-events:auto!important;cursor:pointer!important;box-shadow:0 0 0 1px currentColor!important}.designer-spacing-value[data-editable="true"]:hover,.designer-spacing-value[data-editable="true"]:focus-visible{outline:2px solid #2563eb!important;outline-offset:1px!important}.designer-spacing-margin-value{color:#92400e}.designer-spacing-padding-value{color:#0e7490}.designer-spacing-editor{position:fixed!important;z-index:2147483647!important;display:flex!important;gap:4px!important;padding:5px!important;border:1px solid #93c5fd!important;border-radius:6px!important;background:#fff!important;box-shadow:0 8px 24px rgba(15,23,42,.22)!important}.designer-spacing-editor input{width:72px!important;padding:5px 6px!important;border:1px solid #d1d5db!important;border-radius:4px!important;font:500 12px/1.2 system-ui,sans-serif!important}.designer-spacing-editor button{padding:5px 7px!important;border:0!important;border-radius:4px!important;background:#2563eb!important;color:#fff!important;font:600 12px/1.2 system-ui,sans-serif!important;cursor:pointer!important}
@media(max-width:767px){.two-columns-widget,.three-columns-widget{grid-template-columns:1fr}}
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

const descendantTargets = (node: HTMLElement) => {
    const seen = new Set<string>()
    return [...node.querySelectorAll<HTMLElement>('[data-designer-target]')].flatMap((descendant) => nodeTargets(descendant).map((target: any) => ({
        ...target,
        text: editableValue(descendant, Boolean(target.richText)),
        sourceUrl: target.sourceUrl || (descendant instanceof HTMLImageElement ? descendant.currentSrc || descendant.src : ''),
        computedStyles: computedThemeValues(descendant),
    }))).filter((target: any) => target.id && !seen.has(target.id) && seen.add(target.id)).slice(0, 100)
}

const postDesignerEvent = (node: HTMLElement, action = 'select', preferredTarget?: any, extra: Record<string, unknown> = {}) => {
    const targets = JSON.parse(node.dataset.designerTargets || '[]')
    const primary = preferredTarget || targets[0]
    if (!primary) return
    const richText = Boolean(primary.richText || isRichTextNode(node))
    window.parent.postMessage({
        source: 'eceee-designer-preview', action, targetId: primary.id, kind: primary.kind,
        label: primary.label, text: editableValue(node, richText), editable: primary.editable, richText,
        sourceUrl: primary.sourceUrl || '',
        computedStyles: computedThemeValues(node),
        alternatives: targets.map((target: any) => ({ ...target, text: editableValue(node, Boolean(target.richText || richText)), richText: Boolean(target.richText || richText), computedStyles: computedThemeValues(node) })),
        descendants: descendantTargets(node),
        ...extra,
    }, '*')
}

const registerTarget = (node: HTMLElement, target: any, primary = false) => {
    let targets: any[] = []
    try { targets = JSON.parse(node.dataset.designerTargets || '[]') } catch { targets = [] }
    if (!targets.some((candidate) => candidate.id === target.id)) {
        if (primary) targets.unshift(target)
        else targets.push(target)
    }
    node.dataset.designerTargets = JSON.stringify(targets)
    node.dataset.designerTarget = targets[0].id
    node.dataset.designerKind = targets[0].kind
    node.dataset.designerLabel = targets[0].label
}

const applyDesignerOverlay = (model: RenderPageModel, root: HTMLElement) => {
    const designer = model.designer
    if (!designer) return () => undefined
    const cleanups: Array<() => void> = []
    let guides: HTMLElement[] = []
    let hoveredNode: HTMLElement | null = null
    let contextMenu: HTMLElement | null = null
    let spacingEditor: HTMLElement | null = null
    const closeContextMenu = () => { contextMenu?.remove(); contextMenu = null }
    const closeSpacingEditor = () => { spacingEditor?.remove(); spacingEditor = null }
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
                    Object.assign(editor.style, { left: `${Math.max(8, labelLeft - 45)}px`, top: `${Math.min(window.innerHeight - 44, labelTop + 12)}px` })
                    editor.addEventListener('submit', (submitEvent) => {
                        submitEvent.preventDefault()
                        window.parent.postMessage({ source: 'eceee-designer-preview', action: 'spacingChange', targetIds, property, value: input.value.trim() }, '*')
                        closeSpacingEditor()
                    })
                    document.body.append(editor)
                    spacingEditor = editor
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

    ;(layout?.slots || []).forEach((slot: any) => {
        root.querySelectorAll<HTMLElement>(`.slot-${slot.name}`).forEach((node) => registerTarget(node, { id: `layout:${model.layout}:slot:${slot.name}`, kind: 'layoutSlot', label: slot.label, editable: false }))
    })

    groups.forEach((group: any) => {
        const roots = new Set<HTMLElement>()
        ;(group.widgetTypes || []).forEach((type: string) => {
            const full = normalizeCssName(type)
            const short = normalizeCssName(type.split('.').pop()?.replace(/Widget$/i, '') || type)
            root.querySelectorAll<HTMLElement>(`.widget-type-${full},.widget-type-${short}`).forEach((node) => roots.add(node))
        })
        roots.forEach((groupRoot) => {
            registerTarget(groupRoot, { id: group.id, kind: 'group', label: group.label, editable: false })
            ;(group.parts || []).forEach((part: any) => groupRoot.querySelectorAll<HTMLElement>(`.${normalizeCssName(part.part)}`).forEach((node) => registerTarget(node, { id: part.id, kind: 'part', label: part.label, editable: false })))
            ;(group.assetKeys || []).forEach((assetKey: string) => {
                const asset = designer.assets.find((candidate: any) => candidate.assetKey === assetKey)
                const targetNode = asset?.part ? groupRoot.querySelector<HTMLElement>(`.${normalizeCssName(asset.part)}`) || groupRoot : groupRoot
                registerTarget(targetNode, { id: `asset:${assetKey}`, kind: 'asset', label: asset?.displayName || 'Theme image', editable: false })
            })
            ;(group.elements || []).forEach((element: any) => {
                const selector = element.element === 'a:hover' ? 'a' : element.element
                try {
                    groupRoot.querySelectorAll<HTMLElement>(selector).forEach((node) => {
                        registerTarget(node, { id: element.id, kind: 'element', label: element.label, editable: false })
                    })
                } catch { /* Invalid theme selector metadata is ignored in preview. */ }
            })
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
    root.querySelectorAll<HTMLElement>(EDITABLE_TEXT_SELECTOR).forEach((node) => {
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
        root.querySelectorAll<HTMLImageElement>('img[src]').forEach((node) => {
            const sourceUrl = node.currentSrc || node.src
            if (!sourceUrl) return
            registerTarget(node, {
                id: `content-image:${imageIndex}`,
                kind: 'previewImage',
                label: node.alt?.trim() || 'Content image',
                sourceUrl,
                editable: false,
            }, true)
            imageIndex += 1
        })
    }

    root.querySelectorAll<HTMLElement>('[data-designer-target]').forEach((node) => {
        const click = (event: Event) => { if (!node.isContentEditable) event.preventDefault(); event.stopPropagation(); root.querySelectorAll('.designer-selected').forEach((selected) => selected.classList.remove('designer-selected')); node.classList.add('designer-selected'); postDesignerEvent(node) }
        let primaryTarget: any = null
        try { primaryTarget = JSON.parse(node.dataset.designerTargets || '[]')[0] } catch { primaryTarget = null }
        const activateEditing = (event?: Event) => {
            if (!primaryTarget?.editable) return
            event?.preventDefault()
            event?.stopPropagation()
            root.querySelectorAll<HTMLElement>('[contenteditable="true"]').forEach((editable) => { if (editable !== node) editable.contentEditable = 'false' })
            node.contentEditable = 'true'
            node.focus()
            postDesignerEvent(node, 'editText', primaryTarget)
        }
        const input = (event: Event) => {
            if (!primaryTarget?.editable || !(event.target instanceof Node) || !node.contains(event.target)) return
            event.stopPropagation()
            postDesignerEvent(node, 'contentChange')
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
        root.querySelectorAll('.designer-selected').forEach((selected) => selected.classList.remove('designer-selected'))
        eventNode.classList.add('designer-selected')
        postDesignerEvent(eventNode, 'select', primary)

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
                else postDesignerEvent(eventNode, 'contextAction', target, { command })
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

        const assetTargets = targets.filter((target) => target.kind === 'asset')
        const imageTargets = assetTargets.length ? assetTargets : targets.filter((target) => target.kind === 'previewImage')
        imageTargets.forEach((target) => addAction(imageTargets.length > 1 ? `Replace ${target.label}` : 'Replace image', target, 'replaceImage', () => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml'
            input.hidden = true
            input.addEventListener('change', () => {
                const file = input.files?.[0]
                if (file) postDesignerEvent(eventNode, 'contextAction', target, { command: 'replaceImage', file })
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
    const dismissContextMenuWithKeyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') closeContextMenu() }
    root.addEventListener('contextmenu', openContextMenu)
    document.addEventListener('pointerdown', dismissContextMenu)
    document.addEventListener('keydown', dismissContextMenuWithKeyboard)
    const findHoveredNode = (target: EventTarget | null) => target instanceof HTMLElement ? target : null
    const over = (event: MouseEvent) => {
        const node = findHoveredNode(event.target)
        if (node && root.contains(node) && node !== hoveredNode) showSpacing(node)
    }
    const out = (event: MouseEvent) => {
        if (!hoveredNode || (event.relatedTarget instanceof Node && hoveredNode.contains(event.relatedTarget))) return
        const next = findHoveredNode(event.relatedTarget)
        if (next && root.contains(next)) showSpacing(next)
        else clearGuides()
    }
    const refreshGuides = () => { if (hoveredNode) showSpacing(hoveredNode) }
    root.addEventListener('mouseover', over)
    root.addEventListener('mouseout', out)
    window.addEventListener('scroll', refreshGuides, true)
    window.addEventListener('resize', refreshGuides)
    cleanups.push(() => {
        closeContextMenu()
        closeSpacingEditor()
        root.removeEventListener('contextmenu', openContextMenu)
        document.removeEventListener('pointerdown', dismissContextMenu)
        document.removeEventListener('keydown', dismissContextMenuWithKeyboard)
        root.removeEventListener('mouseover', over)
        root.removeEventListener('mouseout', out)
        window.removeEventListener('scroll', refreshGuides, true)
        window.removeEventListener('resize', refreshGuides)
    })
    return () => { clearGuides(); closeSpacingEditor(); cleanups.forEach((cleanup) => cleanup()) }
}

export const RenderFrameRuntime = () => {
    const [model, setModel] = useState<RenderPageModel | null>(null)
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const receive = (event: MessageEvent<RenderFrameMessage>) => {
            if (event.source !== window.parent) return
            if (event.data?.source !== 'eceee-render-host') return
            if (event.data.action === 'render' && event.data.model) {
                setModel(event.data.model)
            }
            if (event.data.action === 'selectTarget' && event.data.targetId) {
                document.querySelectorAll('.designer-selected').forEach((node) => node.classList.remove('designer-selected'))
                const match = [...document.querySelectorAll<HTMLElement>('[data-designer-target]')].find((node) => {
                    try { return JSON.parse(node.dataset.designerTargets || '[]').some((target: any) => target.id === event.data.targetId) } catch { return false }
                })
                match?.classList.add('designer-selected')
                match?.scrollIntoView({ block: 'nearest' })
            }
            if (event.data.action === 'readTargetStyles' && event.data.targetId) {
                const match = [...document.querySelectorAll<HTMLElement>('[data-designer-target]')].find((node) => {
                    try { return JSON.parse(node.dataset.designerTargets || '[]').some((target: any) => target.id === event.data.targetId) } catch { return false }
                })
                if (match) window.parent.postMessage({
                    source: 'eceee-designer-preview', action: 'targetStyles', targetId: event.data.targetId,
                    computedStyles: computedThemeValues(match),
                }, '*')
            }
            if (event.data.action === 'updateText' && event.data.targetId && typeof event.data.text === 'string') {
                const match = [...document.querySelectorAll<HTMLElement>('[data-designer-target]')].find((node) => {
                    try { return JSON.parse(node.dataset.designerTargets || '[]')[0]?.id === event.data.targetId } catch { return false }
                })
                const richText = match ? nodeTargets(match)[0]?.richText : false
                if (match && richText && match.innerHTML !== event.data.text) match.innerHTML = DOMPurify.sanitize(event.data.text)
                if (match && !richText && match.textContent !== event.data.text) match.textContent = event.data.text
            }
            if (event.data.action === 'formatText' && event.data.targetId && event.data.command) {
                const match = [...document.querySelectorAll<HTMLElement>('[data-designer-target]')].find((node) => nodeTargets(node)[0]?.id === event.data.targetId)
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
                postDesignerEvent(match, 'contentChange')
            }
        }
        window.addEventListener('message', receive)
        window.parent.postMessage({ source: 'eceee-render-frame', action: 'ready' }, '*')
        return () => window.removeEventListener('message', receive)
    }, [])

    useLayoutEffect(() => {
        if (!model || !rootRef.current) return undefined
        return applyDesignerOverlay(model, rootRef.current)
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
            ? `designer-preview${model.designer.guidesEnabled === false ? '' : ' designer-guides'}`
            : ''}>{model
            ? <PageRenderer model={model} />
            : <div className="p-4 text-gray-500">Preparing preview…</div>}</div>
    </>
}

export default RenderFrameRuntime
