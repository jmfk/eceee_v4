import React, { useCallback } from 'react'
import ValidatedInput from '../validation/ValidatedInput'

/**
 * TextInput Component
 * 
 * Basic text input field component that integrates with the validation system.
 * Used for single-line text input fields.
 * Supports both controlled (value) and uncontrolled (defaultValue) modes.
 * 
 * Optimized with React.memo to prevent unnecessary re-renders.
 */
const TextInput = React.memo(({
    value,
    defaultValue,
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

    // Build props for ValidatedInput
    const inputProps = {
        type: "text",
        onChange: handleChange,
        validation,
        isValidating,
        label,
        description,
        required,
        disabled,
        placeholder,
        ...props
    }

    // Add either value or defaultValue, but never both
    if (value !== undefined) {
        inputProps.value = value || ''
    } else if (defaultValue !== undefined) {
        inputProps.defaultValue = defaultValue
    }

    return <ValidatedInput {...inputProps} />
})

TextInput.displayName = 'TextInput'

export default TextInput
