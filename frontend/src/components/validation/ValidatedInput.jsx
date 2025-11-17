import React, { useState, useEffect, useRef } from 'react'
import ValidationMessage from './ValidationMessage.jsx'

/**
 * ValidatedInput Component
 * 
 * Input component with integrated validation display
 * Supports both controlled (value) and uncontrolled (defaultValue) modes
 */
export default function ValidatedInput({
    type = 'text',
    value,
    defaultValue,
    onChange,
    validation = null,
    isValidating = false,
    placeholder = '',
    disabled = false,
    className = '',
    label,
    description,
    required = false,
    showValidation = true,
    validationPosition = 'bottom', // 'bottom', 'right', 'inline'
    // Custom props that shouldn't be spread to DOM
    context,
    formData,
    fieldName,
    fieldType, // Filter out fieldType - not a valid HTML attribute
    children,
    ...props
}) {
    const [focused, setFocused] = useState(false)
    const inputRef = useRef(null)

    // Determine if this is controlled or uncontrolled
    const isControlled = value !== undefined
    const isUncontrolled = defaultValue !== undefined

    // Get validation status for styling
    const getValidationStatus = () => {
        if (isValidating) return 'validating'
        if (!validation) return 'none'
        if (validation.errors?.length > 0) return 'error'
        if (validation.warnings?.length > 0) return 'warning'
        return 'valid'
    }

    const validationStatus = getValidationStatus()

    // Get input border classes based on validation
    // Only show colors for problems (errors/warnings) or when validating
    const getBorderClasses = () => {
        if (disabled) return 'border-gray-300'
        if (focused) {
            switch (validationStatus) {
                case 'error':
                    return 'border-red-500 ring-2 ring-red-200'
                case 'warning':
                    return 'border-yellow-500 ring-2 ring-yellow-200'
                case 'validating':
                    return 'border-blue-500 ring-2 ring-blue-200'
                case 'valid':
                case 'none':
                default:
                    return 'border-blue-500 ring-2 ring-blue-200' // Normal focus state
            }
        } else {
            switch (validationStatus) {
                case 'error':
                    return 'border-red-300'
                case 'warning':
                    return 'border-yellow-300'
                case 'validating':
                    return 'border-blue-300'
                case 'valid':
                case 'none':
                default:
                    return 'border-gray-300' // Normal unfocused state
            }
        }
    }

    // Get the primary validation message to display
    const getValidationMessage = () => {
        if (!validation) return ''
        if (validation.errors?.length > 0) return validation.errors[0]
        if (validation.warnings?.length > 0) return validation.warnings[0]
        return ''
    }

    const handleFocus = (e) => {
        setFocused(true)
        props.onFocus?.(e)
    }

    const handleBlur = (e) => {
        setFocused(false)
        props.onBlur?.(e)
    }

    const inputClasses = `
        w-full px-3 py-2 border rounded-md transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500/50
        disabled:bg-gray-50 disabled:cursor-not-allowed
        ${getBorderClasses()}
        ${className}
    `.trim()

    const renderInput = () => {
        // Filter out custom props that shouldn't be passed to DOM elements
        const customProps = [
            'allowCreate', 'searchDebounce', 'onValidationChange',
            'showValidation', 'validationPosition', 'validationRules',
            'autoValidate', 'debounceMs', 'minItems', 'maxItems',
            'minWidth', 'minHeight', 'mediaTypes', 'allowedMimeTypes',
            'autoTags', 'defaultCollection', 'allowedExtensions',
            'allowedFileTypes', 'fileTypeLabel', 'helpText',
            // Schema metadata props
            'componentType', 'propertyOrder', 'relationshipType',
            'allowedObjectTypes', 'component', 'category', 'order',
            'conditionalOn', 'itemSchema', 'itemLabelTemplate',
            // Widget/form-specific props
            'onFieldChange', 'onFieldValidation', 'validateOnChange',
            'validateOnBlur', 'isDirty', 'isTouched'
        ]

        // Filter props to only include valid HTML attributes
        const filteredProps = Object.keys(props).reduce((acc, key) => {
            if (!customProps.includes(key)) {
                acc[key] = props[key]
            }
            return acc
        }, {})

        // Build props based on controlled vs uncontrolled mode
        const commonProps = {
            ref: inputRef,
            onChange: (e) => onChange?.(e.target.value), // Extract value from event
            onFocus: handleFocus,
            onBlur: handleBlur,
            placeholder,
            disabled,
            className: inputClasses,
            ...filteredProps
        }

        // Add either value or defaultValue, but never both
        if (isControlled) {
            commonProps.value = value ?? ''
        } else if (isUncontrolled) {
            commonProps.defaultValue = defaultValue ?? ''
        } else {
            // Neither provided, default to empty controlled
            commonProps.value = ''
        }

        switch (type) {
            case 'textarea': {
                const textareaProps = { ...commonProps }
                // Handle rows attribute carefully for auto-resize support
                const rowsValue = props.rows
                if (rowsValue === null) {
                    // Explicitly null (autoResize) - remove rows attribute
                    delete textareaProps.rows
                } else if (typeof rowsValue === 'number' && rowsValue > 0) {
                    // Explicit number - use it
                    textareaProps.rows = rowsValue
                } else if (rowsValue === undefined && !('rows' in props)) {
                    // Not mentioned at all - default to 3
                    textareaProps.rows = 3
                }
                return <textarea {...textareaProps} />
            }
            case 'select':
                return (
                    <select {...commonProps}>
                        {children}
                    </select>
                )
            default:
                return <input type={type} {...commonProps} />
        }
    }

    const renderValidation = () => {
        if (!showValidation) return null

        const message = getValidationMessage()
        const severity = validationStatus === 'validating' ? 'info' :
            validationStatus === 'none' ? 'none' : validationStatus

        return (
            <ValidationMessage
                message={message}
                severity={severity}
                isValidating={isValidating}
                size="sm"
            />
        )
    }

    if (validationPosition === 'inline') {
        return (
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    {label && (
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {label}
                            {required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                    )}
                    {renderInput()}
                </div>
                <div className="flex-shrink-0 min-w-0 max-w-xs">
                    {renderValidation()}
                </div>
            </div>
        )
    }

    if (validationPosition === 'right') {
        return (
            <div className="flex gap-4">
                <div className="flex-1">
                    {label && (
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {label}
                            {required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                    )}
                    {renderInput()}
                    {description && (
                        <p className="text-xs text-gray-500 mt-1">{description}</p>
                    )}
                </div>
                <div className="flex-shrink-0 w-64">
                    {renderValidation()}
                </div>
            </div>
        )
    }

    // Default: bottom position
    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            {renderInput()}
            {description && (
                <p className="text-xs text-gray-500">{description}</p>
            )}
            {renderValidation()}
        </div>
    )
}
