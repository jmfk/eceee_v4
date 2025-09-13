import React from 'react'
import { Check, Grid, Play } from 'lucide-react'
import * as LucideIcons from 'lucide-react'

/**
 * SegmentedControlInput Component
 * 
 * Segmented control for selecting one or multiple options from a group.
 * Provides a clean, iOS-style interface for choice selection.
 */
const SegmentedControlInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    options = [],
    multiple = false,
    size = 'md', // 'sm', 'md', 'lg'
    variant = 'default', // 'default', 'pills', 'buttons'
    fullWidth = false,
    allowDeselect = false, // Allow deselecting in single mode
    showValue = false, // Show selected value below the control
    ...props
}) => {
    // Normalize options to consistent format
    const normalizeOptions = (opts) => {
        if (!Array.isArray(opts)) return []

        return opts.map((option, index) => {
            if (typeof option === 'string') {
                return { value: option, label: option, id: `option-${index}` }
            }
            if (typeof option === 'object' && option.value !== undefined) {
                return {
                    value: option.value,
                    label: option.label || option.value,
                    id: option.id || `option-${index}`,
                    icon: option.icon,
                    disabled: option.disabled,
                    ...option
                }
            }
            return { value: String(option), label: String(option), id: `option-${index}` }
        })
    }

    const normalizedOptions = normalizeOptions(options)
    const selectedValues = multiple ? (Array.isArray(value) ? value : []) : (value ? [value] : [])

    // Handle option selection
    const handleOptionClick = (optionValue) => {
        if (disabled) return

        if (multiple) {
            const isSelected = selectedValues.includes(optionValue)
            let newValue

            if (isSelected) {
                newValue = selectedValues.filter(v => v !== optionValue)
            } else {
                newValue = [...selectedValues, optionValue]
            }

            onChange(newValue)
        } else {
            if (allowDeselect && value === optionValue) {
                onChange(null)
            } else {
                onChange(optionValue)
            }
        }
    }

    // Size classes
    const sizeClasses = {
        sm: 'px-2 py-1 text-xs',
        md: 'px-3 py-2 text-sm',
        lg: 'px-4 py-3 text-base'
    }

    const sizeClass = sizeClasses[size] || sizeClasses.md

    // Variant styles
    const getVariantClasses = (isSelected, isDisabled, optionDisabled) => {
        const baseClasses = `
            transition-all duration-200 font-medium border focus:outline-none focus:ring-2 focus:ring-blue-500
            ${isDisabled || optionDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
        `

        if (variant === 'pills') {
            return `
                ${baseClasses} rounded-full border-2
                ${isSelected
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }
            `
        } else if (variant === 'buttons') {
            return `
                ${baseClasses} rounded border
                ${isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }
            `
        } else {
            // Default segmented style
            return `
                ${baseClasses} border-gray-300
                ${isSelected
                    ? 'bg-blue-600 text-white border-blue-600 z-10'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }
            `
        }
    }

    // Container classes
    const getContainerClasses = () => {
        const baseClasses = `
            ${fullWidth ? 'w-full' : 'inline-flex'}
            ${validation && !validation.isValid ? 'ring-2 ring-red-200' : ''}
        `

        if (variant === 'pills' || variant === 'buttons') {
            return `${baseClasses} flex flex-wrap gap-2`
        } else {
            // Default segmented style
            return `${baseClasses} inline-flex rounded-md overflow-hidden`
        }
    }

    // Individual button classes for segmented style
    const getSegmentedButtonClasses = (index, isSelected, isDisabled, optionDisabled) => {
        const baseClasses = getVariantClasses(isSelected, isDisabled, optionDisabled)

        if (variant === 'default') {
            // Remove individual border radius and adjust borders for segmented look
            let segmentClasses = baseClasses.replace('rounded-md', '')

            if (index === 0) {
                segmentClasses += ' rounded-l-md'
            }
            if (index === normalizedOptions.length - 1) {
                segmentClasses += ' rounded-r-md'
            }
            if (index > 0 && !isSelected) {
                segmentClasses += ' -ml-px'
            }

            return segmentClasses
        }

        return baseClasses
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

            <div className={getContainerClasses()}>
                {normalizedOptions.map((option, index) => {
                    const isSelected = selectedValues.includes(option.value)
                    const isOptionDisabled = option.disabled || false
                    const IconComponent = option.icon
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => handleOptionClick(option.value)}
                            disabled={disabled || isOptionDisabled}
                            className={`
                                ${sizeClass}
                                ${variant === 'default'
                                    ? getSegmentedButtonClasses(index, isSelected, disabled, isOptionDisabled)
                                    : getVariantClasses(isSelected, disabled, isOptionDisabled)
                                }
                                ${fullWidth && variant !== 'default' ? 'flex-1' : ''}
                                flex items-center justify-center space-x-2
                            `}
                            title={option.title || option.label}
                            {...props}
                        >
                            {IconComponent && (() => {
                                // Handle different icon types
                                if (typeof IconComponent === 'function') {
                                    // React component (direct import)
                                    return <IconComponent className="w-4 h-4" />
                                } else if (typeof IconComponent === 'string') {
                                    // String reference to Lucide icon
                                    const LucideIcon = LucideIcons[IconComponent]
                                    if (LucideIcon) {
                                        return <LucideIcon className="w-4 h-4" />
                                    }
                                    // Fallback for URLs or other strings
                                    return <img src={IconComponent} className="w-4 h-4" alt="" />
                                }
                                return null
                            })()}
                            <span>{option.label}</span>
                            {multiple && isSelected && (
                                <Check className="w-3 h-3 ml-1" />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Value Display */}
            {showValue && (
                <div className="text-sm text-gray-600">
                    {multiple ? (
                        selectedValues.length > 0 ? (
                            `Selected: ${selectedValues.map(val =>
                                normalizedOptions.find(opt => opt.value === val)?.label || val
                            ).join(', ')}`
                        ) : (
                            'No selection'
                        )
                    ) : (
                        value ? (
                            `Selected: ${normalizedOptions.find(opt => opt.value === value)?.label || value}`
                        ) : (
                            'No selection'
                        )
                    )}
                </div>
            )}
            {/* Labels */}
            {options.length > 0 && (
                <div className="text-xs text-gray-500">
                    <div className="flex justify-between">
                        {normalizedOptions.map((option, index) => (
                            <span key={index} className="text-center">
                                {option.label}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {description && (
                <p className="text-sm text-gray-500">{description}</p>
            )}

            {/* Selection Info */}
            {multiple && (
                <div className="text-xs text-gray-500">
                    {selectedValues.length} of {normalizedOptions.length} selected
                    {allowDeselect && ' • Click again to deselect'}
                </div>
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

            {normalizedOptions.length === 0 && (
                <div className="text-sm text-gray-500">
                    No options available
                </div>
            )}
        </div>
    )
}

SegmentedControlInput.displayName = 'SegmentedControlInput'

export default SegmentedControlInput
