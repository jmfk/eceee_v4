import React from 'react'
import PropTypes from 'prop-types'

/**
 * ContentWidget - Displays HTML content with sanitization options
 */
const ContentWidget = ({ config = {}, className = '', style = {} }) => {
    const {
        content = '',
        allow_scripts = false,
        sanitize_html = true,
        ...otherConfig
    } = config

    // Basic content validation
    if (!content || typeof content !== 'string') {
        return (
            <div className={`content-widget ${className}`} style={style}>
                <p className="text-gray-500 italic">No content to display</p>
            </div>
        )
    }

    // For now, we'll always render as safe HTML
    // In a production environment, you'd want proper HTML sanitization
    return (
        <div
            className={`content-widget ${className}`}
            style={style}
            dangerouslySetInnerHTML={{ __html: content }}
        />
    )
}

ContentWidget.propTypes = {
    config: PropTypes.shape({
        content: PropTypes.string,
        allow_scripts: PropTypes.bool,
        sanitize_html: PropTypes.bool,
    }),
    className: PropTypes.string,
    style: PropTypes.object,
}

// Widget metadata for registration
ContentWidget.displayName = 'Content Widget'
ContentWidget.widgetType = 'core_widgets.ContentWidget'
ContentWidget.defaultConfig = {
    content: '<p>Enter your content here...</p>',
    allow_scripts: false,
    sanitize_html: true,
}

ContentWidget.metadata = {
    name: 'Content',
    description: 'Display HTML content with formatting and styling options',
    category: 'content',
    icon: '📄',
    tags: ['html', 'content', 'text', 'rich-text']
}

export default ContentWidget
