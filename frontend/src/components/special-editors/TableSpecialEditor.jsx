/**
 * TableSpecialEditor - React wrapper for TableEditorCore
 * 
 * Provides toolbar UI and integrates the vanilla JS table editor with React.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
    Plus, Minus, Grid3X3, Split, Type, Palette, Square, Import,
    Bold, Italic, AlignLeft, AlignCenter, AlignRight,
    AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd
} from 'lucide-react'
import { TableEditorCore } from './TableEditorCore'
import TableImportModal from './TableImportModal'
import '../../styles/table-editor.css'

const TableSpecialEditor = ({
    widgetData,
    isAnimating = false,
    isClosing = false,
    onConfigChange
}) => {
    const containerRef = useRef(null)
    const coreRef = useRef(null)
    const borderPickerRef = useRef(null)
    const colorPickerRef = useRef(null)
    const toolbarRef = useRef(null)

    const [selectedCells, setSelectedCells] = useState([])
    const [showColorPicker, setShowColorPicker] = useState(false)
    const [showBorderPicker, setShowBorderPicker] = useState(false)
    const [showImportModal, setShowImportModal] = useState(false)

    // Color state for each type
    const [backgroundColor, setBackgroundColor] = useState('#ffffff')
    const [textColor, setTextColor] = useState('#000000')
    const [hoverBackgroundColor, setHoverBackgroundColor] = useState('#f3f4f6')
    const [hoverTextColor, setHoverTextColor] = useState('#000000')

    // Border configuration state
    // States: null (mixed/grey), false (no border), true (has border)
    const [borderSides, setBorderSides] = useState({
        top: null,
        bottom: null,
        left: null,
        right: null
    })
    const [borderWidth, setBorderWidth] = useState('1px')
    const [borderStyle, setBorderStyle] = useState('solid')
    const [borderColor, setBorderColor] = useState('#000000')

    const config = widgetData?.config || {}

    /**
     * Close pickers when clicking on toolbar but outside the pickers
     */
    useEffect(() => {
        const handleClickOnToolbar = (event) => {
            // Only close if clicking within the toolbar area
            if (!toolbarRef.current || !toolbarRef.current.contains(event.target)) {
                return
            }

            // Close border picker if clicking outside of it (but on toolbar)
            if (borderPickerRef.current && !borderPickerRef.current.contains(event.target)) {
                setShowBorderPicker(false)
            }

            // Close color picker if clicking outside of it (but on toolbar)
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target)) {
                setShowColorPicker(false)
            }
        }

        document.addEventListener('mousedown', handleClickOnToolbar)
        return () => {
            document.removeEventListener('mousedown', handleClickOnToolbar)
        }
    }, [])

    /**
     * Initialize table editor
     */
    useEffect(() => {
        if (!containerRef.current) return

        const core = new TableEditorCore(config, {
            onChange: (newData) => {
                if (onConfigChange) {
                    onConfigChange(newData)
                }
            },
            onSelectionChange: (cells) => {
                setSelectedCells(cells)
            }
        })

        core.render(containerRef.current)
        coreRef.current = core

        return () => {
            if (coreRef.current) {
                coreRef.current.destroy()
            }
        }
    }, [config, onConfigChange])

    /**
     * Update editor when config changes externally
     */
    useEffect(() => {
        if (coreRef.current && config) {
            coreRef.current.updateTable(config)
        }
    }, [config])

    /**
     * Structure operations
     */
    const handleAddRow = (position) => {
        coreRef.current?.addRow(position)
    }

    const handleRemoveRow = () => {
        if (selectedCells.length === 0) {
            alert('Please select a cell in the row you want to remove')
            return
        }
        const rowIndex = parseInt(selectedCells[0].dataset.rowIndex)
        coreRef.current?.removeRow(rowIndex)
    }

    const handleAddColumn = (position) => {
        coreRef.current?.addColumn(position)
    }

    const handleRemoveColumn = () => {
        if (selectedCells.length === 0) {
            alert('Please select a cell in the column you want to remove')
            return
        }
        const colIndex = parseInt(selectedCells[0].dataset.cellIndex)
        coreRef.current?.removeColumn(colIndex)
    }

    /**
     * Cell operations
     */
    const handleMergeCells = () => {
        coreRef.current?.mergeCells()
    }

    const handleSplitCell = () => {
        if (selectedCells.length !== 1) {
            alert('Please select exactly one cell to split')
            return
        }
        coreRef.current?.splitCell(selectedCells[0])
    }

    /**
     * Content type operations
     */
    const handleSetCellType = (type) => {
        if (selectedCells.length === 0) {
            alert('Please select cells first')
            return
        }

        coreRef.current?.setCellType(selectedCells, type)
    }

    /**
     * Formatting operations
     */
    const handleApplyFormatting = (type) => {
        coreRef.current?.applyFormatting(type)
    }

    const handleInsertLink = () => {
        const url = prompt('Enter URL:')
        if (url) {
            coreRef.current?.insertLink(url)
        }
    }

    /**
     * Styling operations
     */
    const handleApplyFontStyle = (fontStyle) => {
        if (selectedCells.length === 0) {
            alert('Please select cells first')
            return
        }
        coreRef.current?.applyFontStyle(selectedCells, fontStyle)
    }

    const handleBold = () => {
        if (selectedCells.length === 0) {
            return
        }
        coreRef.current?.applyCellBold(selectedCells)
    }

    const handleItalic = () => {
        if (selectedCells.length === 0) {
            return
        }
        coreRef.current?.applyCellItalic(selectedCells)
    }

    const handleSetAlignment = (alignment) => {
        if (selectedCells.length === 0) {
            return
        }
        coreRef.current?.setAlignment(selectedCells, alignment)
    }

    const handleSetVerticalAlignment = (alignment) => {
        if (selectedCells.length === 0) {
            return
        }
        coreRef.current?.setVerticalAlignment(selectedCells, alignment)
    }


    /**
     * Apply borders immediately when any border setting changes
     */
    const applyBordersImmediately = useCallback(() => {
        if (selectedCells.length === 0) {
            return
        }

        // Get sides that should be changed (not null/mixed)
        const sidesToChange = {}
        Object.keys(borderSides).forEach(side => {
            if (borderSides[side] !== null) {
                sidesToChange[side] = borderSides[side]
            }
        })

        if (Object.keys(sidesToChange).length === 0) {
            return
        }

        const borderStyleConfig = {
            width: borderWidth,
            style: borderStyle,
            color: borderColor
        }

        coreRef.current?.setBorders(selectedCells, sidesToChange, borderStyleConfig)
    }, [selectedCells, borderSides, borderWidth, borderStyle, borderColor])

    /**
     * Track if we should apply borders automatically
     * This prevents the infinite loop when reading border state from cells
     */
    const isReadingBorderState = useRef(false)

    /**
     * Apply borders when settings change (but NOT when cells change)
     */
    useEffect(() => {
        // Don't apply when cells change - that should only READ the state
        // Only apply when border settings themselves change
        if (selectedCells.length > 0 && showBorderPicker && !isReadingBorderState.current) {
            applyBordersImmediately()
        }
    }, [borderSides, borderWidth, borderStyle, borderColor, applyBordersImmediately, showBorderPicker])
    // Note: selectedCells.length is NOT in dependencies - we don't want to apply when selection changes!

    /**
     * Get opposite side (mirrors the one in TableEditorCore)
     */
    const getOppositeSide = (side) => {
        const opposites = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }
        return opposites[side]
    }

    /**
     * Handle tri-state border checkbox click
     */
    const handleBorderSideToggle = (side) => {
        setBorderSides(prev => {
            const current = prev[side]
            // Cycle: null -> false -> true -> false -> ...
            let next
            if (current === null) {
                next = false // First click on mixed: set to no border
            } else if (current === false) {
                next = true // Second click: set to has border
            } else {
                next = false // Third click: back to no border
            }
            return { ...prev, [side]: next }
        })
    }

    /**
     * Update border picker state based on selected cells
     * Now considers both the cell's own borders AND adjacent cells' opposite borders
     */
    const updateBorderStateFromSelection = useCallback(() => {
        // Set flag to prevent automatic border application while reading
        isReadingBorderState.current = true

        if (!coreRef.current || selectedCells.length === 0) {
            // No cells selected - reset to mixed
            setBorderSides({ top: null, bottom: null, left: null, right: null })
            isReadingBorderState.current = false
            return
        }

        // Analyze selected cells to determine border states
        const sides = ['top', 'bottom', 'left', 'right']
        const newBorderSides = {}
        let firstBorder = null

        sides.forEach(side => {
            let hasCount = 0
            let noCount = 0

            selectedCells.forEach(cell => {
                const rowIndex = parseInt(cell.dataset.rowIndex)
                const cellIndex = parseInt(cell.dataset.cellIndex)

                let cellData
                try {
                    cellData = coreRef.current.data.rows[rowIndex].cells[cellIndex]
                } catch (error) {
                    return
                }

                // Check current cell's border on this side
                const hasBorderOnCell = cellData.borders?.[side]

                // Check adjacent cell's opposite border (borders between cells!)
                let adjacentCells = []
                let oppositeSide = getOppositeSide(side)

                try {
                    if (coreRef.current && typeof coreRef.current.findAdjacentCells === 'function') {
                        adjacentCells = coreRef.current.findAdjacentCells(rowIndex, cellIndex, side)
                    }
                } catch (error) {
                    // Error finding adjacent cells
                }

                const adjacentBorders = adjacentCells.map(({ rowIndex: r, cellIndex: c }) => {
                    const border = coreRef.current.data.rows[r].cells[c].borders?.[oppositeSide]
                    return border
                }).filter(b => b) // Remove nulls

                // Border exists if EITHER the cell has it OR an adjacent cell has the opposite
                const borderExists = hasBorderOnCell || adjacentBorders.length > 0

                if (borderExists) {
                    hasCount++
                    // Use the border config from current cell, or first adjacent if current is null
                    if (!firstBorder) {
                        firstBorder = hasBorderOnCell || adjacentBorders[0]
                    }
                } else {
                    noCount++
                }
            })

            // Determine state for this side
            if (hasCount === selectedCells.length) {
                newBorderSides[side] = true // All have border
            } else if (noCount === selectedCells.length) {
                newBorderSides[side] = false // None have border
            } else {
                newBorderSides[side] = null // Mixed state
            }
        })

        // Batch all state updates together
        setBorderSides(newBorderSides)

        // Update border width, style, and color from first found border
        if (firstBorder) {
            if (firstBorder.width) setBorderWidth(firstBorder.width)
            if (firstBorder.style) setBorderStyle(firstBorder.style)
            if (firstBorder.color) setBorderColor(firstBorder.color)
        }

        // Clear flag after React has definitely processed all state updates
        // Use a longer timeout to ensure all effects have run
        setTimeout(() => {
            isReadingBorderState.current = false
        }, 50) // Small delay to ensure React batching is complete
    }, [selectedCells])

    /**
     * Update border state when selection changes or border picker opens
     */
    useEffect(() => {
        if (showBorderPicker) {
            updateBorderStateFromSelection()
        }
    }, [showBorderPicker, selectedCells, updateBorderStateFromSelection])

    /**
     * Apply color immediately when changed
     */
    const applyColor = useCallback((colorType, color) => {
        if (selectedCells.length === 0) return
        coreRef.current?.setColors(selectedCells, colorType, color)
    }, [selectedCells])

    const handleBackgroundColorChange = (color) => {
        setBackgroundColor(color)
        applyColor('background', color)
    }

    const handleTextColorChange = (color) => {
        setTextColor(color)
        applyColor('text', color)
    }

    const handleHoverBackgroundColorChange = (color) => {
        setHoverBackgroundColor(color)
        applyColor('hoverBackground', color)
    }

    const handleHoverTextColorChange = (color) => {
        setHoverTextColor(color)
        applyColor('hoverText', color)
    }

    /**
     * Handle table import
     */
    const handleImportTable = (tableData) => {
        if (onConfigChange && tableData) {
            onConfigChange(tableData)

            // Force immediate reload of the table editor
            if (coreRef.current) {
                coreRef.current.updateTable(tableData)
            }
        }
    }

    return (
        <div className="table-special-editor h-full flex flex-col bg-white min-w-0">
            {/* Toolbar */}
            <div ref={toolbarRef} className="border-b bg-gray-50 px-4 py-3 overflow-x-auto">
                <div className="flex flex-wrap gap-2">
                    {/* Structure Section */}
                    <div className="flex items-center gap-1 border-r pr-2">
                        <button
                            onClick={() => setShowImportModal(true)}
                            className="p-2 hover:bg-gray-200 rounded"
                            title="Import Table"
                        >
                            <Import size={16} />
                        </button>
                        <button
                            onClick={() => handleAddRow('end')}
                            className="p-2 hover:bg-gray-200 rounded flex items-center gap-1"
                            title="Add Row"
                        >
                            <Plus size={16} />
                            <span className="text-sm">Row</span>
                        </button>
                        <button
                            onClick={handleRemoveRow}
                            className="p-2 hover:bg-gray-200 rounded"
                            title="Remove Row"
                        >
                            <Minus size={16} />
                        </button>
                        <button
                            onClick={() => handleAddColumn('end')}
                            className="p-2 hover:bg-gray-200 rounded flex items-center gap-1"
                            title="Add Column"
                        >
                            <Plus size={16} />
                            <span className="text-sm">Col</span>
                        </button>
                        <button
                            onClick={handleRemoveColumn}
                            className="p-2 hover:bg-gray-200 rounded"
                            title="Remove Column"
                        >
                            <Minus size={16} />
                        </button>
                    </div>

                    {/* Cell Operations */}
                    <div className="flex items-center gap-1 border-r pr-2">
                        <button
                            onClick={handleMergeCells}
                            className="p-2 hover:bg-gray-200 rounded"
                            title="Merge Cells"
                            disabled={selectedCells.length <= 1}
                        >
                            <Grid3X3 size={16} />
                        </button>
                        <button
                            onClick={handleSplitCell}
                            className="p-2 hover:bg-gray-200 rounded"
                            title="Split Cell"
                            disabled={selectedCells.length !== 1}
                        >
                            <Split size={16} />
                        </button>
                    </div>

                    {/* Content Type */}
                    <div className="flex items-center gap-1 border-r pr-2">
                        <button
                            onClick={() => handleSetCellType('text')}
                            className="p-2 hover:bg-gray-200 rounded"
                            title="Text Cell"
                            disabled={selectedCells.length === 0}
                        >
                            <Type size={16} />
                        </button>
                    </div>

                    {/* Text Formatting */}
                    <div className="flex items-center gap-1 border-r pr-2">
                        <button
                            onClick={handleBold}
                            className="p-2 hover:bg-gray-200 rounded"
                            title="Bold (applies to entire cell)"
                            disabled={selectedCells.length === 0}
                        >
                            <Bold size={16} />
                        </button>
                        <button
                            onClick={handleItalic}
                            className="p-2 hover:bg-gray-200 rounded"
                            title="Italic (applies to entire cell)"
                            disabled={selectedCells.length === 0}
                        >
                            <Italic size={16} />
                        </button>
                    </div>

                    {/* Horizontal Alignment */}
                    <div className="flex items-center gap-1 border-r pr-2">
                        <button
                            onClick={() => handleSetAlignment('left')}
                            className="p-2 hover:bg-gray-200 rounded"
                            title="Align Left"
                            disabled={selectedCells.length === 0}
                        >
                            <AlignLeft size={16} />
                        </button>
                        <button
                            onClick={() => handleSetAlignment('center')}
                            className="p-2 hover:bg-gray-200 rounded"
                            title="Align Center"
                            disabled={selectedCells.length === 0}
                        >
                            <AlignCenter size={16} />
                        </button>
                        <button
                            onClick={() => handleSetAlignment('right')}
                            className="p-2 hover:bg-gray-200 rounded"
                            title="Align Right"
                            disabled={selectedCells.length === 0}
                        >
                            <AlignRight size={16} />
                        </button>
                    </div>

                    {/* Vertical Alignment */}
                    <div className="flex items-center gap-1 border-r pr-2">
                        <button
                            onClick={() => handleSetVerticalAlignment('top')}
                            className="p-2 hover:bg-gray-200 rounded"
                            title="Align Top"
                            disabled={selectedCells.length === 0}
                        >
                            <AlignVerticalJustifyStart size={16} />
                        </button>
                        <button
                            onClick={() => handleSetVerticalAlignment('middle')}
                            className="p-2 hover:bg-gray-200 rounded"
                            title="Align Middle"
                            disabled={selectedCells.length === 0}
                        >
                            <AlignVerticalJustifyCenter size={16} />
                        </button>
                        <button
                            onClick={() => handleSetVerticalAlignment('bottom')}
                            className="p-2 hover:bg-gray-200 rounded"
                            title="Align Bottom"
                            disabled={selectedCells.length === 0}
                        >
                            <AlignVerticalJustifyEnd size={16} />
                        </button>
                    </div>

                    {/* Font Style */}
                    <div className="flex items-center gap-1 border-r pr-2">
                        <select
                            onChange={(e) => handleApplyFontStyle(e.target.value)}
                            className="p-2 border rounded text-sm"
                            defaultValue=""
                            disabled={selectedCells.length === 0}
                        >
                            <option value="" disabled>Font Style</option>
                            <option value="normal">Normal Text</option>
                            <option value="quote">Quote</option>
                            <option value="caption">Caption</option>
                        </select>
                    </div>

                    {/* Styling */}
                    <div className="flex items-center gap-1 border-r pr-2 relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setShowBorderPicker(!showBorderPicker)
                                if (!showBorderPicker) setShowColorPicker(false)
                            }}
                            className="p-2 hover:bg-gray-200 rounded"
                            title="Borders"
                            disabled={selectedCells.length === 0}
                        >
                            <Square size={16} />
                        </button>

                        {showBorderPicker && (
                            <div ref={borderPickerRef} className="absolute top-full left-0 mt-1 bg-white border border-gray-300 shadow-lg p-3 z-10 w-72">
                                <div className="font-medium mb-2" role="heading" aria-level="4">Border Configuration</div>

                                {/* Selection info */}
                                {selectedCells.length > 0 && (
                                    <div className="mb-2 text-xs bg-gray-50 text-gray-600 px-2 py-1">
                                        {selectedCells.length} cell{selectedCells.length !== 1 ? 's' : ''} selected
                                    </div>
                                )}

                                {/* Border side selector with tri-state checkboxes */}
                                <div className="mb-3">
                                    <div className="text-sm text-gray-600 mb-1">
                                        Sides:
                                        <span className="text-xs ml-2">(Grey=Mixed, Empty=Remove, Filled=Add)</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['top', 'bottom', 'left', 'right'].map(side => (
                                            <label
                                                key={side}
                                                className="flex items-center gap-2 cursor-pointer"
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    handleBorderSideToggle(side)
                                                }}
                                            >
                                                <div className={`
                                                    w-4 h-4 border-2 flex items-center justify-center
                                                    ${borderSides[side] === null ? 'bg-gray-300 border-gray-400' :
                                                        borderSides[side] ? 'bg-black border-black' :
                                                            'bg-white border-gray-400'}
                                                `}>
                                                    {borderSides[side] === true && (
                                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                    {borderSides[side] === null && (
                                                        <div className="w-2 h-0.5 bg-gray-600"></div>
                                                    )}
                                                </div>
                                                <span className="text-sm capitalize select-none">{side}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Border width */}
                                <div className="mb-3">
                                    <div className="text-sm text-gray-600 mb-1">Width:</div>
                                    <select
                                        value={borderWidth}
                                        onChange={(e) => setBorderWidth(e.target.value)}
                                        className="w-full p-2 border text-sm"
                                    >
                                        <option value="1px">1px</option>
                                        <option value="2px">2px</option>
                                        <option value="3px">3px</option>
                                    </select>
                                </div>

                                {/* Border style */}
                                <div className="mb-3">
                                    <div className="text-sm text-gray-600 mb-1">Style:</div>
                                    <select
                                        value={borderStyle}
                                        onChange={(e) => setBorderStyle(e.target.value)}
                                        className="w-full p-2 border text-sm"
                                    >
                                        <option value="solid">Solid</option>
                                        <option value="double">Double</option>
                                    </select>
                                </div>

                                {/* Border color */}
                                <div className="mb-3">
                                    <div className="text-sm text-gray-600 mb-1">Color:</div>
                                    <input
                                        type="color"
                                        value={borderColor}
                                        onChange={(e) => setBorderColor(e.target.value)}
                                        className="w-full h-10 border cursor-pointer"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Color pickers */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setShowColorPicker(!showColorPicker)
                                    if (!showColorPicker) setShowBorderPicker(false)
                                }}
                                className="p-2 hover:bg-gray-200 rounded"
                                title="Colors"
                                disabled={selectedCells.length === 0}
                            >
                                <Palette size={16} />
                            </button>

                            {showColorPicker && (
                                <div ref={colorPickerRef} className="absolute top-full left-0 mt-1 bg-white border border-gray-300 shadow-lg p-3 z-10 w-64">
                                    <div className="font-medium mb-3 text-sm" role="heading" aria-level="4">Cell Colors</div>

                                    {/* Background Color */}
                                    <div className="mb-3">
                                        <label className="block text-xs text-gray-600 mb-1">Background</label>
                                        <input
                                            type="color"
                                            value={backgroundColor}
                                            onChange={(e) => handleBackgroundColorChange(e.target.value)}
                                            className="w-full h-8 border cursor-pointer"
                                        />
                                    </div>

                                    {/* Text Color */}
                                    <div className="mb-3">
                                        <label className="block text-xs text-gray-600 mb-1">Text</label>
                                        <input
                                            type="color"
                                            value={textColor}
                                            onChange={(e) => handleTextColorChange(e.target.value)}
                                            className="w-full h-8 border cursor-pointer"
                                        />
                                    </div>

                                    {/* Hover Background Color */}
                                    <div className="mb-3">
                                        <label className="block text-xs text-gray-600 mb-1">Hover Background</label>
                                        <input
                                            type="color"
                                            value={hoverBackgroundColor}
                                            onChange={(e) => handleHoverBackgroundColorChange(e.target.value)}
                                            className="w-full h-8 border cursor-pointer"
                                        />
                                    </div>

                                    {/* Hover Text Color */}
                                    <div className="mb-0">
                                        <label className="block text-xs text-gray-600 mb-1">Hover Text</label>
                                        <input
                                            type="color"
                                            value={hoverTextColor}
                                            onChange={(e) => handleHoverTextColorChange(e.target.value)}
                                            className="w-full h-8 border cursor-pointer"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Editor Container */}
            <div
                ref={containerRef}
                className="flex-1 overflow-auto p-4"
            />

            {/* Import Modal */}
            <TableImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onImport={handleImportTable}
                existingData={config}
            />
        </div>
    )
}

export default TableSpecialEditor

