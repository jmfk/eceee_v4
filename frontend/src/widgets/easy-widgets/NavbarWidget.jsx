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
 * EASY Navbar Widget Component
 * Renders a navigation bar with configurable menu items and responsive overflow
 */
const NavbarWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        menuItems = [],
        secondaryMenuItems = [],
        backgroundImage = null,
        backgroundPosition = 'center',
        backgroundColor = null,
        hamburgerBreakpoint = 768,
    } = config

    // Filter active items (undefined/null treated as active for backwards compatibility)
    const activeMenuItems = menuItems.filter(item => item.isActive !== false)
    const activeSecondaryMenuItems = secondaryMenuItems.filter(item => item.isActive !== false)

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

        return (
            <a
                key={index}
                href={mode === 'editor' ? '#' : item.url}
                data-href={item.url}
                target={item.targetBlank ? '_blank' : undefined}
                rel={item.targetBlank ? 'noopener noreferrer' : undefined}
                className={linkClasses}
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
        const itemBgColor = item.backgroundColor || '#3b82f6'
        const itemBgImage = getImageUrl(item.backgroundImage)

        const itemStyle = {
            color: '#ffffff',
            fontSize: '0.875rem',
            fontWeight: 500,
            textDecoration: 'none',
            transition: 'opacity 0.2s ease-in-out',
            whiteSpace: 'nowrap',
            padding: '4px 12px',
            display: 'inline-block',
            borderRadius: '4px',
            backgroundColor: itemBgColor,
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
                            <li key={index} className="navbar-menu-item">
                                {renderSecondaryMenuItem(item, index, false)}
                            </li>
                        ))}
                    </ul>
                )}

                {/* Hidden secondary menu items for measuring (always rendered) */}
                {activeSecondaryMenuItems.length > 0 && (
                    <div className="absolute opacity-0 pointer-events-none flex gap-1 right-[20px]">
                        {activeSecondaryMenuItems.map((item, index) => {
                            const itemBgColor = item.backgroundColor || '#3b82f6'
                            const itemBgImage = getImageUrl(item.backgroundImage)
                            return (
                                <span
                                    key={`measure-secondary-${index}`}
                                    ref={(el) => {
                                        secondaryItemRefs.current[index] = el
                                    }}
                                    className="text-white text-sm font-medium whitespace-nowrap"
                                    style={{
                                        padding: '4px 12px',
                                        borderRadius: '4px',
                                        backgroundColor: itemBgColor,
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

