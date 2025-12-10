/**
 * Component Styles Tab Component
 * 
 * HTML template + CSS editor for component styles (renamed from Image Styles).
 */

import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Code, Eye, BookOpen, Edit, Sparkles } from 'lucide-react';
import { createEmptyComponentStyle } from '../../utils/themeUtils';
import { renderMustache, prepareComponentContext } from '../../utils/mustacheRenderer';
import CopyButton from './CopyButton';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';
import PresetSelector from './PresetSelector';
import { smartInsert } from '../../utils/codeInsertion';
import StyleAIHelper from './StyleAIHelper';

const ComponentStylesTab = forwardRef(({ componentStyles, onChange, onDirty, themeId }, ref) => {
    const navigate = useNavigate();
    const [editingStyle, setEditingStyle] = useState(null);
    const [showPresetSelector, setShowPresetSelector] = useState(false);
    const templateRefs = useRef({});
    const cssRefs = useRef({});
    const { addNotification } = useGlobalNotifications();
    const { updateThemeField, saveCurrentTheme, switchTheme, getState } = useUnifiedData();
    const queryClient = useQueryClient();

    const styles = componentStyles || {};
    const styleEntries = Object.entries(styles);

    const handleAddStyle = async () => {
        // Generate a unique key without showing a form
        const base = 'component-style';
        let idx = 1;
        let styleKey = base;
        while (styles[styleKey]) {
            idx += 1;
            styleKey = `${base}-${idx}`;
        }

        const newStyle = createEmptyComponentStyle(styleKey);
        newStyle.name = 'New Component Style';

        const updatedStyles = { ...styles, [styleKey]: newStyle };

        // Ensure UDC currentThemeId is set
        try {
            const udcState = getState();
            if (udcState.metadata.currentThemeId !== String(themeId)) {
                switchTheme(String(themeId));
            }
        } catch (_) {}

        // Update UDC with new style
        updateThemeField('componentStyles', updatedStyles);

        // Save the new style and then navigate to edit view
        try {
            await saveCurrentTheme();
            
            // Invalidate React Query cache to refresh the theme data
            queryClient.invalidateQueries(['theme', themeId]);
            
            addNotification({ type: 'success', message: 'New component style created and saved' });
            navigate(`/settings/themes/${themeId}/component-styles/${styleKey}`);
        } catch (error) {
            addNotification({ type: 'error', message: 'Failed to save new component style' });
        }
    };

    const handleRemoveStyle = (key) => {
        if (!window.confirm(`Delete style "${styles[key]?.name || key}"?`)) return;

        const updatedStyles = { ...styles };
        delete updatedStyles[key];
        onChange(updatedStyles);
        if (onDirty) onDirty();
        addNotification({ type: 'success', message: 'Style deleted' });
    };

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
        flushPendingChanges: () => {
            // No pending changes to flush in this simplified version
            return Promise.resolve();
        },
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">Component Styles</div>
                    <div className="text-sm text-gray-600 mt-1">
                        Custom component templates using Mustache syntax
                    </div>
                </div>
                <button
                    onClick={handleAddStyle}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                    <Plus className="h-4 w-4" />
                    Add Style
                </button>
            </div>

            {/* Styles List */}
            {styleEntries.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <Code className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                    <div className="text-gray-600 mb-4">No component styles defined yet</div>
                    <button
                        onClick={handleAddStyle}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        <Plus className="h-4 w-4" />
                        Create First Style
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {styleEntries.map(([key, style]) => (
                        <div
                            key={key}
                            className="border rounded-lg p-4 hover:shadow-md transition cursor-pointer bg-white"
                            onClick={() => navigate(`/settings/themes/${themeId}/component-styles/${key}`)}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Code className="h-5 w-5 text-blue-600" />
                                    <div className="font-semibold text-gray-900" role="heading" aria-level="4">{style.name || key}</div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveStyle(key);
                                    }}
                                    className="p-1 text-gray-400 hover:text-red-600 transition"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            {style.description && (
                                <div className="text-sm text-gray-600 mb-2">{style.description}</div>
                            )}
                            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                <span>Key: {key}</span>
                                <Edit className="h-3 w-3" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Documentation Link */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-3">
                    <BookOpen className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                        <div className="font-medium text-blue-900 mb-1" role="heading" aria-level="4">Component Styles Documentation</div>
                        <div className="text-sm text-blue-700 mb-2">
                            Learn how to create custom component templates with Mustache.
                        </div>
                        <a
                            href="/docs/component-styles-reference.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800 underline"
                        >
                            View Documentation →
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
});

ComponentStylesTab.displayName = 'ComponentStylesTab';

export default ComponentStylesTab;

