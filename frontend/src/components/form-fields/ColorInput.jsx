import React, { useState, useRef, useEffect } from 'react'
import { Palette, Pipette, Check, RotateCcw } from 'lucide-react'

/**
 * ColorInput Component
 * 
 * Advanced color picker with multiple input methods and preset colors.
 * Supports hex, RGB, HSL color formats with visual color preview.
 */
const ColorInput = ({
    value,
    onChange,
    validation,
    isValidating,
    label,
    description,
    required,
    disabled,
    format = 'hex', // 'hex', 'rgb', 'hsl'
    showPresets = true,
    showEyeDropper = true,
    allowTransparent = false,
    presetColors = [
        '#000000', '#ffffff', '#f3f4f6', '#e5e7eb', '#d1d5db', '#9ca3af',
        '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
        '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899'
    ],
    ...props
}) => {
    const [showPicker, setShowPicker] = useState(false)
    const [inputValue, setInputValue] = useState(value || '#000000')
    const pickerRef = useRef(null)
    const inputRef = useRef(null)

    // Sync input value with prop value
    useEffect(() => {
        if (value !== inputValue) {
            setInputValue(value || '#000000')
        }
    }, [value])

    // Close picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setShowPicker(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Validate color format
    const isValidColor = (color) => {
        if (!color) return false
        if (color === 'transparent' && allowTransparent) return true

        // Test hex format
        if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) return true

        // Test rgb format
        if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(color)) return true

        // Test rgba format
        if (/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*(0|1|0?\.\d+)\s*\)$/.test(color)) return true

        return false
    }

    const handleInputChange = (e) => {
        const newValue = e.target.value
        setInputValue(newValue)

        if (isValidColor(newValue) || newValue === '') {
            onChange(newValue || null)
        }
    }

    const handleColorSelect = (color) => {
        setInputValue(color)
        onChange(color)
        setShowPicker(false)
    }

    const handleEyeDropper = async () => {
        if ('EyeDropper' in window) {
            try {
                const eyeDropper = new window.EyeDropper()
                const result = await eyeDropper.open()
                handleColorSelect(result.sRGBHex)
            } catch (err) {
                console.log('EyeDropper was cancelled or failed:', err)
            }
        } else {
            alert('EyeDropper API is not supported in this browser')
        }
    }

    const handleReset = () => {
        const defaultColor = allowTransparent ? 'transparent' : '#000000'
        handleColorSelect(defaultColor)
    }

    const getDisplayColor = () => {
        return isValidColor(inputValue) ? inputValue : '#000000'
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

            <div className="flex items-center space-x-3">
                {/* Color Preview */}
                <button
                    type="button"
                    onClick={() => !disabled && setShowPicker(!showPicker)}
                    disabled={disabled}
                    className={`
                        w-12 h-10 rounded-md border-2 border-gray-300 shadow-sm transition-all
                        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-gray-400'}
                        ${hasError ? 'border-red-300' : ''}
                        ${showPicker ? 'ring-2 ring-blue-500' : ''}
                    `}
                    style={{
                        backgroundColor: getDisplayColor(),
                        backgroundImage: allowTransparent && getDisplayColor() === 'transparent'
                            ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                            : 'none',
                        backgroundSize: allowTransparent && getDisplayColor() === 'transparent' ? '8px 8px' : 'auto',
                        backgroundPosition: allowTransparent && getDisplayColor() === 'transparent' ? '0 0, 0 4px, 4px -4px, -4px 0px' : 'auto'
                    }}
                    title="Click to open color picker"
                >
                    <Palette className="w-4 h-4 text-white opacity-0 hover:opacity-100 transition-opacity mx-auto" />
                </button>

                {/* Text Input */}
                <div className="flex-1">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        disabled={disabled}
                        placeholder={format === 'hex' ? '#000000' : 'Enter color...'}
                        className={`
                            w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500
                            ${hasError ? 'border-red-300' : 'border-gray-300'}
                            ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}
                        `}
                        {...props}
                    />
                </div>

                {/* Eye Dropper */}
                {showEyeDropper && 'EyeDropper' in window && (
                    <button
                        type="button"
                        onClick={handleEyeDropper}
                        disabled={disabled}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                        title="Pick color from screen"
                    >
                        <Pipette className="w-4 h-4" />
                    </button>
                )}

                {/* Reset */}
                <button
                    type="button"
                    onClick={handleReset}
                    disabled={disabled}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                    title="Reset to default"
                >
                    <RotateCcw className="w-4 h-4" />
                </button>
            </div>

            {/* Color Picker Dropdown */}
            {showPicker && (
                <div ref={pickerRef} className="relative">
                    <div className="absolute z-10 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-64">
                        {/* HTML5 Color Picker */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Color Picker
                            </label>
                            <input
                                type="color"
                                value={getDisplayColor()}
                                onChange={(e) => handleColorSelect(e.target.value)}
                                className="w-full h-10 rounded border border-gray-300 cursor-pointer"
                            />
                        </div>

                        {/* Preset Colors */}
                        {showPresets && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Preset Colors
                                </label>
                                <div className="grid grid-cols-6 gap-2 mb-4">
                                    {allowTransparent && (
                                        <button
                                            type="button"
                                            onClick={() => handleColorSelect('transparent')}
                                            className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center"
                                            style={{
                                                backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                                                backgroundSize: '6px 6px',
                                                backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px'
                                            }}
                                            title="Transparent"
                                        >
                                            {getDisplayColor() === 'transparent' && (
                                                <Check className="w-4 h-4 text-gray-600" />
                                            )}
                                        </button>
                                    )}
                                    {presetColors.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => handleColorSelect(color)}
                                            className="w-8 h-8 rounded border border-gray-300 flex items-center justify-center"
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        >
                                            {getDisplayColor() === color && (
                                                <Check className="w-4 h-4 text-white" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Format Options */}
                        <div className="text-xs text-gray-500">
                            Current: {getDisplayColor()}
                        </div>
                    </div>
                </div>
            )}

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
        </div>
    )
}

ColorInput.displayName = 'ColorInput'

export default ColorInput
