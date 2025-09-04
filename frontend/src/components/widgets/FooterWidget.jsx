import React from 'react'
import { Hash } from 'lucide-react'

/**
 * Footer Widget Component
 * Renders footer content with background styling, social links, and copyright
 */
const FooterWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        content = 'Footer content will appear here...',
        background_color = '#1f2937',
        background_image = '',
        background_size = 'cover',
        background_position = 'center',
        text_color = '#f9fafb',
        padding = '2rem 1rem',
        text_align = 'center',
        show_copyright = true,
        copyright_text = '',
        social_links = [],
        css_class = '',
        custom_css = ''
    } = config

    const currentYear = new Date().getFullYear()
    const displayCopyright = copyright_text || `© ${currentYear} All rights reserved.`

    const footerStyle = {
        backgroundColor: background_color,
        backgroundImage: background_image ? `url(${background_image})` : 'none',
        backgroundSize: background_size,
        backgroundPosition: background_position,
        backgroundRepeat: 'no-repeat',
        color: text_color,
        padding: padding,
        textAlign: text_align
    }

    if (mode === 'editor') {
        return (
            <div className="footer-widget-editor p-2 border border-dashed border-gray-300 rounded">
                <div className="flex items-center mb-2">
                    <Hash className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-600">Footer</span>
                </div>
                <footer
                    className={`footer-widget rounded ${css_class}`}
                    style={footerStyle}
                >
                    <div className="footer-content max-w-6xl mx-auto">
                        <div dangerouslySetInnerHTML={{ __html: content }} />

                        {social_links.length > 0 && (
                            <div className="footer-social-links mt-4 flex justify-center space-x-4">
                                {social_links.map((link, index) => (
                                    <a
                                        key={index}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:text-blue-300 transition-colors"
                                        title={link.name}
                                    >
                                        {link.icon && <i className={link.icon}></i>}
                                        {!link.icon && <span>{link.name}</span>}
                                    </a>
                                ))}
                            </div>
                        )}

                        {show_copyright && (
                            <div className="footer-copyright mt-4 text-sm opacity-80">
                                {displayCopyright}
                            </div>
                        )}
                    </div>

                    {custom_css && (
                        <style dangerouslySetInnerHTML={{ __html: custom_css }} />
                    )}
                </footer>
            </div>
        )
    }

    return (
        <footer
            className={`footer-widget ${css_class}`}
            style={footerStyle}
        >
            <div className="footer-content max-w-6xl mx-auto">
                <div dangerouslySetInnerHTML={{ __html: content }} />

                {social_links.length > 0 && (
                    <div className="footer-social-links mt-4 flex justify-center space-x-4">
                        {social_links.map((link, index) => (
                            <a
                                key={index}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:opacity-80 transition-opacity"
                                title={link.name}
                            >
                                {link.icon && <i className={link.icon}></i>}
                                {!link.icon && <span>{link.name}</span>}
                            </a>
                        ))}
                    </div>
                )}

                {show_copyright && (
                    <div className="footer-copyright mt-4 text-sm opacity-80">
                        {displayCopyright}
                    </div>
                )}
            </div>

            {custom_css && (
                <style dangerouslySetInnerHTML={{ __html: custom_css }} />
            )}
        </footer>
    )
}

// === COLOCATED METADATA ===
FooterWidget.displayName = 'FooterWidget'
FooterWidget.widgetType = 'core_widgets.FooterWidget'

// Default configuration
FooterWidget.defaultConfig = {
    content: '<p>© 2024 Your Company Name. All rights reserved.</p>',
    background_color: '#1f2937',
    background_image: '',
    background_size: 'cover',
    background_position: 'center',
    text_color: '#f9fafb',
    padding: '2rem 1rem',
    text_align: 'center',
    show_copyright: true,
    copyright_text: '',
    social_links: []
}

// Display metadata
FooterWidget.metadata = {
    name: 'Footer',
    description: 'Website footer with background styling, social links, and copyright information',
    category: 'layout',
    icon: Hash,
    tags: ['footer', 'layout', 'copyright', 'social', 'links', 'contact']
}

export default FooterWidget
