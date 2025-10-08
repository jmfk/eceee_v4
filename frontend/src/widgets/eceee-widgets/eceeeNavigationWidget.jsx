import React, { useState } from 'react'
import { Menu, X, ChevronDown } from 'lucide-react'

/**
 * ECEEE Navigation Widget Component
 * Renders navigation menus with dropdowns, mobile support, and branding
 */
const eceeeNavigationWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        menu_items = [],
    } = config

    const [activeDropdown, setActiveDropdown] = useState(null)

    const renderMenuItems = (items, isMobile = false) => {
        return items.map((item, index) => (
            <li key={index} className={`nav-item ${item.children && dropdown_enabled ? 'nav-dropdown relative' : ''}`}>
                <a
                    href={item.url}
                    className={`nav-link block px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-100 hover:text-gray-900 ${item.is_active ? 'bg-blue-100 text-blue-900' : ''
                        }`}
                    onClick={item.children && dropdown_enabled ? (e) => {
                        e.preventDefault()
                        toggleDropdown(index)
                    } : undefined}
                >
                    {item.label}
                    {item.children && dropdown_enabled && (
                        <ChevronDown className={`inline-block ml-1 h-4 w-4 transition-transform ${activeDropdown === index ? 'rotate-180' : ''
                            }`} />
                    )}
                </a>

                {item.children && dropdown_enabled && (
                    <ul className={`nav-dropdown-menu absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-10 ${activeDropdown === index ? 'block' : 'hidden'
                        } ${isMobile ? 'relative w-full mt-0 border-0 shadow-none bg-gray-50' : ''}`}>
                        {item.children.map((child, childIndex) => (
                            <li key={childIndex} className="nav-dropdown-item">
                                <a
                                    href={child.url}
                                    className={`nav-dropdown-link block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 ${child.is_active ? 'bg-blue-50 text-blue-900' : ''
                                        }`}
                                >
                                    {child.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
            </li>
        ))
    }

    if (mode === 'editor') {
        return (
            <nav className="navigation-widget">
                <ul className="nav-container">
                    <li><a href="#">Nav row 1</a></li>
                </ul>
            </nav>

        )
    }

    return (
        <nav className="navigation-widget">
            <ul className="nav-container">
                <li><a href="">Nav row 1</a></li>
            </ul>
        </nav>

    )
}

// === COLOCATED METADATA ===
eceeeNavigationWidget.displayName = 'NavigationWidget'
eceeeNavigationWidget.widgetType = 'eceee_widgets.NavigationWidget'

// Default configuration
eceeeNavigationWidget.defaultConfig = {

    menu_items: [],
}

// Display metadata
eceeeNavigationWidget.metadata = {
    name: 'ECEEE Navigation',
    description: 'Navigation menus with dropdowns, mobile hamburger menu, and branding support',
    category: 'layout',
    icon: Menu,
    tags: ['eceee', 'navigation', 'menu', 'nav', 'mobile', 'dropdown', 'brand', 'header']
}

export default eceeeNavigationWidget
