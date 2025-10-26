/**
 * Color Selector - Compact button with color palette popover
 */

import React, { useState, useRef, useEffect } from 'react';

const ColorSelector = ({ value, onChange, colors = {}, label, className = '' }) => {
    const [showPalette, setShowPalette] = useState(false);
    const buttonRef = useRef(null);
    const paletteRef = useRef(null);
    const themeColors = Object.entries(colors);

    // Get current color for display
    const getCurrentColor = () => {
        if (!value) return '#cccccc';
        if (value.startsWith('var(--')) {
            const colorName = value.match(/var\(--([^)]+)\)/)?.[1];
            return colors[colorName] || '#cccccc';
        }
        return value;
    };

    // Close palette when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                paletteRef.current &&
                !paletteRef.current.contains(event.target) &&
                !buttonRef.current?.contains(event.target)
            ) {
                setShowPalette(false);
            }
        };

        if (showPalette) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showPalette]);

    return (
        <div className={`relative ${className}`}>
            {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>}

            {/* Color Button */}
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setShowPalette(!showPalette)}
                className="w-10 h-10 rounded border-2 border-gray-300 hover:border-gray-400 transition-colors"
                style={{ backgroundColor: getCurrentColor() }}
                title="Select color"
            />

            {/* Color Palette Popover */}
            {showPalette && (
                <div
                    ref={paletteRef}
                    className="absolute z-50 mt-2 p-3 bg-white border border-gray-300 rounded-lg shadow-lg"
                    style={{ minWidth: '200px' }}
                >
                    <div className="text-xs font-semibold text-gray-700 mb-2">Theme Colors</div>
                    <div className="grid grid-cols-4 gap-2">
                        {themeColors.map(([name, color]) => {
                            const isSelected = value === `var(--${name})` || value === color;
                            return (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => {
                                        onChange(`var(--${name})`);
                                        setShowPalette(false);
                                    }}
                                    className={`group relative w-10 h-10 rounded border-2 transition-all ${isSelected
                                            ? 'border-blue-600 ring-2 ring-blue-200'
                                            : 'border-gray-300 hover:border-gray-400'
                                        }`}
                                    title={name}
                                >
                                    <div
                                        className="w-full h-full rounded"
                                        style={{ backgroundColor: color }}
                                    />
                                </button>
                            );
                        })}
                    </div>

                    {/* Custom Color */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs font-semibold text-gray-700 mb-2">Custom</div>
                        <input
                            type="color"
                            value={getCurrentColor()}
                            onChange={(e) => {
                                onChange(e.target.value);
                                setShowPalette(false);
                            }}
                            className="w-full h-10 rounded border border-gray-300 cursor-pointer"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ColorSelector;
