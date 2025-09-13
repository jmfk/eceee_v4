import React from 'react'
import ValidatedInput from '../validation/ValidatedInput'

/**
 * SelectInput Component
 * 
 * Dropdown selection field component that integrates with the validation system.
 * Supports single selection from a list of options.
 */
const SelectInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    placeholder = 'Select an option...',
    options = [],
    ...props
}) => {
    // Handle both array of strings and array of objects
    const normalizeOptions = (opts) => {
        if (!Array.isArray(opts)) return []

        return opts.map(option => {
            if (typeof option === 'string') {
                return { value: option, label: option }
            }
            if (typeof option === 'object' && option.value !== undefined) {
                return { value: option.value, label: option.label || option.value }
            }
            return { value: String(option), label: String(option) }
        })
    }

    const normalizedOptions = normalizeOptions(options)

    return (
        <ValidatedInput
            type="select"
            value={value || ''}
            onChange={onChange}
            validation={validation}
            isValidating={isValidating}
            label={label}
            description={description}
            required={required}
            disabled={disabled}
            {...props}
        >
            {!required && (
                <option value="">{placeholder}</option>
            )}
            {normalizedOptions.map((option, index) => (
                <option key={`${option.value}-${index}`} value={option.value}>
                    {option.label}
                </option>
            ))}
        </ValidatedInput>
    )
}

SelectInput.displayName = 'SelectInput'

export default SelectInput
