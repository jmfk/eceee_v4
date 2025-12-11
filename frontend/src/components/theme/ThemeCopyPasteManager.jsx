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
    const [showSelectiveCopyDialog, setShowSelectiveCopyDialog] = useState(false);
    const [selectedSections, setSelectedSections] = useState({
        fonts: true,
        colors: true,
        breakpoints: true,
        designGroups: true,
        componentStyles: true,
        imageStyles: true,
        tableTemplates: true,
    });
    const [pasteText, setPasteText] = useState('');
    const [parsedData, setParsedData] = useState(null);
    const [conflicts, setConflicts] = useState([]);
    const [showConflictDialog, setShowConflictDialog] = useState(false);
    const [mergeMode, setMergeMode] = useState('add'); // 'replace' or 'add'
    const fileInputRef = useRef(null);
    const { addNotification } = useGlobalNotifications();

    // Map tab IDs to section names
    const tabToSection = {
        'fonts': 'fonts',
        'colors': 'colors',
        'breakpoints': 'breakpoints',
        'typography': 'designGroups',
        'component-styles': 'componentStyles',
        'image-styles': 'imageStyles',
        'table-templates': 'tableTemplates',
    };

    const handleCopyAll = async () => {
        const data = {
            fonts: themeData?.fonts || {},
            colors: themeData?.colors || {},
            breakpoints: themeData?.breakpoints || {},
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
            breakpoints: themeData?.breakpoints || {},
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

        const { level, section, data } = parsedData;

        // If replace mode, skip conflict detection and directly apply
        if (mergeMode === 'replace') {
            applyPaste({}, true);
            return;
        }

        // Add mode: detect conflicts but auto-resolve as overwrite
        let existingData;
        if (level === 'full') {
            existingData = {
                fonts: themeData?.fonts || {},
                colors: themeData?.colors || {},
                breakpoints: themeData?.breakpoints || {},
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
            // Auto-resolve all conflicts as 'overwrite' for add mode
            const autoResolutions = {};
            detectedConflicts.forEach(conflict => {
                const key = `${conflict.section}.${conflict.key}`;
                autoResolutions[key] = 'overwrite';
            });
            applyPaste(autoResolutions, false);
        } else {
            // No conflicts, merge directly
            applyPaste({}, false);
        }
    };

    const applyPaste = (resolutions, replaceMode = false) => {
        const { level, section, data } = parsedData;

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c8b75885-14df-434e-9b57-f5e9971d8cca', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ThemeCopyPasteManager.jsx:204', message: 'applyPaste entry', data: { level, section, replaceMode, hasDesignGroupsInData: !!data?.designGroups, designGroupsType: typeof data?.designGroups, designGroupsGroups: data?.designGroups?.groups?.length, hasDesignGroupsInTheme: !!themeData?.designGroups, themeDesignGroupsType: typeof themeData?.designGroups, themeDesignGroupsGroups: themeData?.designGroups?.groups?.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(() => { });
        // #endregion

        let existingData;
        if (level === 'full') {
            existingData = {
                fonts: themeData?.fonts || {},
                colors: themeData?.colors || {},
                breakpoints: themeData?.breakpoints || {},
                designGroups: themeData?.designGroups || { groups: [] },
                componentStyles: themeData?.componentStyles || {},
                imageStyles: themeData?.imageStyles || {},
                tableTemplates: themeData?.tableTemplates || {},
            };
        } else {
            existingData = themeData?.[section] || {};
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c8b75885-14df-434e-9b57-f5e9971d8cca', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ThemeCopyPasteManager.jsx:220', message: 'before mergeThemeData', data: { existingDesignGroups: JSON.stringify(existingData.designGroups), incomingDesignGroups: JSON.stringify(data.designGroups), resolutions: JSON.stringify(resolutions) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
        // #endregion

        const merged = mergeThemeData(existingData, data, level, section, resolutions, replaceMode);

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c8b75885-14df-434e-9b57-f5e9971d8cca', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ThemeCopyPasteManager.jsx:222', message: 'after mergeThemeData', data: { mergedDesignGroups: JSON.stringify(merged.designGroups), mergedDesignGroupsGroups: merged.designGroups?.groups?.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(() => { });
        // #endregion

        // Apply update
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/c8b75885-14df-434e-9b57-f5e9971d8cca', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'ThemeCopyPasteManager.jsx:225', message: 'before onUpdate', data: { level, willUpdateFull: level === 'full', updateDataDesignGroups: JSON.stringify(level === 'full' ? merged.designGroups : merged[section]?.designGroups) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(() => { });
        // #endregion

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
            breakpoints: 'Breakpoints',
            designGroups: 'Design Groups',
            componentStyles: 'Component Styles',
            imageStyles: 'Image Styles',
            tableTemplates: 'Table Templates',
        };
        return labels[section] || section;
    };

    const allSections = ['fonts', 'colors', 'breakpoints', 'designGroups', 'componentStyles', 'imageStyles', 'tableTemplates'];

    const handleSelectAll = () => {
        const newSelection = {};
        allSections.forEach(section => {
            newSelection[section] = true;
        });
        setSelectedSections(newSelection);
    };

    const handleDeselectAll = () => {
        const newSelection = {};
        allSections.forEach(section => {
            newSelection[section] = false;
        });
        setSelectedSections(newSelection);
    };

    const handleToggleSection = (section) => {
        setSelectedSections(prev => ({
            ...prev,
            [section]: !prev[section],
        }));
    };

    const handleSelectiveCopy = async () => {
        const selectedCount = Object.values(selectedSections).filter(Boolean).length;

        if (selectedCount === 0) {
            addNotification({
                type: 'error',
                message: 'Please select at least one section to copy',
            });
            return;
        }

        const data = {};
        allSections.forEach(section => {
            if (selectedSections[section]) {
                if (section === 'designGroups') {
                    data[section] = themeData?.[section] || { groups: [] };
                } else {
                    data[section] = themeData?.[section] || {};
                }
            }
        });

        const result = await copyToClipboard(data, 'full');

        if (result.success) {
            addNotification({
                type: 'success',
                message: `${selectedCount} section${selectedCount !== 1 ? 's' : ''} copied to clipboard`,
            });
            setShowSelectiveCopyDialog(false);
            setShowCopyMenu(false);
        } else {
            addNotification({
                type: 'error',
                message: `Failed to copy: ${result.error}`,
            });
        }
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
                                <button
                                    onClick={() => {
                                        setShowSelectiveCopyDialog(true);
                                        setShowCopyMenu(false);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                    <Copy className="w-4 h-4" />
                                    Copy Selected...
                                </button>
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
                            <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="2">
                                Paste Theme Settings
                            </div>
                            <button
                                onClick={() => {
                                    setShowPasteModal(false);
                                    setPasteText('');
                                    setParsedData(null);
                                    setMergeMode('add');
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-4 space-y-4">
                            {/* Merge Mode Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Import Mode
                                </label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="mergeMode"
                                            value="add"
                                            checked={mergeMode === 'add'}
                                            onChange={(e) => setMergeMode(e.target.value)}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">
                                            Add to existing (overwrite conflicts)
                                        </span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="mergeMode"
                                            value="replace"
                                            checked={mergeMode === 'replace'}
                                            onChange={(e) => setMergeMode(e.target.value)}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700">
                                            Replace existing
                                        </span>
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {mergeMode === 'add'
                                        ? 'Merges imported data with existing, automatically overwriting conflicts'
                                        : 'Completely replaces all data in imported sections'}
                                </p>
                            </div>

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
                                    setMergeMode('add');
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

            {/* Selective Copy Dialog */}
            {showSelectiveCopyDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                            <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="2">
                                Select Sections to Copy
                            </div>
                            <button
                                onClick={() => {
                                    setShowSelectiveCopyDialog(false);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-4 space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <button
                                    onClick={handleSelectAll}
                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    Select All
                                </button>
                                <button
                                    onClick={handleDeselectAll}
                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    Deselect All
                                </button>
                            </div>

                            <div className="space-y-2">
                                {allSections.map(section => (
                                    <label
                                        key={section}
                                        className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedSections[section] || false}
                                            onChange={() => handleToggleSection(section)}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                        />
                                        <span className="text-sm text-gray-700">
                                            {getSectionLabel(section)}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowSelectiveCopyDialog(false);
                                }}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSelectiveCopy}
                                disabled={Object.values(selectedSections).filter(Boolean).length === 0}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Copy Selected
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

