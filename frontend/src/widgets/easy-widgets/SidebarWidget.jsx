import React, { useState } from 'react'
import { PanelRight, ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * EASY Sidebar Widget Component
 * Renders sidebar content with nested widgets, collapsible functionality, and positioning
 */
const SidebarWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        content = 'Sidebar content will appear here...',
        background_color = '#f9fafb',
        background_image = '',
        background_size = 'cover',
        background_position = 'center',
        text_color = '#1f2937',
        padding = '1.5rem',
        text_align = 'left',
        position = 'right',
        width = '300px',
        collapsible = false,
        widgets = [],
        css_class = '',
        custom_css = ''
    } = config

    const [isCollapsed, setIsCollapsed] = useState(false)

    const sidebarStyle = {
        backgroundColor: background_color,
        backgroundImage: background_image ? `url(${background_image})` : 'none',
        backgroundSize: background_size,
        backgroundPosition: background_position,
        backgroundRepeat: 'no-repeat',
        color: text_color,
        padding: isCollapsed ? '1rem' : padding,
        textAlign: text_align,
        width: isCollapsed ? '60px' : width,
        minWidth: isCollapsed ? '60px' : 'auto',
        transition: 'all 0.3s ease-in-out'
    }

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed)
    }

    const renderWidgetSection = (widget, index) => {
        return (
            <div key={index} className="sidebar-section mb-6 last:mb-0">
                {widget.title && !isCollapsed && (
                    <h3 className="sidebar-section-title font-semibold text-gray-900 mb-3 pb-2 border-b-2 border-gray-300">
                        {widget.title}
                    </h3>
                )}

                {widget.content && !isCollapsed && (
                    <div className="sidebar-section-content mb-4">
                        <div dangerouslySetInnerHTML={{ __html: widget.content }} />
                    </div>
                )}

                {widget.type === 'list' && widget.items && !isCollapsed && (
                    <div className="sidebar-widget-list bg-white border border-gray-200 rounded-lg p-4">
                        <ul className="space-y-3">
                            {widget.items.map((item, itemIndex) => (
                                <li key={itemIndex} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                                    {item.url ? (
                                        <a
                                            href={item.url}
                                            className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                        >
                                            {item.title}
                                        </a>
                                    ) : (
                                        <span className="font-medium text-gray-900">{item.title}</span>
                                    )}
                                    {item.description && (
                                        <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        )
    }

    if (mode === 'editor') {
        return (
            <div className="sidebar-widget-editor p-4">
                <aside
                    className={`sidebar-widget border border-gray-200 rounded-lg relative ${position === 'left' ? 'position-left' : 'position-right'} ${css_class}`}
                    style={sidebarStyle}
                >
                    {collapsible && (
                        <button
                            className="sidebar-toggle absolute top-4 right-4 p-1 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                            onClick={toggleCollapse}
                            aria-label="Toggle sidebar"
                        >
                            {isCollapsed ? (
                                position === 'left' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
                            ) : (
                                position === 'left' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                            )}
                        </button>
                    )}

                    <div className={`sidebar-content ${isCollapsed ? 'hidden' : 'block'}`}>
                        {widgets.length > 0 ? (
                            widgets.map((widget, index) => renderWidgetSection(widget, index))
                        ) : (
                            <div dangerouslySetInnerHTML={{ __html: content }} />
                        )}
                    </div>

                    {custom_css && (
                        <style dangerouslySetInnerHTML={{ __html: custom_css }} />
                    )}
                </aside>
            </div>
        )
    }

    return (
        <aside
            className={`sidebar-widget ${position === 'left' ? 'position-left' : 'position-right'} ${css_class} relative`}
            style={sidebarStyle}
        >
            {collapsible && (
                <button
                    className="sidebar-toggle absolute top-4 right-4 p-1 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors z-10"
                    onClick={toggleCollapse}
                    aria-label="Toggle sidebar"
                >
                    {isCollapsed ? (
                        position === 'left' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />
                    ) : (
                        position === 'left' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                    )}
                </button>
            )}

            <div className={`sidebar-content ${isCollapsed ? 'hidden' : 'block'}`}>
                {widgets.length > 0 ? (
                    widgets.map((widget, index) => renderWidgetSection(widget, index))
                ) : (
                    <div dangerouslySetInnerHTML={{ __html: content }} />
                )}
            </div>

            {custom_css && (
                <style dangerouslySetInnerHTML={{ __html: custom_css }} />
            )}
        </aside>
    )
}

// === COLOCATED METADATA ===
SidebarWidget.displayName = 'SidebarWidget'
SidebarWidget.widgetType = 'easy_widgets.SidebarWidget'

// Default configuration
SidebarWidget.defaultConfig = {
    content: '<h3>Sidebar Title</h3><p>This is sidebar content that can contain any HTML.</p>',
    background_color: '#f9fafb',
    background_image: '',
    background_size: 'cover',
    background_position: 'center',
    text_color: '#1f2937',
    padding: '1.5rem',
    text_align: 'left',
    position: 'right',
    width: '300px',
    collapsible: false,
    widgets: [
        {
            title: 'Quick Links',
            type: 'list',
            items: [
                { title: 'Home', url: '/', description: 'Return to homepage' },
                { title: 'About Us', url: '/about', description: 'Learn more about our company' },
                { title: 'Contact', url: '/contact', description: 'Get in touch with us' }
            ]
        },
        {
            title: 'Information',
            content: '<p>This is additional information that can be displayed in the sidebar.</p>'
        }
    ]
}

// Display metadata
SidebarWidget.metadata = {
    name: 'Sidebar',
    description: 'Sidebar content with nested widgets, collapsible functionality, and flexible positioning',
    category: 'layout',
    icon: PanelRight,
    tags: ['eceee', 'sidebar', 'aside', 'layout', 'navigation', 'collapsible', 'widgets']
}

export default SidebarWidget
