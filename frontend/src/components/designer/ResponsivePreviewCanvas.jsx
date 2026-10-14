import { useEffect, useRef, useState } from 'react'
import { Maximize2, Monitor, Smartphone, Tablet, X } from 'lucide-react'
import { createPortal } from 'react-dom'

import RenderFrame from '../../rendering/RenderFrame'

const previewSizes = {
    mobile: { label: 'Mobile', width: 375, icon: Smartphone },
    tablet: { label: 'Tablet', width: 768, icon: Tablet },
    desktop: { label: 'Desktop', width: 1440, icon: Monitor },
}

const PreviewSurface = ({ model, title, viewport }) => {
    const containerRef = useRef(null)
    const [size, setSize] = useState({ width: 0, height: 0 })
    const canvasWidth = previewSizes[viewport].width
    const availableWidth = size.width || canvasWidth + 24
    const availableHeight = size.height || 720
    const scale = Math.min(1, Math.max(0.2, (availableWidth - 24) / canvasWidth))
    const renderedHeight = Math.max(720, Math.round((availableHeight - 24) / scale))
    const viewportModel = {
        ...model,
        context: { ...model.context, previewViewport: viewport },
    }

    useEffect(() => {
        const node = containerRef.current
        if (!node || typeof ResizeObserver === 'undefined') return undefined
        const update = () => {
            const rectangle = node.getBoundingClientRect()
            setSize({ width: rectangle.width, height: rectangle.height })
        }
        update()
        const observer = new ResizeObserver(update)
        observer.observe(node)
        return () => observer.disconnect()
    }, [])

    return <div ref={containerRef} className="relative min-h-0 flex-1 overflow-auto bg-gray-100">
        <div
            className="absolute top-3 overflow-hidden border border-gray-300 bg-white shadow-sm"
            style={{
                left: '50%',
                width: `${canvasWidth}px`,
                height: `${renderedHeight}px`,
                transform: `translateX(-50%) scale(${scale})`,
                transformOrigin: 'center top',
            }}
        >
            <RenderFrame model={viewportModel} title={title} className="h-full w-full border-0" />
        </div>
    </div>
}

const ViewportControls = ({ viewport, onChange }) => <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5" aria-label="Preview size">
    {Object.entries(previewSizes).map(([key, definition]) => {
        const Icon = definition.icon
        return <button
            key={key}
            type="button"
            aria-label={`Preview at ${definition.label.toLowerCase()} width`}
            aria-pressed={viewport === key}
            title={`${definition.label} · ${definition.width}px`}
            onClick={() => onChange(key)}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded px-2.5 text-xs font-medium ${viewport === key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
        ><Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{definition.label}</span></button>
    })}
</div>

const ResponsivePreviewCanvas = ({ model, title, initialViewport = 'desktop', toolbarStart = null }) => {
    const [viewport, setViewport] = useState(initialViewport)
    const [expanded, setExpanded] = useState(false)

    useEffect(() => {
        if (!expanded) return undefined
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const closeOnEscape = (event) => { if (event.key === 'Escape') setExpanded(false) }
        window.addEventListener('keydown', closeOnEscape)
        return () => {
            document.body.style.overflow = previousOverflow
            window.removeEventListener('keydown', closeOnEscape)
        }
    }, [expanded])

    const toolbar = <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2">
        <div className="min-w-0 flex-1">{toolbarStart}</div>
        <div className="flex items-center gap-2">
            <span className="hidden text-xs tabular-nums text-gray-500 md:inline">{previewSizes[viewport].width}px</span>
            <ViewportControls viewport={viewport} onChange={setViewport} />
            <button type="button" onClick={() => setExpanded(true)} className="inline-flex min-h-8 items-center gap-1.5 rounded border border-gray-300 px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50" aria-label="Open full-screen preview"><Maximize2 className="h-3.5 w-3.5" />Full screen</button>
        </div>
    </div>

    return <>
        <div className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
            {toolbar}
            <PreviewSurface model={model} title={title} viewport={viewport} />
        </div>
        {expanded && createPortal(<div role="dialog" aria-modal="true" aria-label={`${title} full-screen preview`} className="fixed inset-0 z-[100] flex flex-col bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-2">
                <div className="min-w-0"><h2 className="truncate text-sm font-semibold text-gray-900">{title}</h2><p className="text-xs text-gray-500">Unsaved workspace preview · {previewSizes[viewport].width}px</p></div>
                <div className="flex items-center gap-2"><ViewportControls viewport={viewport} onChange={setViewport} /><button type="button" autoFocus onClick={() => setExpanded(false)} className="inline-flex min-h-9 items-center gap-1.5 rounded border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-50" aria-label="Close full-screen preview"><X className="h-4 w-4" />Close</button></div>
            </div>
            <PreviewSurface model={model} title={`${title} full screen`} viewport={viewport} />
        </div>, document.body)}
    </>
}

export default ResponsivePreviewCanvas
