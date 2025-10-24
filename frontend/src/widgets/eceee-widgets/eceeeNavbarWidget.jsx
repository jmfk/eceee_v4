import React from 'react'
import { Menu } from 'lucide-react'

/**
 * Extract URL from image object
 * Handles both plain strings and image objects with metadata
 */
const getImageUrl = (image) => {
    if (!image) return null
    if (typeof image === 'string') return image

    // Check various URL fields in priority order
    return image.imgproxyBaseUrl ||
        image.imgproxy_base_url ||
        image.fileUrl ||
        image.file_url ||
        image.url ||
        null
}

/**
 * ECEEE Navbar Widget Component
 * Renders a navigation bar with configurable menu items
 */
const eceeeNavbarWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        menuItems = [],
        backgroundImage = null,
        backgroundPosition = 'center',
        backgroundColor = null,
    } = config

    const renderMenuItems = (items) => {
        if (!items || items.length === 0) {
            if (mode === 'editor') {
                return (
                    <li className="text-white text-sm opacity-50">
                        No menu items added yet
                    </li>
                )
            }
            return null
        }

        return items.map((item, index) => (
            <li key={index}>
                <a
                    href={mode === 'editor' ? '#' : item.url}
                    data-href={item.url}
                    target={item.targetBlank ? '_blank' : undefined}
                    rel={item.targetBlank ? 'noopener noreferrer' : undefined}
                    className="text-white text-sm font-medium no-underline hover:opacity-80 transition-opacity"
                >
                    {item.label}
                </a>
            </li>
        ))
    }

    // Extract image URL from image object or string
    const imageUrl = getImageUrl(backgroundImage)

    // Build inline styles for background
    const navStyles = {
        ...(imageUrl && {
            backgroundImage: `url('${imageUrl}')`,
            backgroundSize: 'cover',
            backgroundPosition: backgroundPosition,
            backgroundRepeat: 'no-repeat',
        }),
        ...(backgroundColor && { backgroundColor }),
    }

    // Determine if we should use default background color
    const shouldUseDefaultBg = !imageUrl && !backgroundColor

    return (
        <nav
            className={`shadow-sm h-[28px] ${shouldUseDefaultBg ? 'bg-blue-500' : ''}`}
            style={navStyles}
        >
            <ul
                className="flex gap-6 m-0 p-0 pl-[20px] items-center h-full"
                style={{ listStyle: 'none' }}
            >
                {renderMenuItems(menuItems)}
            </ul>
        </nav>
    )
}

// === COLOCATED METADATA ===
eceeeNavbarWidget.displayName = 'NavbarWidget'
eceeeNavbarWidget.widgetType = 'eceee_widgets.NavbarWidget'

// Default configuration
eceeeNavbarWidget.defaultConfig = {
    menuItems: [],
    backgroundImage: null,
    backgroundPosition: 'center',
    backgroundColor: null,
}

// Display metadata
eceeeNavbarWidget.metadata = {
    name: 'ECEEE Navbar',
    description: 'Navigation bar with configurable menu items',
    category: 'layout',
    icon: Menu,
    tags: ['eceee', 'navbar', 'navigation', 'menu', 'nav']
}

export default eceeeNavbarWidget

