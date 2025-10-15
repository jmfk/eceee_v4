import React from 'react'
import * as Icons from 'lucide-react'

/**
 * Segmented Control Component
 * 
 * Radio-style button group for selecting from a few options
 */
export default function SegmentedControl({
    value,
    onChange,
    options = [],
    label,
    description,
    disabled = false,
    className = ''
}) {
    const handleSelect = (optionValue) => {
        if (!disabled) {
            onChange(optionValue)
        }
    }

    return (
        <div className={`space-y-2 ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                </label>
            )}

            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden bg-white">
                {options.map((option, index) => {
                    const optionValue = typeof option === 'string' ? option : option.value
                    const optionLabel = typeof option === 'string' ? option : option.label
                    const optionIcon = typeof option === 'object' ? option.icon : null
                    const isSelected = value === optionValue

                    // Get icon component if specified
                    const IconComponent = optionIcon && Icons[optionIcon] ? Icons[optionIcon] : null

                    return (
                        <button
                            key={optionValue}
                            type="button"
                            onClick={() => handleSelect(optionValue)}
                            disabled={disabled}
                            className={`
                px-4 py-2 text-sm font-medium transition-colors
                ${isSelected
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                }
                ${index > 0 ? 'border-l border-gray-300' : ''}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                flex items-center space-x-2
              `}
                        >
                            {IconComponent && <IconComponent className="w-4 h-4" />}
                            <span>{optionLabel}</span>
                        </button>
                    )
                })}
            </div>

            {description && (
                <p className="text-xs text-gray-500">{description}</p>
            )}
        </div>
    )
}

