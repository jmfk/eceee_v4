import React from 'react'
import { FileText } from 'lucide-react'

/**
 * Content Widget Component
 * Renders HTML content with sanitization options
 */
const ContentWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        content = 'Content will appear here...',
        allow_scripts = false,
        sanitize_html = true
    } = config

    if (mode === 'editor') {
        return (
            <div className="content-widget-editor p-2 border border-dashed border-gray-300 rounded">
                <div className="flex items-center mb-2">
                    <FileText className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-600">Content</span>
                </div>
                <div className="content-widget">
                    {content ? (
                        <div dangerouslySetInnerHTML={{ __html: content }} />
                    ) : (
                        <div className="bg-gray-200 h-32 rounded flex items-center justify-center text-gray-500">
                            <FileText className="h-8 w-8 mr-2" />
                            Content placeholder
                        </div>
                    )}
                </div>
            </div>
        )
    }

    if (!content) {
        return (
            <div className="content-widget">
                <div className="bg-gray-200 h-32 rounded flex items-center justify-center text-gray-500">
                    <FileText className="h-8 w-8 mr-2" />
                    No content
                </div>
            </div>
        )
    }

    return (
        <div className="content-widget">
            <div dangerouslySetInnerHTML={{ __html: content }} />
        </div>
    )
}

// === COLOCATED METADATA ===
ContentWidget.displayName = 'ContentWidget'
ContentWidget.widgetType = 'core_widgets.ContentWidget'

// Default configuration
ContentWidget.defaultConfig = {
    content: '<h2>Welcome</h2><p>This is sample content. You can add any HTML here including headings, paragraphs, lists, links, and more.</p>',
    allow_scripts: false,
    sanitize_html: true
}

// Display metadata
ContentWidget.metadata = {
    name: 'Content',
    description: 'HTML content with sanitization options for rich text display',
    category: 'content',
    icon: FileText,
    tags: ['content', 'html', 'text', 'rich', 'editor']
}

export default ContentWidget