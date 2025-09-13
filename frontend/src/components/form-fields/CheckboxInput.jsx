import React from 'react'
import { Check } from 'lucide-react'

/**
 * CheckboxInput Component
 * 
 * Checkbox group component for multiple selections from a list of options.
 * Can also be used as a single checkbox for boolean values.
 */
const CheckboxInput = ({
    value = [],
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    options = [],
    layout = 'vertical', // 'vertical' or 'horizontal'
    singleCheckbox = false, // Use as single boolean checkbox
    maxSelections,
    ...props
}) => {
    // Handle both array of strings and array of objects
    const normalizeOptions = (opts) => {
        if (!Array.isArray(opts)) return []

        return opts.map((option, index) => {
            if (typeof option === 'string') {
                return { value: option, label: option, id: `checkbox-${index}` }
            }
            if (typeof option === 'object' && option.value !== undefined) {
                return {
                    value: option.value,
                    label: option.label || option.value,
                    id: `checkbox-${index}`
                }
            }
            return { value: String(option), label: String(option), id: `checkbox-${index}` }
        })
    }

    const normalizedOptions = singleCheckbox ? [{ value: true, label: label, id: 'single-checkbox' }] : normalizeOptions(options)
    const selectedValues = singleCheckbox ? (value ? [true] : []) : (Array.isArray(value) ? value : [])

    const handleChange = (optionValue, checked) => {
        if (singleCheckbox) {
            onChange(checked)
            return
        }

        let newValue
        if (checked) {
            if (maxSelections && selectedValues.length >= maxSelections) {
                return // Don't add more if at max
            }
            newValue = [...selectedValues, optionValue]
        } else {
            newValue = selectedValues.filter(v => v !== optionValue)
        }

        onChange(newValue)
    }

    // Get validation status for styling
    const hasError = validation && !validation.isValid

    if (singleCheckbox) {
        return (
            <div className="space-y-1">
                <div className="flex items-center space-x-3">
                    <div className="relative">
                        <input
                            type="checkbox"
                            checked={!!value}
                            onChange={(e) => handleChange(true, e.target.checked)}
                            disabled={disabled}
                            className={`
                                h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500
                                ${hasError ? 'border-red-300' : ''}
                                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                            `}
                            {...props}
                        />
                        {value && (
                            <Check className="absolute inset-0 h-4 w-4 text-white pointer-events-none" />
                        )}
                    </div>

                    {label && (
                        <label className={`text-sm font-medium text-gray-700 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
                            {label}
                            {required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                    )}

                    {isValidating && (
                        <span className="text-sm text-blue-600">Validating...</span>
                    )}
                </div>

                {description && (
                    <p className="text-sm text-gray-500 ml-7">{description}</p>
                )}

                {hasError && validation?.errors?.length > 0 && (
                    <div className="text-sm text-red-600 ml-7">
                        {validation.errors[0]}
                    </div>
                )}
            </div>
        )
    }

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
                {normalizedOptions.map((option) => {
                    const isChecked = selectedValues.includes(option.value)
                    const isDisabled = disabled || (!isChecked && maxSelections && selectedValues.length >= maxSelections)

                    return (
                        <div key={option.value} className="flex items-center">
                            <div className="relative">
                                <input
                                    id={option.id}
                                    type="checkbox"
                                    value={option.value}
                                    checked={isChecked}
                                    onChange={(e) => handleChange(option.value, e.target.checked)}
                                    disabled={isDisabled}
                                    className={`
                                        h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500
                                        ${hasError ? 'border-red-300' : ''}
                                        ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                                    `}
                                />
                                {isChecked && (
                                    <Check className="absolute inset-0 h-4 w-4 text-white pointer-events-none" />
                                )}
                            </div>
                            <label
                                htmlFor={option.id}
                                className={`
                                    ml-2 text-sm text-gray-700
                                    ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                                `}
                            >
                                {option.label}
                            </label>
                        </div>
                    )
                })}
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

            {/* Selection Info */}
            {maxSelections && !singleCheckbox && (
                <div className="text-xs text-gray-500">
                    {selectedValues.length}/{maxSelections} selected
                </div>
            )}

            {normalizedOptions.length === 0 && !singleCheckbox && (
                <div className="text-sm text-gray-500">
                    No options available
                </div>
            )}
        </div>
    )
}

CheckboxInput.displayName = 'CheckboxInput'

export default CheckboxInput
