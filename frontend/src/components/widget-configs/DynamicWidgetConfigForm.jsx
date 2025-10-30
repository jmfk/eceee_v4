import React, { useState, useEffect } from 'react'
import { Loader, AlertCircle, Code } from 'lucide-react'
import { initializeWidgetConfigRegistry, getWidgetSchema, isWidgetConfigRegistryInitialized } from './WidgetConfigRegistry'
import SliderInput from './field-components/SliderInput'
import SegmentedControl from './field-components/SegmentedControl'
import ReorderableListInput from './field-components/ReorderableListInput'
import { formatFieldLabel } from '../../utils/labelFormatting'

/**
 * Dynamic Widget Configuration Form
 * 
 * Generates a form for widget configuration based on the widget's Pydantic model schema
 */
export default function DynamicWidgetConfigForm({
    widgetType,
    config = {},
    onChange,
    disabled = false,
    showJsonToggle = true
}) {
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const [schema, setSchema] = useState(null)
    const [viewMode, setViewMode] = useState('form') // 'form' or 'json'
    const [jsonValue, setJsonValue] = useState('')
    const [jsonError, setJsonError] = useState('')

    useEffect(() => {
        const loadSchema = async () => {
            try {
                setIsLoading(true)
                setError(null)

                // Initialize registry if needed
                if (!isWidgetConfigRegistryInitialized()) {
                    await initializeWidgetConfigRegistry()
                }

                // Get schema for this widget type
                const widgetSchema = getWidgetSchema(widgetType)

                if (!widgetSchema) {
                    throw new Error(`No configuration schema found for widget type: ${widgetType}`)
                }

                setSchema(widgetSchema)
            } catch (err) {
                console.error('Failed to load widget schema:', err)
                setError(err.message)
            } finally {
                setIsLoading(false)
            }
        }

        loadSchema()
    }, [widgetType])

    // Sync JSON view with config
    useEffect(() => {
        if (viewMode === 'json') {
            setJsonValue(JSON.stringify(config, null, 2))
        }
    }, [config, viewMode])

    const handleFieldChange = (fieldName, value) => {
        const newConfig = { ...config, [fieldName]: value }
        onChange(newConfig)
    }

    const handleJsonChange = (newJsonString) => {
        setJsonValue(newJsonString)

        try {
            const parsed = JSON.parse(newJsonString)
            setJsonError('')
            onChange(parsed)
        } catch (err) {
            setJsonError('Invalid JSON')
        }
    }

    const renderField = (fieldName, fieldMeta) => {
        const { type, description, required, ui = {}, enum: enumValues, minimum, maximum, minLength, maxLength } = fieldMeta
        const fieldValue = config[fieldName]
        const component = ui.component || 'TextInput'
        const fieldLabel = ui.label || formatFieldLabel(fieldName)

        // Hidden fields
        if (ui.hidden) {
            return null
        }

        // Check for validation errors
        const hasValidationError = required && (fieldValue === undefined || fieldValue === null || fieldValue === '')

        // Common props
        const commonProps = {
            label: fieldLabel + (required ? ' *' : ''),
            description: description || ui.helpText,
            value: fieldValue,
            onChange: (value) => handleFieldChange(fieldName, value),
            disabled: disabled,
            className: 'w-full'
        }

        // Render based on component type
        switch (component) {
            case 'TextInput':
                return (
                    <div key={fieldName}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {commonProps.label}
                        </label>
                        <input
                            type="text"
                            value={fieldValue || ''}
                            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                            placeholder={ui.placeholder}
                            disabled={disabled}
                            minLength={minLength}
                            maxLength={maxLength}
                            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${hasValidationError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                }`}
                        />
                        {hasValidationError && (
                            <p className="text-xs text-red-600 mt-1">This field is required</p>
                        )}
                        {!hasValidationError && description && (
                            <p className="text-xs text-gray-500 mt-1">{description}</p>
                        )}
                    </div>
                )

            case 'TextareaInput':
            case 'HtmlSource':
                return (
                    <div key={fieldName}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {commonProps.label}
                        </label>
                        <textarea
                            value={fieldValue || ''}
                            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                            placeholder={ui.placeholder}
                            rows={ui.rows || 4}
                            disabled={disabled}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        />
                        {description && (
                            <p className="text-xs text-gray-500 mt-1">{description}</p>
                        )}
                    </div>
                )

            case 'NumberInput':
                return (
                    <div key={fieldName}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {commonProps.label}
                        </label>
                        <input
                            type="number"
                            value={fieldValue ?? ''}
                            onChange={(e) => handleFieldChange(fieldName, e.target.value ? parseFloat(e.target.value) : null)}
                            min={minimum}
                            max={maximum}
                            disabled={disabled}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {description && (
                            <p className="text-xs text-gray-500 mt-1">{description}</p>
                        )}
                    </div>
                )

            case 'BooleanInput':
                return (
                    <div key={fieldName} className="flex items-start space-x-3">
                        <div className="flex items-center h-5">
                            <input
                                type="checkbox"
                                checked={fieldValue || false}
                                onChange={(e) => handleFieldChange(fieldName, e.target.checked)}
                                disabled={disabled}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-sm font-medium text-gray-700">
                                {commonProps.label}
                            </label>
                            {description && (
                                <p className="text-xs text-gray-500 mt-1">{description}</p>
                            )}
                            {ui.warning && (
                                <p className="text-xs text-amber-600 mt-1 flex items-center">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Warning: Use with caution
                                </p>
                            )}
                        </div>
                    </div>
                )

            case 'SelectInput':
                const selectOptions = enumValues || ui.options || []
                return (
                    <div key={fieldName}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {commonProps.label}
                        </label>
                        <select
                            value={fieldValue || ''}
                            onChange={(e) => handleFieldChange(fieldName, e.target.value || null)}
                            disabled={disabled}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            {ui.placeholder && (
                                <option value="">{ui.placeholder}</option>
                            )}
                            {selectOptions.map((option) => {
                                const optionValue = typeof option === 'string' ? option : option.value
                                const optionLabel = typeof option === 'string' ? option : option.label
                                return (
                                    <option key={optionValue} value={optionValue}>
                                        {optionLabel}
                                    </option>
                                )
                            })}
                        </select>
                        {description && (
                            <p className="text-xs text-gray-500 mt-1">{description}</p>
                        )}
                    </div>
                )

            case 'SliderInput':
                return (
                    <SliderInput
                        key={fieldName}
                        {...commonProps}
                        min={ui.min || minimum || 0}
                        max={ui.max || maximum || 100}
                        step={ui.step || 1}
                        unit={ui.unit}
                        showValue={ui.showValue !== false}
                    />
                )

            case 'SegmentedControlInput':
                return (
                    <SegmentedControl
                        key={fieldName}
                        {...commonProps}
                        options={ui.options || enumValues || []}
                    />
                )

            case 'ReorderableInput':
                return (
                    <ReorderableListInput
                        key={fieldName}
                        {...commonProps}
                        itemTemplate={ui.itemTemplate || {}}
                        allowAdd={ui.allowAdd !== false}
                        allowRemove={ui.allowRemove !== false}
                        allowReorder={ui.allowReorder !== false}
                    />
                )

            case 'URLInput':
                return (
                    <div key={fieldName}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {commonProps.label}
                        </label>
                        <input
                            type="url"
                            value={fieldValue || ''}
                            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                            placeholder={ui.placeholder}
                            disabled={disabled}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {description && (
                            <p className="text-xs text-gray-500 mt-1">{description}</p>
                        )}
                    </div>
                )

            default:
                // Fallback for unsupported component types
                return (
                    <div key={fieldName}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {commonProps.label}
                        </label>
                        <input
                            type="text"
                            value={typeof fieldValue === 'object' ? JSON.stringify(fieldValue) : fieldValue || ''}
                            onChange={(e) => {
                                try {
                                    const parsed = JSON.parse(e.target.value)
                                    handleFieldChange(fieldName, parsed)
                                } catch {
                                    handleFieldChange(fieldName, e.target.value)
                                }
                            }}
                            placeholder={ui.placeholder}
                            disabled={disabled}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {description || `Component type: ${component}`}
                        </p>
                    </div>
                )
        }
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                <span className="text-gray-600">Loading configuration...</span>
            </div>
        )
    }

    // Error state
    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                    <div>
                        <div className="text-red-800 font-medium">Failed to load configuration</div>
                        <div className="text-red-700 text-sm mt-1">{error}</div>
                    </div>
                </div>
            </div>
        )
    }

    // No schema available
    if (!schema || !schema.fields) {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-center">
                <p className="text-gray-600">No configuration available for this widget type</p>
            </div>
        )
    }

    // Group fields by group property
    const groupedFields = {}
    const ungroupedFields = []

    Object.entries(schema.fields).forEach(([fieldName, fieldMeta]) => {
        const group = fieldMeta.ui?.group

        if (group) {
            if (!groupedFields[group]) {
                groupedFields[group] = []
            }
            groupedFields[group].push([fieldName, fieldMeta])
        } else {
            ungroupedFields.push([fieldName, fieldMeta])
        }
    })

    // Sort fields by order property
    const sortByOrder = (a, b) => {
        const orderA = a[1].ui?.order ?? 999
        const orderB = b[1].ui?.order ?? 999
        return orderA - orderB
    }

    ungroupedFields.sort(sortByOrder)
    Object.keys(groupedFields).forEach(group => {
        groupedFields[group].sort(sortByOrder)
    })

    return (
        <div className="space-y-4">
            {/* View mode toggle */}
            {showJsonToggle && (
                <div className="flex items-center justify-end space-x-2 pb-2 border-b">
                    <button
                        type="button"
                        onClick={() => setViewMode('form')}
                        className={`px-3 py-1 text-sm rounded ${viewMode === 'form'
                            ? 'bg-blue-100 text-blue-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        Form
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('json')}
                        className={`px-3 py-1 text-sm rounded flex items-center space-x-1 ${viewMode === 'json'
                            ? 'bg-blue-100 text-blue-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <Code className="w-4 h-4" />
                        <span>JSON</span>
                    </button>
                </div>
            )}

            {viewMode === 'form' ? (
                <div className="space-y-6">
                    {/* Ungrouped fields */}
                    {ungroupedFields.length > 0 && (
                        <div className="space-y-4">
                            {ungroupedFields.map(([fieldName, fieldMeta]) => renderField(fieldName, fieldMeta))}
                        </div>
                    )}

                    {/* Grouped fields */}
                    {Object.entries(groupedFields).map(([groupName, fields]) => (
                        <div key={groupName} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <h4 className="text-sm font-semibold text-gray-900 mb-4">{groupName}</h4>
                            <div className="space-y-4">
                                {fields.map(([fieldName, fieldMeta]) => renderField(fieldName, fieldMeta))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Configuration JSON
                    </label>
                    <textarea
                        value={jsonValue}
                        onChange={(e) => handleJsonChange(e.target.value)}
                        className="w-full h-96 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder='{"key": "value"}'
                    />
                    {jsonError && (
                        <p className="text-xs text-red-600 mt-1">{jsonError}</p>
                    )}
                </div>
            )}
        </div>
    )
}

