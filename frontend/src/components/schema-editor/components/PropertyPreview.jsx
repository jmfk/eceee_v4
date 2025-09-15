import React from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * PropertyPreview Component
 * 
 * Shows a preview of how the property will appear in forms.
 */
export default function PropertyPreview({
    property,
    isVisible = false,
    onToggle
}) {
    if (!isVisible) {
        return (
            <button
                type="button"
                onClick={onToggle}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 text-sm"
            >
                <Eye className="w-4 h-4" />
                <span>Preview</span>
            </button>
        )
    }

    return (
        <div className="border-t border-gray-200 mt-4 pt-4">
            <div className="flex items-center justify-between mb-3">
                <h5 className="text-sm font-medium text-gray-900">Field Preview</h5>
                <button
                    type="button"
                    onClick={onToggle}
                    className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 text-sm"
                >
                    <EyeOff className="w-4 h-4" />
                    <span>Hide</span>
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-md p-4">
                <div className="space-y-2">
                    {/* Field Label */}
                    <label className="block text-sm font-medium text-gray-700">
                        {property.title || property.key || 'Untitled Field'}
                        {property.required && <span className="text-red-500 ml-1">*</span>}
                    </label>

                    {/* Field Description */}
                    {property.description && (
                        <div className="text-sm text-gray-600">{property.description}</div>
                    )}

                    {/* Mock Field Input */}
                    <div className="mt-2">
                        {renderMockInput(property)}
                    </div>
                </div>
            </div>
        </div>
    )
}

/**
 * Render a mock input based on property configuration
 */
function renderMockInput(property) {
    const baseClasses = "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"

    switch (property.component) {
        case 'TextInput':
        case 'EmailInput':
        case 'URLInput':
        case 'PasswordInput':
            return (
                <input
                    type={getInputType(property.component)}
                    className={baseClasses}
                    placeholder={property.placeholder || `Enter ${property.title || 'value'}...`}
                    disabled
                />
            )

        case 'TextareaInput':
            return (
                <textarea
                    className={baseClasses}
                    placeholder={property.placeholder || `Enter ${property.title || 'text'}...`}
                    rows={property.rows || 3}
                    disabled
                />
            )

        case 'NumberInput':
            return (
                <input
                    type="number"
                    className={baseClasses}
                    placeholder={property.placeholder || '0'}
                    min={property.minimum}
                    max={property.maximum}
                    step={property.step}
                    disabled
                />
            )

        case 'BooleanInput':
            return (
                <div className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        checked={property.default || false}
                        disabled
                    />
                    <span className="text-sm text-gray-700">
                        {property.trueLabel || 'Enabled'}
                    </span>
                </div>
            )

        case 'SelectInput':
            return (
                <select className={baseClasses} disabled>
                    <option value="">{property.placeholder || 'Select an option...'}</option>
                    {(property.enum || []).map((option, index) => (
                        <option key={index} value={option}>{option}</option>
                    ))}
                </select>
            )

        case 'DateInput':
            return (
                <input
                    type="date"
                    className={baseClasses}
                    disabled
                />
            )

        case 'DateTimeInput':
            return (
                <input
                    type="datetime-local"
                    className={baseClasses}
                    disabled
                />
            )

        case 'ColorInput':
            return (
                <div className="flex items-center space-x-2">
                    <input
                        type="color"
                        className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                        disabled
                    />
                    <input
                        type="text"
                        className={baseClasses}
                        placeholder="#000000"
                        disabled
                    />
                </div>
            )

        case 'ImageInput':
        case 'FileInput':
            return (
                <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                    <div className="text-gray-500 text-sm">
                        {property.component === 'ImageInput' ? 'Click to upload image' : 'Click to upload file'}
                    </div>
                </div>
            )

        default:
            return (
                <div className="bg-gray-100 border border-gray-300 rounded-md p-3 text-center text-sm text-gray-500">
                    Preview not available for {property.component}
                </div>
            )
    }
}

/**
 * Get HTML input type for component
 */
function getInputType(component) {
    switch (component) {
        case 'EmailInput':
            return 'email'
        case 'URLInput':
            return 'url'
        case 'PasswordInput':
            return 'password'
        default:
            return 'text'
    }
}
