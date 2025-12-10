import React, { useCallback, useMemo } from 'react'

/**
 * TwoColumnRatioSelector Component
 * 
 * Visual selector for 2-column layout ratios.
 * Shows visual preview of column widths for each ratio option.
 */
const TwoColumnRatioSelector = React.memo(({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    fieldName,
    ...props
}) => {
    // Available ratio options
    const ratios = useMemo(() => [
        { value: '5:1', label: '5:1', left: 5, right: 1 },
        { value: '4:2', label: '4:2', left: 4, right: 2 },
        { value: '3:3', label: '3:3', left: 3, right: 3 },
        { value: '2:4', label: '2:4', left: 2, right: 4 },
        { value: '1:5', label: '1:5', left: 1, right: 5 },
    ], [])

    // Handle option selection
    const handleOptionClick = useCallback((ratioValue) => {
        if (disabled) return
        onChange(ratioValue)
    }, [disabled, onChange])

    // Calculate bar widths as percentages
    const getBarWidths = useCallback((left, right) => {
        const total = left + right
        const leftPercent = (left / total) * 100
        const rightPercent = (right / total) * 100
        return { left: leftPercent, right: rightPercent }
    }, [])

    const hasError = validation && !validation.isValid

    return (
        <div className="space-y-2">
            {label && (
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}

            <div className="inline-flex rounded-md overflow-hidden border border-gray-300">
                {ratios.map((ratio, index) => {
                    const isSelected = value === ratio.value
                    const widths = getBarWidths(ratio.left, ratio.right)
                    
                    return (
                        <button
                            key={ratio.value}
                            type="button"
                            onClick={() => handleOptionClick(ratio.value)}
                            disabled={disabled}
                            className={`
                                px-3 py-2 transition-all duration-200 font-medium border-gray-300
                                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                                ${isSelected 
                                    ? 'bg-blue-600 text-white border-blue-600 z-10' 
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                }
                                ${index > 0 && !isSelected ? '-ml-px' : ''}
                                flex flex-col items-center justify-center space-y-1.5
                            `}
                            title={`${ratio.label} column ratio`}
                            {...props}
                        >
                            {/* Visual bars preview */}
                            <div className="flex items-end h-8 w-12 gap-0.5">
                                <div 
                                    className={`
                                        ${isSelected ? 'bg-white' : 'bg-blue-500'}
                                        rounded-sm transition-colors
                                    `}
                                    style={{ 
                                        width: `${widths.left}%`,
                                        height: `${(ratio.left / 5) * 100}%`
                                    }}
                                />
                                <div 
                                    className={`
                                        ${isSelected ? 'bg-white' : 'bg-blue-500'}
                                        rounded-sm transition-colors
                                    `}
                                    style={{ 
                                        width: `${widths.right}%`,
                                        height: `${(ratio.right / 5) * 100}%`
                                    }}
                                />
                            </div>
                            
                            {/* Ratio label */}
                            <span className="text-xs font-semibold">{ratio.label}</span>
                        </button>
                    )
                })}
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
        </div>
    )
})

TwoColumnRatioSelector.displayName = 'TwoColumnRatioSelector'

export default TwoColumnRatioSelector

