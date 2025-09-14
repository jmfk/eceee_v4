import React, { useState, useEffect } from 'react'
import { Minus, Plus } from 'lucide-react'

/**
 * SliderInput Component
 * 
 * Range slider input with numeric display and optional step buttons.
 * Supports custom formatting and validation.
 */
const SliderInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    min = 0,
    max = 100,
    step = 1,
    showValue = true,
    showStepButtons = false,
    showMinMax = true,
    formatValue = (val) => String(val),
    unit = '',
    marks = [], // Array of {value, label} for tick marks
    ...props
}) => {
    const [localValue, setLocalValue] = useState(value || min)
    const [isDragging, setIsDragging] = useState(false)

    // Sync local value with prop value
    useEffect(() => {
        if (value !== localValue && !isDragging) {
            setLocalValue(value || min)
        }
    }, [value, min, isDragging])

    const handleSliderChange = (e) => {
        const newValue = Number(e.target.value)
        setLocalValue(newValue)
        onChange(newValue)
    }

    const handleStepUp = () => {
        const newValue = Math.min(localValue + step, max)
        setLocalValue(newValue)
        onChange(newValue)
    }

    const handleStepDown = () => {
        const newValue = Math.max(localValue - step, min)
        setLocalValue(newValue)
        onChange(newValue)
    }

    const handleMouseDown = () => {
        setIsDragging(true)
    }

    const handleMouseUp = () => {
        setIsDragging(false)
    }

    // Calculate percentage for styling
    const percentage = ((localValue - min) / (max - min)) * 100

    const hasError = validation && !validation.isValid

    return (
        <div className="space-y-1 slider-input">
            {label && (
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                        {label}
                        {required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {showValue && (
                        <span className={`text-sm font-medium ${hasError ? 'text-red-600' : 'text-gray-900'}`}>
                            {formatValue(localValue)}{unit}
                        </span>
                    )}
                </div>
            )}

            <div className="space-y-3">
                {/* Slider Container */}
                <div className="relative">
                    {/* Step Buttons */}
                    {showStepButtons && (
                        <div className="flex items-center space-x-3">
                            <button
                                type="button"
                                onClick={handleStepDown}
                                disabled={disabled || localValue <= min}
                                className="p-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Minus className="w-4 h-4" />
                            </button>

                            <div className="flex-1 relative">
                                {/* Slider Track */}
                                <div className="relative">
                                    <input
                                        type="range"
                                        min={min}
                                        max={max}
                                        step={step}
                                        value={localValue}
                                        onChange={handleSliderChange}
                                        onMouseDown={handleMouseDown}
                                        onMouseUp={handleMouseUp}
                                        onTouchStart={handleMouseDown}
                                        onTouchEnd={handleMouseUp}
                                        disabled={disabled}
                                        className={`
                                            w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                                            focus:outline-none focus:ring-2 focus:ring-blue-500
                                            disabled:opacity-50 disabled:cursor-not-allowed
                                            slider-thumb
                                        `}
                                        style={{
                                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`
                                        }}
                                        {...props}
                                    />

                                    {/* Marks */}
                                    {marks.length > 0 && (
                                        <div className="absolute top-3 left-0 right-0 flex justify-between">
                                            {marks.map((mark) => {
                                                const markPercentage = ((mark.value - min) / (max - min)) * 100
                                                return (
                                                    <div
                                                        key={mark.value}
                                                        className="absolute transform -translate-x-1/2"
                                                        style={{ left: `${markPercentage}%` }}
                                                    >
                                                        <div className="w-0.5 h-2 bg-gray-400"></div>
                                                        <div className="text-xs text-gray-500 mt-1 text-center">
                                                            {mark.label}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleStepUp}
                                disabled={disabled || localValue >= max}
                                className="p-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Slider Only */}
                    {!showStepButtons && (
                        <div className="relative">
                            <input
                                type="range"
                                min={min}
                                max={max}
                                step={step}
                                value={localValue}
                                onChange={handleSliderChange}
                                onMouseDown={handleMouseDown}
                                onMouseUp={handleMouseUp}
                                onTouchStart={handleMouseDown}
                                onTouchEnd={handleMouseUp}
                                disabled={disabled}
                                className={`
                                    w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                                    focus:outline-none focus:ring-2 focus:ring-blue-500
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                `}
                                style={{
                                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`
                                }}
                                {...props}
                            />

                            {/* Marks */}
                            {marks.length > 0 && (
                                <div className="absolute top-3 left-0 right-0">
                                    {marks.map((mark) => {
                                        const markPercentage = ((mark.value - min) / (max - min)) * 100
                                        return (
                                            <div
                                                key={mark.value}
                                                className="absolute transform -translate-x-1/2"
                                                style={{ left: `${markPercentage}%` }}
                                            >
                                                <div className="w-0.5 h-2 bg-gray-400"></div>
                                                <div className="text-xs text-gray-500 mt-1 text-center whitespace-nowrap">
                                                    {mark.label}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Min/Max Labels */}
                    {showMinMax && (
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>{formatValue(min)}{unit}</span>
                            <span>{formatValue(max)}{unit}</span>
                        </div>
                    )}
                </div>
            </div>

            {description && (
                <p className="text-sm text-gray-500">{description}</p>
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

            <style dangerouslySetInnerHTML={{
                __html: `
                    .slider-input input[type="range"]::-webkit-slider-thumb {
                        appearance: none;
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        background: #3b82f6;
                        border: 2px solid white;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                        cursor: pointer;
                    }
                    
                    .slider-input input[type="range"]::-moz-range-thumb {
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        background: #3b82f6;
                        border: 2px solid white;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                        cursor: pointer;
                        border: none;
                    }
                    
                    .slider-input input[type="range"]:disabled::-webkit-slider-thumb {
                        background: #9ca3af;
                        cursor: not-allowed;
                    }
                    
                    .slider-input input[type="range"]:disabled::-moz-range-thumb {
                        background: #9ca3af;
                        cursor: not-allowed;
                    }
                `
            }} />
        </div>
    )
}

SliderInput.displayName = 'SliderInput'

export default SliderInput
