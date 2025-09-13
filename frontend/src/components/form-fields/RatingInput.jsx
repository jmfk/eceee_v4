import React, { useState } from 'react'
import { Star, Heart, ThumbsUp, Circle, Square, Triangle } from 'lucide-react'

/**
 * RatingInput Component
 * 
 * Rating input with customizable icons (stars, hearts, etc.) and interactive feedback.
 * Supports half-ratings, hover effects, and custom rating scales.
 */
const RatingInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    max = 5,
    precision = 1, // 1 for whole numbers, 0.5 for half ratings
    icon = 'star', // 'star', 'heart', 'thumb', 'circle', 'square', 'triangle'
    size = 'md', // 'sm', 'md', 'lg'
    color = 'yellow', // 'yellow', 'red', 'blue', 'green', 'purple'
    showValue = true,
    showLabels = false,
    labels = [], // Custom labels for each rating
    allowClear = true,
    readOnly = false,
    ...props
}) => {
    const [hoverValue, setHoverValue] = useState(null)

    // Icon components mapping
    const iconComponents = {
        star: Star,
        heart: Heart,
        thumb: ThumbsUp,
        circle: Circle,
        square: Square,
        triangle: Triangle
    }

    // Size classes
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8'
    }

    // Color classes for filled state
    const colorClasses = {
        yellow: 'text-yellow-400',
        red: 'text-red-500',
        blue: 'text-blue-500',
        green: 'text-green-500',
        purple: 'text-purple-500'
    }

    // Color classes for hover state
    const hoverColorClasses = {
        yellow: 'hover:text-yellow-300',
        red: 'hover:text-red-400',
        blue: 'hover:text-blue-400',
        green: 'hover:text-green-400',
        purple: 'hover:text-purple-400'
    }

    const IconComponent = iconComponents[icon] || Star
    const sizeClass = sizeClasses[size] || sizeClasses.md
    const colorClass = colorClasses[color] || colorClasses.yellow
    const hoverColorClass = hoverColorClasses[color] || hoverColorClasses.yellow

    // Generate rating options based on precision
    const generateRatingOptions = () => {
        const options = []
        for (let i = precision; i <= max; i += precision) {
            options.push(i)
        }
        return options
    }

    const ratingOptions = generateRatingOptions()

    // Handle rating click
    const handleRatingClick = (rating) => {
        if (disabled || readOnly) return

        if (allowClear && value === rating) {
            onChange(null) // Clear rating if clicking same value
        } else {
            onChange(rating)
        }
    }

    // Handle hover
    const handleMouseEnter = (rating) => {
        if (disabled || readOnly) return
        setHoverValue(rating)
    }

    const handleMouseLeave = () => {
        setHoverValue(null)
    }

    // Determine if icon should be filled
    const isIconFilled = (rating) => {
        const currentValue = hoverValue !== null ? hoverValue : (value || 0)

        if (precision === 1) {
            return rating <= currentValue
        } else {
            // Handle half ratings
            return rating <= currentValue
        }
    }

    // Get rating label
    const getRatingLabel = (rating) => {
        if (labels.length > 0) {
            const index = Math.ceil(rating) - 1
            return labels[index] || `${rating} star${rating !== 1 ? 's' : ''}`
        }

        return `${rating} ${icon}${rating !== 1 ? 's' : ''}`
    }

    const hasError = validation && !validation.isValid

    return (
        <div className="space-y-1">
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            <div className="space-y-3">
                {/* Rating Icons */}
                <div className="flex items-center space-x-1">
                    {ratingOptions.map((rating) => (
                        <button
                            key={rating}
                            type="button"
                            onClick={() => handleRatingClick(rating)}
                            onMouseEnter={() => handleMouseEnter(rating)}
                            onMouseLeave={handleMouseLeave}
                            disabled={disabled || readOnly}
                            className={`
                                transition-all duration-150 
                                ${disabled || readOnly ? 'cursor-default opacity-50' : 'cursor-pointer hover:scale-110'}
                                ${isIconFilled(rating) ? colorClass : 'text-gray-300'}
                                ${!disabled && !readOnly ? hoverColorClass : ''}
                            `}
                            title={getRatingLabel(rating)}
                        >
                            <IconComponent
                                className={`${sizeClass} ${isIconFilled(rating) ? 'fill-current' : ''}`}
                            />
                        </button>
                    ))}

                    {/* Clear Button */}
                    {allowClear && value && !disabled && !readOnly && (
                        <button
                            type="button"
                            onClick={() => onChange(null)}
                            className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Clear rating"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Value Display */}
                {showValue && (
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-700">
                            {value ? `${value}/${max}` : 'No rating'}
                        </span>
                        {hoverValue !== null && hoverValue !== value && (
                            <span className="text-sm text-gray-500">
                                (hover: {hoverValue}/{max})
                            </span>
                        )}
                    </div>
                )}

                {/* Labels */}
                {showLabels && (hoverValue !== null || value) && (
                    <div className="text-sm text-gray-600">
                        {getRatingLabel(hoverValue || value)}
                    </div>
                )}

                {/* Rating Scale */}
                {labels.length > 0 && (
                    <div className="text-xs text-gray-500">
                        <div className="flex justify-between">
                            {labels.map((labelText, index) => (
                                <span key={index} className="text-center">
                                    {index + 1}: {labelText}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
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

            {/* Rating Guide */}
            {!readOnly && (
                <div className="text-xs text-gray-500">
                    {allowClear ? 'Click to rate, click again to clear' : 'Click to rate'}
                    {precision < 1 && ' • Supports half ratings'}
                </div>
            )}
        </div>
    )
}

RatingInput.displayName = 'RatingInput'

export default RatingInput
