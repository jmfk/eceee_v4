import React, { useState, useEffect, useRef } from 'react'
import ValidationMessage from './ValidationMessage.jsx'

/**
 * ValidatedInput Component
 * 
 * Input component with integrated validation display
 */
export default function ValidatedInput({
    type = 'text',
    value = '',
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
    ...props
}) {
    const [focused, setFocused] = useState(false)
    const inputRef = useRef(null)

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
        focus:outline-none focus:ring-2 focus:ring-opacity-50
        disabled:bg-gray-50 disabled:cursor-not-allowed
        ${getBorderClasses()}
        ${className}
    `.trim()

    const renderInput = () => {
        const commonProps = {
            ref: inputRef,
            value,
            onChange: (e) => onChange?.(e.target.value), // Extract value from event
            onFocus: handleFocus,
            onBlur: handleBlur,
            placeholder,
            disabled,
            className: inputClasses,
            ...props
        }

        switch (type) {
            case 'textarea':
                return <textarea {...commonProps} rows={props.rows || 3} />
            case 'select':
                return (
                    <select {...commonProps}>
                        {props.children}
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
