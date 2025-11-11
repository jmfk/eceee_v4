/**
 * TableImportModal - Modal for importing table data from various sources
 * 
 * Supports:
 * - Paste from clipboard (auto-detect HTML or TSV)
 * - Upload CSV/Excel files
 * - Paste HTML table code
 */

import React, { useState, useRef } from 'react'
import { X, Upload, ClipboardPaste, Code, AlertCircle, CheckCircle, Trash2 } from 'lucide-react'
import { parseAuto, parseHTMLTable, detectPasteFormat } from '@/utils/tableImport'
import { importTableFromFile } from '@/api/fileManager'

const TableImportModal = ({ isOpen, onClose, onImport, existingData }) => {
    const [activeTab, setActiveTab] = useState('paste')
    const [pasteContent, setPasteContent] = useState('')
    const [selectedFile, setSelectedFile] = useState(null)
    const [preview, setPreview] = useState(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)
    const [detectedFormat, setDetectedFormat] = useState(null)
    const [showCodeView, setShowCodeView] = useState(false)
    const [showMergeDialog, setShowMergeDialog] = useState(false)
    const fileInputRef = useRef(null)
    const contentEditableRef = useRef(null)

    if (!isOpen) return null

    // Reset state when modal opens
    const handleReset = () => {
        setPasteContent('')
        setSelectedFile(null)
        setPreview(null)
        setError(null)
        setDetectedFormat(null)
        setLoading(false)
        setShowCodeView(false)
        if (contentEditableRef.current) {
            contentEditableRef.current.innerHTML = ''
        }
    }

    // Handle contenteditable paste event
    const handleContentEditablePaste = (e) => {
        e.preventDefault()
        setError(null)

        // Try to get HTML from clipboard first
        const htmlData = e.clipboardData.getData('text/html')
        const textData = e.clipboardData.getData('text/plain')

        let content = htmlData || textData

        if (content.trim()) {
            const format = detectPasteFormat(content)
            setDetectedFormat(format)

            try {
                const parsed = parseAuto(content)
                setPreview(parsed)
                setPasteContent(content)

                // Insert the pasted content into contenteditable so user can see it
                if (contentEditableRef.current) {
                    // For HTML, show the table; for other formats, show as text
                    if (format === 'html' && htmlData) {
                        contentEditableRef.current.innerHTML = htmlData
                    } else {
                        contentEditableRef.current.textContent = textData
                    }
                }
            } catch (err) {
                setError(err.message)
                setPreview(null)

                // Still show the pasted content even if parsing failed
                if (contentEditableRef.current) {
                    contentEditableRef.current.textContent = content
                }
            }
        } else {
            setDetectedFormat(null)
            setPreview(null)
        }
    }

    // Handle contenteditable keyboard input - switch to code view when typing
    const handleContentEditableKeyDown = (e) => {
        // Ignore modifier keys and shortcuts
        if (e.ctrlKey || e.metaKey || e.altKey) {
            return
        }

        // Ignore navigation keys
        const navigationKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Tab', 'Escape', 'Shift']
        if (navigationKeys.includes(e.key)) {
            return
        }

        // If user is typing text or pressing Enter, switch to code view
        if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault()

            // Get current content from contenteditable
            let currentContent = contentEditableRef.current?.innerHTML || ''

            // Convert to plain text for textarea
            const tempDiv = document.createElement('div')
            tempDiv.innerHTML = currentContent
            let textContent = tempDiv.textContent || ''

            // Handle the keystroke
            if (e.key === 'Enter') {
                textContent += '\n'
            } else if (e.key === 'Backspace') {
                textContent = textContent.slice(0, -1)
            } else if (e.key === 'Delete') {
                // For delete, don't modify (cursor position matters)
            } else if (e.key.length === 1) {
                textContent += e.key
            }

            // Update state with the new content and parse it
            setPasteContent(textContent)

            // Parse and update preview
            if (textContent.trim()) {
                const format = detectPasteFormat(textContent)
                setDetectedFormat(format)

                try {
                    const parsed = parseAuto(textContent)
                    setPreview(parsed)
                    setError(null)
                } catch (err) {
                    setError(err.message)
                    setPreview(null)
                }
            } else {
                setDetectedFormat(null)
                setPreview(null)
            }

            // Switch to code view
            setShowCodeView(true)

            // Focus textarea and position cursor at end
            requestAnimationFrame(() => {
                const textarea = document.querySelector('textarea[placeholder*="table"]')
                if (textarea) {
                    textarea.focus()
                    textarea.selectionStart = textContent.length
                    textarea.selectionEnd = textContent.length
                }
            })
        }
    }

    // Handle contenteditable input changes (for paste events)
    const handleContentEditableInput = (e) => {
        const content = e.target.innerHTML
        setPasteContent(content)

        if (!content.trim() || content === '<br>') {
            setDetectedFormat(null)
            setPreview(null)
            setError(null)
        } else {
            // Re-parse when content changes
            const format = detectPasteFormat(content)
            setDetectedFormat(format)

            try {
                const parsed = parseAuto(content)
                setPreview(parsed)
                setError(null)
            } catch (err) {
                setError(err.message)
                setPreview(null)
            }
        }
    }

    // Handle code textarea change
    const handleCodeChange = (e) => {
        const content = e.target.value
        setPasteContent(content)
        setError(null)

        if (content.trim()) {
            const format = detectPasteFormat(content)
            setDetectedFormat(format)

            try {
                const parsed = parseAuto(content)
                setPreview(parsed)
            } catch (err) {
                setError(err.message)
                setPreview(null)
            }
        } else {
            setDetectedFormat(null)
            setPreview(null)
        }
    }

    // Toggle between contenteditable and code view
    const handleToggleView = () => {
        setError(null)

        // Sync content between views
        if (!showCodeView && contentEditableRef.current) {
            // Switching to code view - get HTML from contenteditable
            const content = contentEditableRef.current.innerHTML
            setPasteContent(content)

            // Re-parse to update preview
            if (content.trim() && content !== '<br>') {
                const format = detectPasteFormat(content)
                setDetectedFormat(format)

                try {
                    const parsed = parseAuto(content)
                    setPreview(parsed)
                } catch (err) {
                    setError(err.message)
                    setPreview(null)
                }
            }
        } else if (showCodeView && contentEditableRef.current) {
            // Switching to visual view - set contenteditable HTML
            contentEditableRef.current.innerHTML = pasteContent

            // Re-parse to update preview
            if (pasteContent.trim()) {
                const format = detectPasteFormat(pasteContent)
                setDetectedFormat(format)

                try {
                    const parsed = parseAuto(pasteContent)
                    setPreview(parsed)
                } catch (err) {
                    setError(err.message)
                    setPreview(null)
                }
            }
        }
        setShowCodeView(!showCodeView)
    }

    // Clear paste content and reset state
    const handleClearPaste = () => {
        setPasteContent('')
        setPreview(null)
        setError(null)
        setDetectedFormat(null)
        if (contentEditableRef.current) {
            contentEditableRef.current.innerHTML = ''
        }
    }

    // Handle file selection
    const handleFileSelect = (e) => {
        const file = e.target.files[0]
        if (file) {
            processFile(file)
        }
    }

    // Handle drag and drop
    const handleDrop = (e) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) {
            processFile(file)
        }
    }

    const handleDragOver = (e) => {
        e.preventDefault()
    }

    // Process uploaded file
    const processFile = async (file) => {
        setError(null)
        setPreview(null)

        // Validate file type
        const validExtensions = ['.csv', '.xlsx', '.xls']
        const fileName = file.name.toLowerCase()
        const isValid = validExtensions.some(ext => fileName.endsWith(ext))

        if (!isValid) {
            setError('Invalid file type. Please upload a CSV (.csv) or Excel (.xlsx, .xls) file.')
            setSelectedFile(null)
            return
        }

        // Validate file size (5MB)
        const maxSize = 5 * 1024 * 1024
        if (file.size > maxSize) {
            setError('File too large. Maximum size is 5MB.')
            setSelectedFile(null)
            return
        }

        setSelectedFile(file)
        setLoading(true)

        try {
            const tableData = await importTableFromFile(file)
            setPreview(tableData)
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to parse file')
            setPreview(null)
        } finally {
            setLoading(false)
        }
    }

    // Handle import button click
    const handleImportClick = () => {
        if (!preview) return

        // Check if there's existing table data
        const hasExistingData = existingData && existingData.rows && existingData.rows.length > 0

        if (hasExistingData) {
            // Show merge dialog
            setShowMergeDialog(true)
        } else {
            // No existing data, just import
            onImport(preview)
            handleReset()
            onClose()
        }
    }

    // Handle replace - use only new data
    const handleReplace = () => {
        onImport(preview)
        setShowMergeDialog(false)
        handleReset()
        onClose()
    }

    // Handle append - merge new rows with existing data
    const handleAppend = () => {
        if (!existingData || !preview) return

        const mergedData = {
            ...existingData,
            rows: [
                ...existingData.rows,
                ...preview.rows
            ]
        }

        onImport(mergedData)
        setShowMergeDialog(false)
        handleReset()
        onClose()
    }

    // Handle cancel merge dialog
    const handleCancelMerge = () => {
        setShowMergeDialog(false)
    }

    // Handle close
    const handleClose = () => {
        handleReset()
        onClose()
    }

    // Render preview table (simplified)
    const renderPreview = () => {
        if (!preview || !preview.rows) return null

        return (
            <div className="border rounded overflow-auto max-h-64 bg-white">
                <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="divide-y divide-gray-200">
                        {preview.rows.slice(0, 10).map((row, rowIdx) => (
                            <tr key={rowIdx}>
                                {row.cells.map((cell, cellIdx) => (
                                    <td
                                        key={cellIdx}
                                        colSpan={cell.colspan || 1}
                                        rowSpan={cell.rowspan || 1}
                                        className="px-2 py-1 text-sm border-r border-gray-200 last:border-r-0"
                                        style={{
                                            textAlign: cell.alignment || 'left',
                                            backgroundColor: cell.background_color || 'transparent',
                                            color: cell.text_color || 'inherit'
                                        }}
                                    >
                                        <div dangerouslySetInnerHTML={{ __html: cell.content || '' }} />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {preview.rows.length > 10 && (
                    <div className="p-2 text-xs text-gray-500 bg-gray-50 text-center">
                        Showing first 10 of {preview.rows.length} rows
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-semibold">Import Table</h2>
                    <button
                        onClick={handleClose}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab('paste')}
                        className={`px-4 py-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'paste'
                            ? 'border-b-2 border-blue-500 text-blue-600'
                            : 'text-gray-600 hover:text-gray-800'
                            }`}
                    >
                        <ClipboardPaste size={16} />
                        Paste
                    </button>
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={`px-4 py-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'upload'
                            ? 'border-b-2 border-blue-500 text-blue-600'
                            : 'text-gray-600 hover:text-gray-800'
                            }`}
                    >
                        <Upload size={16} />
                        Upload File
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    {/* Paste Tab */}
                    {activeTab === 'paste' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-600">
                                    {showCodeView
                                        ? 'Paste or edit table data. Supports: HTML, CSV, TSV (Google Sheets/Excel), JSON.'
                                        : 'Paste from webpage, spreadsheet, or data file. Auto-detects: HTML, CSV, TSV, JSON.'
                                    }
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleClearPaste}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded border"
                                        title="Clear content"
                                        disabled={!pasteContent}
                                    >
                                        <Trash2 size={14} />
                                        Clear
                                    </button>
                                    <button
                                        onClick={handleToggleView}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded border"
                                        title={showCodeView ? "Switch to visual view" : "Switch to code view"}
                                    >
                                        <Code size={14} />
                                        {showCodeView ? 'Visual' : 'Code'}
                                    </button>
                                </div>
                            </div>

                            {!showCodeView ? (
                                <div
                                    ref={contentEditableRef}
                                    contentEditable
                                    onPaste={handleContentEditablePaste}
                                    onInput={handleContentEditableInput}
                                    onKeyDown={handleContentEditableKeyDown}
                                    className="w-full h-48 p-3 border rounded font-mono text-sm overflow-auto focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                                    data-placeholder="Paste your table here from a webpage or spreadsheet..."
                                    suppressContentEditableWarning={true}
                                />
                            ) : (
                                <textarea
                                    value={pasteContent}
                                    onChange={handleCodeChange}
                                    placeholder="<table>&#10;  <tr>&#10;    <td>Cell 1</td>&#10;    <td>Cell 2</td>&#10;  </tr>&#10;</table>"
                                    className="w-full h-48 p-3 border rounded font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            )}

                            {detectedFormat && (
                                <div className="flex items-center gap-2 text-sm">
                                    <CheckCircle size={16} className="text-green-600" />
                                    <span className="text-gray-700">
                                        Detected format: <strong>{detectedFormat.toUpperCase()}</strong>
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Upload Tab */}
                    {activeTab === 'upload' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Upload a CSV or Excel file (.csv, .xlsx, .xls). Maximum file size: 5MB.
                            </p>

                            {/* Drop zone */}
                            <div
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-700 mb-2">
                                    Drop your file here or click to browse
                                </p>
                                <p className="text-sm text-gray-500">
                                    Supported formats: CSV, Excel (.xlsx, .xls)
                                </p>
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileSelect}
                                className="hidden"
                            />

                            {selectedFile && (
                                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded">
                                    <CheckCircle size={16} className="text-green-600" />
                                    <span className="text-sm text-gray-700">{selectedFile.name}</span>
                                    <span className="text-xs text-gray-500">
                                        ({(selectedFile.size / 1024).toFixed(1)} KB)
                                    </span>
                                </div>
                            )}

                            {loading && (
                                <div className="text-center text-gray-600">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    <p className="mt-2 text-sm">Processing file...</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded mt-4">
                            <AlertCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-red-700">{error}</div>
                        </div>
                    )}

                    {/* Preview */}
                    {preview && (
                        <div className="mt-6">
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Preview:</h3>
                            {renderPreview()}
                            <p className="text-xs text-gray-500 mt-2">
                                {preview.rows.length} rows × {preview.column_widths?.length || 0} columns
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleImportClick}
                        disabled={!preview || loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        Import Table
                    </button>
                </div>
            </div>

            {/* Merge Dialog Overlay */}
            {showMergeDialog && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
                        <h3 className="text-lg font-semibold mb-4">Table Already Has Data</h3>
                        <p className="text-sm text-gray-600 mb-6">
                            This table already contains data. Would you like to replace it or append the new rows?
                        </p>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={handleReplace}
                                    className="w-full px-4 py-3 text-left bg-red-50 hover:bg-red-100 border border-red-200 rounded"
                                >
                                    <div className="font-medium text-red-900">Replace</div>
                                    <div className="text-sm text-red-700">Delete existing data and use only the new table</div>
                                </button>
                                <button
                                    onClick={handleAppend}
                                    className="w-full px-4 py-3 text-left bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded"
                                >
                                    <div className="font-medium text-blue-900">Append</div>
                                    <div className="text-sm text-blue-700">Add new rows to the end of the existing table</div>
                                </button>
                            </div>
                            <button
                                onClick={handleCancelMerge}
                                className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded border"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default TableImportModal

