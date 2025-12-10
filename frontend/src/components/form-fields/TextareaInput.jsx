import React from 'react'
import ValidatedInput from '../validation/ValidatedInput'

/**
 * TextareaInput Component
 * 
 * Multi-line text input field component with auto-resize and character counting.
 * Integrates with the validation system.
 * Supports both controlled (value) and uncontrolled (defaultValue) modes.
 */
const TextareaInput = ({
    value,
    defaultValue,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    placeholder = 'Enter text...',
    rows = 3,
    maxLength,
    showCharacterCount = false,
    autoResize = false,
    ...props
}) => {
    const isControlled = value !== undefined
    const currentValue = isControlled ? value : defaultValue
    const characterCount = currentValue ? currentValue.length : 0
    const isOverLimit = maxLength && characterCount > maxLength

    const handleChange = (e) => {
        const newValue = e?.target?.value ?? e
        if (maxLength && newValue && newValue.length > maxLength) {
            return // Don't allow input beyond max length
        }
        onChange(e)
    }

    // Build props for ValidatedInput
    const inputProps = {
        type: "textarea",
        onChange: handleChange,
        validation,
        isValidating,
        disabled,
        placeholder,
        maxLength,
        ...props
    }

    // Handle rows attribute
    if (autoResize) {
        // Explicitly set to null so ValidatedInput knows not to add default
        inputProps.rows = null
        inputProps.style = {
            minHeight: `${rows * 1.5}rem`,
            resize: 'none',
            overflow: 'hidden'
        }
        inputProps.onInput = (e) => {
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
        }
    } else {
        inputProps.rows = rows
    }

    // Add either value or defaultValue, but never both
    if (isControlled) {
        inputProps.value = value || ''
    } else if (defaultValue !== undefined) {
        inputProps.defaultValue = defaultValue
    }

    return (
        <div className="space-y-1">
            {label && (
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                        {label}
                        {required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {showCharacterCount && isControlled && (
                        <span className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
                            {characterCount}{maxLength && `/${maxLength}`}
                        </span>
                    )}
                </div>
            )}

            <ValidatedInput {...inputProps} />

            {description && (
                <div className="text-sm text-gray-500">{description}</div>
            )}

            {!showCharacterCount && maxLength && (
                <div className="text-xs text-gray-500">
                    Maximum {maxLength} characters
                </div>
            )}
        </div>
    )
}

TextareaInput.displayName = 'TextareaInput'

export default TextareaInput
