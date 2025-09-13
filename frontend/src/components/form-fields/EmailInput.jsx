import React from 'react'
import ValidatedInput from '../validation/ValidatedInput'
import { Mail } from 'lucide-react'

/**
 * EmailInput Component
 * 
 * Email input field component with built-in email validation.
 * Includes visual email icon and proper input type for mobile keyboards.
 */
const EmailInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    placeholder = 'user@example.com',
    ...props
}) => {
    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-400" />
                </div>

                <ValidatedInput
                    type="email"
                    value={value || ''}
                    onChange={onChange}
                    validation={validation}
                    isValidating={isValidating}
                    disabled={disabled}
                    placeholder={placeholder}
                    className="pl-10"
                    {...props}
                />
            </div>

            {description && (
                <p className="text-sm text-gray-500">{description}</p>
            )}
        </div>
    )
}

EmailInput.displayName = 'EmailInput'

export default EmailInput
