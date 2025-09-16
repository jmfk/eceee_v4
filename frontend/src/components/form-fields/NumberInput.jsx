import React, { useCallback } from 'react'
import ValidatedInput from '../validation/ValidatedInput'

/**
 * NumberInput Component
 * 
 * Numeric input field component that integrates with the validation system.
 * Handles both integers and floating-point numbers.
 * 
 * Optimized with React.memo and useCallback to prevent unnecessary re-renders.
 */
const NumberInput = React.memo(({
    value,
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

    return (
        <ValidatedInput
            type="number"
            value={value || ''}
            onChange={handleChange}
            validation={validation}
            isValidating={isValidating}
            label={label}
            description={description}
            required={required}
            disabled={disabled}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step}
            {...props}
        />
    )
})

NumberInput.displayName = 'NumberInput'

export default NumberInput
