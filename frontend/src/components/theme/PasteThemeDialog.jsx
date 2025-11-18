import React, { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { parseClipboardData } from '../../utils/themeCopyPaste';

const PasteThemeDialog = ({ isOpen, onClose, onConfirm, targetTheme }) => {
    const [clipboardData, setClipboardData] = useState(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            readClipboard();
        }
    }, [isOpen]);

    const readClipboard = async () => {
        setIsLoading(true);
        setError('');
        
        try {
            const text = await navigator.clipboard.readText();
            console.log('[PasteThemeDialog] Raw clipboard text length:', text.length);
            console.log('[PasteThemeDialog] Raw clipboard text (first 200 chars):', text.substring(0, 200));
            
            const result = parseClipboardData(text);
            console.log('[PasteThemeDialog] Parse result:', result);

            if (!result.valid) {
                console.error('[PasteThemeDialog] Invalid clipboard data:', result.error);
                setError(result.error);
                setClipboardData(null);
            } else if (result.data.level !== 'full') {
                console.error('[PasteThemeDialog] Wrong level:', result.data.level);
                setError('Only full theme data can be pasted. Please copy a complete theme.');
                setClipboardData(null);
            } else {
                console.log('[PasteThemeDialog] Valid clipboard data:', {
                    level: result.data.level,
                    dataKeys: Object.keys(result.data.data || {}),
                    data: result.data.data,
                });
                setClipboardData(result.data);
            }
        } catch (err) {
            console.error('[PasteThemeDialog] Error reading clipboard:', err);
            setError('Failed to read clipboard. Please ensure you have copied theme data.');
            setClipboardData(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = () => {
        console.log('[PasteThemeDialog] Confirming paste with data:', clipboardData?.data);
        if (clipboardData) {
            onConfirm(clipboardData.data);
        }
    };

    const countItems = (obj) => {
        if (!obj) return 0;
        if (Array.isArray(obj)) return obj.length;
        if (typeof obj === 'object') return Object.keys(obj).length;
        return 0;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Paste Theme Data</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 py-4">
                    {isLoading ? (
                        <div className="text-center py-8">
                            <p className="text-gray-600">Reading clipboard...</p>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border border-red-200 rounded-md p-4">
                            <div className="flex items-start">
                                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                                <div>
                                    <h3 className="text-sm font-medium text-red-800 mb-1">
                                        Error Reading Clipboard
                                    </h3>
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        </div>
                    ) : clipboardData ? (
                        <div>
                            {/* Warning */}
                            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
                                <div className="flex items-start">
                                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                                    <div>
                                        <h3 className="text-sm font-medium text-yellow-800 mb-1">
                                            Warning: This will overwrite the entire theme
                                        </h3>
                                        <p className="text-sm text-yellow-700">
                                            All current settings in "{targetTheme?.name}" will be replaced with the pasted data, including the theme image if one is included.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Current vs New */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-900 mb-2">Current Theme</h3>
                                    <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                                        <p className="font-semibold text-gray-900">{targetTheme?.name}</p>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-gray-900 mb-2">Source Theme</h3>
                                    <div className="bg-blue-50 rounded-md p-3 border border-blue-200">
                                        <p className="font-semibold text-blue-900">
                                            {clipboardData.data.name || 'Unnamed Theme'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Preview of what will be pasted */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-900 mb-3">
                                    Data to be pasted:
                                </h3>
                                <div className="bg-gray-50 rounded-md p-4 border border-gray-200 space-y-2">
                                    {clipboardData.data.fonts?.googleFonts && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Fonts:</span>
                                            <span className="font-medium text-gray-900">
                                                {clipboardData.data.fonts.googleFonts.length} font{clipboardData.data.fonts.googleFonts.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    )}
                                    {clipboardData.data.colors && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Colors:</span>
                                            <span className="font-medium text-gray-900">
                                                {countItems(clipboardData.data.colors)} color{countItems(clipboardData.data.colors) !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    )}
                                    {clipboardData.data.designGroups?.groups && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Design Groups:</span>
                                            <span className="font-medium text-gray-900">
                                                {clipboardData.data.designGroups.groups.length} group{clipboardData.data.designGroups.groups.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    )}
                                    {clipboardData.data.componentStyles && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Component Styles:</span>
                                            <span className="font-medium text-gray-900">
                                                {countItems(clipboardData.data.componentStyles)} style{countItems(clipboardData.data.componentStyles) !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    )}
                                    {clipboardData.data.imageStyles && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Image Styles:</span>
                                            <span className="font-medium text-gray-900">
                                                {countItems(clipboardData.data.imageStyles)} style{countItems(clipboardData.data.imageStyles) !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    )}
                                    {clipboardData.data.tableTemplates && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Table Templates:</span>
                                            <span className="font-medium text-gray-900">
                                                {countItems(clipboardData.data.tableTemplates)} template{countItems(clipboardData.data.tableTemplates) !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    )}
                                    {clipboardData.data.image && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Theme Image:</span>
                                            <span className="font-medium text-green-700">Included</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-gray-600">No valid theme data found in clipboard</p>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Cancel
                    </button>
                    {clipboardData && !error && (
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 border border-transparent rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                        >
                            Overwrite Theme
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PasteThemeDialog;

