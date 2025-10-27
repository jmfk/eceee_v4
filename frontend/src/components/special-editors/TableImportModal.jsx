/**
 * TableImportModal - Modal for importing table data from various sources
 * 
 * Supports:
 * - Paste from clipboard (auto-detect HTML or TSV)
 * - Upload CSV/Excel files
 * - Paste HTML table code
 */

import React, { useState, useRef } from 'react'
import { X, Upload, ClipboardPaste, Code, AlertCircle, CheckCircle } from 'lucide-react'
import { parseAuto, parseHTMLTable, detectPasteFormat } from '@/utils/tableImport'
import { importTableFromFile } from '@/api/fileManager'

const TableImportModal = ({ isOpen, onClose, onImport }) => {
    const [activeTab, setActiveTab] = useState('paste')
    const [pasteContent, setPasteContent] = useState('')
    const [htmlContent, setHtmlContent] = useState('')
    const [selectedFile, setSelectedFile] = useState(null)
    const [preview, setPreview] = useState(null)
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)
    const [detectedFormat, setDetectedFormat] = useState(null)
    const fileInputRef = useRef(null)

    if (!isOpen) return null

    // Reset state when modal opens
    const handleReset = () => {
        setPasteContent('')
        setHtmlContent('')
        setSelectedFile(null)
        setPreview(null)
        setError(null)
        setDetectedFormat(null)
        setLoading(false)
    }

    // Handle paste content change with auto-detection
    const handlePasteChange = (e) => {
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

    // Handle HTML content change
    const handleHtmlChange = (e) => {
        const content = e.target.value
        setHtmlContent(content)
        setError(null)

        if (content.trim()) {
            try {
                const parsed = parseHTMLTable(content)
                setPreview(parsed)
            } catch (err) {
                setError(err.message)
                setPreview(null)
            }
        } else {
            setPreview(null)
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
        if (preview) {
            onImport(preview)
            handleReset()
            onClose()
        }
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
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
                    <button
                        onClick={() => setActiveTab('html')}
                        className={`px-4 py-2 font-medium text-sm flex items-center gap-2 ${activeTab === 'html'
                                ? 'border-b-2 border-blue-500 text-blue-600'
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                    >
                        <Code size={16} />
                        HTML Code
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    {/* Paste Tab */}
                    {activeTab === 'paste' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Paste content from a spreadsheet (Google Sheets, Excel) or HTML table.
                                Format will be auto-detected.
                            </p>
                            <textarea
                                value={pasteContent}
                                onChange={handlePasteChange}
                                placeholder="Paste your table data here..."
                                className="w-full h-48 p-3 border rounded font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
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

                    {/* HTML Tab */}
                    {activeTab === 'html' && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Paste HTML table markup. Must include &lt;table&gt; element with &lt;tr&gt; and &lt;td&gt; tags.
                            </p>
                            <textarea
                                value={htmlContent}
                                onChange={handleHtmlChange}
                                placeholder="<table>&#10;  <tr>&#10;    <td>Cell 1</td>&#10;    <td>Cell 2</td>&#10;  </tr>&#10;</table>"
                                className="w-full h-48 p-3 border rounded font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
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
        </div>
    )
}

export default TableImportModal

