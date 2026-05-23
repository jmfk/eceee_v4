import React, { useState, useEffect, useRef } from 'react'
import { usePageChildren } from '../../hooks/usePageStructure'
import { Menu, X } from 'lucide-react'
import ComponentStyleRenderer from '../../components/ComponentStyleRenderer'
import { prepareNavigationContext } from '../../utils/mustacheRenderer'
import { pagesApi } from '../../api'
import EditorNavLink, { EditorNavItemModal, EditorNavLinkMenu } from './EditorNavLink'
import {
    cleanConfigNavItems,
    isEditorNavMenuContext,
    itemFromStyledAnchor,
    processEditableNavItems,
} from './editorNavLinkUtils'

/**
 * Process menu items to extract link_data structure
 * Handles both new format (with link_data) and old format (direct fields)
 */
const processMenuItems = (items) => processEditableNavItems(items, 'menuItems')

/**
 * EASY Navigation Widget Component
 * Renders navigation menus with dropdowns, mobile support, and branding
 */
const NavigationWidget = ({ config = {}, mode = 'preview', context = {}, onConfigChange }) => {
    const {
        menuItems = [],
        includeSubpages = false,
        menus = {},
    } = config
    const pageId = context?.pageId
    const pageVersionData = context?.pageVersionData
    const { data: children } = usePageChildren(pageId)
    
    // Process menu items to extract link_data (handles both new and old formats)
    const processedMenuItems = processMenuItems(menuItems)
    const shouldUseEditorNavMenus = isEditorNavMenuContext(mode, context)

    // State for owner page data (for inherited widgets)
    const [ownerPageData, setOwnerPageData] = useState(null)
    const [, setLoadingOwnerPage] = useState(false)
    
    // State for overflow detection
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [componentStyleMenu, setComponentStyleMenu] = useState(null)
    const [editingMenuItem, setEditingMenuItem] = useState(null)
    const navRef = useRef(null)

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
            pageId: child.page?.id,
            isPublished: Boolean(child.currentVersion || child.current_version),
            currentVersionId: child.currentVersion?.id || child.current_version?.id,
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
                type: 'anchor',
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
            type: 'internal',
            pageId: child.page.id,
            isPublished: Boolean(child.currentVersion || child.current_version),
            currentVersionId: child.currentVersion?.id || child.current_version?.id,
        }))
    }
    
    // Merge dynamic items with legacy local menu
    if (localMenu.length > 0) {
        dynamicMenuItems = [...dynamicMenuItems, ...localMenu]
    }

    // Overflow detection effect
    useEffect(() => {
        if (mode === 'editor') {
            setIsCollapsed(false)
            return
        }

        const updateNavMode = () => {
            if (!navRef.current) return
            const isOverflowing = navRef.current.scrollWidth > navRef.current.clientWidth
            setIsCollapsed(isOverflowing)
        }

        const ro = new ResizeObserver(updateNavMode)
        if (navRef.current) {
            ro.observe(navRef.current)
        }

        updateNavMode() // Initial check

        return () => ro.disconnect()
    }, [dynamicMenuItems, processedMenuItems, mode])

    // Click outside handler for mobile menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (navRef.current && !navRef.current.contains(event.target)) {
                setIsMobileMenuOpen(false)
            }
        }

        if (isMobileMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isMobileMenuOpen])

    const renderMenuItems = (items, isInDropdown = false) => {
        const linkClasses = isInDropdown
            ? "block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 no-underline"
            : "hover:opacity-70 transition-opacity"

        return items.map((item, index) => (
            <li key={index}>
                <EditorNavLink
                    item={item}
                    mode={mode}
                    enableEditorMenu={shouldUseEditorNavMenus}
                    editorActions={navEditorActions}
                    className={linkClasses}
                    onEditorAction={() => {
                        if (isInDropdown) {
                            setIsMobileMenuOpen(false)
                        }
                    }}
                >
                    {item.label}
                </EditorNavLink>
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

    const updateConfigList = (listKey, updater) => {
        if (!onConfigChange || listKey !== 'menuItems') return

        const currentItems = Array.isArray(config.menuItems) ? config.menuItems : []
        const updatedItems = updater([...currentItems])
        onConfigChange({
            ...config,
            menuItems: cleanConfigNavItems(updatedItems),
        })
    }

    const navEditorActions = onConfigChange ? {
        getListLength: (listKey) => (Array.isArray(config[listKey]) ? config[listKey].length : 0),
        onEdit: (item) => setEditingMenuItem({ mode: 'edit', item }),
        onAddAfter: (item) => setEditingMenuItem({ mode: 'add', item }),
        onDelete: (item) => {
            updateConfigList(item._navListKey, (items) => items.filter((_, index) => index !== item._navIndex))
        },
        onMove: (item, toIndex) => {
            updateConfigList(item._navListKey, (items) => {
                const fromIndex = item._navIndex
                if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length) {
                    return items
                }
                const [movedItem] = items.splice(fromIndex, 1)
                items.splice(toIndex, 0, movedItem)
                return items
            })
        },
    } : null

    const handleSaveMenuItem = (linkData) => {
        if (!editingMenuItem) return

        const { item, mode: modalMode } = editingMenuItem
        updateConfigList(item._navListKey, (items) => {
            if (modalMode === 'add') {
                items.splice(item._navIndex + 1, 0, { linkData })
                return items
            }

            items[item._navIndex] = {
                ...items[item._navIndex],
                linkData,
            }
            return items
        })
        setEditingMenuItem(null)
    }

    const editMenuItemModal = (
        <EditorNavItemModal
            open={Boolean(editingMenuItem)}
            item={editingMenuItem?.item}
            mode={editingMenuItem?.mode}
            context={context}
            onClose={() => setEditingMenuItem(null)}
            onSave={handleSaveMenuItem}
        />
    )

    const handleComponentStyleClick = (event) => {
        if (!shouldUseEditorNavMenus) return

        const anchor = event.target.closest?.('a')
        if (!anchor) return

        event.preventDefault()
        event.stopPropagation()

        const item = itemFromStyledAnchor(anchor, allItems)
        if (!item) {
            setComponentStyleMenu(null)
            return
        }

        setComponentStyleMenu({
            item,
            position: {
                top: event.clientY + 6,
                left: event.clientX,
            },
        })
    }

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
        <>
            <ComponentStyleRenderer
                template={style.template}
                context={mustacheContext}
                css={style.css}
                styleId={`nav-${navigationStyle}`}
                className="navigation-widget-component-style"
                onClick={handleComponentStyleClick}
            />
            {shouldUseEditorNavMenus && (
                <EditorNavLinkMenu
                    item={componentStyleMenu?.item}
                    open={Boolean(componentStyleMenu)}
                    position={componentStyleMenu?.position}
                    onClose={() => setComponentStyleMenu(null)}
                    editorActions={navEditorActions}
                />
            )}
            {editMenuItemModal}
        </>
        )
    }

    // Otherwise, use React rendering (existing code)
    if (mode === 'editor') {
        return (
            <>
                <nav className="navigation-widget">
                    <ul className="nav-container list-none m-0 p-0 flex gap-4 items-center">
                        {hasItems ? renderMenuItems(allItems) : null}
                    </ul>
                </nav>
                {editMenuItemModal}
            </>
        )
    }

    // Collapsed mode with hamburger menu
    if (isCollapsed) {
        return (
            <>
                <nav ref={navRef} className="navigation-widget nav-collapsed relative">
                    <div className="flex items-center justify-between h-full">
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="p-2 hover:opacity-70 transition-opacity"
                            aria-label="Toggle menu"
                        >
                            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>

                    {/* Dropdown menu */}
                    {isMobileMenuOpen && hasItems && (
                        <div className="absolute top-full left-0 w-64 bg-white shadow-lg z-50 border border-gray-200 rounded-md mt-1">
                            <ul className="list-none m-0 p-0 py-2">
                                {renderMenuItems(allItems, true)}
                            </ul>
                        </div>
                    )}
                </nav>
                {editMenuItemModal}
            </>
        )
    }

    // Expanded mode
    return (
        <>
            <nav ref={navRef} className="navigation-widget">
                <ul className="nav-container list-none m-0 p-0 flex gap-4 items-center">
                    {hasItems ? renderMenuItems(allItems) : null}
                </ul>
            </nav>
            {editMenuItemModal}
        </>
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
