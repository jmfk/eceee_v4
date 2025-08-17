import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, Info } from 'lucide-react'

/**
 * BaseWidgetEditor - Common functionality for all widget editors
 * 
 * Provides:
 * - Field validation and error handling
 * - Common form input components
 * - Consistent styling and layout
 * - Live preview integration
 */
const BaseWidgetEditor = ({
    config,
    onChange,
    errors = {},
    widgetType,
    children,
    className = ''
}) => {
    const [localConfig, setLocalConfig] = useState(config || {})

    // Sync with parent config changes
    useEffect(() => {
        setLocalConfig(config || {})
    }, [config])

    // Handle field changes with validation
    const handleFieldChange = useCallback((fieldName, value) => {
        const newConfig = { ...localConfig, [fieldName]: value }
        setLocalConfig(newConfig)

        // Debounced onChange to avoid excessive updates
        if (onChange) {
            setTimeout(() => onChange(newConfig), 100)
        }
    }, [localConfig, onChange])

    // Common field components
    const renderTextField = (fieldName, label, props = {}) => {
        const value = localConfig[fieldName] || ''
        const error = errors[fieldName]
        const isRequired = widgetType?.configurationSchema?.required?.includes(fieldName)

        return (
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                        }`}
                    {...props}
                />
                {error && (
                    <div className="flex items-center space-x-1 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs">{error}</span>
                    </div>
                )}
            </div>
        )
    }

    const renderTextArea = (fieldName, label, props = {}) => {
        const value = localConfig[fieldName] || ''
        const error = errors[fieldName]
        const isRequired = widgetType?.configurationSchema?.required?.includes(fieldName)

        return (
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                <textarea
                    value={value}
                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                        }`}
                    rows={4}
                    {...props}
                />
                {error && (
                    <div className="flex items-center space-x-1 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs">{error}</span>
                    </div>
                )}
            </div>
        )
    }

    const renderSelectField = (fieldName, label, options = [], props = {}) => {
        const value = localConfig[fieldName] || ''
        const error = errors[fieldName]
        const isRequired = widgetType?.configurationSchema?.required?.includes(fieldName)

        return (
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                <select
                    value={value}
                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                        }`}
                    {...props}
                >
                    <option value="">Select {label}</option>
                    {options.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {error && (
                    <div className="flex items-center space-x-1 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs">{error}</span>
                    </div>
                )}
            </div>
        )
    }

    const renderCheckboxField = (fieldName, label, description = null) => {
        const value = localConfig[fieldName] || false

        return (
            <div className="flex items-start space-x-3">
                <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => handleFieldChange(fieldName, e.target.checked)}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700">
                        {label}
                    </label>
                    {description && (
                        <div className="flex items-start space-x-1 mt-1">
                            <Info className="w-3 h-3 text-gray-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-gray-500">{description}</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const renderDateField = (fieldName, label, props = {}) => {
        const value = localConfig[fieldName] || ''
        const error = errors[fieldName]
        const isRequired = widgetType?.configurationSchema?.required?.includes(fieldName)

        return (
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                    type="date"
                    value={value}
                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                        }`}
                    {...props}
                />
                {error && (
                    <div className="flex items-center space-x-1 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs">{error}</span>
                    </div>
                )}
            </div>
        )
    }

    const renderDateTimeField = (fieldName, label, props = {}) => {
        const value = localConfig[fieldName] || ''
        const error = errors[fieldName]
        const isRequired = widgetType?.configurationSchema?.required?.includes(fieldName)

        return (
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                    type="datetime-local"
                    value={value}
                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                        }`}
                    {...props}
                />
                {error && (
                    <div className="flex items-center space-x-1 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs">{error}</span>
                    </div>
                )}
            </div>
        )
    }

    const renderUrlField = (fieldName, label, props = {}) => {
        const value = localConfig[fieldName] || ''
        const error = errors[fieldName]
        const isRequired = widgetType?.configurationSchema?.required?.includes(fieldName)

        return (
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input
                    type="url"
                    value={value}
                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                    placeholder="https://example.com"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
                        }`}
                    {...props}
                />
                {error && (
                    <div className="flex items-center space-x-1 text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-xs">{error}</span>
                    </div>
                )}
            </div>
        )
    }

    // Provide all helper functions to child components
    const editorProps = {
        config: localConfig,
        handleFieldChange,
        renderTextField,
        renderTextArea,
        renderSelectField,
        renderCheckboxField,
        renderDateField,
        renderDateTimeField,
        renderUrlField,
        errors,
        widgetType
    }

    return (
        <div className={`space-y-6 ${className}`}>
            {children(editorProps)}
        </div>
    )
}

export default BaseWidgetEditor 