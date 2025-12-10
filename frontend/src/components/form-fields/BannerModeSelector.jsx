import React, { useCallback } from 'react'
import { Type, AlignLeft } from 'lucide-react'

/**
 * BannerModeSelector Component
 * 
 * Visual selector for banner mode options.
 * Shows visual preview of text mode vs header mode layouts.
 */
const BannerModeSelector = React.memo(({
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
    // Available mode options
    const modes = [
        { 
            value: 'text', 
            label: 'Text Mode', 
            icon: AlignLeft,
            description: 'H3 + paragraph, optional image'
        },
        { 
            value: 'header', 
            label: 'Header Mode', 
            icon: Type,
            description: 'H2 centered, no image'
        },
    ]

    // Handle option selection
    const handleOptionClick = useCallback((modeValue) => {
        if (disabled) return
        onChange(modeValue)
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
                {modes.map((mode, index) => {
                    const isSelected = value === mode.value
                    const IconComponent = mode.icon
                    
                    return (
                        <button
                            key={mode.value}
                            type="button"
                            onClick={() => handleOptionClick(mode.value)}
                            disabled={disabled}
                            className={`
                                px-4 py-3 transition-all duration-200 font-medium border-gray-300
                                ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                                ${isSelected 
                                    ? 'bg-blue-600 text-white border-blue-600 z-10' 
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                                }
                                ${index > 0 && !isSelected ? '-ml-px' : ''}
                                flex flex-col items-center justify-center space-y-2 min-w-[100px]
                            `}
                            title={mode.description}
                            {...props}
                        >
                            {/* Visual representation */}
                            <div className="flex items-center justify-center h-8 w-14">
                                {mode.value === 'text' ? (
                                    // Text mode: lines representing text + small box for image
                                    <div className="flex flex-col items-start space-y-1 w-full">
                                        <div className={`h-1.5 w-8 rounded ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />
                                        <div className={`h-1 w-10 rounded ${isSelected ? 'bg-white/70' : 'bg-blue-400'}`} />
                                        <div className={`h-1 w-6 rounded ${isSelected ? 'bg-white/70' : 'bg-blue-400'}`} />
                                    </div>
                                ) : (
                                    // Header mode: centered large text
                                    <div className="flex flex-col items-center space-y-1 w-full">
                                        <div className={`h-2 w-12 rounded ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />
                                        <div className={`h-1.5 w-10 rounded ${isSelected ? 'bg-white/80' : 'bg-blue-400'}`} />
                                    </div>
                                )}
                            </div>
                            
                            {/* Mode label */}
                            <div className="flex items-center gap-1.5">
                                <IconComponent className="h-3.5 w-3.5" />
                                <span className="text-xs font-semibold">{mode.label}</span>
                            </div>
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

BannerModeSelector.displayName = 'BannerModeSelector'

export default BannerModeSelector

