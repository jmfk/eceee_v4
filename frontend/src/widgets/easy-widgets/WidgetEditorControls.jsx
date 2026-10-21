import React from 'react'
import { Image, RectangleHorizontal, Square } from 'lucide-react'

export const WidgetEditorButton = ({ children, ...props }) => <button
    type="button"
    className="inline-flex min-h-8 items-center gap-2 rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
    {...props}
>{children}</button>

export const ImageSizeButton = ({ value = 'square', onChange, allowOriginal = false }) => {
    const sizes = allowOriginal ? ['original', 'square', 'rectangle'] : ['square', 'rectangle']
    const next = sizes[(sizes.indexOf(value) + 1) % sizes.length]
    const label = value === 'rectangle' ? 'Rectangle' : value === 'original' ? 'Original' : 'Square'
    const Icon = value === 'rectangle' ? RectangleHorizontal : value === 'original' ? Image : Square
    return <WidgetEditorButton title={`Change image shape to ${next}`} onClick={() => onChange(next)}>
        <Icon className="h-4 w-4" />Image size: {label}
    </WidgetEditorButton>
}

export default function WidgetEditorControls({ mode, label, controls, children, picker }) {
    if (mode !== 'editor') return children
    return <div className="relative isolate min-h-10 group/widget-controls">
        <div role="toolbar" aria-label={`${label} controls`}
            className="eceee-editor-ui absolute right-2 top-2 z-10 flex max-w-[calc(100%-1rem)] flex-wrap items-center justify-end gap-2 opacity-0 pointer-events-none group-hover/widget-controls:opacity-100 group-hover/widget-controls:pointer-events-auto group-focus-within/widget-controls:opacity-100 group-focus-within/widget-controls:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto"
            onClick={event => event.stopPropagation()}>
            {controls}
        </div>
        <div className="relative z-0">{children}</div>
        {picker}
    </div>
}
