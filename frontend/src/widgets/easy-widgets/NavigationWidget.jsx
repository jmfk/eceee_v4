import React, { useState, useEffect } from 'react'
import { usePageChildren } from '../../hooks/usePageStructure'
import { Menu, X, ChevronDown } from 'lucide-react'
import ComponentStyleRenderer from '../../components/ComponentStyleRenderer'
import { prepareNavigationContext } from '../../utils/mustacheRenderer'
import { pagesApi } from '../../api'

/**
 * Process menu items to extract link_data structure
 * Handles both new format (with link_data) and old format (direct fields)
 */
const processMenuItems = (items) => {
    if (!items || !Array.isArray(items)) return []
    
    return items.map((item, index) => {
        // Check if item has link_data field (new format)
        if (item.linkData || item.link_data) {
            const linkData = item.linkData || item.link_data
            const order = item.order !== undefined ? item.order : index
            
            return {
                label: linkData.label,
                url: linkData.url || '',
                isActive: linkData.isActive !== false && linkData.is_active !== false,
                targetBlank: linkData.targetBlank || linkData.target_blank || false,
                type: linkData.type || 'external',
                order,
            }
        }
        
        // Old format - direct fields (backwards compatibility)
        return {
            label: item.label,
            url: item.url || '',
            isActive: item.isActive !== false && item.is_active !== false,
            targetBlank: item.targetBlank || item.target_blank || false,
            type: item.type || 'external',
            order: item.order !== undefined ? item.order : index,
        }
    })
}

/**
 * EASY Navigation Widget Component
 * Renders navigation menus with dropdowns, mobile support, and branding
 */
const NavigationWidget = ({ config = {}, mode = 'preview', context = {}, }) => {
    const {
        menuItems = [],
        includeSubpages = false,
        menus = {},
    } = config
    const pageId = context?.pageId
    const pageVersionData = context?.pageVersionData
    const { data: children, isLoading, error } = usePageChildren(pageId)
    
    // Process menu items to extract link_data (handles both new and old formats)
    const processedMenuItems = processMenuItems(menuItems)

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

    // Generate dynamic menu items based on configuration
    let dynamicMenuItems = []
    
    // Support for includeSubpages (backend feature)
    if (includeSubpages && children && children.length > 0) {
        dynamicMenuItems = children.map((child, index) => ({
            label: child.page?.title || child.page?.slug,
            url: child.page?.path || `/${child.page?.slug}`,
            isActive: true,
            targetBlank: false,
            type: 'internal',
            order: child.page?.order !== undefined ? child.page.order : index,
        }))
    }
    
    // Legacy support for menus configuration
    let localMenu = []
    if (children && children.length > 0 && menus.activeGroup === "pageSections") {
        const slotName = menus.formData?.pageSections?.slotName || menus.formData?.pageSections?.slot_name || "main"
        const slotWidgets = (pageVersionData?.widgets?.[slotName] || []).filter(widget => {
            const anchor = widget.config?.anchor
            return anchor && typeof anchor === 'string' && anchor.trim() !== ''
        })
        localMenu = slotWidgets.map((child) => {
            // Use anchor_title if available, fallback to title, then anchor
            const label = child.config.anchorTitle || child.config.anchor_title || 
                         child.config.title || child.config.header || child.config.anchor
            return { 
                id: `section-${child.config.anchor}`, 
                label: label, 
                url: `#${child.config.anchor}`,
                isActive: true,
                targetBlank: false,
            }
        })
    }
    if (children && children.length > 0 && menus.activeGroup === "pageSubmenu") {
        localMenu = children.map((child) => ({ 
            id: `submenu-${child.page.id}`, 
            label: child.page.title, 
            url: child.page.path,
            isActive: true,
            targetBlank: false,
        }))
    }
    
    // Merge dynamic items with legacy local menu
    if (localMenu.length > 0) {
        dynamicMenuItems = [...dynamicMenuItems, ...localMenu]
    }


    const renderMenuItems = (items) => {
        return items.map((item, index) => (
            <li key={index}>
                <a 
                    href={item.url} 
                    target={item.targetBlank || item.target_blank ? "_blank" : undefined}
                    rel={item.targetBlank || item.target_blank ? "noopener noreferrer" : undefined}
                    className="hover:opacity-70 transition-opacity"
                >
                    {item.label}
                </a>
            </li>
        ))
    }

    // Check for Component Style rendering
    const navigationStyle = config.navigationStyle || config.navigation_style
    const theme = context?.pageVersionData?.effectiveTheme || context?.theme

    const hasComponentStyle = navigationStyle &&
        navigationStyle !== 'default' &&
        navigationStyle !== 'Default' &&
        theme?.componentStyles?.[navigationStyle]

    // Combine static and dynamic menu items (matching backend logic)
    const allItems = [...dynamicMenuItems, ...processedMenuItems]
    const hasItems = allItems.length > 0

    // If Component Style is selected, use Mustache rendering
    if (hasComponentStyle) {
        const style = theme.componentStyles[navigationStyle]

        // Prepare context for Mustache template (matching backend output)
        const mustacheContext = prepareNavigationContext(
            { 
                ...config, 
                menuItems: processedMenuItems,
                dynamicMenuItems: dynamicMenuItems,
            },
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
                <ul className="nav-container list-none m-0 p-0 flex gap-4 items-center">
                    {hasItems ? renderMenuItems(allItems) : null}
                </ul>
            </nav>
        )
    }

    return (
        <nav className="navigation-widget">
            <ul className="nav-container list-none m-0 p-0 flex gap-4 items-center">
                {hasItems ? renderMenuItems(allItems) : null}
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
    includeSubpages: false,
}

// Display metadata
NavigationWidget.metadata = {
    name: 'Navigation',
    description: 'Navigation menus with dropdowns, mobile hamburger menu, and branding support',
    category: 'layout',
    icon: Menu,
    tags: ['eceee', 'navigation', 'menu', 'nav', 'mobile', 'dropdown', 'brand', 'header'],
    specialEditor: 'NavigationWidgetEditor'
}

export default NavigationWidget
