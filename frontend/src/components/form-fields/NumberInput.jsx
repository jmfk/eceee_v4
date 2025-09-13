import React from 'react'
import ValidatedInput from '../validation/ValidatedInput'

/**
 * NumberInput Component
 * 
 * Numeric input field component that integrates with the validation system.
 * Handles both integers and floating-point numbers.
 */
const NumberInput = ({
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
    const handleChange = (e) => {
        const numericValue = e.target.value === '' ? '' : Number(e.target.value)
        onChange(e.target.value === '' ? null : numericValue)
    }

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
}

NumberInput.displayName = 'NumberInput'

export default NumberInput
