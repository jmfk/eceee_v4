import React from 'react'
import { Image as ImageIcon } from 'lucide-react'

/**
 * ECEEE Header Widget Component
 * Simple header widget that displays an image
 */
const eceeeHeaderWidget = ({ config = {}, mode = 'preview' }) => {
    const { image } = config

    // Editor mode: show placeholder if no image
    if (mode === 'editor') {
        if (!image) {
            return (
                <div className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center text-gray-400">
                    <ImageIcon className="w-12 h-12 mb-2" />
                    <p className="text-sm">No header image selected</p>
                    <p className="text-xs mt-1">Configure this widget to add an image</p>
                </div>
            )
        }

        return (
            <div className="w-full">
                <img
                    src={image}
                    alt="Header Image"
                    className="w-full h-auto block"
                />
            </div>
        )
    }

    // Preview mode: only render if image exists
    if (!image) {
        return null
    }

    return (
        <div className="w-full">
            <img
                src={image}
                alt="Header Image"
                className="w-full h-auto block"
            />
        </div>
    )
}

// === COLOCATED METADATA ===
eceeeHeaderWidget.displayName = 'HeaderWidget'
eceeeHeaderWidget.widgetType = 'eceee_widgets.HeaderWidget'

// Default configuration
eceeeHeaderWidget.defaultConfig = {
    image: null
}

// Display metadata
eceeeHeaderWidget.metadata = {
    name: 'Header',
    description: 'Simple header widget with image',
    category: 'layout',
    icon: ImageIcon,
    tags: ['eceee', 'header', 'image', 'layout']
}

export default eceeeHeaderWidget
