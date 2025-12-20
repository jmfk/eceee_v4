/**
 * CSS Import Modal Component
 * 
 * Modal for importing CSS into design groups with:
 * - File upload
 * - Text paste
 * - Preview parsing results
 * - Support for global, group, and element-level imports
 */

import React, { useState, useRef } from 'react';
import { parseCSSRules, cssToGroupElements, cssToElementProperties } from '../utils/cssParser';

const CSSImportModal = ({
    isOpen,
    importType,
    groupIndex = null,
    elementKey = null,
    onImport,
    onClose
}) => {
    const [importCSSText, setImportCSSText] = useState('');
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            setImportCSSText(e.target.result);
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset file input
    };

    const handleImport = () => {
        if (!importCSSText.trim()) {
            return;
        }
        onImport(importCSSText);
        setImportCSSText('');
    };

    const handleClose = () => {
        setImportCSSText('');
        onClose();
    };

    // Generate preview info
    const getPreviewInfo = () => {
        if (!importCSSText.trim()) return null;

        try {
            if (importType === 'element') {
                const props = cssToElementProperties(importCSSText);
                const count = Object.keys(props).length;
                return count > 0
                    ? `✓ ${count} CSS ${count === 1 ? 'property' : 'properties'} detected`
                    : '⚠ No valid CSS properties found';
            } else {
                const rules = parseCSSRules(importCSSText);
                const { elements } = cssToGroupElements(rules);
                const count = Object.keys(elements).length;
                return count > 0
                    ? `✓ ${count} ${count === 1 ? 'element' : 'elements'} detected: ${Object.keys(elements).join(', ')}`
                    : '⚠ No valid CSS rules found';
            }
        } catch (error) {
            return `⚠ Parse error: ${error.message}`;
        }
    };

    const previewInfo = getPreviewInfo();

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">
                        Import CSS {
                            importType === 'global' ? 'to Create New Group' :
                                importType === 'group' ? 'to Update Group' :
                                    `for ${elementKey}`
                        }
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                        {importType === 'global' && 'Paste CSS rules with selectors (e.g., h1 { font-size: 2.5rem; })'}
                        {importType === 'group' && 'Paste CSS rules with selectors to update all elements in this group'}
                        {importType === 'element' && 'Paste CSS properties without selector (e.g., font-size: 2.5rem; color: blue;)'}
                    </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* File Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Upload CSS File</label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".css"
                            onChange={handleFileUpload}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>

                    {/* Or Divider */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">or paste CSS</span>
                        </div>
                    </div>

                    {/* CSS Textarea */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">CSS Code</label>
                        <textarea
                            value={importCSSText}
                            onChange={(e) => setImportCSSText(e.target.value)}
                            placeholder={
                                importType === 'element'
                                    ? 'font-size: 2.5rem;\nfont-weight: 700;\ncolor: #333;'
                                    : 'h1 {\n  font-size: 2.5rem;\n  font-weight: 700;\n}\n\np {\n  font-size: 1rem;\n  line-height: 1.6;\n}'
                            }
                            className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Preview Info */}
                    {previewInfo && (
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                            <div className="text-sm text-blue-800">
                                {previewInfo}
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleImport}
                        disabled={!importCSSText.trim()}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Import
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CSSImportModal;









