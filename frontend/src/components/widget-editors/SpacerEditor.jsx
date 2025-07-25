import { useState } from 'react'
import { Ruler, Eye } from 'lucide-react'
import BaseWidgetEditor from './BaseWidgetEditor'

/**
 * SpacerEditor - Specialized editor for Spacer widgets
 * 
 * Features:
 * - Visual height selection
 * - Custom height input with validation
 * - Live preview of spacing
 * - Preset height options
 */
const SpacerEditor = ({ config, onChange, errors, widgetType }) => {
    const [showPreview, setShowPreview] = useState(true)

    const heightOptions = [
        { value: 'small', label: 'Small', pixels: '16px', description: '1rem spacing' },
        { value: 'medium', label: 'Medium', pixels: '32px', description: '2rem spacing' },
        { value: 'large', label: 'Large', pixels: '64px', description: '4rem spacing' },
        { value: 'custom', label: 'Custom', pixels: 'custom', description: 'Set your own height' }
    ]

    const getHeightValue = () => {
        const currentConfig = config || {}
        if (currentConfig.height === 'custom' && currentConfig.custom_height) {
            return currentConfig.custom_height
        }

        const option = heightOptions.find(opt => opt.value === currentConfig.height)
        return option ? option.pixels : '32px'
    }

    const validateCustomHeight = (value) => {
        if (!value) return false
        // Must be in format like "20px", "1.5rem", "2em"
        return /^[0-9]+(\.[0-9]+)?(px|rem|em)$/.test(value)
    }

    const renderSpacerPreview = () => {
        const heightValue = getHeightValue()
        const isCustom = config?.height === 'custom'
        const customHeight = config?.custom_height || '32px'

        const actualHeight = isCustom && validateCustomHeight(customHeight)
            ? customHeight
            : heightValue !== 'custom' ? heightValue : '32px'

        return (
            <div className="border border-gray-200 rounded-lg bg-gray-50 p-4">
                <div className="flex items-center justify-center">
                    <div className="w-full max-w-md">
                        {/* Before spacer content */}
                        <div className="bg-blue-100 border border-blue-300 rounded p-2 text-center text-sm text-blue-800">
                            Content before spacer
                        </div>

                        {/* The actual spacer */}
                        <div
                            className="bg-gradient-to-r from-gray-200 to-gray-300 border-l-2 border-r-2 border-dashed border-gray-400 relative"
                            style={{ height: actualHeight }}
                        >
                            {/* Height indicator */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-white px-2 py-1 rounded shadow-sm border text-xs text-gray-600 flex items-center space-x-1">
                                    <Ruler className="w-3 h-3" />
                                    <span>{actualHeight}</span>
                                </div>
                            </div>
                        </div>

                        {/* After spacer content */}
                        <div className="bg-green-100 border border-green-300 rounded p-2 text-center text-sm text-green-800">
                            Content after spacer
                        </div>
                    </div>
                </div>
            </div>
        )
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
                renderTextField
            }) => (
                <>
                    {/* Height Selection with Visual Options */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                            Spacer Height
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {heightOptions.map(option => (
                                <label
                                    key={option.value}
                                    className={`cursor-pointer border-2 rounded-lg p-3 transition-all ${localConfig.height === option.value
                                            ? 'border-blue-500 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="spacer-height"
                                        value={option.value}
                                        checked={localConfig.height === option.value}
                                        onChange={(e) => handleFieldChange('height', e.target.value)}
                                        className="sr-only"
                                    />
                                    <div className="text-center">
                                        {/* Visual height representation */}
                                        <div className="mb-2 flex justify-center">
                                            <div
                                                className={`bg-gray-300 w-16 rounded ${option.value === 'small' ? 'h-2' :
                                                        option.value === 'medium' ? 'h-4' :
                                                            option.value === 'large' ? 'h-8' :
                                                                'h-6 border-2 border-dashed border-gray-400'
                                                    }`}
                                            />
                                        </div>
                                        <div className="text-sm font-medium">{option.label}</div>
                                        <div className="text-xs text-gray-500">{option.description}</div>
                                        {option.pixels !== 'custom' && (
                                            <div className="text-xs text-gray-400 mt-1">{option.pixels}</div>
                                        )}
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Custom Height Input */}
                    {localConfig.height === 'custom' && (
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                Custom Height *
                            </label>
                            <input
                                type="text"
                                value={localConfig.custom_height || ''}
                                onChange={(e) => handleFieldChange('custom_height', e.target.value)}
                                placeholder="e.g., 48px, 3rem, 2.5em"
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.custom_height ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                                    }`}
                            />
                            <div className="text-xs text-gray-500 space-y-1">
                                <p>• Use CSS units: px (pixels), rem (relative), em (relative to font)</p>
                                <p>• Examples: 24px, 1.5rem, 2em</p>
                            </div>

                            {localConfig.custom_height && !validateCustomHeight(localConfig.custom_height) && (
                                <div className="text-xs text-red-600">
                                    ⚠️ Height must include a unit (px, rem, or em). Example: "24px"
                                </div>
                            )}

                            {errors.custom_height && (
                                <div className="flex items-center space-x-1 text-red-600">
                                    <span className="text-xs">{errors.custom_height}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Live Preview Toggle */}
                    <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">
                            Visual Preview
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

                    {/* Spacer Preview */}
                    {showPreview && (
                        <div className="space-y-2">
                            {renderSpacerPreview()}
                            <div className="text-xs text-gray-500 space-y-1">
                                <p>• The spacer creates vertical space between content elements</p>
                                <p>• Dashed area represents the invisible spacer element</p>
                                <p>• Height value is shown in the center</p>
                            </div>
                        </div>
                    )}

                    {/* Spacer Usage Tips */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start space-x-2">
                            <Ruler className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="space-y-1">
                                <h4 className="text-sm font-medium text-blue-900">Spacer Best Practices</h4>
                                <ul className="text-xs text-blue-800 space-y-1">
                                    <li>• Use consistent spacing throughout your page for better design</li>
                                    <li>• Small (16px) for tight spacing between related elements</li>
                                    <li>• Medium (32px) for general content separation</li>
                                    <li>• Large (64px) for major section breaks</li>
                                    <li>• Custom heights for specific design requirements</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </BaseWidgetEditor>
    )
}

export default SpacerEditor 