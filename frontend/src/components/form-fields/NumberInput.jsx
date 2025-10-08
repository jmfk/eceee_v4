import React, { useCallback } from 'react'
import ValidatedInput from '../validation/ValidatedInput'

/**
 * NumberInput Component
 * 
 * Numeric input field component that integrates with the validation system.
 * Handles both integers and floating-point numbers.
 * Supports both controlled (value) and uncontrolled (defaultValue) modes.
 * 
 * Optimized with React.memo and useCallback to prevent unnecessary re-renders.
 */
const NumberInput = React.memo(({
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
    min,
    max,
    step = 'any',
    ...props
}) => {
    const handleChange = useCallback((e) => {
        // Extract value from event if it's an event object, otherwise use as-is
        const eventValue = e && e.target ? e.target.value : e
        const numericValue = eventValue === '' ? '' : Number(eventValue)
        onChange(eventValue === '' ? null : numericValue)
    }, [onChange])

    // Build props for ValidatedInput
    const inputProps = {
        type: "number",
        onChange: handleChange,
        validation,
        isValidating,
        label,
        description,
        required,
        disabled,
        placeholder,
        min,
        max,
        step,
        ...props
    }

    // Add either value or defaultValue, but never both
    if (value !== undefined) {
        inputProps.value = value ?? ''
    } else if (defaultValue !== undefined) {
        inputProps.defaultValue = defaultValue
    }

    return <ValidatedInput {...inputProps} />
})

NumberInput.displayName = 'NumberInput'

export default NumberInput
