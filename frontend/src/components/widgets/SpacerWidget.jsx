import React from 'react'
import { Space } from 'lucide-react'

/**
 * Spacer Widget Component
 * Creates vertical spacing between other widgets
 */
const SpacerWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        height = 'medium',
        custom_height: customHeight = '32px'
    } = config

    const getSpacerHeight = () => {
        switch (height) {
            case 'small':
                return '16px'
            case 'large':
                return '64px'
            case 'xlarge':
                return '96px'
            case 'custom':
                return customHeight
            default: // medium
                return '32px'
        }
    }

    const spacerHeight = getSpacerHeight()

    if (mode === 'editor') {
        return (
            <div className="spacer-widget-editor p-2 border border-dashed border-gray-300 rounded">
                <div className="flex items-center mb-2">
                    <Space className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-600">Spacer</span>
                </div>
                <div className="spacer-preview" style={{ height: spacerHeight }}>
                    <div className="h-full border-l-2 border-r-2 border-dashed border-gray-400 bg-gray-100 opacity-75 flex items-center justify-center">
                        <span className="text-xs text-gray-500">
                            {height === 'custom' ? `Custom (${customHeight})` : `${height.charAt(0).toUpperCase() + height.slice(1)} (${spacerHeight})`}
                        </span>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="spacer-widget" style={{ height: spacerHeight }}>
            {/* Invisible spacer for production */}
        </div>
    )
}

// === COLOCATED METADATA ===
SpacerWidget.displayName = 'SpacerWidget'
SpacerWidget.widgetType = 'core_widgets.SpacerWidget'

// Default configuration
SpacerWidget.defaultConfig = {
    height: 'medium',
    custom_height: '32px'
}

// Display metadata
SpacerWidget.metadata = {
    name: 'Spacer',
    description: 'Vertical spacing element for layout control',
    category: 'layout',
    icon: Space,
    tags: ['spacer', 'spacing', 'layout', 'divider']
}

export default SpacerWidget
