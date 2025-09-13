import React from 'react'

/**
 * RadioInput Component
 * 
 * Radio button group component for single selection from multiple options.
 * Integrates with the validation system.
 */
const RadioInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    options = [],
    layout = 'vertical', // 'vertical' or 'horizontal'
    ...props
}) => {
    // Handle both array of strings and array of objects
    const normalizeOptions = (opts) => {
        if (!Array.isArray(opts)) return []

        return opts.map((option, index) => {
            if (typeof option === 'string') {
                return { value: option, label: option, id: `radio-${index}` }
            }
            if (typeof option === 'object' && option.value !== undefined) {
                return {
                    value: option.value,
                    label: option.label || option.value,
                    id: `radio-${index}`
                }
            }
            return { value: String(option), label: String(option), id: `radio-${index}` }
        })
    }

    const normalizedOptions = normalizeOptions(options)

    const handleChange = (optionValue) => {
        onChange(optionValue)
    }

    // Get validation status for styling
    const hasError = validation && !validation.isValid

    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            {description && (
                <p className="text-sm text-gray-500 mb-2">{description}</p>
            )}

            <div className={`space-${layout === 'horizontal' ? 'x' : 'y'}-2 ${layout === 'horizontal' ? 'flex flex-wrap' : ''}`}>
                {normalizedOptions.map((option) => (
                    <div key={option.value} className="flex items-center">
                        <input
                            id={option.id}
                            type="radio"
                            name={props.name || 'radio-group'}
                            value={option.value}
                            checked={value === option.value}
                            onChange={() => handleChange(option.value)}
                            disabled={disabled}
                            className={`
                                h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500
                                ${hasError ? 'border-red-300' : ''}
                                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                            `}
                        />
                        <label
                            htmlFor={option.id}
                            className={`
                                ml-2 text-sm text-gray-700
                                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                            `}
                        >
                            {option.label}
                        </label>
                    </div>
                ))}
            </div>

            {/* Validation Message */}
            {hasError && validation?.errors?.length > 0 && (
                <div className="text-sm text-red-600">
                    {validation.errors[0]}
                </div>
            )}

            {/* Loading State */}
            {isValidating && (
                <div className="text-sm text-blue-600">
                    Validating...
                </div>
            )}

            {normalizedOptions.length === 0 && (
                <div className="text-sm text-gray-500">
                    No options available
                </div>
            )}
        </div>
    )
}

RadioInput.displayName = 'RadioInput'

export default RadioInput
