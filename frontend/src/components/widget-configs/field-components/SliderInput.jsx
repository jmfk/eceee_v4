import React from 'react'

/**
 * Slider Input Component
 * 
 * Numeric input with a visual slider control
 */
export default function SliderInput({
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    unit = '',
    showValue = true,
    label,
    description,
    disabled = false,
    className = ''
}) {
    const handleSliderChange = (e) => {
        const newValue = parseFloat(e.target.value)
        onChange(newValue)
    }

    const handleInputChange = (e) => {
        const newValue = e.target.value === '' ? min : parseFloat(e.target.value)
        if (!isNaN(newValue)) {
            onChange(Math.min(Math.max(newValue, min), max))
        }
    }

    return (
        <div className={`space-y-2 ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}

            <div className="flex items-center space-x-4">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value || min}
                    onChange={handleSliderChange}
                    disabled={disabled}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                        background: disabled ? undefined : `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((value - min) / (max - min)) * 100}%, #e5e7eb ${((value - min) / (max - min)) * 100}%, #e5e7eb 100%)`
                    }}
                />

                {showValue && (
                    <div className="flex items-center space-x-1">
                        <input
                            type="number"
                            min={min}
                            max={max}
                            step={step}
                            value={value || min}
                            onChange={handleInputChange}
                            disabled={disabled}
                            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        {unit && (
                            <span className="text-sm text-gray-600">{unit}</span>
                        )}
                    </div>
                )}
            </div>

            {description && (
                <p className="text-xs text-gray-500">{description}</p>
            )}
        </div>
    )
}

