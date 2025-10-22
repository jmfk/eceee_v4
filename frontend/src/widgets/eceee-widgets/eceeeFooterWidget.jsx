import React from 'react'
import { Hash } from 'lucide-react'

/**
 * ECEEE Footer Widget Component
 * Footer widget with background styling, content, social links, and copyright
 * Matches backend eceee_widgets.FooterWidget schema
 */
const eceeeFooterWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        content = '<p>Footer content will appear here...</p>',
        backgroundColor = '#1f2937',
        backgroundImage = null,
        backgroundSize = 'cover',
        backgroundPosition = 'center',
        textColor = '#f9fafb',
        padding = '2rem 1rem',
        margin = null,
        textAlign = 'center',
        cssClass = '',
        customCss = '',
        showCopyright = true,
        copyrightText = '',
        socialLinks = []
    } = config

    const currentYear = new Date().getFullYear()
    const displayCopyright = copyrightText || `© ${currentYear} All rights reserved.`

    // Build footer styles
    const footerStyle = {
        backgroundColor: backgroundColor,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
        backgroundSize: backgroundSize,
        backgroundPosition: backgroundPosition,
        backgroundRepeat: 'no-repeat',
        color: textColor,
        padding: padding,
        textAlign: textAlign
    }

    if (margin) {
        footerStyle.margin = margin
    }

    // Editor mode: show simple preview with configured styles
    if (mode === 'editor') {
        return (
            <div className="footer-widget-editor p-4">
                <footer
                    className={`footer-widget rounded ${cssClass}`}
                    style={footerStyle}
                >
                    <div className="footer-content max-w-6xl mx-auto">
                        <div dangerouslySetInnerHTML={{ __html: content }} />

                        {socialLinks.length > 0 && (
                            <div className="footer-social-links mt-4 flex justify-center space-x-4">
                                {socialLinks.map((link, index) => (
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

                        {showCopyright && (
                            <div className="footer-copyright mt-4 text-sm opacity-80">
                                {displayCopyright}
                            </div>
                        )}
                    </div>

                    {customCss && (
                        <style dangerouslySetInnerHTML={{ __html: customCss }} />
                    )}
                </footer>
            </div>
        )
    }

    // Preview/production mode: full rendering with all config applied
    return (
        <footer
            className={`footer-widget ${cssClass}`}
            style={footerStyle}
        >
            <div className="footer-content max-w-6xl mx-auto">
                <div dangerouslySetInnerHTML={{ __html: content }} />

                {socialLinks.length > 0 && (
                    <div className="footer-social-links mt-4 flex justify-center space-x-4">
                        {socialLinks.map((link, index) => (
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

                {showCopyright && (
                    <div className="footer-copyright mt-4 text-sm opacity-80">
                        {displayCopyright}
                    </div>
                )}
            </div>

            {customCss && (
                <style dangerouslySetInnerHTML={{ __html: customCss }} />
            )}
        </footer>
    )
}

// === COLOCATED METADATA ===
eceeeFooterWidget.displayName = 'FooterWidget'
eceeeFooterWidget.widgetType = 'eceee_widgets.FooterWidget'

// Default configuration matching backend schema
eceeeFooterWidget.defaultConfig = {
    content: '<p>Footer content</p>',
    backgroundColor: '#1f2937',
    backgroundImage: null,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    textColor: '#f9fafb',
    padding: '2rem 1rem',
    margin: null,
    textAlign: 'center',
    cssClass: '',
    customCss: '',
    showCopyright: true,
    copyrightText: '',
    socialLinks: []
}

// Display metadata
eceeeFooterWidget.metadata = {
    name: 'ECEEE Footer',
    description: 'Footer with background styling, content, social links, and copyright',
    category: 'layout',
    icon: Hash,
    tags: ['eceee', 'footer', 'layout', 'copyright', 'social']
}

export default eceeeFooterWidget
