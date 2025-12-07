import React, { useState, useRef, useEffect } from 'react'
import { Menu, X, MoreHorizontal } from 'lucide-react'

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
 * Process secondary menu items to extract link_data and styling
 * Handles both new format (with link_data) and old format (direct fields)
 */
const processSecondaryMenuItems = (items) => {
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
                backgroundColor: item.backgroundColor || item.background_color,
                textColor: item.textColor || item.text_color,
                backgroundImage: item.backgroundImage || item.background_image,
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
            backgroundColor: item.backgroundColor || item.background_color,
            textColor: item.textColor || item.text_color,
            backgroundImage: item.backgroundImage || item.background_image,
            order: item.order !== undefined ? item.order : index,
        }
    })
}

/**
 * Convert color value to CSS variable if it's a named color from theme palette
 */
const formatColorValue = (colorValue, themeColors) => {
    if (!colorValue || !themeColors) return colorValue
    // If the value is a key in the theme colors, wrap it in var()
    if (themeColors[colorValue]) {
        return `var(--${colorValue})`
    }
    return colorValue
}

/**
 * EASY Navbar Widget Component
 * Renders a navigation bar with configurable menu items and responsive overflow
 */
const NavbarWidget = ({ config = {}, mode = 'preview', context = {} }) => {
    const {
        menuItems = [],
        secondaryMenuItems = [],
        backgroundImage = null,
        backgroundPosition = 'center',
        backgroundAlignment = 'center',
        backgroundColor = null,
        hamburgerBreakpoint = 768,
    } = config

    // Get theme colors for CSS variable conversion
    const themeColors = context?.theme?.colors || context?.theme?.palette || {}

    // Process menu items to extract link_data (handles both new and old formats)
    const processedMenuItems = processMenuItems(menuItems)
    const processedSecondaryMenuItems = processSecondaryMenuItems(secondaryMenuItems)

    // Filter active items
    const activeMenuItems = processedMenuItems.filter(item => item.isActive !== false)
    const activeSecondaryMenuItems = processedSecondaryMenuItems.filter(item => item.isActive !== false)

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [isOverflowMenuOpen, setIsOverflowMenuOpen] = useState(false)
    const [visibleItems, setVisibleItems] = useState(activeMenuItems)
    const [overflowItems, setOverflowItems] = useState([])
    const [showHamburger, setShowHamburger] = useState(false)
    const [showSecondaryMenu, setShowSecondaryMenu] = useState(true)

    const navRef = useRef(null)
    const itemRefs = useRef([])
    const secondaryItemRefs = useRef([])
    const overflowButtonRef = useRef(null)
    const dropdownRef = useRef(null)

    // Handle window resize to determine hamburger vs desktop mode
    useEffect(() => {
        const handleResize = () => {
            setShowHamburger(window.innerWidth < hamburgerBreakpoint)
        }

        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [hamburgerBreakpoint])

    // Calculate overflow items and secondary menu visibility when in desktop mode
    useEffect(() => {
        if (showHamburger || mode === 'editor') {
            setVisibleItems(prev => {
                const newVal = activeMenuItems
                return JSON.stringify(prev) !== JSON.stringify(newVal) ? newVal : prev
            })
            setOverflowItems(prev => prev.length === 0 ? prev : [])
            setShowSecondaryMenu(prev => prev === true ? prev : true)
            return
        }

        if (!activeMenuItems.length) {
            setVisibleItems(prev => prev.length === 0 ? prev : [])
            setOverflowItems(prev => prev.length === 0 ? prev : [])
            setShowSecondaryMenu(prev => prev === true ? prev : true)
            return
        }

        const calculateOverflow = () => {
            if (!navRef.current) return

            const navWidth = navRef.current.offsetWidth
            const OVERFLOW_BUTTON_WIDTH = 60 // Approximate width for "..." button
            const PADDING = 40 // Left padding
            const RIGHT_PADDING = 20 // Right padding

            // Calculate secondary menu width
            let secondaryMenuWidth = 0
            if (activeSecondaryMenuItems && activeSecondaryMenuItems.length > 0) {
                const SECONDARY_GAP = 4 // 0.25rem = 4px gap between items
                secondaryItemRefs.current.forEach((ref) => {
                    if (ref) {
                        secondaryMenuWidth += ref.offsetWidth
                    }
                })
                // Add gaps between items (n-1 gaps for n items)
                if (activeSecondaryMenuItems.length > 1) {
                    secondaryMenuWidth += SECONDARY_GAP * (activeSecondaryMenuItems.length - 1)
                }
                secondaryMenuWidth += RIGHT_PADDING // Add right padding
            }

            // Calculate available width for primary menu
            const availableWidth = navWidth - secondaryMenuWidth

            let usedWidth = PADDING
            const visible = []
            const overflow = []

            activeMenuItems.forEach((item, index) => {
                const itemWidth = itemRefs.current[index]?.offsetWidth || 100

                if (usedWidth + itemWidth + OVERFLOW_BUTTON_WIDTH < availableWidth) {
                    visible.push(item)
                    usedWidth += itemWidth
                } else {
                    overflow.push(item)
                }
            })

            // If we have overflow items, ensure we have room for the button
            if (overflow.length > 0 && visible.length > 0) {
                // Double check last visible item has room with button
                if (usedWidth > availableWidth) {
                    overflow.unshift(visible.pop())
                }
            }

            // Determine if secondary menu should be shown
            // Primary menu needs space, so if it doesn't fit even without secondary menu, hide secondary
            const primaryMenuWidth = usedWidth + (overflow.length > 0 ? OVERFLOW_BUTTON_WIDTH : 0)
            const totalNeededWidth = primaryMenuWidth + secondaryMenuWidth
            const shouldShowSecondary = activeSecondaryMenuItems.length > 0 && totalNeededWidth <= navWidth

            // Only update state if values have actually changed
            setVisibleItems(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(visible)) {
                    return visible
                }
                return prev
            })
            setOverflowItems(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(overflow)) {
                    return overflow
                }
                return prev
            })
            setShowSecondaryMenu(prev => {
                if (prev !== shouldShowSecondary) {
                    return shouldShowSecondary
                }
                return prev
            })
        }

        // Use requestAnimationFrame to avoid update loops
        const rafId = requestAnimationFrame(() => {
            calculateOverflow()
        })

        // Set up ResizeObserver
        const observer = new ResizeObserver(() => {
            requestAnimationFrame(calculateOverflow)
        })
        if (navRef.current) {
            observer.observe(navRef.current)
        }

        return () => {
            cancelAnimationFrame(rafId)
            observer.disconnect()
        }
    }, [activeMenuItems, activeSecondaryMenuItems, showHamburger, mode])

    // Click outside handler for overflow dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target) &&
                overflowButtonRef.current &&
                !overflowButtonRef.current.contains(event.target)
            ) {
                setIsOverflowMenuOpen(false)
            }
        }

        if (isOverflowMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOverflowMenuOpen])

    const renderMenuItem = (item, index, isInDropdown = false) => {
        const linkClasses = isInDropdown
            ? "navbar-link block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 no-underline"
            : "navbar-link text-white text-sm font-medium no-underline hover:opacity-80 transition-opacity"

        const linkStyle = !isInDropdown ? {
            fontSize: '14px',
            color: '#ffffff',
            fontFamily: '"Source Sans 3", sans-serif',
            fontWeight: 500
        } : {}

        return (
            <a
                key={index}
                href={mode === 'editor' ? '#' : item.url}
                data-href={item.url}
                target={item.targetBlank ? '_blank' : undefined}
                rel={item.targetBlank ? 'noopener noreferrer' : undefined}
                className={linkClasses}
                style={linkStyle}
                onClick={(e) => {
                    if (mode === 'editor') {
                        e.preventDefault()
                    }
                    if (isInDropdown) {
                        setIsOverflowMenuOpen(false)
                    }
                    if (showHamburger) {
                        setIsMobileMenuOpen(false)
                    }
                }}
            >
                {item.label}
            </a>
        )
    }

    const renderSecondaryMenuItem = (item, index, isInDropdown = false) => {
        const itemBgImage = getImageUrl(item.backgroundImage)

        // Convert color values to CSS variables if needed
        const bgColor = formatColorValue(item.backgroundColor, themeColors)
        const txtColor = formatColorValue(item.textColor, themeColors)

        const itemStyle = {
            // Only apply item-specific overrides
            ...(bgColor && { backgroundColor: bgColor }),
            ...(txtColor && { color: txtColor }),
            ...(itemBgImage && {
                backgroundImage: `url('${itemBgImage}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            }),
        }

        if (isInDropdown) {
            itemStyle.display = 'block'
            itemStyle.margin = '0.25rem 0.5rem'
        }

        return (
            <a
                key={index}
                href={mode === 'editor' ? '#' : item.url}
                data-href={item.url}
                target={item.targetBlank ? '_blank' : undefined}
                rel={item.targetBlank ? 'noopener noreferrer' : undefined}
                style={itemStyle}
                className="navbar-link navbar-secondary-link hover:opacity-80"
                onClick={(e) => {
                    if (mode === 'editor') {
                        e.preventDefault()
                    }
                    if (showHamburger) {
                        setIsMobileMenuOpen(false)
                    }
                }}
            >
                {item.label}
            </a>
        )
    }

    // Extract image URL from image object or string
    const imageUrl = getImageUrl(backgroundImage)

    // Convert background color to CSS variable if needed
    const formattedBgColor = formatColorValue(backgroundColor, themeColors)

    // Build inline styles for background
    const navStyles = {
        ...(imageUrl && {
            backgroundImage: `url('${imageUrl}')`,
            backgroundSize: 'cover',
            backgroundPosition: backgroundAlignment || backgroundPosition,
            backgroundRepeat: 'no-repeat',
        }),
        ...(formattedBgColor && { backgroundColor: formattedBgColor }),
    }

    // Determine if we should use default background color
    const shouldUseDefaultBg = !imageUrl && !formattedBgColor

    // Empty state for editor
    if (mode === 'editor' && (!activeMenuItems || activeMenuItems.length === 0)) {
        return (
            <nav
                className={`shadow-sm h-[28px] ${shouldUseDefaultBg ? 'bg-blue-500' : ''}`}
                style={navStyles}
            >
                <div className="flex items-center h-full pl-[20px]">
                    <span className="text-white text-sm opacity-50">
                        No active menu items
                    </span>
                </div>
            </nav>
        )
    }

    // Hamburger menu mode (mobile)
    if (showHamburger) {
        return (
            <nav
                ref={navRef}
                className={`shadow-sm h-[28px] relative ${shouldUseDefaultBg ? 'bg-blue-500' : ''}`}
                style={navStyles}
            >
                <div className="flex items-center h-full px-[20px] justify-between">
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="text-white hover:opacity-80 transition-opacity"
                        aria-label="Toggle menu"
                    >
                        {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>

                {/* Slide-out mobile menu */}
                {isMobileMenuOpen && (
                    <div className="absolute top-full left-0 w-64 bg-white shadow-lg z-50 border border-gray-200">
                        <div className="py-2">
                            {/* Primary menu items */}
                            {activeMenuItems.map((item, index) => (
                                <div key={index}>
                                    {renderMenuItem(item, index, true)}
                                </div>
                            ))}

                            {/* Secondary menu items */}
                            {activeSecondaryMenuItems.length > 0 && (
                                <div className="border-t border-gray-200 mt-2 pt-2">
                                    {activeSecondaryMenuItems.map((item, index) => (
                                        <div key={`secondary-${index}`}>
                                            {renderSecondaryMenuItem(item, index, true)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </nav>
        )
    }

    // Desktop mode with overflow menu
    return (
        <nav
            ref={navRef}
            className={`shadow-sm h-[28px] relative ${shouldUseDefaultBg ? 'bg-blue-500' : ''}`}
            style={navStyles}
        >
            <div className="flex justify-between items-center h-full w-full">
                {/* Primary menu (left-aligned) */}
                <ul
                    className="navbar-menu-list flex gap-6 m-0 p-0 pl-[20px] items-center"
                    style={{ listStyle: 'none' }}
                >
                    {visibleItems.map((item, index) => (
                        <li
                            key={index}
                            className="navbar-menu-item"
                            ref={(el) => (itemRefs.current[index] = el)}
                            style={{
                                listStyle: 'none',
                                fontSize: '14px',
                                marginTop: '0px',
                                fontFamily: '"Source Sans 3", sans-serif',
                                fontWeight: 300,
                                lineHeight: '22px',
                                marginBottom: '0px'
                            }}
                        >
                            {renderMenuItem(item, index, false)}
                        </li>
                    ))}

                    {/* Overflow dropdown button */}
                    {overflowItems.length > 0 && (
                        <li className="relative">
                            <button
                                ref={overflowButtonRef}
                                onClick={() => setIsOverflowMenuOpen(!isOverflowMenuOpen)}
                                className="text-white hover:opacity-80 transition-opacity px-2"
                                aria-label="More menu items"
                            >
                                <MoreHorizontal size={18} />
                            </button>

                            {/* Overflow dropdown */}
                            {isOverflowMenuOpen && (
                                <div
                                    ref={dropdownRef}
                                    className="absolute top-full right-0 mt-1 bg-white shadow-lg rounded-md border border-gray-200 z-50 min-w-[200px]"
                                >
                                    <div className="py-1">
                                        {overflowItems.map((item, index) => (
                                            <div key={index}>
                                                {renderMenuItem(item, index, true)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </li>
                    )}

                    {/* Hidden items for measuring */}
                    {mode !== 'editor' && (
                        <div className="absolute opacity-0 pointer-events-none flex gap-6">
                            {activeMenuItems.map((item, index) => (
                                <span
                                    key={`measure-${index}`}
                                    ref={(el) => {
                                        if (!itemRefs.current[index]) {
                                            itemRefs.current[index] = el
                                        }
                                    }}
                                    className="text-white text-sm font-medium whitespace-nowrap"
                                >
                                    {item.label}
                                </span>
                            ))}
                        </div>
                    )}
                </ul>

                {/* Secondary menu (right-aligned) */}
                {activeSecondaryMenuItems.length > 0 && showSecondaryMenu && (
                    <ul
                        className="navbar-menu-list navbar-secondary-menu flex gap-1 m-0 p-0 pr-[20px] items-center ml-auto"
                        style={{ listStyle: 'none' }}
                    >
                        {activeSecondaryMenuItems.map((item, index) => (
                            <li 
                                key={index} 
                                className="navbar-menu-item"
                                style={{
                                    listStyle: 'none',
                                    fontSize: '14px',
                                    marginTop: '0px',
                                    fontFamily: '"Source Sans 3", sans-serif',
                                    fontWeight: 300,
                                    lineHeight: '22px',
                                    marginBottom: '0px',
                                    borderRadius: '4px 4px 0 0',
                                    padding: '0 12px 3px'
                                }}
                            >
                                {renderSecondaryMenuItem(item, index, false)}
                            </li>
                        ))}
                    </ul>
                )}

                {/* Hidden secondary menu items for measuring (always rendered) */}
                {activeSecondaryMenuItems.length > 0 && (
                    <div className="absolute opacity-0 pointer-events-none flex gap-1 right-[20px]">
                        {activeSecondaryMenuItems.map((item, index) => {
                            const itemBgImage = getImageUrl(item.backgroundImage)
                            const bgColor = formatColorValue(item.backgroundColor, themeColors)
                            const txtColor = formatColorValue(item.textColor, themeColors)
                            return (
                                <span
                                    key={`measure-secondary-${index}`}
                                    ref={(el) => {
                                        secondaryItemRefs.current[index] = el
                                    }}
                                    className="navbar-secondary-link text-white text-sm font-medium whitespace-nowrap"
                                    style={{
                                        ...(bgColor && { backgroundColor: bgColor }),
                                        ...(txtColor && { color: txtColor }),
                                        ...(itemBgImage && {
                                            backgroundImage: `url('${itemBgImage}')`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                        }),
                                    }}
                                >
                                    {item.label}
                                </span>
                            )
                        })}
                    </div>
                )}
            </div>
        </nav>
    )
}

// === COLOCATED METADATA ===
NavbarWidget.displayName = 'NavbarWidget'
NavbarWidget.widgetType = 'easy_widgets.NavbarWidget'

// Default configuration
NavbarWidget.defaultConfig = {
    menuItems: [],
    secondaryMenuItems: [],
    backgroundImage: null,
    backgroundPosition: 'center',
    backgroundColor: null,
    hamburgerBreakpoint: 768,
}

// Display metadata
NavbarWidget.metadata = {
    name: 'Navbar',
    description: 'Navigation bar with primary and secondary menus',
    category: 'layout',
    icon: Menu,
    tags: ['eceee', 'navbar', 'navigation', 'menu', 'nav'],
    specialEditor: 'NavbarWidgetEditor'
}

export default NavbarWidget

