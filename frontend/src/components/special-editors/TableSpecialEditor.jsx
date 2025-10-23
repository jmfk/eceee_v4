/**
 * TableSpecialEditor - React wrapper for TableEditorCore
 * 
 * Provides toolbar UI and integrates the vanilla JS table editor with React.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
    Plus, Minus, Grid3X3, Split, Type, Image as ImageIcon, Palette,
    Square, AlignLeft, AlignCenter, AlignRight, Save, X, RotateCcw,
    ChevronDown
} from 'lucide-react'
import { TableEditorCore } from './TableEditorCore'
import MediaPicker from '../media/MediaPicker'
import '../../styles/table-editor.css'

const TableSpecialEditor = ({
    widgetData,
    isAnimating = false,
    isClosing = false,
    onConfigChange,
    namespace: providedNamespace = null
}) => {
    const editorRef = useRef(null)
    const containerRef = useRef(null)
    const coreRef = useRef(null)

    const [selectedCells, setSelectedCells] = useState([])
    const [showMediaPicker, setShowMediaPicker] = useState(false)
    const [showColorPicker, setShowColorPicker] = useState(null) // 'background', 'text', 'hoverBg', 'hoverText'
    const [showBorderPicker, setShowBorderPicker] = useState(false)
    const [currentColor, setCurrentColor] = useState('#000000')

    // Border configuration state
    const [borderSides, setBorderSides] = useState({
        top: false,
        bottom: false,
        left: false,
        right: false
    })
    const [borderStyle, setBorderStyle] = useState('plain')
    const [borderColor, setBorderColor] = useState('#d1d5db')

    const config = widgetData?.config || {}

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
    }, [])

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

        if (type === 'image') {
            setShowMediaPicker(true)
        } else {
            coreRef.current?.setCellType(selectedCells, type)
        }
    }

    const handleMediaSelect = (selectedMedia) => {
        if (selectedMedia.length === 0) return

        const media = selectedMedia[0]
        const imageData = {
            mediaId: media.id,
            url: media.file,
            alt: media.alt_text || media.title || ''
        }

        // Apply image to all selected cells
        selectedCells.forEach(cell => {
            coreRef.current?.setCellImage(cell, imageData)
        })

        setShowMediaPicker(false)
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

    const handleApplyBorders = () => {
        if (selectedCells.length === 0) {
            alert('Please select cells first')
            return
        }

        const sides = Object.keys(borderSides).filter(side => borderSides[side])
        if (sides.length === 0) {
            alert('Please select at least one border side')
            return
        }

        const borderStyleConfig = {
            style: borderStyle,
            color: borderColor
        }

        coreRef.current?.setBorders(selectedCells, sides, borderStyleConfig)
        setShowBorderPicker(false)
    }

    const handleSetColor = (colorType) => {
        if (selectedCells.length === 0) {
            alert('Please select cells first')
            return
        }

        coreRef.current?.setColors(selectedCells, colorType, currentColor)
        setShowColorPicker(null)
    }

    /**
     * Dimension operations
     */
    const handleSetColumnWidth = () => {
        if (selectedCells.length === 0) {
            alert('Please select a cell in the column')
            return
        }

        const colIndex = parseInt(selectedCells[0].dataset.cellIndex)
        const width = prompt('Enter column width (e.g., auto, 200px, 30%):', 'auto')

        if (width !== null) {
            coreRef.current?.setColumnWidth(colIndex, width)
        }
    }

    const handleSetRowHeight = () => {
        if (selectedCells.length === 0) {
            alert('Please select a cell in the row')
            return
        }

        const rowIndex = parseInt(selectedCells[0].dataset.rowIndex)
        const height = prompt('Enter row height (e.g., auto, 50px, 3rem):', 'auto')

        if (height !== null) {
            coreRef.current?.setRowHeight(rowIndex, height)
        }
    }

    return (
        <div className="table-special-editor h-full flex flex-col bg-white">
            {/* Toolbar */}
            <div className="border-b bg-gray-50 px-4 py-3">
                <div className="flex flex-wrap gap-2">
                    {/* Structure Section */}
                    <div className="flex items-center gap-1 border-r pr-2">
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
                        <button
                            onClick={() => handleSetCellType('image')}
                            className="p-2 hover:bg-gray-200 rounded"
                            title="Image Cell"
                            disabled={selectedCells.length === 0}
                        >
                            <ImageIcon size={16} />
                        </button>
                    </div>

                    {/* Formatting */}
                    <div className="flex items-center gap-1 border-r pr-2">
                        <button
                            onClick={() => handleApplyFormatting('bold')}
                            className="p-2 hover:bg-gray-200 rounded font-bold text-sm"
                            title="Bold"
                        >
                            B
                        </button>
                        <button
                            onClick={() => handleApplyFormatting('italic')}
                            className="p-2 hover:bg-gray-200 rounded italic text-sm"
                            title="Italic"
                        >
                            I
                        </button>
                        <button
                            onClick={handleInsertLink}
                            className="p-2 hover:bg-gray-200 rounded text-sm"
                            title="Insert Link"
                        >
                            Link
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
                            onClick={() => setShowBorderPicker(!showBorderPicker)}
                            className="p-2 hover:bg-gray-200 rounded"
                            title="Borders"
                            disabled={selectedCells.length === 0}
                        >
                            <Square size={16} />
                        </button>

                        {showBorderPicker && (
                            <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg p-4 z-10 w-64">
                                <h4 className="font-medium mb-2">Border Configuration</h4>

                                {/* Border side selector */}
                                <div className="mb-3">
                                    <p className="text-sm text-gray-600 mb-1">Sides:</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['top', 'bottom', 'left', 'right'].map(side => (
                                            <label key={side} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={borderSides[side]}
                                                    onChange={(e) => setBorderSides({
                                                        ...borderSides,
                                                        [side]: e.target.checked
                                                    })}
                                                />
                                                <span className="text-sm capitalize">{side}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Border style */}
                                <div className="mb-3">
                                    <p className="text-sm text-gray-600 mb-1">Style:</p>
                                    <select
                                        value={borderStyle}
                                        onChange={(e) => setBorderStyle(e.target.value)}
                                        className="w-full p-2 border rounded"
                                    >
                                        <option value="plain">Plain (1px)</option>
                                        <option value="thick">Thick (3px)</option>
                                        <option value="double">Double</option>
                                    </select>
                                </div>

                                {/* Border color */}
                                <div className="mb-3">
                                    <p className="text-sm text-gray-600 mb-1">Color:</p>
                                    <input
                                        type="color"
                                        value={borderColor}
                                        onChange={(e) => setBorderColor(e.target.value)}
                                        className="w-full h-10 border rounded"
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={handleApplyBorders}
                                        className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
                                    >
                                        Apply
                                    </button>
                                    <button
                                        onClick={() => setShowBorderPicker(false)}
                                        className="px-3 py-2 border rounded hover:bg-gray-100"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Color pickers */}
                        <div className="relative">
                            <button
                                onClick={() => setShowColorPicker(showColorPicker ? null : 'menu')}
                                className="p-2 hover:bg-gray-200 rounded"
                                title="Colors"
                                disabled={selectedCells.length === 0}
                            >
                                <Palette size={16} />
                            </button>

                            {showColorPicker === 'menu' && (
                                <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg p-2 z-10">
                                    <button
                                        onClick={() => setShowColorPicker('background')}
                                        className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm"
                                    >
                                        Background Color
                                    </button>
                                    <button
                                        onClick={() => setShowColorPicker('text')}
                                        className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm"
                                    >
                                        Text Color
                                    </button>
                                    <button
                                        onClick={() => setShowColorPicker('hoverBackground')}
                                        className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm"
                                    >
                                        Hover Background
                                    </button>
                                    <button
                                        onClick={() => setShowColorPicker('hoverText')}
                                        className="block w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm"
                                    >
                                        Hover Text
                                    </button>
                                </div>
                            )}

                            {showColorPicker && showColorPicker !== 'menu' && (
                                <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg p-4 z-10 w-64">
                                    <h4 className="font-medium mb-2 capitalize">
                                        {showColorPicker.replace(/([A-Z])/g, ' $1')} Color
                                    </h4>
                                    <input
                                        type="color"
                                        value={currentColor}
                                        onChange={(e) => setCurrentColor(e.target.value)}
                                        className="w-full h-10 border rounded mb-3"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleSetColor(showColorPicker)}
                                            className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
                                        >
                                            Apply
                                        </button>
                                        <button
                                            onClick={() => setShowColorPicker(null)}
                                            className="px-3 py-2 border rounded hover:bg-gray-100"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Dimensions */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleSetColumnWidth}
                            className="p-2 hover:bg-gray-200 rounded text-xs"
                            title="Column Width"
                            disabled={selectedCells.length === 0}
                        >
                            Col Width
                        </button>
                        <button
                            onClick={handleSetRowHeight}
                            className="p-2 hover:bg-gray-200 rounded text-xs"
                            title="Row Height"
                            disabled={selectedCells.length === 0}
                        >
                            Row Height
                        </button>
                    </div>
                </div>

                {/* Selection info */}
                {selectedCells.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                        {selectedCells.length} cell{selectedCells.length !== 1 ? 's' : ''} selected
                    </div>
                )}
            </div>

            {/* Table Editor Container */}
            <div
                ref={containerRef}
                className="flex-1 overflow-auto p-4"
            />

            {/* Media Picker Modal */}
            {showMediaPicker && (
                <MediaPicker
                    isOpen={showMediaPicker}
                    onClose={() => setShowMediaPicker(false)}
                    onSelect={handleMediaSelect}
                    namespace={providedNamespace}
                    multiple={false}
                    mediaTypes={['image']}
                />
            )}
        </div>
    )
}

export default TableSpecialEditor

