/**
 * Color Selector - Compact button with color palette popover
 */

import React, { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../Tooltip';

const ColorSelector = ({ value, onChange, colors = {}, label, className = '', icon = null, title = 'Select color', compact = false, onOpenChange, onClose }) => {
    const [showPalette, setShowPalette] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef(null);
    const paletteRef = useRef(null);
    const paletteId = useId();
    const themeColors = Object.entries(colors);

    const setPaletteOpen = open => {
        onOpenChange?.(open);
        setShowPalette(open);
    };
    const closePalette = (reason, target) => {
        setPaletteOpen(false);
        const focusRestored = onClose?.(reason, target);
        if (reason !== 'outside' && !focusRestored) buttonRef.current?.focus();
    };

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
                left: Math.max(8, Math.min(rect.left, window.innerWidth - (paletteRef.current.offsetWidth || 226) - 8))
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
                left: Math.max(8, Math.min(rect.left, window.innerWidth - 226 - 8))
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
            paletteRef.current?.querySelector('button, input')?.focus();
            
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
                closePalette('outside', event.target);
            }
        };

        if (showPalette) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showPalette]);

    const selectPaletteColor = color => {
        onChange(color);
        closePalette('select');
    };

    const colorButton = <button
        ref={buttonRef}
        type="button"
        onClick={() => showPalette ? closePalette('toggle') : setPaletteOpen(true)}
        className={compact
            ? 'relative inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
            : 'w-10 h-10 rounded border-2 border-gray-300 hover:border-gray-400 transition-colors'}
        style={compact ? undefined : { backgroundColor: getCurrentColor() }}
        title={title}
        aria-label={title}
        aria-expanded={showPalette}
        aria-controls={showPalette ? paletteId : undefined}
    >
        {icon}
        {compact && <span className="absolute bottom-1 h-0.5 w-4 rounded-sm ring-1 ring-gray-300"
            style={{ backgroundColor: getCurrentColor() }} />}
    </button>;

    return (
        <div className={`relative ${className}`}>
            {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>}

            {/* Color Button */}
            {compact ? <Tooltip text={title}>{colorButton}</Tooltip> : colorButton}

            {/* Color Palette Popover - Rendered via Portal */}
            {showPalette && createPortal(
                <div
                    ref={paletteRef}
                    id={paletteId}
                    role="group"
                    aria-label={title}
                    onClick={event => event.stopPropagation()}
                    onBlur={event => {
                        // Another toolbar control may restore editor focus without
                        // a mouse click (for example a native outline selection).
                        // Close the old palette without stealing that new focus.
                        const target = event.relatedTarget;
                        if (target && !event.currentTarget.contains(target) && !buttonRef.current?.contains(target)) {
                            setPaletteOpen(false);
                        }
                    }}
                    onKeyDown={event => {
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            event.stopPropagation();
                            closePalette('escape');
                        }
                    }}
                    className="eceee-editor-ui fixed z-[10010] p-3 bg-white border border-gray-300 rounded-lg shadow-lg dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    style={{ 
                        minWidth: '200px',
                        top: `${position.top}px`,
                        left: `${position.left}px`
                    }}
                >
                    <div className="text-xs font-semibold text-gray-700 mb-2 dark:text-gray-200">Theme Colors</div>
                    <div className="grid grid-cols-4 gap-2">
                        {themeColors.map(([name, color]) => {
                            const isSelected = value === name || value === color;
                            return (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => selectPaletteColor(name)}
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
                        <div className="text-xs font-semibold text-gray-700 mb-2 dark:text-gray-200">Custom</div>
                        <input
                            type="color"
                            aria-label={`Custom ${title.toLowerCase()}`}
                            value={/^#[a-f\d]{6}$/i.test(getCurrentColor()) ? getCurrentColor() : '#000000'}
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
