import React from 'react'
import { Hash } from 'lucide-react'

/**
 * ECEEE Footer Widget Component
 * Footer widget with multi-column grid layout, background styling, social links, and copyright
 * Matches backend easy_widgets.FooterWidget schema
 */
const FooterWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        columns = [],
        columnCount = 3,
        backgroundColor = '#1f2937',
        backgroundImage = null,
        backgroundSize = 'cover',
        backgroundPosition = 'center',
        textColor = '#f9fafb',
        padding = '2rem 1rem',
        margin = null,
        textAlign = 'left',
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
        padding: padding
    }

    if (margin) {
        footerStyle.margin = margin
    }

    // Render a column
    const renderColumn = (column, index) => {
        return (
            <div key={index} className="footer-column">
                {column.title && (
                    <h3 className="footer-column-title">{column.title}</h3>
                )}
                {column.items && column.items.length > 0 && (
                    <ul className="footer-column-items">
                        {column.items.map((item, itemIndex) => (
                            <li key={itemIndex} className="footer-column-item">
                                {item.url ? (
                                    <a
                                        href={item.url}
                                        target={item.openInNewTab ? '_blank' : undefined}
                                        rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
                                    >
                                        {item.label}
                                    </a>
                                ) : (
                                    item.label
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        )
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
                        {columns && columns.length > 0 && (
                            <div
                                className="footer-columns grid gap-8 mb-8"
                                style={{
                                    gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                                }}
                            >
                                {columns.map((column, index) => renderColumn(column, index))}
                            </div>
                        )}

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
                            <div className="footer-copyright mt-4 text-sm opacity-80 text-center">
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
                {columns && columns.length > 0 && (
                    <div
                        className="footer-columns grid gap-8 mb-8"
                        style={{
                            gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                        }}
                    >
                        {columns.map((column, index) => renderColumn(column, index))}
                    </div>
                )}

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
                    <div className="footer-copyright mt-4 text-sm opacity-80 text-center">
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
FooterWidget.displayName = 'FooterWidget'
FooterWidget.widgetType = 'easy_widgets.FooterWidget'

// Default configuration matching backend schema
FooterWidget.defaultConfig = {
    columns: [
        { title: '', items: [] },
        { title: '', items: [] },
        { title: '', items: [] }
    ],
    columnCount: 3,
    backgroundColor: '#1f2937',
    backgroundImage: null,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    textColor: '#f9fafb',
    padding: '2rem 1rem',
    margin: null,
    textAlign: 'left',
    cssClass: '',
    customCss: '',
    showCopyright: true,
    copyrightText: '',
    socialLinks: []
}

// Display metadata
FooterWidget.metadata = {
    name: 'Footer',
    description: 'Footer with multi-column grid layout, links, social links, and copyright',
    category: 'layout',
    icon: Hash,
    tags: ['footer', 'layout', 'copyright', 'social', 'grid', 'columns'],
    specialEditor: 'FooterWidgetEditor'
}

export default FooterWidget
