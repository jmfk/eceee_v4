/**
 * Theme Copy/Paste Manager
 * 
 * Global manager for copying and pasting theme settings
 * Placed in ThemeEditor header
 */

import React, { useState, useRef } from 'react';
import { Copy, Upload, Download, X, FileText } from 'lucide-react';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import {
    copyToClipboard,
    parseClipboardData,
    detectConflicts,
    mergeThemeData,
    generateMergeSummary,
    downloadAsJSON,
} from '../../utils/themeCopyPaste';
import ConflictResolutionDialog from './ConflictResolutionDialog';

const ThemeCopyPasteManager = ({ themeData, currentTab, onUpdate }) => {
    const [showCopyMenu, setShowCopyMenu] = useState(false);
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [pasteText, setPasteText] = useState('');
    const [parsedData, setParsedData] = useState(null);
    const [conflicts, setConflicts] = useState([]);
    const [showConflictDialog, setShowConflictDialog] = useState(false);
    const fileInputRef = useRef(null);
    const { addNotification } = useGlobalNotifications();

    // Map tab IDs to section names
    const tabToSection = {
        'fonts': 'fonts',
        'colors': 'colors',
        'typography': 'designGroups',
        'component-styles': 'componentStyles',
        'image-styles': 'imageStyles',
        'table-templates': 'tableTemplates',
    };

    const handleCopyAll = async () => {
        const data = {
            fonts: themeData?.fonts || {},
            colors: themeData?.colors || {},
            designGroups: themeData?.designGroups || { groups: [] },
            componentStyles: themeData?.componentStyles || {},
            imageStyles: themeData?.imageStyles || {},
            tableTemplates: themeData?.tableTemplates || {},
        };

        const result = await copyToClipboard(data, 'full');

        if (result.success) {
            addNotification({
                type: 'success',
                message: 'All theme settings copied to clipboard',
            });
            setShowCopyMenu(false);
        } else {
            addNotification({
                type: 'error',
                message: `Failed to copy: ${result.error}`,
            });
        }
    };

    const handleCopyCurrentTab = async () => {
        const section = tabToSection[currentTab];

        if (!section) {
            addNotification({
                type: 'error',
                message: 'Cannot copy this tab',
            });
            return;
        }

        const data = themeData?.[section] || {};
        const result = await copyToClipboard(data, 'section', section);

        if (result.success) {
            addNotification({
                type: 'success',
                message: `${getSectionLabel(section)} copied to clipboard`,
            });
            setShowCopyMenu(false);
        } else {
            addNotification({
                type: 'error',
                message: `Failed to copy: ${result.error}`,
            });
        }
    };

    const handleDownloadAll = () => {
        const data = {
            fonts: themeData?.fonts || {},
            colors: themeData?.colors || {},
            designGroups: themeData?.designGroups || { groups: [] },
            componentStyles: themeData?.componentStyles || {},
            imageStyles: themeData?.imageStyles || {},
            tableTemplates: themeData?.tableTemplates || {},
        };

        const payload = {
            type: 'theme-settings',
            version: '1.0',
            level: 'full',
            section: null,
            timestamp: new Date().toISOString(),
            data,
        };

        downloadAsJSON(payload, `theme-${themeData?.name || 'settings'}.json`);
        addNotification({
            type: 'success',
            message: 'Theme settings downloaded',
        });
        setShowCopyMenu(false);
    };

    const handlePasteTextChange = (text) => {
        setPasteText(text);

        if (!text.trim()) {
            setParsedData(null);
            return;
        }

        const result = parseClipboardData(text);

        if (result.valid) {
            setParsedData(result.data);
        } else {
            setParsedData({ error: result.error });
        }
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            handlePasteTextChange(text);
        };
        reader.readAsText(file);
    };

    const handlePaste = () => {
        if (!parsedData || parsedData.error) {
            addNotification({
                type: 'error',
                message: parsedData?.error || 'Invalid data',
            });
            return;
        }

        // Detect conflicts
        const { level, section, data } = parsedData;

        let existingData;
        if (level === 'full') {
            existingData = {
                fonts: themeData?.fonts || {},
                colors: themeData?.colors || {},
                designGroups: themeData?.designGroups || { groups: [] },
                componentStyles: themeData?.componentStyles || {},
                imageStyles: themeData?.imageStyles || {},
                tableTemplates: themeData?.tableTemplates || {},
            };
        } else {
            existingData = themeData?.[section] || {};
        }

        const detectedConflicts = detectConflicts(existingData, data, section, level);

        if (detectedConflicts.length > 0) {
            setConflicts(detectedConflicts);
            setShowConflictDialog(true);
            setShowPasteModal(false);
        } else {
            // No conflicts, merge directly
            applyPaste({});
        }
    };

    const applyPaste = (resolutions) => {
        const { level, section, data } = parsedData;

        let existingData;
        if (level === 'full') {
            existingData = {
                fonts: themeData?.fonts || {},
                colors: themeData?.colors || {},
                designGroups: themeData?.designGroups || { groups: [] },
                componentStyles: themeData?.componentStyles || {},
                imageStyles: themeData?.imageStyles || {},
                tableTemplates: themeData?.tableTemplates || {},
            };
        } else {
            existingData = themeData?.[section] || {};
        }

        const merged = mergeThemeData(existingData, data, level, section, resolutions);

        // Apply update
        if (level === 'full') {
            onUpdate(merged);
        } else {
            onUpdate({ ...themeData, [section]: merged[section] });
        }

        // Show summary
        if (conflicts.length > 0) {
            const summary = generateMergeSummary(conflicts, resolutions);
            addNotification({
                type: 'success',
                message: summary.message,
            });
        } else {
            addNotification({
                type: 'success',
                message: 'Settings pasted successfully',
            });
        }

        // Clean up
        setShowPasteModal(false);
        setShowConflictDialog(false);
        setPasteText('');
        setParsedData(null);
        setConflicts([]);
    };

    const handleConflictResolve = (resolutions) => {
        applyPaste(resolutions);
    };

    const getSectionLabel = (section) => {
        const labels = {
            fonts: 'Fonts',
            colors: 'Colors',
            designGroups: 'Design Groups',
            componentStyles: 'Component Styles',
            imageStyles: 'Image Styles',
            tableTemplates: 'Table Templates',
        };
        return labels[section] || section;
    };

    return (
        <>
            <div className="flex items-center gap-2">
                {/* Copy Button with Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowCopyMenu(!showCopyMenu)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        <Copy className="w-4 h-4" />
                        Copy
                    </button>

                    {showCopyMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setShowCopyMenu(false)}
                            />
                            <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                                <button
                                    onClick={handleCopyAll}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                    <Copy className="w-4 h-4" />
                                    Copy All Settings
                                </button>
                                {tabToSection[currentTab] && (
                                    <button
                                        onClick={handleCopyCurrentTab}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                        <Copy className="w-4 h-4" />
                                        Copy {getSectionLabel(tabToSection[currentTab])}
                                    </button>
                                )}
                                <div className="border-t border-gray-200" />
                                <button
                                    onClick={handleDownloadAll}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Download as JSON
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Paste Button */}
                <button
                    onClick={() => setShowPasteModal(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                    <Upload className="w-4 h-4" />
                    Paste
                </button>
            </div>

            {/* Paste Modal */}
            {showPasteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">
                                Paste Theme Settings
                            </h2>
                            <button
                                onClick={() => {
                                    setShowPasteModal(false);
                                    setPasteText('');
                                    setParsedData(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Paste JSON or upload file
                                </label>
                                <textarea
                                    value={pasteText}
                                    onChange={(e) => handlePasteTextChange(e.target.value)}
                                    placeholder='Paste theme settings JSON here...'
                                    rows={12}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                                >
                                    <FileText className="w-4 h-4" />
                                    Upload JSON File
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </div>

                            {/* Preview */}
                            {parsedData && !parsedData.error && (
                                <div className="bg-green-50 border border-green-200 rounded p-3">
                                    <div className="text-sm font-medium text-green-900 mb-1">
                                        ✓ Valid {parsedData.level} level data
                                    </div>
                                    {parsedData.section && (
                                        <div className="text-xs text-green-700">
                                            Section: {getSectionLabel(parsedData.section)}
                                        </div>
                                    )}
                                </div>
                            )}

                            {parsedData?.error && (
                                <div className="bg-red-50 border border-red-200 rounded p-3">
                                    <div className="text-sm font-medium text-red-900">
                                        Error: {parsedData.error}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowPasteModal(false);
                                    setPasteText('');
                                    setParsedData(null);
                                }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePaste}
                                disabled={!parsedData || parsedData.error}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Paste
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Conflict Resolution Dialog */}
            {showConflictDialog && conflicts.length > 0 && (
                <ConflictResolutionDialog
                    conflicts={conflicts}
                    onResolve={handleConflictResolve}
                    onCancel={() => {
                        setShowConflictDialog(false);
                        setShowPasteModal(true);
                    }}
                />
            )}
        </>
    );
};

export default ThemeCopyPasteManager;

