import React from 'react'
import ValidatedInput from '../validation/ValidatedInput'
import { Calendar, Clock } from 'lucide-react'

/**
 * DateTimeInput Component
 * 
 * Date and time input field component with built-in validation.
 * Uses native HTML5 datetime-local input for consistent behavior.
 */
const DateTimeInput = ({
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
    step = 60, // Default to 1-minute steps
    ...props
}) => {
    // Convert value to YYYY-MM-DDTHH:MM format for HTML5 datetime-local input
    const formatDateTimeValue = (val) => {
        if (!val) return ''

        // If already in YYYY-MM-DDTHH:MM format, return as is
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) {
            return val.substring(0, 16) // Ensure we only take YYYY-MM-DDTHH:MM part
        }

        // Try to parse and format the datetime
        try {
            const date = new Date(val)
            if (isNaN(date.getTime())) return ''

            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const hours = String(date.getHours()).padStart(2, '0')
            const minutes = String(date.getMinutes()).padStart(2, '0')

            return `${year}-${month}-${day}T${hours}:${minutes}`
        } catch {
            return ''
        }
    }

    const handleChange = (e) => {
        const dateTimeValue = e.target.value
        onChange(dateTimeValue || null)
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
                    <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <Clock className="h-3 w-3 text-gray-400" />
                    </div>
                </div>

                <ValidatedInput
                    type="datetime-local"
                    value={formatDateTimeValue(value)}
                    onChange={handleChange}
                    validation={validation}
                    isValidating={isValidating}
                    disabled={disabled}
                    min={min}
                    max={max}
                    step={step}
                    className="pl-12"
                    {...props}
                />
            </div>

            {description && (
                <p className="text-sm text-gray-500">{description}</p>
            )}

            {step && step < 60 && (
                <p className="text-xs text-gray-500">
                    Time precision: {step < 60 ? `${step} seconds` : `${step / 60} minutes`}
                </p>
            )}
        </div>
    )
}

DateTimeInput.displayName = 'DateTimeInput'

export default DateTimeInput
