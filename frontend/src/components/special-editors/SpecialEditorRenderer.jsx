/**
 * SpecialEditorRenderer Component
 * 
 * Renders the appropriate special editor based on widget type.
 * This component serves as a registry and renderer for different special editors.
 */
import React from 'react'
import MediaSpecialEditor from './MediaSpecialEditor'

// Registry of special editors mapped to widget types
const SPECIAL_EDITORS = {
    'core_widgets.ImageWidget': MediaSpecialEditor,
    // Future editors can be added here:
    // 'core_widgets.FormsWidget': FormsSpecialEditor,
    // 'core_widgets.TableWidget': TableSpecialEditor,
    // 'custom_widgets.ChartWidget': ChartSpecialEditor,
}

// Function to check if a widget type has a special editor
export const hasSpecialEditor = (widgetType) => {
    return widgetType && SPECIAL_EDITORS[widgetType] !== undefined
}

// Function to get the special editor component for a widget type
export const getSpecialEditor = (widgetType) => {
    return SPECIAL_EDITORS[widgetType] || null
}

const SpecialEditorRenderer = ({
    widgetData,
    specialEditorWidth = 60,
    isAnimating = false,
    isClosing = false,
    onConfigChange
}) => {
    if (!widgetData?.type || !hasSpecialEditor(widgetData.type)) {
        return null
    }

    const SpecialEditorComponent = getSpecialEditor(widgetData.type)

    if (!SpecialEditorComponent) {
        return null
    }

    return (
        <div
            className={`flex-shrink-0 border-r border-gray-200 bg-gray-50 transition-all duration-500 ease-out ${isAnimating ? 'animate-slide-in-left' : ''
                } ${isClosing ? 'animate-slide-out-left' : ''
                }`}
            style={{ width: `${specialEditorWidth}%` }}
        >
            <SpecialEditorComponent
                widgetData={widgetData}
                isAnimating={isAnimating}
                isClosing={isClosing}
                onConfigChange={onConfigChange}
            />
        </div>
    )
}

SpecialEditorRenderer.displayName = 'SpecialEditorRenderer'

export default SpecialEditorRenderer
