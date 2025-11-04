/**
 * Carousel Styles Tab Component
 * 
 * Mustache template + CSS editor for carousel styles with Alpine.js support.
 */

import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Play, Eye, Code, X, BookOpen, Edit, Sparkles } from 'lucide-react';
import { renderMustache, prepareCarouselContext } from '../../utils/mustacheRenderer';
import CopyButton from './CopyButton';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import PresetSelector from './PresetSelector';
import { smartInsert } from '../../utils/codeInsertion';
import StyleAIHelper from './StyleAIHelper';

const CarouselStylesTab = forwardRef(({ carouselStyles, onChange, onDirty, themeId }, ref) => {
    const navigate = useNavigate();
    const [editingStyle, setEditingStyle] = useState(null);
    const [newStyleKey, setNewStyleKey] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [showPresetSelector, setShowPresetSelector] = useState(false);
    const templateRefs = useRef({});
    const cssRefs = useRef({});
    const { addNotification } = useGlobalNotifications();

    const styles = carouselStyles || {};
    const styleEntries = Object.entries(styles);

    // Sample data for preview
    const sampleImages = [
        { url: 'https://via.placeholder.com/800x400', alt: 'Slide 1', caption: 'Carousel Slide 1', width: 800, height: 400 },
        { url: 'https://via.placeholder.com/800x400', alt: 'Slide 2', caption: 'Carousel Slide 2', width: 800, height: 400 },
        { url: 'https://via.placeholder.com/800x400', alt: 'Slide 3', caption: 'Carousel Slide 3', width: 800, height: 400 }
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
            template: '<div class="image-carousel" x-data="{ current: 0, total: {{imageCount}} }">\n  <div class="carousel-track" :style="\'transform: translateX(-\' + (current * 100) + \'%)\'">  \n    {{#images}}\n      <div class="carousel-slide">\n        <img src="{{url}}" alt="{{alt}}" loading="lazy">\n      </div>\n    {{/images}}\n  </div>\n  {{#multipleImages}}\n  <button @click="current = (current - 1 + total) % total" class="carousel-prev">‹</button>\n  <button @click="current = (current + 1) % total" class="carousel-next">›</button>\n  {{/multipleImages}}\n</div>',
            css: '.image-carousel {\n  position: relative;\n  overflow: hidden;\n}\n.carousel-track {\n  display: flex;\n  transition: transform 0.5s ease;\n}\n.carousel-slide {\n  min-width: 100%;\n}\n.carousel-slide img {\n  width: 100%;\n  height: auto;\n}\n.carousel-prev, .carousel-next {\n  position: absolute;\n  top: 50%;\n  transform: translateY(-50%);\n  background: rgba(255,255,255,0.9);\n  border: none;\n  padding: 1rem;\n  cursor: pointer;\n}\n.carousel-prev { left: 1rem; }\n.carousel-next { right: 1rem; }',
            variables: {},
            alpine: true,
            imgproxyConfig: {
                width: 1200,
                height: 400,
                resizeType: 'fill',
                gravity: 'sm'
            }
        };

        const updatedStyles = {
            ...styles,
            [styleKey]: newStyle,
        };

        onChange(updatedStyles);
        if (onDirty) onDirty();
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

    const handlePreviewImageUpload = (file) => {
        if (!file || !editingStyle) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            handleUpdateStyle(editingStyle, { previewImage: reader.result });
        };
        reader.readAsDataURL(file);
    };

    const handlePresetInsert = (template, css, mode) => {
        if (!editingStyle) return;

        const currentTemplate = templateRefs.current[editingStyle]?.value || styles[editingStyle]?.template || '';
        const currentCSS = cssRefs.current[editingStyle]?.value || styles[editingStyle]?.css || '';

        const { template: newTemplate, css: newCSS } = smartInsert({
            existingTemplate: currentTemplate,
            existingCSS: currentCSS,
            newTemplate: template,
            newCSS: css,
            mode,
            presetCategory: 'carousel'
        });

        // Update refs directly
        if (templateRefs.current[editingStyle]) {
            templateRefs.current[editingStyle].value = newTemplate;
        }
        if (cssRefs.current[editingStyle]) {
            cssRefs.current[editingStyle].value = newCSS;
        }

        // Update state
        handleUpdateStyle(editingStyle, {
            template: newTemplate,
            css: newCSS
        });

        setShowPresetSelector(false);
        addNotification({ type: 'success', message: 'Preset inserted successfully' });
    };

    const renderPreview = (style) => {
        try {
            const context = prepareCarouselContext(
                sampleImages,
                { showCaptions: false, autoPlay: false },
                style.variables
            );
            const html = renderMustache(style.template, context);
            return (
                <div>
                    {style.css && <style>{style.css}</style>}
                    <div dangerouslySetInnerHTML={{ __html: html }} />
                    <p className="text-xs text-amber-600 mt-2">
                        Note: Alpine.js interactions won't work in preview
                    </p>
                </div>
            );
        } catch (error) {
            return <div className="text-red-600 text-sm">Preview error: {error.message}</div>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Carousel Styles</h3>
                    <p className="text-sm text-gray-500 mt-1">Define custom carousel templates using Mustache syntax</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => window.open('/docs/carousel-styles-reference.html', '_blank')}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        title="Open Carousel Styles Documentation"
                    >
                        <BookOpen className="w-4 h-4" />
                        Documentation
                    </button>
                    <CopyButton
                        data={carouselStyles}
                        level="section"
                        section="carouselStyles"
                        label="Copy All Carousel Styles"
                        onSuccess={() => addNotification({ type: 'success', message: 'Carousel styles copied to clipboard' })}
                        onError={(error) => addNotification({ type: 'error', message: `Failed to copy: ${error}` })}
                    />
                </div>
            </div>

            <div className="text-sm text-gray-600">
                Carousel styles use Mustache templates with Alpine.js for interactivity. Available variables:
                <code className="px-1 py-0.5 bg-gray-100 rounded text-xs mx-1">images</code>,
                <code className="px-1 py-0.5 bg-gray-100 rounded text-xs mx-1">imageCount</code>,
                <code className="px-1 py-0.5 bg-gray-100 rounded text-xs mx-1">multipleImages</code>
            </div>

            {/* Add Style Form */}
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Add Carousel Style</h4>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newStyleKey}
                        onChange={(e) => setNewStyleKey(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddStyle();
                        }}
                        placeholder="e.g., fade-carousel, card-slider"
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
                        <h4 className="text-sm font-semibold text-gray-700">Carousel Styles</h4>
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
                                        onClick={() => navigate(`/settings/themes/${themeId}/carousel-styles/${key}`)}
                                        className="px-3 py-2 text-blue-600 hover:text-blue-700"
                                        title="Edit style"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <CopyButton
                                        data={{ [key]: style }}
                                        level="item"
                                        section="carouselStyles"
                                        itemKey={key}
                                        iconOnly
                                        size="default"
                                        className="px-3 py-2 border-l border-gray-200"
                                        onSuccess={() => addNotification({ type: 'success', message: `Carousel style "${key}" copied` })}
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

                    {/* Editor panel */}
                    {editingStyle && styles[editingStyle] && (
                        <div className="space-y-4 border border-gray-200 rounded-lg p-4 bg-white">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-gray-700">Edit: {styles[editingStyle].name || editingStyle}</h4>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowPresetSelector(true)}
                                        className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                                        title="Insert preset template"
                                    >
                                        <Sparkles className="w-3 h-3" />
                                        Insert Preset
                                    </button>
                                    <button
                                        onClick={() => setEditingStyle(null)}
                                        className="p-1 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Key, Name and Description */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Key (Technical Identifier)</label>
                                    <input
                                        type="text"
                                        defaultValue={editingStyle}
                                        onBlur={(e) => {
                                            if (e.target.value !== editingStyle) {
                                                const success = handleRenameKey(editingStyle, e.target.value);
                                                if (!success) {
                                                    e.target.value = editingStyle; // Reset on failure
                                                }
                                            }
                                        }}
                                        placeholder="unique-key-name"
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Lowercase letters, numbers, and hyphens only
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Display Name</label>
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

                            {/* AI Helper */}
                            <StyleAIHelper
                                themeId={themeId}
                                styleType="carousel"
                                currentStyle={styles[editingStyle]}
                                onUpdateStyle={(updates) => handleUpdateStyle(editingStyle, updates)}
                            />

                            {/* Imgproxy Configuration */}
                            <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-3">
                                <h5 className="text-xs font-semibold text-gray-700">Image Processing (imgproxy)</h5>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Width (px)</label>
                                        <input
                                            type="number"
                                            value={styles[editingStyle].imgproxyConfig?.width || ''}
                                            onChange={(e) => handleUpdateStyle(editingStyle, {
                                                imgproxyConfig: {
                                                    ...(styles[editingStyle].imgproxyConfig || {}),
                                                    width: parseInt(e.target.value) || null
                                                }
                                            })}
                                            placeholder="1200"
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Height (px)</label>
                                        <input
                                            type="number"
                                            value={styles[editingStyle].imgproxyConfig?.height || ''}
                                            onChange={(e) => handleUpdateStyle(editingStyle, {
                                                imgproxyConfig: {
                                                    ...(styles[editingStyle].imgproxyConfig || {}),
                                                    height: parseInt(e.target.value) || null
                                                }
                                            })}
                                            placeholder="400"
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Max Width (px)</label>
                                        <input
                                            type="number"
                                            value={styles[editingStyle].imgproxyConfig?.maxWidth || ''}
                                            onChange={(e) => handleUpdateStyle(editingStyle, {
                                                imgproxyConfig: {
                                                    ...(styles[editingStyle].imgproxyConfig || {}),
                                                    maxWidth: parseInt(e.target.value) || null
                                                }
                                            })}
                                            placeholder="2400"
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Prevents upscaling beyond original</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Max Height (px)</label>
                                        <input
                                            type="number"
                                            value={styles[editingStyle].imgproxyConfig?.maxHeight || ''}
                                            onChange={(e) => handleUpdateStyle(editingStyle, {
                                                imgproxyConfig: {
                                                    ...(styles[editingStyle].imgproxyConfig || {}),
                                                    maxHeight: parseInt(e.target.value) || null
                                                }
                                            })}
                                            placeholder="800"
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Prevents upscaling beyond original</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Resize Type</label>
                                        <select
                                            value={styles[editingStyle].imgproxyConfig?.resizeType || 'fill'}
                                            onChange={(e) => handleUpdateStyle(editingStyle, {
                                                imgproxyConfig: {
                                                    ...(styles[editingStyle].imgproxyConfig || {}),
                                                    resizeType: e.target.value
                                                }
                                            })}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="fit">Fit</option>
                                            <option value="fill">Fill</option>
                                            <option value="crop">Crop</option>
                                            <option value="force">Force</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Gravity</label>
                                        <select
                                            value={styles[editingStyle].imgproxyConfig?.gravity || 'sm'}
                                            onChange={(e) => handleUpdateStyle(editingStyle, {
                                                imgproxyConfig: {
                                                    ...(styles[editingStyle].imgproxyConfig || {}),
                                                    gravity: e.target.value
                                                }
                                            })}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="sm">Smart</option>
                                            <option value="face">Face</option>
                                            <option value="ce">Center</option>
                                            <option value="no">North (Top)</option>
                                            <option value="so">South (Bottom)</option>
                                            <option value="ea">East (Right)</option>
                                            <option value="we">West (Left)</option>
                                            <option value="noea">North-East</option>
                                            <option value="nowe">North-West</option>
                                            <option value="soea">South-East</option>
                                            <option value="sowe">South-West</option>
                                        </select>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-600">
                                    Controls how carousel images are processed and cropped. Widget instances can override these settings.
                                </p>
                            </div>

                            {/* Template Editor */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Mustache Template (with Alpine.js)
                                </label>
                                <textarea
                                    ref={(el) => {
                                        if (el) templateRefs.current[editingStyle] = el;
                                    }}
                                    defaultValue={styles[editingStyle].template}
                                    onChange={() => { if (onDirty) onDirty(); }}
                                    onBlur={() => handleSaveFromRefs(editingStyle)}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                    rows={10}
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
                                    onChange={() => { if (onDirty) onDirty(); }}
                                    onBlur={() => handleSaveFromRefs(editingStyle)}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                    rows={8}
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
                                        <Play className="w-4 h-4" />
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
                    <Play className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-500">
                        No carousel styles defined. Add a style to get started.
                    </p>
                </div>
            )}

            {/* Preset Selector Modal */}
            {showPresetSelector && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                        <PresetSelector
                            categories={['carousel', 'buttons']}
                            onInsert={handlePresetInsert}
                            onClose={() => setShowPresetSelector(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
});

CarouselStylesTab.displayName = 'CarouselStylesTab';

export default CarouselStylesTab;

