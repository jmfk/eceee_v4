import React, { useState } from 'react'
import { Menu, X, ChevronDown } from 'lucide-react'

/**
 * Navigation Widget Component
 * Renders navigation menus with dropdowns, mobile support, and branding
 */
const NavigationWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        content = 'Navigation content will appear here...',
        background_color = '#ffffff',
        background_image = '',
        background_size = 'cover',
        background_position = 'center',
        text_color = '#1f2937',
        padding = '1rem',
        text_align = 'left',
        brand_name = '',
        brand_url = '',
        brand_logo = '',
        menu_items = [],
        mobile_friendly = true,
        sticky = false,
        dropdown_enabled = true,
        css_class = '',
        custom_css = ''
    } = config

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [activeDropdown, setActiveDropdown] = useState(null)

    const navStyle = {
        backgroundColor: background_color,
        backgroundImage: background_image ? `url(${background_image})` : 'none',
        backgroundSize: background_size,
        backgroundPosition: background_position,
        backgroundRepeat: 'no-repeat',
        color: text_color,
        padding: padding,
        textAlign: text_align
    }

    const toggleMobileMenu = () => {
        setMobileMenuOpen(!mobileMenuOpen)
    }

    const toggleDropdown = (index) => {
        setActiveDropdown(activeDropdown === index ? null : index)
    }

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
            <div className="navigation-widget-editor p-4">
                <nav
                    className={`navigation-widget rounded border border-gray-200 ${sticky ? 'sticky top-0 z-50' : ''} ${css_class}`}
                    style={navStyle}
                >
                    <div className="nav-container flex justify-between items-center max-w-6xl mx-auto">
                        {(brand_name || brand_logo) && (
                            <div className="nav-brand flex items-center">
                                {brand_logo && (
                                    <img src={brand_logo} alt={brand_name || 'Logo'} className="nav-brand-logo h-8 w-auto mr-2" />
                                )}
                                {brand_name && (
                                    <span className="nav-brand-text text-xl font-bold">{brand_name}</span>
                                )}
                            </div>
                        )}

                        {menu_items.length > 0 ? (
                            <>
                                {mobile_friendly && (
                                    <button
                                        className="nav-toggle md:hidden p-2 rounded-md hover:bg-gray-100"
                                        onClick={toggleMobileMenu}
                                        aria-label="Toggle navigation"
                                    >
                                        {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                                    </button>
                                )}

                                <ul className={`nav-menu ${mobile_friendly ? 'hidden md:flex' : 'flex'} space-x-1`}>
                                    {renderMenuItems(menu_items)}
                                </ul>

                                {mobile_friendly && (
                                    <ul className={`nav-menu-mobile md:hidden absolute top-full left-0 right-0 bg-white border-t border-gray-200 shadow-lg ${mobileMenuOpen ? 'block' : 'hidden'
                                        }`}>
                                        <div className="px-4 py-2 space-y-1">
                                            {renderMenuItems(menu_items, true)}
                                        </div>
                                    </ul>
                                )}
                            </>
                        ) : (
                            <div className="nav-content" dangerouslySetInnerHTML={{ __html: content }} />
                        )}
                    </div>

                    {custom_css && (
                        <style dangerouslySetInnerHTML={{ __html: custom_css }} />
                    )}
                </nav>
            </div>
        )
    }

    return (
        <nav
            className={`navigation-widget ${sticky ? 'sticky top-0 z-50' : ''} ${css_class}`}
            style={navStyle}
        >
            <div className="nav-container flex justify-between items-center max-w-6xl mx-auto relative">
                {(brand_name || brand_logo) && (
                    <div className="nav-brand flex items-center">
                        {brand_logo && (
                            <img src={brand_logo} alt={brand_name || 'Logo'} className="nav-brand-logo h-8 w-auto mr-2" />
                        )}
                        {brand_name && (
                            <a href={brand_url || '/'} className="nav-brand-text text-xl font-bold hover:opacity-80">
                                {brand_name}
                            </a>
                        )}
                    </div>
                )}

                {menu_items.length > 0 ? (
                    <>
                        {mobile_friendly && (
                            <button
                                className="nav-toggle md:hidden p-2 rounded-md hover:bg-gray-100"
                                onClick={toggleMobileMenu}
                                aria-label="Toggle navigation"
                            >
                                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                            </button>
                        )}

                        <ul className={`nav-menu ${mobile_friendly ? 'hidden md:flex' : 'flex'} space-x-1`}>
                            {renderMenuItems(menu_items)}
                        </ul>

                        {mobile_friendly && (
                            <ul className={`nav-menu-mobile md:hidden absolute top-full left-0 right-0 bg-white border-t border-gray-200 shadow-lg ${mobileMenuOpen ? 'block' : 'hidden'
                                }`}>
                                <div className="px-4 py-2 space-y-1">
                                    {renderMenuItems(menu_items, true)}
                                </div>
                            </ul>
                        )}
                    </>
                ) : (
                    <div className="nav-content" dangerouslySetInnerHTML={{ __html: content }} />
                )}
            </div>

            {custom_css && (
                <style dangerouslySetInnerHTML={{ __html: custom_css }} />
            )}
        </nav>
    )
}

// === COLOCATED METADATA ===
NavigationWidget.displayName = 'NavigationWidget'
NavigationWidget.widgetType = 'core_widgets.NavigationWidget'

// Default configuration
NavigationWidget.defaultConfig = {
    content: 'Navigation content will appear here...',
    background_color: '#ffffff',
    background_image: '',
    background_size: 'cover',
    background_position: 'center',
    text_color: '#1f2937',
    padding: '1rem',
    text_align: 'left',
    brand_name: 'Your Brand',
    brand_url: '/',
    brand_logo: '',
    menu_items: [
        { label: 'Home', url: '/', is_active: true },
        { label: 'About', url: '/about', is_active: false },
        {
            label: 'Services', url: '/services', is_active: false, children: [
                { label: 'Web Design', url: '/services/web-design' },
                { label: 'Development', url: '/services/development' }
            ]
        },
        { label: 'Contact', url: '/contact', is_active: false }
    ],
    mobile_friendly: true,
    sticky: false,
    dropdown_enabled: true
}

// Display metadata
NavigationWidget.metadata = {
    name: 'Navigation',
    description: 'Navigation menus with dropdowns, mobile hamburger menu, and branding support',
    category: 'layout',
    icon: Menu,
    tags: ['navigation', 'menu', 'nav', 'mobile', 'dropdown', 'brand', 'header']
}

export default NavigationWidget
