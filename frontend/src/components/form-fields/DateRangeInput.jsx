import React, { useState, useEffect } from 'react'
import { Calendar, ArrowRight, RotateCcw } from 'lucide-react'
import DateInput from './DateInput'

/**
 * DateRangeInput Component
 * 
 * Date range picker component for selecting start and end dates.
 * Includes validation to ensure end date is after start date.
 */
const DateRangeInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    minDate,
    maxDate,
    allowSameDate = true,
    showPresets = true,
    presets = [
        { label: 'Today', days: 0 },
        { label: 'Tomorrow', days: 1 },
        { label: 'This Week', days: 7 },
        { label: 'This Month', days: 30 },
        { label: 'This Quarter', days: 90 }
    ],
    ...props
}) => {
    const [localValue, setLocalValue] = useState({
        start: null,
        end: null
    })

    // Sync with prop value
    useEffect(() => {
        if (value && typeof value === 'object') {
            setLocalValue({
                start: value.start || null,
                end: value.end || null
            })
        } else {
            setLocalValue({ start: null, end: null })
        }
    }, [value])

    const handleStartDateChange = (startDate) => {
        const newValue = {
            ...localValue,
            start: startDate
        }

        // Validate that end date is not before start date
        if (newValue.end && newValue.start && new Date(newValue.end) < new Date(newValue.start)) {
            if (allowSameDate) {
                newValue.end = newValue.start
            } else {
                newValue.end = null
            }
        }

        setLocalValue(newValue)
        onChange(newValue)
    }

    const handleEndDateChange = (endDate) => {
        const newValue = {
            ...localValue,
            end: endDate
        }

        setLocalValue(newValue)
        onChange(newValue)
    }

    const handlePresetClick = (preset) => {
        const today = new Date()
        const startDate = new Date(today)
        const endDate = new Date(today)
        endDate.setDate(today.getDate() + preset.days)

        const newValue = {
            start: startDate.toISOString().split('T')[0],
            end: endDate.toISOString().split('T')[0]
        }

        setLocalValue(newValue)
        onChange(newValue)
    }

    const handleReset = () => {
        const newValue = { start: null, end: null }
        setLocalValue(newValue)
        onChange(newValue)
    }

    const formatDateRange = () => {
        if (!localValue.start && !localValue.end) return 'No dates selected'
        if (localValue.start && !localValue.end) return `From ${localValue.start}`
        if (!localValue.start && localValue.end) return `Until ${localValue.end}`

        const start = new Date(localValue.start).toLocaleDateString()
        const end = new Date(localValue.end).toLocaleDateString()
        return `${start} - ${end}`
    }

    const getDaysDifference = () => {
        if (!localValue.start || !localValue.end) return null

        const start = new Date(localValue.start)
        const end = new Date(localValue.end)
        const diffTime = Math.abs(end - start)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        return diffDays
    }

    const hasError = validation && !validation.isValid
    const hasSelection = localValue.start || localValue.end

    return (
        <div className="space-y-1">
            {label && (
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                        {label}
                        {required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {hasSelection && (
                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={disabled}
                            className="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                            title="Clear dates"
                        >
                            <RotateCcw className="w-3 h-3" />
                            <span>Clear</span>
                        </button>
                    )}
                </div>
            )}

            <div className="space-y-3" ref={containerRef}>
                {/* Date Range Summary */}
                {hasSelection && (
                    <div className={`
                        p-3 border rounded-md bg-blue-50 border-blue-200
                        ${hasError ? 'bg-red-50 border-red-200' : ''}
                    `}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-900">
                                    {formatDateRange()}
                                </span>
                            </div>
                            {getDaysDifference() !== null && (
                                <span className="text-xs text-blue-700">
                                    {getDaysDifference()} day{getDaysDifference() !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Date Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DateInput
                        value={localValue.start}
                        onChange={handleStartDateChange}
                        label="Start Date"
                        disabled={disabled}
                        min={minDate}
                        max={localValue.end || maxDate}
                        validation={validation?.start}
                    />

                    <div className="flex items-center justify-center md:hidden">
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>

                    <DateInput
                        value={localValue.end}
                        onChange={handleEndDateChange}
                        label="End Date"
                        disabled={disabled}
                        min={allowSameDate ? localValue.start || minDate :
                            localValue.start ?
                                new Date(new Date(localValue.start).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] :
                                minDate}
                        max={maxDate}
                        validation={validation?.end}
                    />
                </div>

                {/* Quick Presets */}
                {showPresets && presets.length > 0 && (
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">
                            Quick Select
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {presets.map((preset) => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => handlePresetClick(preset)}
                                    disabled={disabled}
                                    className="px-3 py-1 text-xs border border-gray-300 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {description && (
                <div className="text-sm text-gray-500">{description}</div>
            )}

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

            {/* Validation Rules Info */}
            {!allowSameDate && (
                <div className="text-xs text-gray-500">
                    End date must be after start date
                </div>
            )}
        </div>
    )
}

DateRangeInput.displayName = 'DateRangeInput'

export default DateRangeInput
