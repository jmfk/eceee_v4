import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import PageRenderer from './PageRenderer'
import { RENDER_LAYOUT_CSS } from './layoutRenderers'
import { PUBLIC_RENDER_CSS } from './publicRenderCss'
import { rewriteDirectRenderHref } from './directRenderNavigation'
import type { RenderPageModel } from './types'

interface RenderDocumentProps {
    model: RenderPageModel | null
    rootRef?: RefObject<HTMLDivElement | null>
    additionalCss?: string
    onNavigate?: (href: string) => void
}

export const RenderDocument = ({ model, rootRef, additionalCss = '', onNavigate }: RenderDocumentProps) => {
    const localRootRef = useRef<HTMLDivElement>(null)
    const renderRootRef = rootRef || localRootRef

    useLayoutEffect(() => {
        const routePrefix = model?.context.renderRoutePrefix
        const root = renderRootRef.current
        if (!routePrefix || !root) return
        root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
            const href = anchor.getAttribute('href') || ''
            anchor.setAttribute('href', rewriteDirectRenderHref(href, {
                routePrefix,
                currentPath: model.context.simulatedPath,
                siteHostnames: model.context.siteHostnames,
            }))
        })
    }, [model, renderRootRef])

    useEffect(() => {
        const root = renderRootRef.current
        if (!model || !root) return

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
                    onNavigate?.(href)
                }
                return
            }
            if (routePrefix && href.startsWith('#')) return
            event.preventDefault()
        }

        root.addEventListener('click', preventNavigation)
        root.addEventListener('submit', preventNavigation)
        return () => {
            root.removeEventListener('click', preventNavigation)
            root.removeEventListener('submit', preventNavigation)
        }
    }, [model, onNavigate, renderRootRef])

    return <>
        <style>{`${PUBLIC_RENDER_CSS}\n${additionalCss}\n${RENDER_LAYOUT_CSS}`}</style>
        {model?.fontUrl && <link rel="stylesheet" href={model.fontUrl} />}
        {model?.themeCss && <style>{model.themeCss}</style>}
        <div ref={renderRootRef} className={model?.designer
            ? `designer-preview${model.designer.guidesEnabled === false ? '' : ' designer-guides'}${model.designer.layoutCanvas ? ' layout-designer-preview' : ''}`
            : ''}>{model
            ? <PageRenderer model={model} />
            : <div className="p-4 text-gray-500">Preparing preview…</div>}</div>
    </>
}

export default RenderDocument
