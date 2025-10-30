import React, { useState } from 'react'
import { usePageChildren } from '../../hooks/usePageStructure'
import { Menu, X, ChevronDown } from 'lucide-react'

/**
 * ECEEE Navigation Widget Component
 * Renders navigation menus with dropdowns, mobile support, and branding
 */
const NavigationWidget = ({ config = {}, mode = 'preview', context = {}, }) => {
    const {
        menuItems = [],
        menus = {},
    } = config
    const pageId = context?.pageId
    const pageVersionData = context?.pageVersionData
    const { data: children, isLoading, error } = usePageChildren(pageId)

    let localMenu = []
    if (children && children.length > 0 && menus.activeGroup === "pageSections") {
        const slotName = menus.formData.pageSections.slotName
        const slotWidgets = (pageVersionData?.widgets[slotName] || []).filter(widget => {
            const anchor = widget.config?.anchor
            return anchor && typeof anchor === 'string' && anchor.trim() !== ''
        })
        localMenu = slotWidgets.map((child) => { return { id: `section-${child.config.anchor}`, label: child.config.anchor, url: child.config.anchor } })
    }
    if (children && children.length > 0 && menus.activeGroup === "pageSubmenu") {
        localMenu = children.map((child) => { return { id: `submenu-${child.page.id}`, label: child.page.title, url: child.page.path } })
    }


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
                    {localMenu && renderMenuItems(localMenu)}
                    {renderMenuItems(menuItems)}
                </ul>
            </nav>

        )
    }

    return (
        <nav className="navigation-widget">
            <ul className="nav-container">
                {localMenu && renderMenuItems(localMenu)}
                {renderMenuItems(menuItems)}
            </ul>
        </nav>

    )
}

// === COLOCATED METADATA ===
NavigationWidget.displayName = 'NavigationWidget'
NavigationWidget.widgetType = 'easy_widgets.NavigationWidget'

// Default configuration
NavigationWidget.defaultConfig = {

    menuItems: [],
}

// Display metadata
NavigationWidget.metadata = {
    name: 'ECEEE Navigation',
    description: 'Navigation menus with dropdowns, mobile hamburger menu, and branding support',
    category: 'layout',
    icon: Menu,
    tags: ['eceee', 'navigation', 'menu', 'nav', 'mobile', 'dropdown', 'brand', 'header']
}

export default NavigationWidget
