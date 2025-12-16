/**
 * Gallery Styles Tab Component
 * 
 * Mustache template + CSS editor for gallery styles.
 */

import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Grid3X3, BookOpen, Edit } from 'lucide-react';
import CopyButton from './CopyButton';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';

const GalleryStylesTab = forwardRef(({ galleryStyles, onChange, onDirty, themeId }, ref) => {
    const navigate = useNavigate();
    const [editingStyle, setEditingStyle] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const templateRefs = useRef({});
    const cssRefs = useRef({});
    const { addNotification } = useGlobalNotifications();
    const queryClient = useQueryClient();
    const { updateThemeField, saveCurrentTheme, switchTheme, getState } = useUnifiedData();

    const styles = galleryStyles || {};
    const styleEntries = Object.entries(styles);

    const handleAddStyle = async () => {
        // Generate a unique key without showing a form
        const base = 'gallery-style';
        let idx = 1;
        let styleKey = base;
        while (styles[styleKey]) {
            idx += 1;
            styleKey = `${base}-${idx}`;
        }

        const newStyle = {
            name: 'New Gallery Style',
            description: '',
            template: '<div class="image-gallery">\n  {{#images}}\n    <div class="gallery-item">\n      <img src="{{url}}" alt="{{alt}}" loading="lazy">\n    </div>\n  {{/images}}\n</div>',
            css: '.image-gallery {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 1rem;\n}\n.gallery-item img {\n  width: 100%;\n  height: auto;\n}',
            variables: {},
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

        // Update parent/UDC state first
        onChange(updatedStyles);
        if (onDirty) onDirty();

        // Ensure UDC currentThemeId is set
        try {
            const udcState = getState();
            if (udcState.metadata.currentThemeId !== String(themeId)) {
                switchTheme(String(themeId));
            }
        } catch (_) {}

        // Save via UDC and then navigate to edit view
        try {
            await saveCurrentTheme();
            addNotification({ type: 'success', message: 'New gallery style created' });
            navigate(`/settings/themes/${themeId}/gallery-styles/${styleKey}`);
        } catch (_) {
            // Error already notified by onError
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

        const updatedStyles = { ...styles };
        updatedStyles[sanitizedKey] = { ...styles[oldKey] };
        delete updatedStyles[oldKey];

        onChange(updatedStyles);
        if (onDirty) onDirty();
        setEditingStyle(sanitizedKey);
        addNotification({ type: 'success', message: `Renamed to "${sanitizedKey}"` });
        return true;
    };

    const handleSaveFromRefs = (key) => {
        const templateRef = templateRefs.current[key];
        const cssRef = cssRefs.current[key];

        if (templateRef || cssRef) {
            const updates = {};
            if (templateRef) updates.template = templateRef.value;
            if (cssRef) updates.css = cssRef.value;
            handleUpdateStyle(key, updates);
        }
    };

    const flushPendingChanges = () => {
        // Iterate through all styles that have refs and save their current values to state
        const allStyleKeys = new Set([
            ...Object.keys(templateRefs.current),
            ...Object.keys(cssRefs.current)
        ]);

        allStyleKeys.forEach((key) => {
            if (styles[key]) {
                handleSaveFromRefs(key);
            }
        });
    };

    // Expose flushPendingChanges via ref
    useImperativeHandle(ref, () => ({
        flushPendingChanges
    }));

    const handleRemoveStyle = (key) => {
        const updatedStyles = { ...styles };
        delete updatedStyles[key];
        onChange(updatedStyles);
        if (onDirty) onDirty();
        if (editingStyle === key) {
            setEditingStyle(null);
        }
    };

    // Removed preview and preset insertion from list view; editing happens in dedicated page

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-lg font-semibold text-gray-900" role="heading" aria-level="3">Gallery Styles</div>
                    <div className="text-sm text-gray-500 mt-1">Define custom gallery templates using Mustache syntax</div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleAddStyle}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                        title="Create new gallery style"
                    >
                        <Plus className="w-4 h-4" />
                        Add Style
                    </button>
                    <button
                        onClick={() => window.open('/docs/gallery-styles-reference.html', '_blank')}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        title="Open Gallery Styles Documentation"
                    >
                        <BookOpen className="w-4 h-4" />
                        Documentation
                    </button>
                    <CopyButton
                        data={galleryStyles}
                        level="section"
                        section="galleryStyles"
                        label="Copy All Gallery Styles"
                        onSuccess={() => addNotification({ type: 'success', message: 'Gallery styles copied to clipboard' })}
                        onError={(error) => addNotification({ type: 'error', message: `Failed to copy: ${error}` })}
                    />
                </div>
            </div>

            <div className="text-sm text-gray-600">
                Gallery styles use Mustache templates to render image galleries. Available variables:
                <span className="px-1 py-0.5 bg-gray-100 rounded text-xs mx-1 font-mono">images</span>,
                <span className="px-1 py-0.5 bg-gray-100 rounded text-xs mx-1 font-mono">imageCount</span>,
                <span className="px-1 py-0.5 bg-gray-100 rounded text-xs mx-1 font-mono">showCaptions</span>
            </div>

            {/* Add Style Form removed: creation happens via header button and redirect */}

            {/* Styles List */}
            {styleEntries.length > 0 ? (
                <div className="grid grid-cols-2 gap-6">
                    {/* List panel */}
                    <div className="space-y-2">
                        <div className="text-sm font-semibold text-gray-700" role="heading" aria-level="4">Gallery Styles</div>
                        {styleEntries.map(([key, style]) => (
                            <div
                                key={key}
                                className={`flex items-center border rounded-lg overflow-hidden transition-colors ${editingStyle === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                                    }`}
                            >
                                <div className="flex-1 px-3 py-2 min-w-0">
                                    <div className="font-medium text-gray-900 truncate">{style.name || key}</div>
                                    {style.description && (
                                        <div className="text-xs text-gray-500 truncate">{style.description}</div>
                                    )}
                                </div>
                                <div className="flex items-center border-l border-gray-200">
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/settings/themes/${themeId}/gallery-styles/${key}`)}
                                        className="px-3 py-2 text-blue-600 hover:text-blue-700"
                                        title="Edit style"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <CopyButton
                                        data={{ [key]: style }}
                                        level="item"
                                        section="galleryStyles"
                                        itemKey={key}
                                        iconOnly
                                        size="default"
                                        className="px-3 py-2 border-l border-gray-200"
                                        onSuccess={() => addNotification({ type: 'success', message: `Gallery style "${key}" copied` })}
                                    />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveStyle(key);
                                        }}
                                        className="px-3 py-2 text-red-600 hover:text-red-700 border-l border-gray-200"
                                        title="Remove style"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Inline editor removed; use dedicated edit page instead */}
                </div>
            ) : (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <Grid3X3 className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <div className="text-gray-500">
                        No gallery styles defined. Add a style to get started.
                    </div>
                </div>
            )}

            {/* Preset Selector Modal removed in list view */}
        </div>
    );
});

GalleryStylesTab.displayName = 'GalleryStylesTab';

export default GalleryStylesTab;

