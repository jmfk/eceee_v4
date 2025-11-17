import React, { useEffect, useState } from 'react'
import { fieldTypeRegistry } from '../../utils/fieldTypeRegistry'
import SchemaFieldRenderer from './SchemaFieldRenderer'

/**
 * EnhancedWidgetForm Component
 * 
 * Enhanced form renderer for widget configuration that uses the new field type system.
 * Can be used as a drop-in replacement for the existing widget form rendering logic.
 */
const EnhancedWidgetForm = ({
    schema,
    config,
    onChange,
    validation = {},
    isValidating = false,
    widgetType,
    hiddenFields = [],
    ...props
}) => {
    const [fieldTypesLoaded, setFieldTypesLoaded] = useState(false)

    // Load field types on mount
    useEffect(() => {
        const loadFieldTypes = async () => {
            try {
                await fieldTypeRegistry.ensureLoaded()
                setFieldTypesLoaded(true)
            } catch (error) {
                console.error('Failed to load field types:', error)
                setFieldTypesLoaded(true) // Continue with fallback
            }
        }

        loadFieldTypes()
    }, [])

    const handleFieldChange = (fieldName, value) => {
        onChange(fieldName, value)
    }

    if (!schema?.properties) {
        return (
            <div className="p-4 text-center text-gray-500">
                <p>No schema properties found</p>
            </div>
        )
    }

    if (!fieldTypesLoaded) {
        return (
            <div className="p-4 text-center text-gray-500">
                <p>Loading field types...</p>
            </div>
        )
    }

    // Get property order
    const propertyOrder = schema.propertyOrder || Object.keys(schema.properties)
    const orderedFields = propertyOrder.filter(key =>
        schema.properties[key] && !hiddenFields.includes(key)
    )

    // Special field handling based on widget type
    const getSpecialFieldHandling = (fieldName, fieldSchema) => {
        // Color fields
        if (fieldName.toLowerCase().includes('color') || fieldSchema.format === 'color') {
            return {
                type: 'color',
                component: 'ColorInput' // We'll need to create this
            }
        }

        // Percentage fields
        if (fieldName.toLowerCase().includes('percent') || fieldSchema.format === 'percentage') {
            return {
                type: 'number',
                component: 'NumberInput',
                min: 0,
                max: 100,
                step: 1,
                suffix: '%'
            }
        }

        // Pixel fields
        if (fieldName.toLowerCase().includes('pixel') || fieldName.toLowerCase().includes('px') || fieldSchema.format === 'pixel') {
            return {
                type: 'number',
                component: 'NumberInput',
                min: 0,
                step: 1,
                suffix: 'px'
            }
        }

        return null
    }

    return (
        <div className="space-y-6">
            {orderedFields.map(fieldName => {
                const fieldSchema = schema.properties[fieldName]
                const fieldValue = config[fieldName]
                const fieldValidation = validation[fieldName]
                const isRequired = schema.required?.includes(fieldName) || false

                // Check for special handling
                const specialHandling = getSpecialFieldHandling(fieldName, fieldSchema)

                if (specialHandling) {
                    // Handle special fields with custom rendering
                    return (
                        <div key={fieldName} className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                                {fieldSchema.title || fieldName}
                                {isRequired && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {fieldSchema.description && (
                                <p className="text-xs text-gray-500">{fieldSchema.description}</p>
                            )}

                            {/* Custom rendering for special fields */}
                            {specialHandling.type === 'color' && (
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={fieldValue ?? '#000000'}
                                        onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                                        className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={fieldValue ?? ''}
                                        onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                                        placeholder="#000000"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            )}

                            {specialHandling.type === 'number' && (
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={fieldValue ?? ''}
                                        onChange={(e) => handleFieldChange(fieldName, Number(e.target.value))}
                                        min={specialHandling.min}
                                        max={specialHandling.max}
                                        step={specialHandling.step}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {specialHandling.suffix && (
                                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                                            {specialHandling.suffix}
                                        </div>
                                    )}
                                </div>
                            )}

                            {fieldValidation && !fieldValidation.isValid && (
                                <div className="text-red-600 text-xs">
                                    {fieldValidation.errors?.join(', ')}
                                </div>
                            )}
                        </div>
                    )
                }
                // Use the new field system for standard fields
                return (
                    <SchemaFieldRenderer
                        key={fieldName}
                        fieldName={fieldName}
                        fieldSchema={fieldSchema}
                        value={fieldValue}
                        onChange={(value) => handleFieldChange(fieldName, value)}
                        validation={fieldValidation}
                        isValidating={isValidating}
                        required={isRequired}
                        schema={schema}
                        {...props}
                    />
                )
            })}
        </div>
    )
}

EnhancedWidgetForm.displayName = 'EnhancedWidgetForm'

export default EnhancedWidgetForm
