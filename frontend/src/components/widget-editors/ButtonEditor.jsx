import { useState } from 'react'
import { ExternalLink, MousePointer, Eye } from 'lucide-react'
import BaseWidgetEditor from './BaseWidgetEditor'

/**
 * ButtonEditor - Specialized editor for Button widgets
 * 
 * Features:
 * - Interactive button style preview
 * - Link configuration with validation
 * - Size and style options
 * - Target window controls
 */
const ButtonEditor = ({ config, onChange, errors, widgetType }) => {
    const [showPreview, setShowPreview] = useState(true)

    const styleOptions = [
        { value: 'primary', label: 'Primary', color: 'bg-blue-600 text-white' },
        { value: 'secondary', label: 'Secondary', color: 'bg-gray-600 text-white' },
        { value: 'outline', label: 'Outline', color: 'border-2 border-blue-600 text-blue-600 bg-transparent' }
    ]

    const sizeOptions = [
        { value: 'small', label: 'Small', classes: 'text-sm px-4 py-1' },
        { value: 'medium', label: 'Medium', classes: 'text-base px-6 py-2' },
        { value: 'large', label: 'Large', classes: 'text-lg px-8 py-3' }
    ]

    const renderButtonPreview = () => {
        const previewConfig = config || {}

        const styleClasses = {
            primary: 'bg-blue-600 text-white hover:bg-blue-700',
            secondary: 'bg-gray-600 text-white hover:bg-gray-700',
            outline: 'border-2 border-blue-600 text-blue-600 bg-transparent hover:bg-blue-600 hover:text-white'
        }

        const sizeClasses = {
            small: 'text-sm px-4 py-1',
            medium: 'text-base px-6 py-2',
            large: 'text-lg px-8 py-3'
        }

        return (
            <div className="flex justify-center">
                <button
                    type="button"
                    className={`rounded-lg transition-all duration-200 cursor-pointer ${styleClasses[previewConfig.style] || styleClasses.primary
                        } ${sizeClasses[previewConfig.size] || sizeClasses.medium
                        }`}
                    onClick={() => {
                        if (previewConfig.url) {
                            window.open(
                                previewConfig.url,
                                previewConfig.open_in_new_tab ? '_blank' : '_self'
                            )
                        }
                    }}
                >
                    <div className="flex items-center space-x-2">
                        <span>{previewConfig.text || 'Button Text'}</span>
                        {previewConfig.open_in_new_tab && (
                            <ExternalLink className="w-4 h-4" />
                        )}
                    </div>
                </button>
            </div>
        )
    }

    const validateUrl = (url) => {
        if (!url) return true // Optional field

        try {
            new URL(url)
            return true
        } catch {
            // Try with https prefix
            try {
                new URL(`https://${url}`)
                return true
            } catch {
                return false
            }
        }
    }

    const formatUrl = (url) => {
        if (!url) return url

        // If it looks like a URL but doesn't have protocol, add https
        if (!url.startsWith('http://') && !url.startsWith('https://') && url.includes('.')) {
            return `https://${url}`
        }

        return url
    }

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
                renderTextField,
                renderSelectField,
                renderCheckboxField
            }) => (
                <>
                    {/* Button Text */}
                    {renderTextField('text', 'Button Text', {
                        placeholder: 'Enter button text'
                    })}

                    {/* URL Field with validation */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Link URL *
                        </label>
                        <div className="relative">
                            <input
                                type="url"
                                value={localConfig.url || ''}
                                onChange={(e) => {
                                    const formattedUrl = formatUrl(e.target.value)
                                    handleFieldChange('url', formattedUrl)
                                }}
                                placeholder="https://example.com or /internal-page"
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.url ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                                    }`}
                            />
                            {localConfig.url && (
                                <div className="absolute right-2 top-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (localConfig.url) {
                                                window.open(localConfig.url, '_blank')
                                            }
                                        }}
                                        className="text-gray-400 hover:text-blue-600"
                                        title="Test link"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {localConfig.url && !validateUrl(localConfig.url) && (
                            <div className="text-xs text-amber-600">
                                <span>⚠️ URL format may be invalid. Links starting with '/' are treated as internal.</span>
                            </div>
                        )}

                        <div className="text-xs text-gray-500">
                            <span>Examples: https://example.com, /about, mailto:user@example.com</span>
                        </div>

                        {errors.url && (
                            <div className="flex items-center space-x-1 text-red-600">
                                <span className="text-xs">{errors.url}</span>
                            </div>
                        )}
                    </div>

                    {/* Button Style with Visual Preview */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                            Button Style
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {styleOptions.map(option => (
                                <label
                                    key={option.value}
                                    className={`cursor-pointer border-2 rounded-lg p-3 text-center transition-all ${localConfig.style === option.value
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="button-style"
                                        value={option.value}
                                        checked={localConfig.style === option.value}
                                        onChange={(e) => handleFieldChange('style', e.target.value)}
                                        className="sr-only"
                                    />
                                    <div className={`w-full py-2 px-4 rounded ${option.color} text-sm mb-2`}>
                                        Sample
                                    </div>
                                    <span className="text-xs font-medium">{option.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Button Size */}
                    {renderSelectField('size', 'Button Size', sizeOptions)}

                    {/* Open in New Tab */}
                    {renderCheckboxField(
                        'open_in_new_tab',
                        'Open in new tab',
                        'Check this to open the link in a new browser tab'
                    )}

                    {/* Live Preview Toggle */}
                    <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">
                            Interactive Preview
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowPreview(!showPreview)}
                            className="flex items-center space-x-1 text-xs text-gray-600 hover:text-gray-800"
                        >
                            <Eye className="w-3 h-3" />
                            <span>{showPreview ? 'Hide' : 'Show'}</span>
                        </button>
                    </div>

                    {/* Interactive Preview */}
                    {showPreview && (
                        <div className="space-y-2">
                            <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                                {renderButtonPreview()}
                            </div>
                            <div className="text-xs text-gray-500 space-y-1">
                                <p>• Click the preview button to test the link</p>
                                <p>• Button styles and sizes update in real-time</p>
                                <p>• External link icon appears when "Open in new tab" is enabled</p>
                            </div>
                        </div>
                    )}

                    {/* Button Usage Tips */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start space-x-2">
                            <MousePointer className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium text-blue-900">Button Best Practices</h4>
                                <ul className="text-xs text-blue-800 space-y-1">
                                    <li>• Use clear, action-oriented text (e.g., "Learn More", "Get Started")</li>
                                    <li>• Primary style for main actions, Secondary for supporting actions</li>
                                    <li>• Outline style works well for less prominent actions</li>
                                    <li>• Test your links to ensure they work correctly</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </BaseWidgetEditor>
    )
}

export default ButtonEditor 