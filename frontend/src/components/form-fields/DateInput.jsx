import React from 'react'
import ValidatedInput from '../validation/ValidatedInput'
import { Calendar } from 'lucide-react'

/**
 * DateInput Component
 * 
 * Date input field component with built-in date validation.
 * Uses native HTML5 date input for consistent behavior across browsers.
 */
const DateInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    min,
    max,
    ...props
}) => {
    // Convert value to YYYY-MM-DD format for HTML5 date input
    const formatDateValue = (val) => {
        if (!val) return ''

        // If already in YYYY-MM-DD format, return as is
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
            return val
        }

        // Try to parse and format the date
        try {
            const date = new Date(val)
            if (isNaN(date.getTime())) return ''

            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            return `${year}-${month}-${day}`
        } catch {
            return ''
        }
    }

    const handleChange = (value) => {
        // ValidatedInput passes the value directly, not the event
        onChange(value || null)
    }

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
                    <Calendar className="h-4 w-4 text-gray-400" />
                </div>

                <ValidatedInput
                    type="date"
                    value={formatDateValue(value)}
                    onChange={handleChange}
                    validation={validation}
                    isValidating={isValidating}
                    disabled={disabled}
                    min={min}
                    max={max}
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

DateInput.displayName = 'DateInput'

export default DateInput
