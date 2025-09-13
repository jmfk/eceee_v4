import React from 'react'
import ValidatedInput from '../validation/ValidatedInput'

/**
 * TextareaInput Component
 * 
 * Multi-line text input field component with auto-resize and character counting.
 * Integrates with the validation system.
 */
const TextareaInput = ({
    value,
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
    const characterCount = value ? value.length : 0
    const isOverLimit = maxLength && characterCount > maxLength

    const handleChange = (e) => {
        if (maxLength && e.target.value.length > maxLength) {
            return // Don't allow input beyond max length
        }
        onChange(e)
    }

    return (
        <div className="space-y-1">
            {label && (
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                        {label}
                        {required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {showCharacterCount && (
                        <span className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-gray-500'}`}>
                            {characterCount}{maxLength && `/${maxLength}`}
                        </span>
                    )}
                </div>
            )}

            <ValidatedInput
                type="textarea"
                value={value || ''}
                onChange={handleChange}
                validation={validation}
                isValidating={isValidating}
                disabled={disabled}
                placeholder={placeholder}
                rows={autoResize ? undefined : rows}
                maxLength={maxLength}
                style={autoResize ? {
                    minHeight: `${rows * 1.5}rem`,
                    resize: 'none',
                    overflow: 'hidden'
                } : undefined}
                onInput={autoResize ? (e) => {
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                } : undefined}
                {...props}
            />

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
