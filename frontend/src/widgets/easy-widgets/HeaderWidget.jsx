import React, { useState } from 'react'
import { Image as ImageIcon, Palette } from 'lucide-react'
import DesignGroupsInfoModal from '../../components/DesignGroupsInfoModal'

/**
 * EASY Header Widget Component
 * 
 * Uses design groups for styling and images.
 * Images are configured in the theme's design groups under layoutProperties.
 * CSS variables control background images, heights, and positioning per breakpoint.
 */
const HeaderWidget = ({ config = {}, mode = 'preview' }) => {
    // Simple markup, styled by design groups CSS
    return (
        <div className="widget-type-header header-widget"></div>
    )
}

// === COLOCATED METADATA ===
HeaderWidget.displayName = 'HeaderWidget'
HeaderWidget.widgetType = 'easy_widgets.HeaderWidget'

// Default configuration (empty - styling controlled by design groups)
HeaderWidget.defaultConfig = {}

// Display metadata
HeaderWidget.metadata = {
    name: 'Header',
    description: 'Header widget styled by theme design groups',
    category: 'layout',
    icon: ImageIcon,
    tags: ['eceee', 'header', 'theme', 'layout']
}

// Custom actions for widget header toolbar
HeaderWidget.customActions = (widget, context) => {
    return <DesignGroupsButton themeId={context?.themeId} />
}

// Design Groups button component
const DesignGroupsButton = ({ themeId }) => {
    const [showModal, setShowModal] = useState(false)

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                title="View design groups styling"
            >
                <Palette className="h-3 w-3" />
            </button>
            {showModal && (
                <DesignGroupsInfoModal
                    widgetType="HeaderWidget"
                    themeId={themeId}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    )
}

export default HeaderWidget
