import React, { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Keep children mounted when collapsed so form state and editor subscriptions survive.
export default function ObjectEditorPanel({ side, title, initialWidth = 260, children }) {
    const [width, setWidth] = useState(initialWidth)
    const [collapsed, setCollapsed] = useState(false)
    const drag = useRef(null)
    const clamp = value => Math.max(200, Math.min(640, value))
    const CollapseIcon = (side === 'left') !== collapsed ? ChevronLeft : ChevronRight

    return (
        <aside aria-label={title} className="relative flex shrink-0 flex-col border-gray-200 bg-white"
            style={{ width: collapsed ? 40 : width, borderRightWidth: side === 'left' ? 1 : 0, borderLeftWidth: side === 'right' ? 1 : 0 }}>
            <div className={`flex min-h-10 items-center ${collapsed ? 'justify-center' : 'justify-between px-3'}`}>
                {!collapsed && <span className="text-sm font-medium text-gray-700">{title}</span>}
                <button type="button" aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${title}`} aria-expanded={!collapsed}
                    title={`${collapsed ? 'Expand' : 'Collapse'} ${title}`} onClick={() => setCollapsed(value => !value)}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500">
                    <CollapseIcon className="h-4 w-4" />
                </button>
            </div>
            <div hidden={collapsed} className="min-h-0 flex-1 overflow-auto">{children}</div>
            {!collapsed && <div role="separator" aria-label={`Resize ${title}`} aria-orientation="vertical"
                aria-valuemin={200} aria-valuemax={640} aria-valuenow={width} tabIndex={0}
                className={`absolute inset-y-0 z-10 w-2 cursor-col-resize touch-none hover:bg-blue-200 focus-visible:bg-blue-200 focus-visible:outline-none ${side === 'left' ? '-right-1' : '-left-1'}`}
                onKeyDown={event => {
                    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                    event.preventDefault()
                    const direction = (event.key === 'ArrowRight' ? 1 : -1) * (side === 'left' ? 1 : -1)
                    setWidth(value => event.key === 'Home' ? 200 : event.key === 'End' ? 640 : clamp(value + direction * 20))
                }}
                onPointerDown={event => {
                    event.preventDefault()
                    drag.current = { x: event.clientX, width: event.currentTarget.parentElement.getBoundingClientRect().width }
                    event.currentTarget.setPointerCapture(event.pointerId)
                }}
                onPointerMove={event => {
                    if (drag.current) setWidth(clamp(drag.current.width + (event.clientX - drag.current.x) * (side === 'left' ? 1 : -1)))
                }}
                onPointerUp={event => {
                    drag.current = null
                    event.currentTarget.releasePointerCapture(event.pointerId)
                }}
                onPointerCancel={() => { drag.current = null }}
                onLostPointerCapture={() => { drag.current = null }}
            />}
        </aside>
    )
}
