import { useState, useEffect } from 'react'
import { Save, X, AlertCircle, Info } from 'lucide-react'
import toast from 'react-hot-toast'

const WidgetConfigurator = ({
    widgetType,
    initialConfig = {},
    onSave,
    onCancel,
    title = "Configure Widget"
}) => {
    const [config, setConfig] = useState(initialConfig)
    const [errors, setErrors] = useState({})
    const [isValid, setIsValid] = useState(true)

    // Initialize config with default values from schema
    useEffect(() => {
        if (widgetType?.json_schema?.properties) {
            const defaultConfig = {}
            Object.entries(widgetType.json_schema.properties).forEach(([key, property]) => {
                if (property.default !== undefined) {
                    defaultConfig[key] = property.default
                }
            })
            setConfig(prev => ({ ...defaultConfig, ...prev }))
        }
    }, [widgetType])

    // Validate configuration against schema
    useEffect(() => {
        validateConfig()
    }, [config, widgetType])

    const validateConfig = () => {
        if (!widgetType?.json_schema) return

        const newErrors = {}
        const schema = widgetType.json_schema
        const required = schema.required || []

        // Check required fields
        required.forEach(field => {
            if (!config[field] || (typeof config[field] === 'string' && config[field].trim() === '')) {
                newErrors[field] = 'This field is required'
            }
        })

        // Validate field types and constraints
        Object.entries(schema.properties || {}).forEach(([key, property]) => {
            const value = config[key]

            if (value !== undefined && value !== null && value !== '') {
                // Type validation
                if (property.type === 'string' && typeof value !== 'string') {
                    newErrors[key] = 'Must be a text value'
                } else if (property.type === 'boolean' && typeof value !== 'boolean') {
                    newErrors[key] = 'Must be true or false'
                } else if (property.type === 'number' && (isNaN(value) || typeof +value !== 'number')) {
                    newErrors[key] = 'Must be a number'
                }

                // Enum validation
                if (property.enum && !property.enum.includes(value)) {
                    newErrors[key] = `Must be one of: ${property.enum.join(', ')}`
                }

                // Pattern validation
                if (property.pattern && typeof value === 'string') {
                    const regex = new RegExp(property.pattern)
                    if (!regex.test(value)) {
                        newErrors[key] = 'Invalid format'
                    }
                }

                // URL format validation
                if (property.format === 'uri' && typeof value === 'string') {
                    try {
                        new URL(value)
                    } catch {
                        newErrors[key] = 'Must be a valid URL'
                    }
                }
            }
        })

        setErrors(newErrors)
        setIsValid(Object.keys(newErrors).length === 0)
    }

    const handleFieldChange = (fieldName, value) => {
        setConfig(prev => ({
            ...prev,
            [fieldName]: value
        }))
    }

    const handleSave = () => {
        if (!isValid) {
            toast.error('Please fix validation errors before saving')
            return
        }

        onSave(config)
    }

    const renderField = (fieldName, property) => {
        const value = config[fieldName] || ''
        const hasError = errors[fieldName]
        const isRequired = widgetType?.json_schema?.required?.includes(fieldName)

        const baseClasses = `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${hasError ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-transparent'
            }`

        let inputElement

        if (property.type === 'boolean') {
            inputElement = (
                <label className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        checked={value === true}
                        onChange={(e) => handleFieldChange(fieldName, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{property.title}</span>
                </label>
            )
        } else if (property.enum) {
            inputElement = (
                <select
                    value={value}
                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                    className={baseClasses}
                >
                    <option value="">Select {property.title}</option>
                    {property.enum.map(option => (
                        <option key={option} value={option}>
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                        </option>
                    ))}
                </select>
            )
        } else if (property.format === 'textarea') {
            inputElement = (
                <textarea
                    value={value}
                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                    placeholder={property.description}
                    rows={4}
                    className={baseClasses}
                />
            )
        } else {
            inputElement = (
                <input
                    type={property.type === 'number' ? 'number' : 'text'}
                    value={value}
                    onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                    placeholder={property.description}
                    className={baseClasses}
                />
            )
        }

        return (
            <div key={fieldName} className="space-y-2">
                {property.type !== 'boolean' && (
                    <label className="block">
                        <span className="text-sm font-medium text-gray-700">
                            {property.title}
                            {isRequired && <span className="text-red-500 ml-1">*</span>}
                        </span>
                    </label>
                )}

                {inputElement}

                {property.description && property.type !== 'boolean' && (
                    <div className="flex items-start space-x-1">
                        <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-500">{property.description}</p>
                    </div>
                )}

                {hasError && (
                    <div className="flex items-start space-x-1">
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-red-600">{hasError}</p>
                    </div>
                )}
            </div>
        )
    }

    if (!widgetType) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="text-center text-gray-500">
                    <p>No widget type selected</p>
                </div>
            </div>
        )
    }

    const schema = widgetType.json_schema
    const properties = schema?.properties || {}

    return (
        <div className="bg-white rounded-lg shadow">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">{title}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Configuring: {widgetType.name}
                    </p>
                </div>
                <button
                    onClick={onCancel}
                    className="text-gray-400 hover:text-gray-500"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Configuration Form */}
            <div className="p-6">
                {Object.keys(properties).length > 0 ? (
                    <div className="space-y-6">
                        {Object.entries(properties).map(([fieldName, property]) =>
                            renderField(fieldName, property)
                        )}
                    </div>
                ) : (
                    <div className="text-center text-gray-500 py-8">
                        <p>No configuration options available for this widget type.</p>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200 flex items-center justify-end space-x-3">
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={!isValid}
                    className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${isValid
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                >
                    <Save className="w-4 h-4 mr-2" />
                    Save Configuration
                </button>
            </div>

            {/* Validation Summary */}
            {Object.keys(errors).length > 0 && (
                <div className="p-4 border-t border-red-200 bg-red-50">
                    <div className="flex items-start space-x-2">
                        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                            <h4 className="text-sm font-medium text-red-800">
                                Please fix the following errors:
                            </h4>
                            <ul className="text-xs text-red-700 mt-1 space-y-1">
                                {Object.entries(errors).map(([field, error]) => (
                                    <li key={field}>
                                        <strong>{properties[field]?.title || field}:</strong> {error}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default WidgetConfigurator 