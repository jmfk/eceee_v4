import React from 'react'
import { Type } from 'lucide-react'

/**
 * Text Block Widget Component
 * Renders text content with optional title and styling
 */
const TextBlockWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        title = '',
        content = 'Text content will appear here...',
        style = 'normal',
        alignment = 'left'
    } = config

    const alignmentClasses = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
        justify: 'text-justify'
    }

    const styleClasses = {
        normal: '',
        lead: 'text-lg leading-relaxed',
        small: 'text-sm',
        large: 'text-xl'
    }

    if (mode === 'editor') {
        return (
            <div className="text-widget-editor p-2 border border-dashed border-gray-300 rounded">
                <div className="flex items-center mb-2">
                    <Type className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-600">Text Block</span>
                </div>
                {title && (
                    <h3 className={`font-semibold text-gray-900 mb-2 ${alignmentClasses[alignment]}`}>
                        {title}
                    </h3>
                )}
                <div
                    className={`text-gray-700 ${styleClasses[style]} ${alignmentClasses[alignment]}`}
                    dangerouslySetInnerHTML={{ __html: content }}
                />
            </div>
        )
    }

    return (
        <div className={`text-widget ${alignmentClasses[alignment]}`}>
            {title && (
                <h3 className="font-semibold text-gray-900 mb-2">
                    {title}
                </h3>
            )}
            <div
                className={`text-gray-700 ${styleClasses[style]}`}
                dangerouslySetInnerHTML={{ __html: content }}
            />
        </div>
    )
}

// === COLOCATED METADATA ===
TextBlockWidget.displayName = 'TextBlockWidget'
TextBlockWidget.widgetType = 'core_widgets.TextBlockWidget'

// Default configuration
TextBlockWidget.defaultConfig = {
    title: '',
    content: 'Click to edit this content...',
    style: 'normal',
    alignment: 'left'
}

// Display metadata
TextBlockWidget.metadata = {
    name: 'Text Block',
    description: 'Rich text content block with title and formatting options',
    category: 'content',
    icon: Type,
    tags: ['text', 'content', 'paragraph', 'rich text']
}

export default TextBlockWidget
