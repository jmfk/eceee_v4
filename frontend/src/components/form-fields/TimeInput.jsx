import React from 'react'
import ValidatedInput from '../validation/ValidatedInput'
import { Clock } from 'lucide-react'

/**
 * TimeInput Component
 * 
 * Time input field component with built-in time validation.
 * Uses native HTML5 time input for consistent behavior across browsers.
 */
const TimeInput = ({
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
    // Convert value to HH:MM format for HTML5 time input
    const formatTimeValue = (val) => {
        if (!val) return ''

        // If already in HH:MM format, return as is
        if (typeof val === 'string' && /^\d{2}:\d{2}/.test(val)) {
            return val.substring(0, 5) // Ensure we only take HH:MM part
        }

        // Try to parse and format the time
        try {
            const date = new Date(`2000-01-01T${val}`)
            if (isNaN(date.getTime())) {
                // Try parsing as a full date
                const fullDate = new Date(val)
                if (isNaN(fullDate.getTime())) return ''

                const hours = String(fullDate.getHours()).padStart(2, '0')
                const minutes = String(fullDate.getMinutes()).padStart(2, '0')
                return `${hours}:${minutes}`
            }

            const hours = String(date.getHours()).padStart(2, '0')
            const minutes = String(date.getMinutes()).padStart(2, '0')
            return `${hours}:${minutes}`
        } catch {
            return ''
        }
    }

    const handleChange = (e) => {
        const timeValue = e.target.value
        onChange(timeValue || null)
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
                    <Clock className="h-4 w-4 text-gray-400" />
                </div>

                <ValidatedInput
                    type="time"
                    value={formatTimeValue(value)}
                    onChange={handleChange}
                    validation={validation}
                    isValidating={isValidating}
                    disabled={disabled}
                    min={min}
                    max={max}
                    step={step}
                    className="pl-10"
                    {...props}
                />
            </div>

            {description && (
                <p className="text-sm text-gray-500">{description}</p>
            )}

            {step && step < 60 && (
                <p className="text-xs text-gray-500">
                    Time precision: {step} seconds
                </p>
            )}
        </div>
    )
}

TimeInput.displayName = 'TimeInput'

export default TimeInput
