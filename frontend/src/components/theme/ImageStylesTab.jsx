/**
 * Image Styles Tab Component
 * 
 * Unified editor for both gallery and carousel image styles.
 * Each style has a styleType field ('gallery' or 'carousel').
 */

import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Grid3X3, Play, BookOpen, Edit } from 'lucide-react';
import CopyButton from './CopyButton';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';

const ImageStylesTab = forwardRef(({ imageStyles, onChange, onDirty, themeId }, ref) => {
    const navigate = useNavigate();
    const [editingStyle, setEditingStyle] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const templateRefs = useRef({});
    const cssRefs = useRef({});
    const { addNotification } = useGlobalNotifications();
    const queryClient = useQueryClient();
    const { updateThemeField, saveCurrentTheme, switchTheme, getState } = useUnifiedData();

    const styles = imageStyles || {};
    const styleEntries = Object.entries(styles);

    const handleAddStyle = async () => {
        // Generate a unique key without showing a form
        const base = 'image-style';
        let idx = 1;
        let styleKey = base;
        while (styles[styleKey]) {
            idx += 1;
            styleKey = `${base}-${idx}`;
        }

        const newStyle = {
            name: 'New Image Style',
            description: '',
            styleType: 'gallery',  // Default to gallery
            template: '<div class="image-gallery">\n  {{#images}}\n    <div class="gallery-item">\n      <img src="{{url}}" alt="{{alt}}" loading="lazy">\n    </div>\n  {{/images}}\n</div>',
            css: '.image-gallery {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 1rem;\n}\n.gallery-item img {\n  width: 100%;\n  height: auto;\n}',
            variables: {},
            alpine: false,
            imgproxyConfig: {
                width: 800,
                height: 600,
                resizeType: 'fill',
                gravity: 'sm',
            },
            lightboxConfig: {
                width: 1920,
                height: 1080,
                maxWidth: 2560,
                maxHeight: 1440,
            },
        };

        const updatedStyles = { ...styles, [styleKey]: newStyle };

        // Ensure UDC currentThemeId is set
        try {
            const udcState = getState();
            if (udcState.metadata.currentThemeId !== String(themeId)) {
                switchTheme(String(themeId));
            }
        } catch (_) {}

        // Update UDC with new style
        updateThemeField('imageStyles', updatedStyles);

        // Auto-save the new style and then navigate to edit view
        try {
            await saveCurrentTheme();
            
            // Invalidate React Query cache to refresh the theme data
            queryClient.invalidateQueries(['theme', themeId]);
            
            addNotification({ type: 'success', message: 'New image style created and saved' });
            navigate(`/settings/themes/${themeId}/image-styles/${styleKey}`);
        } catch (error) {
            addNotification({ type: 'error', message: 'Failed to save new image style' });
        }
    };

    const handleUpdateStyle = (key, updates) => {
        const updatedStyles = {
            ...styles,
            [key]: {
                ...styles[key],
                ...updates,
            },
        };
        onChange(updatedStyles);
        if (onDirty) onDirty();
    };

    const handleRenameKey = (oldKey, newKey) => {
        const sanitizedKey = newKey.trim().toLowerCase().replace(/\s+/g, '-');
        
        if (!sanitizedKey) {
            addNotification({ type: 'error', message: 'Key cannot be empty' });
            return false;
        }

        if (sanitizedKey === oldKey) {
            return true; // No change needed
        }

        if (styles[sanitizedKey]) {
            addNotification({ type: 'error', message: 'A style with this key already exists' });
            return false;
        }

        // Create new object with renamed key
        const updatedStyles = {};
        for (const [k, v] of Object.entries(styles)) {
            if (k === oldKey) {
                updatedStyles[sanitizedKey] = v;
            } else {
                updatedStyles[k] = v;
            }
        }

        onChange(updatedStyles);
        if (onDirty) onDirty();
        setEditingStyle(sanitizedKey);
        return true;
    };

    const handleDeleteStyle = (key) => {
        if (!confirm(`Delete style "${styles[key]?.name || key}"?`)) return;

        const updatedStyles = { ...styles };
        delete updatedStyles[key];

        onChange(updatedStyles);
        if (onDirty) onDirty();

        if (editingStyle === key) {
            setEditingStyle(null);
        }

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
                    <h3 className="text-lg font-semibold text-gray-900">Image Styles</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Unified gallery and carousel styles with Mustache templates
                    </p>
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
                    <Grid3X3 className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-600 mb-4">No image styles defined yet</p>
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
                            onClick={() => navigate(`/settings/themes/${themeId}/image-styles/${key}`)}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    {style.styleType === 'carousel' ? (
                                        <Play className="h-5 w-5 text-purple-600" />
                                    ) : (
                                        <Grid3X3 className="h-5 w-5 text-blue-600" />
                                    )}
                                    <h4 className="font-semibold text-gray-900">{style.name || key}</h4>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteStyle(key);
                                    }}
                                    className="p-1 text-gray-400 hover:text-red-600 transition"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            {style.description && (
                                <p className="text-sm text-gray-600 mb-2">{style.description}</p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className={`px-2 py-1 rounded ${
                                    style.styleType === 'carousel' 
                                        ? 'bg-purple-100 text-purple-700' 
                                        : 'bg-blue-100 text-blue-700'
                                }`}>
                                    {style.styleType === 'carousel' ? 'Carousel' : 'Gallery'}
                                </span>
                                <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">
                                    {style.usageType === 'standard' ? 'Standard' : 
                                     style.usageType === 'inline' ? 'Inline' : 'Both'}
                                </span>
                                {style.alpine && (
                                    <span className="px-2 py-1 rounded bg-green-100 text-green-700">
                                        Alpine.js
                                    </span>
                                )}
                            </div>
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
                        <h4 className="font-medium text-blue-900 mb-1">Image Styles Documentation</h4>
                        <p className="text-sm text-blue-700 mb-2">
                            Learn how to create custom gallery and carousel templates with Mustache.
                        </p>
                        <a
                            href="/docs/image-styles-reference.html"
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

ImageStylesTab.displayName = 'ImageStylesTab';

export default ImageStylesTab;

