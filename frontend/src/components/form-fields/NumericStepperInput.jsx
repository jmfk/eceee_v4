import React, { useState, useRef, useEffect } from 'react'
import { Plus, Minus, RotateCcw, Calculator } from 'lucide-react'

/**
 * NumericStepperInput Component
 * 
 * Enhanced numeric input with step controls, validation, and formatting.
 * Supports custom step sizes, min/max bounds, and various display formats.
 */
const NumericStepperInput = ({
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
    step = 1,
    precision = 0, // Decimal places
    placeholder = '0',
    prefix = '',
    suffix = '',
    showSteppers = true,
    showButtons = false, // Large step buttons
    buttonStep = 10, // Step size for large buttons
    allowNegative = true,
    allowDecimal = true,
    formatOnBlur = true,
    showCalculator = false,
    ...props
}) => {
    const [localValue, setLocalValue] = useState('')
    const [isFocused, setIsFocused] = useState(false)
    const [showCalc, setShowCalc] = useState(false)
    const inputRef = useRef(null)

    // Sync local value with prop value
    useEffect(() => {
        if (!isFocused) {
            setLocalValue(value !== null && value !== undefined ? String(value) : '')
        }
    }, [value, isFocused])

    // Format number for display
    const formatNumber = (num) => {
        if (num === null || num === undefined || num === '') return ''

        const number = Number(num)
        if (isNaN(number)) return ''

        return precision > 0 ? number.toFixed(precision) : String(Math.round(number))
    }

    // Parse and validate input
    const parseInput = (input) => {
        if (input === '' || input === null || input === undefined) return null

        const number = Number(input)
        if (isNaN(number)) return null

        // Apply constraints
        let constrainedNumber = number

        if (min !== undefined && constrainedNumber < min) {
            constrainedNumber = min
        }
        if (max !== undefined && constrainedNumber > max) {
            constrainedNumber = max
        }

        if (!allowNegative && constrainedNumber < 0) {
            constrainedNumber = 0
        }

        if (!allowDecimal) {
            constrainedNumber = Math.round(constrainedNumber)
        }

        return constrainedNumber
    }

    // Handle input change
    const handleInputChange = (e) => {
        const newValue = e.target.value
        setLocalValue(newValue)

        // Allow empty input during typing
        if (newValue === '') {
            onChange(null)
            return
        }

        const parsed = parseInput(newValue)
        if (parsed !== null) {
            onChange(parsed)
        }
    }

    // Handle focus
    const handleFocus = () => {
        setIsFocused(true)
    }

    // Handle blur
    const handleBlur = () => {
        setIsFocused(false)

        if (formatOnBlur && value !== null && value !== undefined) {
            setLocalValue(formatNumber(value))
        }
    }

    // Step up/down
    const handleStep = (direction) => {
        if (disabled) return

        const currentValue = value || 0
        const stepSize = direction === 'up' ? step : -step
        const newValue = parseInput(currentValue + stepSize)

        if (newValue !== null) {
            onChange(newValue)
        }
    }

    // Large step buttons
    const handleButtonStep = (direction) => {
        if (disabled) return

        const currentValue = value || 0
        const stepSize = direction === 'up' ? buttonStep : -buttonStep
        const newValue = parseInput(currentValue + stepSize)

        if (newValue !== null) {
            onChange(newValue)
        }
    }

    // Reset to default or zero
    const handleReset = () => {
        if (disabled) return
        onChange(min !== undefined ? min : 0)
    }

    // Keyboard handling
    const handleKeyDown = (e) => {
        if (disabled) return

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault()
                handleStep('up')
                break
            case 'ArrowDown':
                e.preventDefault()
                handleStep('down')
                break
            case 'PageUp':
                e.preventDefault()
                handleButtonStep('up')
                break
            case 'PageDown':
                e.preventDefault()
                handleButtonStep('down')
                break
        }
    }

    // Size classes
    const sizeClasses = {
        sm: 'px-2 py-1 text-sm',
        md: 'px-3 py-2 text-sm',
        lg: 'px-4 py-3 text-base'
    }

    const buttonSizeClasses = {
        sm: 'w-6 h-6',
        md: 'w-8 h-8',
        lg: 'w-10 h-10'
    }

    const sizeClass = sizeClasses[size] || sizeClasses.md
    const buttonSizeClass = buttonSizeClasses[size] || buttonSizeClasses.md

    const hasError = validation && !validation.isValid
    const canStepUp = max === undefined || (value || 0) < max
    const canStepDown = min === undefined || (value || 0) > min

    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            <div className="space-y-3">
                {/* Large Step Buttons */}
                {showButtons && (
                    <div className="flex items-center justify-center space-x-4">
                        <button
                            type="button"
                            onClick={() => handleButtonStep('down')}
                            disabled={disabled || !canStepDown}
                            className="flex items-center space-x-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Minus className="w-4 h-4" />
                            <span className="text-sm">-{buttonStep}</span>
                        </button>

                        <div className="text-lg font-bold text-gray-900 min-w-[60px] text-center">
                            {formatNumber(value || 0)}
                        </div>

                        <button
                            type="button"
                            onClick={() => handleButtonStep('up')}
                            disabled={disabled || !canStepUp}
                            className="flex items-center space-x-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="text-sm">+{buttonStep}</span>
                        </button>
                    </div>
                )}

                {/* Main Input with Steppers */}
                <div className="relative flex items-center">
                    {/* Prefix */}
                    {prefix && (
                        <div className="absolute left-3 text-gray-500 text-sm pointer-events-none">
                            {prefix}
                        </div>
                    )}

                    {/* Input */}
                    <input
                        ref={inputRef}
                        type="text"
                        value={localValue}
                        onChange={handleInputChange}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        disabled={disabled}
                        placeholder={placeholder}
                        className={`
                            w-full border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center
                            ${hasError ? 'border-red-300' : 'border-gray-300'}
                            ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}
                            ${sizeClass}
                            ${prefix ? 'pl-8' : ''}
                            ${suffix ? 'pr-8' : ''}
                            ${showSteppers ? 'pr-16' : ''}
                        `}
                        {...props}
                    />

                    {/* Suffix */}
                    {suffix && (
                        <div className="absolute right-3 text-gray-500 text-sm pointer-events-none">
                            {suffix}
                        </div>
                    )}

                    {/* Steppers */}
                    {showSteppers && (
                        <div className="absolute right-1 flex flex-col">
                            <button
                                type="button"
                                onClick={() => handleStep('up')}
                                disabled={disabled || !canStepUp}
                                className={`
                                    ${buttonSizeClass} flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-t
                                    disabled:opacity-30 disabled:cursor-not-allowed transition-colors
                                `}
                                title="Increase"
                            >
                                <Plus className="w-3 h-3" />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleStep('down')}
                                disabled={disabled || !canStepDown}
                                className={`
                                    ${buttonSizeClass} flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-b
                                    disabled:opacity-30 disabled:cursor-not-allowed transition-colors
                                `}
                                title="Decrease"
                            >
                                <Minus className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    {/* Calculator Button */}
                    {showCalculator && (
                        <button
                            type="button"
                            onClick={() => setShowCalc(!showCalc)}
                            disabled={disabled}
                            className="absolute right-1 p-1 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                            title="Calculator"
                        >
                            <Calculator className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Range Info */}
                {(min !== undefined || max !== undefined) && (
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>Min: {min !== undefined ? formatNumber(min) : 'None'}</span>
                        <span>Max: {max !== undefined ? formatNumber(max) : 'None'}</span>
                    </div>
                )}

                {/* Quick Actions */}
                <div className="flex items-center space-x-2">
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={disabled}
                        className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
                        title="Reset to minimum or zero"
                    >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                    </button>

                    {min !== undefined && (
                        <button
                            type="button"
                            onClick={() => onChange(min)}
                            disabled={disabled}
                            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
                        >
                            Min ({formatNumber(min)})
                        </button>
                    )}

                    {max !== undefined && (
                        <button
                            type="button"
                            onClick={() => onChange(max)}
                            disabled={disabled}
                            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
                        >
                            Max ({formatNumber(max)})
                        </button>
                    )}
                </div>
            </div>

            {description && (
                <p className="text-sm text-gray-500">{description}</p>
            )}

            {/* Keyboard Shortcuts */}
            <div className="text-xs text-gray-500">
                <kbd className="bg-gray-100 px-1 rounded">↑↓</kbd> Step by {step}
                {showButtons && (
                    <>
                        {' • '}
                        <kbd className="bg-gray-100 px-1 rounded">PgUp/PgDn</kbd> Step by {buttonStep}
                    </>
                )}
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
        </div>
    )
}

NumericStepperInput.displayName = 'NumericStepperInput'

export default NumericStepperInput
