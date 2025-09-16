import React, { useCallback } from 'react'
import ValidatedInput from '../validation/ValidatedInput'

/**
 * TextInput Component
 * 
 * Basic text input field component that integrates with the validation system.
 * Used for single-line text input fields.
 * 
 * Optimized with React.memo to prevent unnecessary re-renders.
 */
const TextInput = React.memo(({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    placeholder,
    ...props
}) => {
    const handleChange = useCallback((e) => {
        // Extract value from event if it's an event object, otherwise use as-is
        const newValue = e && e.target ? e.target.value : e
        onChange(newValue)
    }, [onChange])

    return (
        <ValidatedInput
            type="text"
            value={value || ''}
            onChange={handleChange}
            validation={validation}
            isValidating={isValidating}
            label={label}
            description={description}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            {...props}
        />
    )
})

TextInput.displayName = 'TextInput'

export default TextInput
