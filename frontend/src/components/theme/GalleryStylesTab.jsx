/**
 * Gallery Styles Tab Component
 * 
 * Mustache template + CSS editor for gallery styles.
 */

import React, { useState, useRef } from 'react';
import { Plus, Trash2, Grid3X3, Eye, Code, X } from 'lucide-react';
import { renderMustache, prepareGalleryContext } from '../../utils/mustacheRenderer';
import CodeEditorPanel from './CodeEditorPanel';

const GalleryStylesTab = ({ galleryStyles, onChange }) => {
    const [editingStyle, setEditingStyle] = useState(null);
    const [newStyleKey, setNewStyleKey] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const templateRefs = useRef({});
    const cssRefs = useRef({});

    const styles = galleryStyles || {};
    const styleEntries = Object.entries(styles);

    // Sample data for preview
    const sampleImages = [
        { url: 'https://via.placeholder.com/400x300', alt: 'Sample 1', caption: 'Gallery Image 1', width: 400, height: 300 },
        { url: 'https://via.placeholder.com/400x300', alt: 'Sample 2', caption: 'Gallery Image 2', width: 400, height: 300 },
        { url: 'https://via.placeholder.com/400x300', alt: 'Sample 3', caption: 'Gallery Image 3', width: 400, height: 300 }
    ];

    const handleAddStyle = () => {
        if (!newStyleKey.trim()) return;

        const styleKey = newStyleKey.trim().toLowerCase().replace(/\s+/g, '-');

        if (styles[styleKey]) {
            alert('A style with this name already exists');
            return;
        }

        const newStyle = {
            name: newStyleKey.trim(),
            description: '',
            template: '<div class="image-gallery">\n  {{#images}}\n    <div class="gallery-item">\n      <img src="{{url}}" alt="{{alt}}" loading="lazy">\n    </div>\n  {{/images}}\n</div>',
            css: '.image-gallery {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 1rem;\n}\n.gallery-item img {\n  width: 100%;\n  height: auto;\n}',
            variables: {}
        };

        const updatedStyles = {
            ...styles,
            [styleKey]: newStyle,
        };

        onChange(updatedStyles);
        setNewStyleKey('');
        setEditingStyle(styleKey);
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

    const handleRemoveStyle = (key) => {
        const updatedStyles = { ...styles };
        delete updatedStyles[key];
        onChange(updatedStyles);
        if (editingStyle === key) {
            setEditingStyle(null);
        }
    };

    const handlePreviewImageUpload = (file) => {
        if (!file || !editingStyle) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            handleUpdateStyle(editingStyle, { previewImage: reader.result });
        };
        reader.readAsDataURL(file);
    };

    const renderPreview = (style) => {
        try {
            const context = prepareGalleryContext(
                sampleImages,
                { showCaptions: true, enableLightbox: false },
                style.variables
            );
            const html = renderMustache(style.template, context);
            return (
                <div>
                    {style.css && <style>{style.css}</style>}
                    <div dangerouslySetInnerHTML={{ __html: html }} />
                </div>
            );
        } catch (error) {
            return <div className="text-red-600 text-sm">Preview error: {error.message}</div>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Gallery Styles</h3>
            </div>

            <div className="text-sm text-gray-600">
                Gallery styles use Mustache templates to render image galleries. Available variables:
                <code className="px-1 py-0.5 bg-gray-100 rounded text-xs mx-1">images</code>,
                <code className="px-1 py-0.5 bg-gray-100 rounded text-xs mx-1">imageCount</code>,
                <code className="px-1 py-0.5 bg-gray-100 rounded text-xs mx-1">showCaptions</code>
            </div>

            {/* Add Style Form */}
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Add Gallery Style</h4>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newStyleKey}
                        onChange={(e) => setNewStyleKey(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddStyle();
                        }}
                        placeholder="e.g., masonry-grid, photo-wall"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="button"
                        onClick={handleAddStyle}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add
                    </button>
                </div>
            </div>

            {/* Styles List */}
            {styleEntries.length > 0 ? (
                <div className="grid grid-cols-2 gap-6">
                    {/* List panel */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700">Gallery Styles</h4>
                        {styleEntries.map(([key, style]) => (
                            <div
                                key={key}
                                className={`flex items-center border rounded-lg overflow-hidden transition-colors ${editingStyle === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                                    }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => setEditingStyle(editingStyle === key ? null : key)}
                                    className="flex-1 text-left px-3 py-2 min-w-0"
                                >
                                    <div className="font-medium text-gray-900 truncate">{style.name || key}</div>
                                    {style.description && (
                                        <div className="text-xs text-gray-500 truncate">{style.description}</div>
                                    )}
                                </button>
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
                        ))}
                    </div>

                    {/* Editor panel */}
                    {editingStyle && styles[editingStyle] && (
                        <div className="space-y-4 border border-gray-200 rounded-lg p-4 bg-white">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-gray-700">Edit: {styles[editingStyle].name || editingStyle}</h4>
                                <button
                                    onClick={() => setEditingStyle(null)}
                                    className="p-1 text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Name and Description */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={styles[editingStyle].name || ''}
                                        onChange={(e) => handleUpdateStyle(editingStyle, { name: e.target.value })}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                                    <input
                                        type="text"
                                        value={styles[editingStyle].description || ''}
                                        onChange={(e) => handleUpdateStyle(editingStyle, { description: e.target.value })}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Template Editor */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Mustache Template</label>
                                <textarea
                                    ref={(el) => {
                                        if (el) templateRefs.current[editingStyle] = el;
                                    }}
                                    defaultValue={styles[editingStyle].template}
                                    onBlur={() => handleSaveFromRefs(editingStyle)}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                    rows={8}
                                />
                            </div>

                            {/* CSS Editor */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">CSS</label>
                                <textarea
                                    ref={(el) => {
                                        if (el) cssRefs.current[editingStyle] = el;
                                    }}
                                    defaultValue={styles[editingStyle].css}
                                    onBlur={() => handleSaveFromRefs(editingStyle)}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                    rows={6}
                                />
                            </div>

                            {/* Preview Image Upload */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Preview Image (for selector)
                                </label>
                                {styles[editingStyle].previewImage ? (
                                    <div className="relative inline-block">
                                        <img
                                            src={styles[editingStyle].previewImage}
                                            alt="Style preview"
                                            className="w-32 h-20 object-cover rounded border"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateStyle(editingStyle, { previewImage: null })}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors text-sm">
                                        <Grid3X3 className="w-4 h-4" />
                                        Upload Preview
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handlePreviewImageUpload(e.target.files[0])}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                    Optional: Upload a custom preview thumbnail for the style selector
                                </p>
                            </div>

                            {/* Preview */}
                            <div>
                                <button
                                    onClick={() => setShowPreview(!showPreview)}
                                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                                >
                                    <Eye className="w-4 h-4" />
                                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                                </button>
                                {showPreview && (
                                    <div className="mt-2 p-3 border border-gray-200 rounded bg-gray-50 max-h-64 overflow-auto">
                                        {renderPreview(styles[editingStyle])}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <Grid3X3 className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-500">
                        No gallery styles defined. Add a style to get started.
                    </p>
                </div>
            )}
        </div>
    );
};

export default GalleryStylesTab;

