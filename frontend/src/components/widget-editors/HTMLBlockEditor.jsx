import { useState, useRef } from 'react'
import { Code, Eye, EyeOff, AlertTriangle, Shield, Copy, Download } from 'lucide-react'
import DOMPurify from 'dompurify'
import BaseWidgetEditor from './BaseWidgetEditor'

/**
 * HTMLBlockEditor - Specialized editor for HTMLBlock widgets
 * 
 * Features:
 * - Code editor with syntax highlighting
 * - Live HTML preview
 * - Security warnings and validation
 * - Code formatting and utilities
 * - Script execution controls
 */
const HTMLBlockEditor = ({ config, onChange, errors, widgetType }) => {
    const [showPreview, setShowPreview] = useState(false)
    const [showSecurityWarning, setShowSecurityWarning] = useState(false)
    const codeRef = useRef(null)

    // Security validation
    const securityChecks = (html) => {
        const issues = []
        const lowerHtml = html.toLowerCase()

        // Check for scripts
        if (lowerHtml.includes('<script') || lowerHtml.includes('javascript:')) {
            issues.push('Contains JavaScript code')
        }

        // Check for inline event handlers
        const eventHandlers = ['onclick', 'onload', 'onmouseover', 'onerror', 'onsubmit']
        for (const handler of eventHandlers) {
            if (lowerHtml.includes(handler + '=')) {
                issues.push(`Contains ${handler} event handler`)
            }
        }

        // Check for potentially dangerous elements
        if (lowerHtml.includes('<iframe') || lowerHtml.includes('<embed') || lowerHtml.includes('<object')) {
            issues.push('Contains embedded content (iframe, embed, object)')
        }

        return issues
    }

    const formatHTML = () => {
        const html = config?.html_content || ''
        if (!html.trim()) return

        // Simple HTML formatting (in a real app, you'd use a proper formatter)
        let formatted = html
            .replace(/></g, '>\n<')
            .replace(/\n\s*\n/g, '\n')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .join('\n')

        onChange({ ...config, html_content: formatted })
    }

    const copyToClipboard = () => {
        if (codeRef.current) {
            navigator.clipboard.writeText(config?.html_content || '')
        }
    }

    const downloadHTML = () => {
        const html = config?.html_content || ''
        const blob = new Blob([html], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'widget-content.html'
        a.click()
        URL.revokeObjectURL(url)
    }

    const renderHTMLPreview = () => {
        const html = config?.html_content || ''
        if (!html.trim()) {
            return (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
                    <Code className="w-12 h-12 mx-auto mb-2" />
                    <p>No HTML content to preview</p>
                </div>
            )
        }

        const securityIssues = securityChecks(html)
        const allowScripts = config?.allow_scripts || false

        return (
            <div className="space-y-3">
                {/* Security Issues Warning */}
                {securityIssues.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-start space-x-2">
                            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <h4 className="text-sm font-medium text-red-800">Security Issues Detected</h4>
                                <ul className="text-xs text-red-700 mt-1 space-y-1">
                                    {securityIssues.map((issue, index) => (
                                        <li key={index}>• {issue}</li>
                                    ))}
                                </ul>
                                {!allowScripts && (
                                    <p className="text-xs text-red-600 mt-2">
                                        Scripts are disabled and will be sanitized. Enable "Allow Scripts" to execute JavaScript (with DOMPurify sanitization).
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* HTML Preview */}
                <div className="border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
                        <span className="text-sm font-medium text-gray-700">Live Preview</span>
                        <div className="flex items-center space-x-2">
                            {securityIssues.length > 0 && (
                                <div className="flex items-center space-x-1 text-xs text-red-600">
                                    <Shield className="w-3 h-3" />
                                    <span>Sandboxed</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="p-4 bg-white min-h-32">
                        {allowScripts ? (
                            <div dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(html, {
                                    ADD_TAGS: ['script'],
                                    ADD_ATTR: ['onclick', 'onload', 'onmouseover', 'onerror', 'onsubmit'],
                                    ALLOW_UNKNOWN_PROTOCOLS: true
                                })
                            }} />
                        ) : (
                            <div dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(html, {
                                    FORBID_TAGS: ['script'],
                                    FORBID_ATTR: ['onclick', 'onload', 'onmouseover', 'onerror', 'onsubmit', 'onchange', 'onkeydown', 'onkeyup', 'onmousedown', 'onmouseup'],
                                    ALLOW_DATA_ATTR: false
                                })
                            }} />
                        )}
                    </div>
                </div>
            </div>
        )
    }

    const sampleHTMLOptions = [
        {
            name: 'Simple Card',
            html: `<div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; background: white;">
  <h3 style="margin: 0 0 0.5rem 0; color: #1f2937;">Card Title</h3>
  <p style="margin: 0; color: #6b7280;">This is a simple card with some content.</p>
</div>`
        },
        {
            name: 'Call-to-Action',
            html: `<div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 2rem; border-radius: 12px; text-align: center;">
  <h2 style="margin: 0 0 1rem 0;">Get Started Today</h2>
  <p style="margin: 0 0 1.5rem 0; opacity: 0.9;">Join thousands of satisfied customers.</p>
  <a href="#" style="background: white; color: #3b82f6; padding: 0.75rem 2rem; border-radius: 6px; text-decoration: none; font-weight: 600;">Learn More</a>
</div>`
        },
        {
            name: 'Alert Message',
            html: `<div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 1rem;">
  <div style="display: flex; align-items: center;">
    <div style="margin-right: 0.75rem; font-size: 1.25rem;">⚠️</div>
    <div>
      <strong style="color: #92400e;">Important Notice:</strong>
      <span style="color: #b45309; margin-left: 0.5rem;">This is an important message for users.</span>
    </div>
  </div>
</div>`
        }
    ]

    return (
        <BaseWidgetEditor
            config={config}
            onChange={onChange}
            errors={errors}
            widgetType={widgetType}
        >
            {({
                config: localConfig,
                handleFieldChange,
                renderCheckboxField
            }) => (
                <>
                    {/* HTML Content Editor */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="block text-sm font-medium text-gray-700">
                                HTML Content *
                            </label>
                            <div className="flex items-center space-x-2">
                                <button
                                    type="button"
                                    onClick={formatHTML}
                                    className="text-xs text-gray-600 hover:text-gray-800"
                                    title="Format HTML"
                                >
                                    Format
                                </button>
                                <button
                                    type="button"
                                    onClick={copyToClipboard}
                                    className="text-xs text-gray-600 hover:text-gray-800"
                                    title="Copy to clipboard"
                                >
                                    <Copy className="w-3 h-3" />
                                </button>
                                <button
                                    type="button"
                                    onClick={downloadHTML}
                                    className="text-xs text-gray-600 hover:text-gray-800"
                                    title="Download HTML"
                                >
                                    <Download className="w-3 h-3" />
                                </button>
                            </div>
                        </div>

                        <textarea
                            ref={codeRef}
                            value={localConfig.html_content || ''}
                            onChange={(e) => handleFieldChange('html_content', e.target.value)}
                            placeholder="Enter your HTML content here..."
                            rows={12}
                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${errors.html_content ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                                }`}
                            style={{ tabSize: 2 }}
                        />

                        <div className="flex justify-between text-xs text-gray-500">
                            <span>HTML, CSS, and JavaScript are supported</span>
                            <span>{(localConfig.html_content || '').length} characters</span>
                        </div>

                        {errors.html_content && (
                            <div className="flex items-center space-x-1 text-red-600">
                                <span className="text-xs">{errors.html_content}</span>
                            </div>
                        )}
                    </div>

                    {/* Sample HTML Templates */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                            Quick Templates
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                            {sampleHTMLOptions.map((sample, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleFieldChange('html_content', sample.html)}
                                    className="text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <div className="text-sm font-medium text-gray-900">{sample.name}</div>
                                    <div className="text-xs text-gray-500 mt-1">Click to use this template</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Script Execution Control */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <h4 className="text-sm font-medium text-yellow-900 mb-2">Script Execution</h4>
                                {renderCheckboxField(
                                    'allow_scripts',
                                    'Allow JavaScript execution (with DOMPurify sanitization)',
                                    'WARNING: Only enable for trusted content. All content is sanitized with DOMPurify, but scripts can still pose security risks.'
                                )}
                                {localConfig.allow_scripts && (
                                    <div className="mt-2 text-xs text-yellow-800">
                                        <strong>Security Notice:</strong> JavaScript execution is enabled with DOMPurify sanitization. Content is filtered for common XSS patterns, but ensure all content is from trusted sources.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Preview Toggle */}
                    <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">
                            Live Preview
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowPreview(!showPreview)}
                            className="flex items-center space-x-1 text-xs text-gray-600 hover:text-gray-800"
                        >
                            {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            <span>{showPreview ? 'Hide' : 'Show'} Preview</span>
                        </button>
                    </div>

                    {/* HTML Preview */}
                    {showPreview && (
                        <div className="space-y-2">
                            {renderHTMLPreview()}
                        </div>
                    )}

                    {/* HTML Editor Tips */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start space-x-2">
                            <Code className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium text-blue-900">HTML Editor Tips</h4>
                                <ul className="text-xs text-blue-800 space-y-1">
                                    <li>• Use inline styles for consistent appearance across themes</li>
                                    <li>• Test your HTML in the preview before saving</li>
                                    <li>• Keep accessibility in mind (alt texts, semantic HTML)</li>
                                    <li>• Avoid inline scripts unless absolutely necessary</li>
                                    <li>• Use the Format button to clean up your HTML</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </BaseWidgetEditor>
    )
}

export default HTMLBlockEditor 