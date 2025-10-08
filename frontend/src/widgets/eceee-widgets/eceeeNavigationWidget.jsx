import React, { useState } from 'react'
import { Menu, X, ChevronDown } from 'lucide-react'

/**
 * ECEEE Navigation Widget Component
 * Renders navigation menus with dropdowns, mobile support, and branding
 */
const eceeeNavigationWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        menuItems = [],
    } = config

    const renderMenuItems = (items) => {
        return items.map((item, index) => (
            <li key={index} className="">
                <a href="#" data-href={item.url} className="">{item.label}</a>
            </li >
        ))
    }

    if (mode === 'editor') {
        return (
            <nav className="navigation-widget">
                <ul className="nav-container">
                    {renderMenuItems(menuItems)}
                </ul>
            </nav>

        )
    }

    return (
        <nav className="navigation-widget">
            <ul className="nav-container">
                {renderMenuItems(menuItems)}
            </ul>
        </nav>

    )
}

// === COLOCATED METADATA ===
eceeeNavigationWidget.displayName = 'NavigationWidget'
eceeeNavigationWidget.widgetType = 'eceee_widgets.NavigationWidget'

// Default configuration
eceeeNavigationWidget.defaultConfig = {

    menuItems: [],
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
