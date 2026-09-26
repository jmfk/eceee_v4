import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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

const FRAME_CSS = `
html,body,#root{margin:0;min-height:100%;background:#fff}body{font-family:system-ui,sans-serif}
*,*::before,*::after{box-sizing:border-box}.site-renderer{min-height:100vh}.widget-item{position:relative}
.site-renderer .layout-slot{position:relative;display:flex;flex-direction:column;gap:0;min-height:0}
.site-renderer .layout-slot>.widget-item:not(:last-child)>.banner-widget{margin-bottom:30px}
.two-columns-widget{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.three-columns-widget{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.hero-widget,.banner-widget,.content-card-widget,.bio-widget{position:relative}.hero-background,.image-widget img,.content-card-widget img,.bio-widget img{max-width:100%;height:auto}.navbar-widget{min-height:28px}.navbar-desktop-menu{display:flex;position:relative;justify-content:space-between;align-items:center;height:28px;width:100%}.navbar-menu-list{display:flex;gap:1.5rem;list-style:none;margin:0;padding:0 0 0 20px;align-items:center}.navbar-secondary-menu{margin-left:auto;padding-left:0}.navbar-mobile-menu{position:absolute;top:100%;left:0;width:16rem;background:#fff;box-shadow:0 10px 15px -3px rgba(0,0,0,.1);z-index:50;border:1px solid #e5e7eb;padding:.5rem 0}.navbar-mobile-menu a{display:block;padding:.5rem 1rem;font-size:.875rem;color:#374151;text-decoration:none}
.forms-widget{display:grid;gap:12px}.forms-widget label{display:grid;gap:4px}.table-widget{overflow:auto}.table-widget table{width:100%;border-collapse:collapse}.table-widget th,.table-widget td{padding:8px;border:1px solid #d1d5db;text-align:left}
.news-items{display:grid;gap:18px}.news-item{display:grid;gap:12px}.render-error-state{border:1px solid #fecaca;background:#fef2f2}
.designer-preview [data-designer-target]{cursor:pointer}.designer-guides [data-designer-target]{outline:1px dashed rgba(100,116,139,.5)!important;outline-offset:-1px}.designer-guides [data-designer-target]:hover{outline:2px dashed #2563eb!important}[data-designer-target].designer-selected{outline:3px solid #2563eb!important;outline-offset:-3px!important}
.designer-spacing-guide{position:fixed!important;pointer-events:none!important;z-index:2147483646!important}.designer-spacing-margin{border:1px dashed rgba(217,119,6,.7)!important;background:rgba(245,158,11,.04)!important}.designer-spacing-padding{border:1px dashed rgba(8,145,178,.75)!important;box-shadow:inset 0 0 0 1px rgba(6,182,212,.08)!important}.designer-spacing-readout{position:fixed!important;z-index:2147483647!important;max-width:420px;padding:5px 7px;border:1px solid rgba(15,23,42,.18);border-radius:5px;background:rgba(255,255,255,.97);color:#334155;font:600 10px/1.35 system-ui,sans-serif;pointer-events:none!important}
@media(max-width:767px){.two-columns-widget,.three-columns-widget{grid-template-columns:1fr}}
`

const computedThemeValues = (node: HTMLElement) => {
    const style = getComputedStyle(node)
    return Object.fromEntries(Object.entries(DESIGNER_STYLE_PROPERTIES).map(([name, cssName]) => [name, style.getPropertyValue(cssName)]))
}

const postDesignerEvent = (node: HTMLElement, action = 'select') => {
    const targets = JSON.parse(node.dataset.designerTargets || '[]')
    const primary = targets[0]
    if (!primary) return
    window.parent.postMessage({
        source: 'eceee-designer-preview', action, targetId: primary.id, kind: primary.kind,
        label: primary.label, text: node.innerText || '', editable: primary.editable,
        computedStyles: computedThemeValues(node),
        alternatives: targets.map((target: any) => ({ ...target, text: node.innerText || '', computedStyles: computedThemeValues(node) })),
    }, '*')
}

const registerTarget = (node: HTMLElement, target: any) => {
    let targets: any[] = []
    try { targets = JSON.parse(node.dataset.designerTargets || '[]') } catch { targets = [] }
    if (!targets.some((candidate) => candidate.id === target.id)) targets.push(target)
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
    const clearGuides = () => { guides.forEach((guide) => guide.remove()); guides = [] }
    const showSpacing = (node: HTMLElement) => {
        clearGuides()
        if (designer.guidesEnabled === false) return
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        const number = (name: string) => Number.parseFloat(style.getPropertyValue(name)) || 0
        const margin = { top: number('margin-top'), right: number('margin-right'), bottom: number('margin-bottom'), left: number('margin-left') }
        const padding = { top: number('padding-top'), right: number('padding-right'), bottom: number('padding-bottom'), left: number('padding-left') }
        const marginGuide = document.createElement('div')
        marginGuide.className = 'designer-spacing-guide designer-spacing-margin'
        Object.assign(marginGuide.style, { left: `${rect.left - margin.left}px`, top: `${rect.top - margin.top}px`, width: `${rect.width + margin.left + margin.right}px`, height: `${rect.height + margin.top + margin.bottom}px` })
        const paddingGuide = document.createElement('div')
        paddingGuide.className = 'designer-spacing-guide designer-spacing-padding'
        Object.assign(paddingGuide.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` })
        const readout = document.createElement('div')
        readout.className = 'designer-spacing-readout'
        readout.textContent = `Margin: ${margin.top}px ${margin.right}px ${margin.bottom}px ${margin.left}px · Padding: ${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`
        Object.assign(readout.style, { left: `${Math.max(6, rect.left)}px`, top: `${Math.max(6, rect.top - 28)}px` })
        document.body.append(marginGuide, paddingGuide, readout)
        guides = [marginGuide, paddingGuide, readout]
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
                        const editable = designer.contentEditable !== false
                            && ['A', 'BLOCKQUOTE', 'CODE', 'EM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'P', 'PRE', 'SPAN', 'STRONG'].includes(node.tagName)
                        registerTarget(node, { id: element.id, kind: 'element', label: element.label, editable })
                        if (designer.texts[element.id] !== undefined) node.textContent = designer.texts[element.id]
                        if (editable) node.contentEditable = 'true'
                    })
                } catch { /* Invalid theme selector metadata is ignored in preview. */ }
            })
        })
    })

    root.querySelectorAll<HTMLElement>('[data-designer-target]').forEach((node) => {
        const click = (event: Event) => { event.preventDefault(); event.stopPropagation(); root.querySelectorAll('.designer-selected').forEach((selected) => selected.classList.remove('designer-selected')); node.classList.add('designer-selected'); postDesignerEvent(node) }
        const input = () => postDesignerEvent(node, 'contentChange')
        const over = (event: Event) => { event.stopPropagation(); showSpacing(node) }
        node.addEventListener('click', click)
        node.addEventListener('input', input)
        node.addEventListener('mouseover', over)
        node.addEventListener('mouseout', clearGuides)
        cleanups.push(() => { node.removeEventListener('click', click); node.removeEventListener('input', input); node.removeEventListener('mouseover', over); node.removeEventListener('mouseout', clearGuides) })
    })
    return () => { clearGuides(); cleanups.forEach((cleanup) => cleanup()) }
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
