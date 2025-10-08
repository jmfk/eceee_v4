import React from 'react'
import { Check } from 'lucide-react'

/**
 * BooleanInput Component
 * 
 * Boolean input field component that renders as a toggle switch or checkbox.
 * Integrates with the validation system.
 * Supports both controlled (value) and uncontrolled (defaultValue) modes.
 */
const BooleanInput = ({
    value,
    defaultValue,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    variant = 'toggle', // 'toggle' or 'checkbox'
    ...props
}) => {
    const isControlled = value !== undefined
    const currentValue = isControlled ? value : defaultValue

    const handleChange = (e) => {
        onChange(e.target.checked)
    }

    // Get validation status for styling
    const getValidationStatus = () => {
        if (isValidating) return 'validating'
        if (!validation) return 'none'
        if (validation.errors?.length > 0) return 'error'
        if (validation.warnings?.length > 0) return 'warning'
        return 'valid'
    }

    const validationStatus = getValidationStatus()
    const hasError = validationStatus === 'error'

    if (variant === 'toggle') {
        return (
            <div className="space-y-1">
                {label && (
                    <label className="block text-sm font-medium text-gray-700">
                        {label}
                        {required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                )}

                <div className="flex items-center space-x-3">
                    <button
                        type="button"
                        role="switch"
                        aria-checked={!!currentValue}
                        onClick={() => onChange(!currentValue)}
                        disabled={disabled}
                        className={`
                            relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                            transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                            ${disabled ? 'cursor-not-allowed opacity-50' : ''}
                            ${currentValue ? 'bg-blue-600' : 'bg-gray-200'}
                            ${hasError ? 'ring-2 ring-red-200' : ''}
                        `}
                    >
                        <span
                            className={`
                                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                                transition duration-200 ease-in-out
                                ${currentValue ? 'translate-x-5' : 'translate-x-0'}
                            `}
                        />
                    </button>

                    {isValidating && (
                        <span className="text-sm text-blue-600">Validating...</span>
                    )}
                </div>

                {description && (
                    <p className="text-sm text-gray-500">{description}</p>
                )}

                {hasError && validation?.errors?.length > 0 && (
                    <div className="text-sm text-red-600">
                        {validation.errors[0]}
                    </div>
                )}
            </div>
        )
    }

    // Checkbox variant - build props conditionally
    const checkboxProps = {
        type: "checkbox",
        onChange: handleChange,
        disabled,
        className: `
            h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500
            ${hasError ? 'border-red-300' : ''}
            ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
        `,
        ...props
    }

    // Add either checked or defaultChecked, but never both
    if (isControlled) {
        checkboxProps.checked = !!value
    } else if (defaultValue !== undefined) {
        checkboxProps.defaultChecked = !!defaultValue
    }

    return (
        <div className="space-y-1">
            <div className="flex items-center space-x-3">
                <div className="relative">
                    <input {...checkboxProps} />
                    {currentValue && (
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

BooleanInput.displayName = 'BooleanInput'

export default BooleanInput
