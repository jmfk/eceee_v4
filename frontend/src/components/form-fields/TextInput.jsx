import React from 'react'
import ValidatedInput from '../validation/ValidatedInput'

/**
 * TextInput Component
 * 
 * Basic text input field component that integrates with the validation system.
 * Used for single-line text input fields.
 */
const TextInput = ({
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
    return (
        <ValidatedInput
            type="text"
            value={value || ''}
            onChange={onChange}
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
}

TextInput.displayName = 'TextInput'

export default TextInput
