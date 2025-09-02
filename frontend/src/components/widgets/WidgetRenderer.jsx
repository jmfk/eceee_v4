import React from 'react'
import { Layout } from 'lucide-react'
import { getNewFormatWidgetComponent } from './widgetRegistry'

/**
 * Shared widget renderer component that can be used by both ContentEditor and ObjectContentEditor
 * Renders individual widgets based on their type and configuration
 */

const WidgetRenderer = ({ widget, mode = 'preview', className = '' }) => {
    // Validate widget
    if (!widget || !widget.type) {
        return (
            <div className={`widget-renderer-error ${className}`}>
                <div className="text-red-600 text-sm p-2 border border-red-200 rounded bg-red-50">
                    <strong>Widget Error:</strong> Invalid widget configuration
                </div>
            </div>
        )
    }

    // Get the appropriate widget component (NEW FORMAT ONLY)
    const WidgetComponent = getNewFormatWidgetComponent(widget.type)

    if (WidgetComponent) {
        // Use the dedicated widget component
        return (
            <div className={`widget-renderer ${className}`}>
                <WidgetComponent
                    config={widget.config || {}}
                    mode={mode}
                    widget={widget}
                />
            </div>
        )
    }

    // Fallback for unknown widget types
    const widgetTypeName = widget.name || widget.type || 'Unknown Widget'
    const config = widget.config || {}

    return (
        <div className={`widget-renderer widget-renderer-fallback ${className}`}>
            <div className="generic-widget text-center p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded">
                <Layout className="h-6 w-6 mx-auto mb-2 text-gray-400" />
                <div className="text-sm font-medium text-gray-700">{widgetTypeName}</div>
                <div className="text-xs text-gray-500 mt-1">
                    {config.title || config.content || 'Widget content will appear here'}
                </div>
            </div>
        </div>
    )
}

export default WidgetRenderer
