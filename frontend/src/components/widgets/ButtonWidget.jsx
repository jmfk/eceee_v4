import React from 'react'
import { MousePointer } from 'lucide-react'

/**
 * Button Widget Component
 * Renders clickable buttons with configurable styles
 */
const ButtonWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        text = 'Button',
        url = '#',
        style = 'primary',
        target = '_self',
        alignment = 'center'
    } = config

    const alignmentClasses = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right'
    }

    const getButtonClasses = (buttonStyle) => {
        const baseClasses = 'inline-block px-6 py-2 rounded transition-colors font-medium'

        switch (buttonStyle) {
            case 'secondary':
                return `${baseClasses} bg-gray-600 text-white hover:bg-gray-700`
            case 'outline':
                return `${baseClasses} border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white`
            case 'ghost':
                return `${baseClasses} text-blue-600 hover:bg-blue-50`
            case 'danger':
                return `${baseClasses} bg-red-600 text-white hover:bg-red-700`
            default: // primary
                return `${baseClasses} bg-blue-600 text-white hover:bg-blue-700`
        }
    }

    if (mode === 'editor') {
        return (
            <div className="button-widget-editor p-2 border border-dashed border-gray-300 rounded">
                <div className="flex items-center mb-2">
                    <MousePointer className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-600">Button</span>
                </div>
                <div className={alignmentClasses[alignment]}>
                    <span className={getButtonClasses(style)}>
                        {text}
                    </span>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                    Links to: {url}
                </div>
            </div>
        )
    }

    return (
        <div className={`button-widget ${alignmentClasses[alignment]}`}>
            <a
                href={url}
                target={target}
                rel={target === '_blank' ? 'noopener noreferrer' : undefined}
                className={getButtonClasses(style)}
            >
                {text}
            </a>
        </div>
    )
}

ButtonWidget.displayName = 'ButtonWidget'
ButtonWidget.widgetType = 'core_widgets.ButtonWidget'
ButtonWidget.defaultConfig = {
    text: 'Click me',
    url: '#',
    style: 'primary',
    target: '_self',
    alignment: 'center'
}

export default ButtonWidget
