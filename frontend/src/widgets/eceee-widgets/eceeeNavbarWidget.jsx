import React from 'react'
import { Menu } from 'lucide-react'

/**
 * ECEEE Navbar Widget Component
 * Renders a navigation bar with configurable menu items
 */
const eceeeNavbarWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        menuItems = [],
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

    return (
        <nav className="bg-blue-500 shadow-sm h-[28px]">
            <ul className="flex gap-6 list-none m-0 p-0 pl-[20px] items-center h-full">
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

