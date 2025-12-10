import React, { useCallback, useMemo } from 'react'

/**
 * ThreeColumnRatioSelector Component
 * 
 * Visual selector for 3-column layout ratios.
 * Shows visual preview of column widths for each ratio option.
 */
const ThreeColumnRatioSelector = React.memo(({
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
        { value: '3:2:1', label: '3:2:1', left: 3, center: 2, right: 1 },
        { value: '2:2:2', label: '2:2:2', left: 2, center: 2, right: 2 },
        { value: '1:2:3', label: '1:2:3', left: 1, center: 2, right: 3 },
        { value: '1:4:1', label: '1:4:1', left: 1, center: 4, right: 1 },
    ], [])

    // Handle option selection
    const handleOptionClick = useCallback((ratioValue) => {
        if (disabled) return
        onChange(ratioValue)
    }, [disabled, onChange])

    // Calculate bar widths as percentages
    const getBarWidths = useCallback((left, center, right) => {
        const total = left + center + right
        const leftPercent = (left / total) * 100
        const centerPercent = (center / total) * 100
        const rightPercent = (right / total) * 100
        return { left: leftPercent, center: centerPercent, right: rightPercent }
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
                    const widths = getBarWidths(ratio.left, ratio.center, ratio.right)
                    const maxValue = Math.max(ratio.left, ratio.center, ratio.right)
                    
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
                            <div className="flex items-end h-8 w-14 gap-0.5">
                                <div 
                                    className={`
                                        ${isSelected ? 'bg-white' : 'bg-blue-500'}
                                        rounded-sm transition-colors
                                    `}
                                    style={{ 
                                        width: `${widths.left}%`,
                                        height: `${(ratio.left / maxValue) * 100}%`
                                    }}
                                />
                                <div 
                                    className={`
                                        ${isSelected ? 'bg-white' : 'bg-blue-500'}
                                        rounded-sm transition-colors
                                    `}
                                    style={{ 
                                        width: `${widths.center}%`,
                                        height: `${(ratio.center / maxValue) * 100}%`
                                    }}
                                />
                                <div 
                                    className={`
                                        ${isSelected ? 'bg-white' : 'bg-blue-500'}
                                        rounded-sm transition-colors
                                    `}
                                    style={{ 
                                        width: `${widths.right}%`,
                                        height: `${(ratio.right / maxValue) * 100}%`
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

ThreeColumnRatioSelector.displayName = 'ThreeColumnRatioSelector'

export default ThreeColumnRatioSelector

