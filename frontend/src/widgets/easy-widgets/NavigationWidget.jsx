import React, { useState, useEffect } from 'react'
import { usePageChildren } from '../../hooks/usePageStructure'
import { Menu, X, ChevronDown } from 'lucide-react'
import ComponentStyleRenderer from '../../components/ComponentStyleRenderer'
import { prepareNavigationContext } from '../../utils/mustacheRenderer'
import { pagesApi } from '../../api'

/**
 * EASY Navigation Widget Component
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

    // State for owner page data (for inherited widgets)
    const [ownerPageData, setOwnerPageData] = useState(null)
    const [loadingOwnerPage, setLoadingOwnerPage] = useState(false)

    // Fetch owner page data if this widget is inherited
    useEffect(() => {
        const fetchOwnerPage = async () => {
            if (!context?.inheritedFrom?.id) {
                setOwnerPageData(null)
                return
            }

            try {
                setLoadingOwnerPage(true)
                const response = await pagesApi.get(context.inheritedFrom.id)
                setOwnerPageData(response)
            } catch (error) {
                console.error('[NavigationWidget] Failed to fetch owner page:', error)
                setOwnerPageData(null)
            } finally {
                setLoadingOwnerPage(false)
            }
        }

        fetchOwnerPage()
    }, [context?.inheritedFrom?.id])

    let localMenu = []
    if (children && children.length > 0 && menus.activeGroup === "pageSections") {
        const slotName = menus.formData?.pageSections?.slotName || menus.formData?.pageSections?.slot_name || "main"
        const slotWidgets = (pageVersionData?.widgets?.[slotName] || []).filter(widget => {
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

    // Check for Component Style rendering
    const navigationStyle = config.navigationStyle || config.navigation_style
    const theme = context?.pageVersionData?.effectiveTheme || context?.theme

    const hasComponentStyle = navigationStyle &&
        navigationStyle !== 'default' &&
        navigationStyle !== 'Default' &&
        theme?.componentStyles?.[navigationStyle]

    // If Component Style is selected, use Mustache rendering
    if (hasComponentStyle) {
        const style = theme.componentStyles[navigationStyle]

        // Prepare context for Mustache template
        const mustacheContext = prepareNavigationContext(
            { ...config, menuItems, dynamicMenuItems: localMenu },
            { ...context, children, pageData: context?.pageData },
            ownerPageData
        )

        return (
            <ComponentStyleRenderer
                template={style.template}
                context={mustacheContext}
                css={style.css}
                styleId={`nav-${navigationStyle}`}
                className="navigation-widget-component-style"
            />
        )
    }

    // Otherwise, use React rendering (existing code)
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
    name: 'Navigation',
    description: 'Navigation menus with dropdowns, mobile hamburger menu, and branding support',
    category: 'layout',
    icon: Menu,
    tags: ['eceee', 'navigation', 'menu', 'nav', 'mobile', 'dropdown', 'brand', 'header']
}

export default NavigationWidget
