/**
 * Color Selector - Compact button with color palette popover
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const ColorSelector = ({ value, onChange, colors = {}, label, className = '' }) => {
    const [showPalette, setShowPalette] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);
    const paletteRef = useRef(null);
    const themeColors = Object.entries(colors);

    // Get current color for display
    const getCurrentColor = () => {
        if (!value) return '#cccccc';
        // Check if value is a named color from palette
        if (colors[value]) {
            return colors[value];
        }
        // Otherwise it's a direct hex/rgb value
        return value;
    };

    // Calculate and update position
    const updatePosition = () => {
        if (buttonRef.current && paletteRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const paletteHeight = paletteRef.current.offsetHeight || 300; // Estimated height if not yet rendered
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - rect.bottom;
            const spaceAbove = rect.top;
            
            // Position above if there's not enough space below and there's more space above
            const shouldPositionAbove = spaceBelow < paletteHeight && spaceAbove > spaceBelow;
            
            setPosition({
                top: shouldPositionAbove ? rect.top - paletteHeight - 8 : rect.bottom + 8,
                left: rect.left
            });
        } else if (buttonRef.current) {
            // Fallback if palette ref not available yet
            const rect = buttonRef.current.getBoundingClientRect();
            const estimatedPaletteHeight = 300;
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - rect.bottom;
            const spaceAbove = rect.top;
            
            const shouldPositionAbove = spaceBelow < estimatedPaletteHeight && spaceAbove > spaceBelow;
            
            setPosition({
                top: shouldPositionAbove ? rect.top - estimatedPaletteHeight - 8 : rect.bottom + 8,
                left: rect.left
            });
        }
    };

    // Update position when palette opens and on scroll/resize
    useEffect(() => {
        if (showPalette) {
            // Initial position calculation
            updatePosition();
            
            // Recalculate after palette is rendered (to get accurate height)
            const timeoutId = setTimeout(updatePosition, 0);
            
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
            return () => {
                clearTimeout(timeoutId);
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
            };
        }
    }, [showPalette]);

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

            {/* Color Palette Popover - Rendered via Portal */}
            {showPalette && createPortal(
                <div
                    ref={paletteRef}
                    className="fixed z-[10010] p-3 bg-white border border-gray-300 rounded-lg shadow-lg"
                    style={{ 
                        minWidth: '200px',
                        top: `${position.top}px`,
                        left: `${position.left}px`
                    }}
                >
                    <div className="text-xs font-semibold text-gray-700 mb-2">Theme Colors</div>
                    <div className="grid grid-cols-4 gap-2">
                        {themeColors.map(([name, color]) => {
                            const isSelected = value === name || value === color;
                            return (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => onChange(name)}
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
                            onChange={(e) => onChange(e.target.value)}
                            className="w-full h-10 rounded border border-gray-300 cursor-pointer"
                        />
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ColorSelector;
