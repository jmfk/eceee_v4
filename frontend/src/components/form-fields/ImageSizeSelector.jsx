import React, { useCallback } from 'react'

/**
 * ImageSizeSelector Component
 * 
 * Visual selector for image size/shape options.
 * Shows visual preview of square vs rectangle image shapes.
 */
const ImageSizeSelector = React.memo(({
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
    // Available size options
    const sizes = [
        { value: 'square', label: 'Square', width: 1, height: 1 },
        { value: 'rectangle', label: 'Rectangle', width: 2, height: 1 },
    ]

    // Handle option selection
    const handleOptionClick = useCallback((sizeValue) => {
        if (disabled) return
        onChange(sizeValue)
    }, [disabled, onChange])

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
                {sizes.map((size, index) => {
                    const isSelected = value === size.value
                    
                    return (
                        <button
                            key={size.value}
                            type="button"
                            onClick={() => handleOptionClick(size.value)}
                            disabled={disabled}
                            className={`
                                px-4 py-2 transition-all duration-200 font-medium border-gray-300
                                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                                ${isSelected 
                                    ? 'bg-blue-600 text-white border-blue-600 z-10' 
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                }
                                ${index > 0 && !isSelected ? '-ml-px' : ''}
                                flex flex-col items-center justify-center space-y-1.5 min-w-[80px]
                            `}
                            title={`${size.label} image shape`}
                            {...props}
                        >
                            {/* Visual representation */}
                            <div className="flex items-center justify-center h-8 w-14">
                                <div 
                                    className={`
                                        ${isSelected ? 'bg-white' : 'bg-blue-500'}
                                        rounded transition-colors
                                    `}
                                    style={{ 
                                        width: size.value === 'square' ? '28px' : '56px',
                                        height: '28px'
                                    }}
                                />
                            </div>
                            
                            {/* Size label */}
                            <span className="text-xs font-semibold">{size.label}</span>
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
                <div className="text-xs text-gray-500">Validating...</div>
            )}
        </div>
    )
})

ImageSizeSelector.displayName = 'ImageSizeSelector'

export default ImageSizeSelector

