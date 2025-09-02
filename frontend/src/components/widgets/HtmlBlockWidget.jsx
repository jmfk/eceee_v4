import React from 'react'
import { Code } from 'lucide-react'

/**
 * HTML Block Widget Component
 * Renders raw HTML content with safety considerations
 */
const HtmlBlockWidget = ({ config = {}, mode = 'preview' }) => {
    const {
        html_content: htmlContent = '<p>HTML content goes here...</p>',
        allow_scripts: allowScripts = false
    } = config

    // Sanitize HTML content if scripts are not allowed
    const getSafeHtmlContent = () => {
        if (allowScripts) {
            return htmlContent
        }

        // Basic script tag removal for safety
        return htmlContent.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    }

    if (mode === 'editor') {
        return (
            <div className="html-widget-editor p-2 border border-dashed border-gray-300 rounded">
                <div className="flex items-center mb-2">
                    <Code className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-600">HTML Block</span>
                    {!allowScripts && (
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            Scripts disabled
                        </span>
                    )}
                </div>
                <div className="html-content bg-white p-3 rounded border">
                    <div dangerouslySetInnerHTML={{ __html: getSafeHtmlContent() }} />
                </div>
                <div className="text-xs text-gray-500 mt-2">
                    Raw HTML content will be rendered here
                </div>
            </div>
        )
    }

    return (
        <div className="html-widget">
            <div dangerouslySetInnerHTML={{ __html: getSafeHtmlContent() }} />
        </div>
    )
}

HtmlBlockWidget.displayName = 'HtmlBlockWidget'
HtmlBlockWidget.widgetType = 'core_widgets.HtmlBlockWidget'
HtmlBlockWidget.defaultConfig = {
    html_content: '<p>HTML content goes here...</p>',
    allow_scripts: false
}

export default HtmlBlockWidget
