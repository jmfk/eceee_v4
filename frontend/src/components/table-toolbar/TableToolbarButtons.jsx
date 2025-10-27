/**
 * TableToolbarButtons - Toolbar buttons for table editing
 * 
 * Renders all table editing buttons including structure, formatting, styling, etc.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    Plus, Minus, Grid3X3, Split, Palette, Square, Import, Grid2X2,
    Bold, Italic, AlignLeft, AlignCenter, AlignRight,
    AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
    ArrowRightFromLine, ArrowLeftFromLine
} from 'lucide-react';

const TableToolbarButtons = ({ state, onCommand }) => {
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showBorderPicker, setShowBorderPicker] = useState(false);
    const colorPickerRef = useRef(null);
    const borderPickerRef = useRef(null);

    // Border state
    const [borderSides, setBorderSides] = useState({ top: null, bottom: null, left: null, right: null });
    const [borderWidth, setBorderWidth] = useState('1px');
    const [borderStyle, setBorderStyle] = useState('solid');
    const [borderColor, setBorderColor] = useState('#000000');

    // Color state
    const [backgroundColor, setBackgroundColor] = useState('#ffffff');
    const [textColor, setTextColor] = useState('#000000');
    const [hoverBackgroundColor, setHoverBackgroundColor] = useState('#f3f4f6');
    const [hoverTextColor, setHoverTextColor] = useState('#000000');

    // Update state from toolbar state
    useEffect(() => {
        if (state?.colors) {
            setBackgroundColor(state.colors.background || '#ffffff');
            setTextColor(state.colors.text || '#000000');
            setHoverBackgroundColor(state.colors.hoverBackground || '#f3f4f6');
            setHoverTextColor(state.colors.hoverText || '#000000');
        }
        if (state?.borders) {
            // Update border state from selected cell
            const borders = state.borders;
            if (borders.width) setBorderWidth(borders.width);
            if (borders.style) setBorderStyle(borders.style);
            if (borders.color) setBorderColor(borders.color);
        }
    }, [state]);

    // Close pickers when clicking outside (but not the toggle button itself)
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if clicking on the color picker button
            const colorButton = event.target.closest('[data-color-toggle]');
            if (!colorButton && colorPickerRef.current && !colorPickerRef.current.contains(event.target)) {
                setShowColorPicker(false);
            }

            // Check if clicking on the border picker button
            const borderButton = event.target.closest('[data-border-toggle]');
            if (!borderButton && borderPickerRef.current && !borderPickerRef.current.contains(event.target)) {
                setShowBorderPicker(false);
            }
        };

        if (showColorPicker || showBorderPicker) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showColorPicker, showBorderPicker]);

    const handleBorderSideToggle = (side) => {
        setBorderSides(prev => {
            const current = prev[side];
            let next = current === null ? false : current === false ? true : false;
            return { ...prev, [side]: next };
        });
    };

    const applyBorders = () => {
        const sidesToChange = {};
        Object.keys(borderSides).forEach(side => {
            if (borderSides[side] !== null) {
                sidesToChange[side] = borderSides[side];
            }
        });

        if (Object.keys(sidesToChange).length > 0) {
            onCommand('setBorders', {
                sides: sidesToChange,
                style: { width: borderWidth, style: borderStyle, color: borderColor }
            });
        }
    };

    // Apply borders when settings change
    useEffect(() => {
        if (showBorderPicker && state?.hasSelection) {
            applyBorders();
        }
    }, [borderSides, borderWidth, borderStyle, borderColor]);

    const applyColor = (type, color) => {
        onCommand('setColor', { type, color });
    };

    if (!state) return null;

    return (
        <div className="flex items-center gap-1">
            {/* Structure Section */}
            <div className="flex items-center gap-1 border-r pr-2">
                <button
                    onClick={() => onCommand('openImport')}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Import Table"
                >
                    <Import size={16} />
                </button>
                <button
                    onClick={() => onCommand('addRow', 'end')}
                    className="p-2 hover:bg-gray-200 rounded flex items-center gap-1"
                    title="Add Row"
                >
                    <Plus size={16} />
                    <span className="text-sm">Row</span>
                </button>
                <button
                    onClick={() => onCommand('removeRow')}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Remove Row"
                    disabled={!state.hasSelection}
                >
                    <Minus size={16} />
                </button>
                <button
                    onClick={() => onCommand('addColumn', 'end')}
                    className="p-2 hover:bg-gray-200 rounded flex items-center gap-1"
                    title="Add Column"
                >
                    <Plus size={16} />
                    <span className="text-sm">Col</span>
                </button>
                <button
                    onClick={() => onCommand('removeColumn')}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Remove Column"
                    disabled={!state.hasSelection}
                >
                    <Minus size={16} />
                </button>
            </div>

            {/* Cell Operations */}
            <div className="flex items-center gap-1 border-r pr-2">
                <button
                    onClick={() => onCommand('mergeCells')}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Merge Cells"
                    disabled={!state.canMerge}
                >
                    <Grid3X3 size={16} />
                </button>
                <button
                    onClick={() => onCommand('splitCell')}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Split Cell"
                    disabled={!state.canSplit}
                >
                    <Split size={16} />
                </button>
                <button
                    onClick={() => onCommand('growCell')}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Grow Cell (span +1)"
                    disabled={!state.canGrow}
                >
                    <ArrowRightFromLine size={16} />
                </button>
                <button
                    onClick={() => onCommand('shrinkCell')}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Shrink Cell (span -1)"
                    disabled={!state.canShrink}
                >
                    <ArrowLeftFromLine size={16} />
                </button>
            </div>

            {/* View Options */}
            <div className="flex items-center gap-1 border-r pr-2">
                <button
                    onClick={() => onCommand('toggleGrid')}
                    className={`p-2 hover:bg-gray-200 rounded ${state.showGrid ? 'bg-blue-100 text-blue-700' : ''}`}
                    title="Toggle Grid Lines (for visibility)"
                >
                    <Grid2X2 size={16} />
                </button>
            </div>

            {/* Text Formatting */}
            <div className="flex items-center gap-1 border-r pr-2">
                <button
                    onClick={() => onCommand('bold')}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Bold"
                >
                    <Bold size={16} />
                </button>
                <button
                    onClick={() => onCommand('italic')}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Italic"
                >
                    <Italic size={16} />
                </button>
            </div>

            {/* Horizontal Alignment */}
            <div className="flex items-center gap-1 border-r pr-2">
                <button
                    onClick={() => onCommand('alignLeft')}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Align Left"
                    disabled={!state.hasSelection}
                >
                    <AlignLeft size={16} />
                </button>
                <button
                    onClick={() => onCommand('alignCenter')}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Align Center"
                    disabled={!state.hasSelection}
                >
                    <AlignCenter size={16} />
                </button>
                <button
                    onClick={() => onCommand('alignRight')}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Align Right"
                    disabled={!state.hasSelection}
                >
                    <AlignRight size={16} />
                </button>
            </div>

            {/* Vertical Alignment */}
            <div className="flex items-center gap-1 border-r pr-2">
                <button
                    onClick={() => onCommand('alignTop')}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Align Top"
                    disabled={!state.hasSelection}
                >
                    <AlignVerticalJustifyStart size={16} />
                </button>
                <button
                    onClick={() => onCommand('alignMiddle')}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Align Middle"
                    disabled={!state.hasSelection}
                >
                    <AlignVerticalJustifyCenter size={16} />
                </button>
                <button
                    onClick={() => onCommand('alignBottom')}
                    className="p-2 hover:bg-gray-200 rounded"
                    title="Align Bottom"
                    disabled={!state.hasSelection}
                >
                    <AlignVerticalJustifyEnd size={16} />
                </button>
            </div>

            {/* Font Style */}
            <div className="flex items-center gap-1 border-r pr-2">
                <select
                    onChange={(e) => onCommand('fontStyle', e.target.value)}
                    className="p-2 border rounded text-sm"
                    value={state.fontStyle || 'normal'}
                    disabled={!state.hasSelection}
                >
                    <option value="normal">Normal Text</option>
                    <option value="quote">Quote</option>
                    <option value="caption">Caption</option>
                </select>
            </div>

            {/* Styling */}
            <div className="flex items-center gap-1 relative">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowBorderPicker(!showBorderPicker);
                        if (!showBorderPicker) setShowColorPicker(false);
                    }}
                    className={`p-2 hover:bg-gray-200 rounded ${showBorderPicker ? 'bg-blue-100 text-blue-700' : ''}`}
                    title="Borders"
                    disabled={!state.hasSelection}
                    data-border-toggle
                >
                    <Square size={16} />
                </button>

                {showBorderPicker && (
                    <div ref={borderPickerRef} className="absolute top-full left-0 mt-1 bg-white border border-gray-300 shadow-lg p-3 z-50 w-72">
                        <h4 className="font-medium mb-2">Border Configuration</h4>

                        {state.selectedCellsCount > 0 && (
                            <div className="mb-2 text-xs bg-gray-50 text-gray-600 px-2 py-1">
                                {state.selectedCellsCount} cell{state.selectedCellsCount !== 1 ? 's' : ''} selected
                            </div>
                        )}

                        <div className="mb-3">
                            <p className="text-sm text-gray-600 mb-1">Sides:</p>
                            <div className="grid grid-cols-2 gap-2">
                                {['top', 'bottom', 'left', 'right'].map(side => (
                                    <label
                                        key={side}
                                        className="flex items-center gap-2 cursor-pointer"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleBorderSideToggle(side);
                                        }}
                                    >
                                        <div className={`w-4 h-4 border-2 flex items-center justify-center ${borderSides[side] === null ? 'bg-gray-300 border-gray-400' :
                                            borderSides[side] ? 'bg-black border-black' :
                                                'bg-white border-gray-400'
                                            }`}>
                                            {borderSides[side] === true && (
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                        <span className="text-sm capitalize select-none">{side}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="mb-3">
                            <p className="text-sm text-gray-600 mb-1">Width:</p>
                            <select value={borderWidth} onChange={(e) => setBorderWidth(e.target.value)} className="w-full p-2 border text-sm">
                                <option value="1px">1px</option>
                                <option value="2px">2px</option>
                                <option value="3px">3px</option>
                            </select>
                        </div>

                        <div className="mb-3">
                            <p className="text-sm text-gray-600 mb-1">Style:</p>
                            <select value={borderStyle} onChange={(e) => setBorderStyle(e.target.value)} className="w-full p-2 border text-sm">
                                <option value="solid">Solid</option>
                                <option value="double">Double</option>
                            </select>
                        </div>

                        <div className="mb-3">
                            <p className="text-sm text-gray-600 mb-1">Color:</p>
                            <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="w-full h-10 border cursor-pointer" />
                        </div>
                    </div>
                )}

                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowColorPicker(!showColorPicker);
                            if (!showColorPicker) setShowBorderPicker(false);
                        }}
                        className={`p-2 hover:bg-gray-200 rounded ${showColorPicker ? 'bg-blue-100 text-blue-700' : ''}`}
                        title="Colors"
                        disabled={!state.hasSelection}
                        data-color-toggle
                    >
                        <Palette size={16} />
                    </button>

                    {showColorPicker && (
                        <div ref={colorPickerRef} className="absolute top-full left-0 mt-1 bg-white border border-gray-300 shadow-lg p-3 z-50 w-64">
                            <h4 className="font-medium mb-3 text-sm">Cell Colors</h4>

                            <div className="mb-3">
                                <label className="block text-xs text-gray-600 mb-1">Background</label>
                                <input
                                    type="color"
                                    value={backgroundColor}
                                    onChange={(e) => {
                                        setBackgroundColor(e.target.value);
                                        applyColor('background', e.target.value);
                                    }}
                                    className="w-full h-8 border cursor-pointer"
                                />
                            </div>

                            <div className="mb-3">
                                <label className="block text-xs text-gray-600 mb-1">Text</label>
                                <input
                                    type="color"
                                    value={textColor}
                                    onChange={(e) => {
                                        setTextColor(e.target.value);
                                        applyColor('text', e.target.value);
                                    }}
                                    className="w-full h-8 border cursor-pointer"
                                />
                            </div>

                            <div className="mb-3">
                                <label className="block text-xs text-gray-600 mb-1">Hover Background</label>
                                <input
                                    type="color"
                                    value={hoverBackgroundColor}
                                    onChange={(e) => {
                                        setHoverBackgroundColor(e.target.value);
                                        applyColor('hoverBackground', e.target.value);
                                    }}
                                    className="w-full h-8 border cursor-pointer"
                                />
                            </div>

                            <div className="mb-0">
                                <label className="block text-xs text-gray-600 mb-1">Hover Text</label>
                                <input
                                    type="color"
                                    value={hoverTextColor}
                                    onChange={(e) => {
                                        setHoverTextColor(e.target.value);
                                        applyColor('hoverText', e.target.value);
                                    }}
                                    className="w-full h-8 border cursor-pointer"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TableToolbarButtons;

