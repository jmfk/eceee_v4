import React from 'react'
import ComponentTypeSelector from '../components/ComponentTypeSelector'

/**
 * Date Range Property Configuration Component
 * 
 * Handles configuration for date_range fields.
 * 
 * Configuration options:
 * - allowSameDate: Allow start and end date to be the same
 * - showPresets: Show preset date ranges (Today, Last 7 days, etc.)
 * - minDate: Minimum selectable date
 * - maxDate: Maximum selectable date
 */
export default function DateRangePropertyConfig({
    property,
    onChange,
    onValidate,
    errors = {}
}) {
    const handleChange = (field, value) => {
        const updated = { ...property, [field]: value }
        onChange(updated)
    }

    return (
        <div className="space-y-4">
            {/* Basic Configuration */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Property Key <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={property.key || ''}
                        onChange={(e) => handleChange('key', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.key ? 'border-red-300' : 'border-gray-300'
                            }`}
                        placeholder="propertyName"
                    />
                    {errors.key && (
                        <div className="text-red-500 text-xs mt-1">{errors.key}</div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Label <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={property.title || ''}
                        onChange={(e) => handleChange('title', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors.title ? 'border-red-300' : 'border-gray-300'
                            }`}
                        placeholder="Display Name"
                    />
                    {errors.title && (
                        <div className="text-red-500 text-xs mt-1">{errors.title}</div>
                    )}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Component Type <span className="text-red-500">*</span>
                </label>
                <ComponentTypeSelector
                    value={property.componentType || property.component}
                    onChange={(newType) => handleChange('componentType', newType)}
                    error={errors.componentType}
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                </label>
                <input
                    type="text"
                    value={property.description || ''}
                    onChange={(e) => handleChange('description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Help text for this field"
                />
            </div>

            {/* Date Range Specific Configuration */}
            <div className="border-t pt-4">
                <div className="text-sm font-medium text-gray-900 mb-3" role="heading" aria-level="4">Date Range Configuration</div>

                {/* Date Constraints */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Minimum Date (Optional)
                        </label>
                        <input
                            type="date"
                            value={property.minDate || ''}
                            onChange={(e) => handleChange('minDate', e.target.value || null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                            Users cannot select dates before this
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Maximum Date (Optional)
                        </label>
                        <input
                            type="date"
                            value={property.maxDate || ''}
                            onChange={(e) => handleChange('maxDate', e.target.value || null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                            Users cannot select dates after this
                        </div>
                    </div>
                </div>

                {/* Options */}
                <div className="space-y-3">
                    <div className="text-sm font-medium text-gray-900" role="heading" aria-level="5">Options</div>

                    <div className="flex items-start space-x-3">
                        <div className="flex items-center h-5">
                            <input
                                type="checkbox"
                                id={`allowSameDate-${property.key}`}
                                checked={property.allowSameDate !== false}
                                onChange={(e) => handleChange('allowSameDate', e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                        </div>
                        <div className="flex-1">
                            <label htmlFor={`allowSameDate-${property.key}`} className="text-sm text-gray-700">
                                Allow same start and end date
                            </label>
                            <div className="text-xs text-gray-500 mt-1">
                                Permit selecting the same date for both start and end
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start space-x-3">
                        <div className="flex items-center h-5">
                            <input
                                type="checkbox"
                                id={`showPresets-${property.key}`}
                                checked={property.showPresets !== false}
                                onChange={(e) => handleChange('showPresets', e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                        </div>
                        <div className="flex-1">
                            <label htmlFor={`showPresets-${property.key}`} className="text-sm text-gray-700">
                                Show preset ranges
                            </label>
                            <div className="text-xs text-gray-500 mt-1">
                                Display quick selection options (Today, Last 7 days, Last 30 days, etc.)
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start space-x-3">
                        <div className="flex items-center h-5">
                            <input
                                type="checkbox"
                                id={`clearable-${property.key}`}
                                checked={property.clearable !== false}
                                onChange={(e) => handleChange('clearable', e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                        </div>
                        <div className="flex-1">
                            <label htmlFor={`clearable-${property.key}`} className="text-sm text-gray-700">
                                Allow clearing selection
                            </label>
                            <div className="text-xs text-gray-500 mt-1">
                                Show a clear button to remove the selected date range
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Required toggle */}
            <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
                <input
                    type="checkbox"
                    id={`required-${property.key}`}
                    checked={property.required || false}
                    onChange={(e) => handleChange('required', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor={`required-${property.key}`} className="text-sm font-medium text-gray-700">
                    Required field
                </label>
            </div>
        </div>
    )
}

