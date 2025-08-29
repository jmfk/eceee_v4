import React, { forwardRef } from 'react'
import {
    Type, Hash, Calendar, ToggleLeft, Image, FileText, User,
    Link, Mail, ChevronDown
} from 'lucide-react'

const ObjectSchemaForm = forwardRef(({ schema, data = {}, onChange, errors = {} }, ref) => {
    if (!schema?.fields || !Array.isArray(schema.fields)) {
        return (
            <div className="text-center py-8 text-gray-500">
                <FileText className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                <p>No schema fields defined</p>
            </div>
        )
    }

    const handleFieldChange = (fieldName, value) => {
        onChange?.(fieldName, value)
    }

    const getFieldIcon = (type) => {
        switch (type) {
            case 'text':
            case 'rich_text':
                return Type
            case 'number':
                return Hash
            case 'date':
            case 'datetime':
                return Calendar
            case 'boolean':
                return ToggleLeft
            case 'image':
                return Image
            case 'url':
                return Link
            case 'email':
                return Mail
            case 'user_reference':
                return User
            default:
                return FileText
        }
    }

    const renderField = (field) => {
        const Icon = getFieldIcon(field.type)
        const fieldValue = data[field.name]
        const fieldError = errors[`data_${field.name}`]

        const renderInput = () => {
            switch (field.type) {
                case 'text':
                    return (
                        <input
                            type="text"
                            value={fieldValue || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldError ? 'border-red-300' : 'border-gray-300'
                                }`}
                            placeholder={field.placeholder || `Enter ${field.label || field.name}...`}
                            maxLength={field.maxLength}
                        />
                    )

                case 'rich_text':
                    return (
                        <textarea
                            value={fieldValue || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            rows={4}
                            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldError ? 'border-red-300' : 'border-gray-300'
                                }`}
                            placeholder={field.placeholder || `Enter ${field.label || field.name}...`}
                        />
                    )

                case 'number':
                    return (
                        <input
                            type="number"
                            value={fieldValue || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value ? parseFloat(e.target.value) : null)}
                            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldError ? 'border-red-300' : 'border-gray-300'
                                }`}
                            placeholder={field.placeholder || `Enter ${field.label || field.name}...`}
                            min={field.min}
                            max={field.max}
                            step={field.step}
                        />
                    )

                case 'date':
                    return (
                        <input
                            type="date"
                            value={fieldValue || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldError ? 'border-red-300' : 'border-gray-300'
                                }`}
                        />
                    )

                case 'datetime':
                    return (
                        <input
                            type="datetime-local"
                            value={fieldValue || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldError ? 'border-red-300' : 'border-gray-300'
                                }`}
                        />
                    )

                case 'boolean':
                    return (
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                checked={fieldValue || false}
                                onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label className="ml-2 text-sm text-gray-700">
                                {field.label || field.name}
                            </label>
                        </div>
                    )

                case 'choice':
                    return (
                        <div className="relative">
                            <select
                                value={fieldValue || ''}
                                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none ${fieldError ? 'border-red-300' : 'border-gray-300'
                                    }`}
                            >
                                <option value="">Select option...</option>
                                {field.choices?.map((choice) => (
                                    <option key={choice.value || choice} value={choice.value || choice}>
                                        {choice.label || choice}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        </div>
                    )

                case 'multi_choice':
                    return (
                        <div className="space-y-2">
                            {field.choices?.map((choice) => {
                                const choiceValue = choice.value || choice
                                const choiceLabel = choice.label || choice
                                const isSelected = Array.isArray(fieldValue) && fieldValue.includes(choiceValue)

                                return (
                                    <div key={choiceValue} className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => {
                                                const currentValues = Array.isArray(fieldValue) ? fieldValue : []
                                                if (e.target.checked) {
                                                    handleFieldChange(field.name, [...currentValues, choiceValue])
                                                } else {
                                                    handleFieldChange(field.name, currentValues.filter(v => v !== choiceValue))
                                                }
                                            }}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <label className="ml-2 text-sm text-gray-700">
                                            {choiceLabel}
                                        </label>
                                    </div>
                                )
                            })}
                        </div>
                    )

                case 'email':
                    return (
                        <input
                            type="email"
                            value={fieldValue || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldError ? 'border-red-300' : 'border-gray-300'
                                }`}
                            placeholder={field.placeholder || `Enter ${field.label || field.name}...`}
                        />
                    )

                case 'url':
                    return (
                        <input
                            type="url"
                            value={fieldValue || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldError ? 'border-red-300' : 'border-gray-300'
                                }`}
                            placeholder={field.placeholder || `Enter ${field.label || field.name}...`}
                        />
                    )

                case 'image':
                    return (
                        <div className="space-y-2">
                            <input
                                type="url"
                                value={fieldValue || ''}
                                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldError ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                placeholder="Enter image URL..."
                            />
                            {fieldValue && (
                                <div className="mt-2">
                                    <img
                                        src={fieldValue}
                                        alt="Preview"
                                        className="max-w-xs max-h-32 object-cover rounded border"
                                        onError={(e) => {
                                            e.target.style.display = 'none'
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )

                case 'file':
                    return (
                        <div className="space-y-2">
                            <input
                                type="url"
                                value={fieldValue || ''}
                                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldError ? 'border-red-300' : 'border-gray-300'
                                    }`}
                                placeholder="Enter file URL..."
                            />
                        </div>
                    )

                default:
                    return (
                        <input
                            type="text"
                            value={fieldValue || ''}
                            onChange={(e) => handleFieldChange(field.name, e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldError ? 'border-red-300' : 'border-gray-300'
                                }`}
                            placeholder={field.placeholder || `Enter ${field.label || field.name}...`}
                        />
                    )
            }
        }

        return (
            <div key={field.name} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 flex items-center">
                    <Icon className="h-4 w-4 mr-2" />
                    {field.label || field.name}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {renderInput()}
                {fieldError && <p className="text-red-600 text-sm">{fieldError}</p>}
                {field.help && <p className="text-gray-500 text-xs">{field.help}</p>}
            </div>
        )
    }

    return (
        <div ref={ref} className="space-y-6">
            {schema.fields.map(renderField)}
        </div>
    )
})

ObjectSchemaForm.displayName = 'ObjectSchemaForm'

export default ObjectSchemaForm
