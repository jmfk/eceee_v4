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
        if (maxLength && e.target.value.length > maxLength) {
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
        rows: autoResize ? undefined : rows,
        maxLength,
        style: autoResize ? {
            minHeight: `${rows * 1.5}rem`,
            resize: 'none',
            overflow: 'hidden'
        } : undefined,
        onInput: autoResize ? (e) => {
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
        } : undefined,
        ...props
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
                <p className="text-sm text-gray-500">{description}</p>
            )}

            {!showCharacterCount && maxLength && (
                <p className="text-xs text-gray-500">
                    Maximum {maxLength} characters
                </p>
            )}
        </div>
    )
}

TextareaInput.displayName = 'TextareaInput'

export default TextareaInput
