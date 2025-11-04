/**
 * Component Styles Tab Component
 * 
 * HTML template + CSS editor for component styles (renamed from Image Styles).
 */

import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Code, Eye, BookOpen, Edit, Sparkles } from 'lucide-react';
import { createEmptyComponentStyle } from '../../utils/themeUtils';
import { renderMustache, prepareComponentContext } from '../../utils/mustacheRenderer';
import CopyButton from './CopyButton';
import { useGlobalNotifications } from '../../contexts/GlobalNotificationContext';
import PresetSelector from './PresetSelector';
import { smartInsert } from '../../utils/codeInsertion';
import StyleAIHelper from './StyleAIHelper';

const ComponentStylesTab = forwardRef(({ componentStyles, onChange, onDirty, themeId }, ref) => {
    const navigate = useNavigate();
    const [editingStyle, setEditingStyle] = useState(null);
    const [newStyleKey, setNewStyleKey] = useState('');
    const [showPresetSelector, setShowPresetSelector] = useState(false);
    const templateRefs = useRef({});
    const cssRefs = useRef({});
    const { addNotification } = useGlobalNotifications();

    const styles = componentStyles || {};
    const styleEntries = Object.entries(styles);

    const handleAddStyle = () => {
        if (!newStyleKey.trim()) return;

        const styleKey = newStyleKey.trim().toLowerCase().replace(/\s+/g, '-');

        if (styles[styleKey]) {
            alert('A style with this name already exists');
            return;
        }

        const newStyle = createEmptyComponentStyle(styleKey);
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
            presetCategory: 'component'
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Component Styles</h3>
                    <p className="text-sm text-gray-500 mt-1">Define custom component templates using Mustache syntax</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => window.open('/docs/component-styles-reference.html', '_blank')}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        title="Open Component Styles Documentation"
                    >
                        <BookOpen className="w-4 h-4" />
                        Documentation
                    </button>
                    <CopyButton
                        data={componentStyles}
                        level="section"
                        section="componentStyles"
                        label="Copy All Component Styles"
                        onSuccess={() => addNotification({ type: 'success', message: 'Component styles copied to clipboard' })}
                        onError={(error) => addNotification({ type: 'error', message: `Failed to copy: ${error}` })}
                    />
                </div>
            </div>

            <div className="text-sm text-gray-600">
                Component styles use Mustache templates with optional CSS. They can be used for widgets
                (like Navigation) and inline objects (like images in WYSIWYG content).
                <div className="mt-2">
                    <strong>Available variables:</strong>
                    <ul className="list-disc list-inside mt-1">
                        <li><code className="px-1 py-0.5 bg-gray-100 rounded text-xs">{'{{content}}'}</code> - Generic content (for inline objects)</li>
                        <li><code className="px-1 py-0.5 bg-gray-100 rounded text-xs">{'{{#items}}...{{/items}}'}</code> - Navigation items (for Navigation widget)</li>
                        <li><code className="px-1 py-0.5 bg-gray-100 rounded text-xs">{'{{label}}, {{url}}, {{targetBlank}}'}</code> - Item properties (within items loop)</li>
                    </ul>
                </div>
            </div>

            {/* Add Style Form */}
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Add Component Style</h4>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newStyleKey}
                        onChange={(e) => setNewStyleKey(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddStyle();
                        }}
                        placeholder="e.g., card-style, rounded-image"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="button"
                        onClick={handleAddStyle}
                        disabled={!newStyleKey.trim()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                    </button>
                </div>
            </div>

            {/* Styles List */}
            {styleEntries.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Styles sidebar */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Your Styles</h4>
                        {styleEntries.map(([key, style]) => (
                            <div
                                key={key}
                                className={`relative flex items-stretch border rounded-lg transition-colors ${editingStyle === key
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
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
                                        onClick={() => navigate(`/settings/themes/${themeId}/component-styles/${key}`)}
                                        className="px-3 py-2 text-blue-600 hover:text-blue-700"
                                        title="Edit style"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <CopyButton
                                        data={{ [key]: style }}
                                        level="item"
                                        section="componentStyles"
                                        itemKey={key}
                                        iconOnly
                                        size="default"
                                        className="px-3 py-2"
                                        onSuccess={() => addNotification({ type: 'success', message: `Component style "${key}" copied` })}
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
                        <ComponentStyleEditor
                            themeId={themeId}
                            styleKey={editingStyle}
                            style={styles[editingStyle]}
                            onUpdate={(updates) => handleUpdateStyle(editingStyle, updates)}
                            onSave={() => handleSaveFromRefs(editingStyle)}
                            onDirty={onDirty}
                            onShowPresetSelector={() => setShowPresetSelector(true)}
                            onRenameKey={handleRenameKey}
                            templateRef={(el) => {
                                if (el) templateRefs.current[editingStyle] = el;
                            }}
                            cssRef={(el) => {
                                if (el) cssRefs.current[editingStyle] = el;
                            }}
                        />
                    )}
                </div>
            ) : (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <Code className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-500">
                        No component styles defined. Add a style to get started.
                    </p>
                </div>
            )}

            {/* Preset Selector Modal */}
            {showPresetSelector && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                        <PresetSelector
                            categories={['component']}
                            onInsert={handlePresetInsert}
                            onClose={() => setShowPresetSelector(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
});

// Component Style Editor
const ComponentStyleEditor = ({ themeId, styleKey, style, onUpdate, onSave, onDirty, onShowPresetSelector, onRenameKey, templateRef, cssRef }) => {
    const [showPreview, setShowPreview] = useState(false);
    const [previewHTML, setPreviewHTML] = useState('');

    const updatePreview = () => {
        const template = templateRef ? document.querySelector(`[data-template-key="${styleKey}"]`)?.value : style.template;
        const context = prepareComponentContext(
            '<div style="padding: 1rem; background: #f3f4f6; border: 2px dashed #d1d5db; text-align: center;">Content Placeholder</div>'
        );
        const html = renderMustache(template || '', context);
        setPreviewHTML(html);
    };

    const handleShowPreview = () => {
        updatePreview();
        setShowPreview(!showPreview);
    };

    const handleTextareaChange = () => {
        if (onDirty) {
            onDirty();
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900">{styleKey}</h4>
                <div className="flex items-center gap-2">
                    {onShowPresetSelector && (
                        <button
                            onClick={onShowPresetSelector}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                            title="Insert preset template"
                        >
                            <Sparkles className="w-3 h-3" />
                            Insert Preset
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleShowPreview}
                        className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                    >
                        <Eye className="w-3 h-3 mr-1" />
                        {showPreview ? 'Hide' : 'Show'} Preview
                    </button>
                </div>
            </div>

            {/* Key */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Key (Technical Identifier)
                </label>
                <input
                    type="text"
                    defaultValue={styleKey}
                    onBlur={(e) => {
                        if (e.target.value !== styleKey) {
                            const success = onRenameKey(styleKey, e.target.value);
                            if (!success) {
                                e.target.value = styleKey; // Reset on failure
                            }
                        }
                    }}
                    placeholder="unique-key-name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                    Lowercase letters, numbers, and hyphens only
                </p>
            </div>

            {/* Name */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name
                </label>
                <input
                    type="text"
                    value={style.name || ''}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    placeholder="Friendly name for this style"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Description */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                </label>
                <input
                    type="text"
                    value={style.description || ''}
                    onChange={(e) => onUpdate({ description: e.target.value })}
                    placeholder="Brief description of this style"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* AI Helper */}
            <StyleAIHelper
                themeId={themeId}
                styleType="component"
                currentStyle={style}
                onUpdateStyle={onUpdate}
            />

            {/* Template - Uncontrolled with ref */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mustache Template
                    <span className="ml-2 text-xs text-gray-500">
                        Use <code className="px-1 py-0.5 bg-gray-100 rounded">{'{{content}}'}</code> or <code className="px-1 py-0.5 bg-gray-100 rounded">{'{{#items}}...{{/items}}'}</code>
                    </span>
                </label>
                <textarea
                    ref={templateRef}
                    data-template-key={styleKey}
                    defaultValue={style.template || ''}
                    onChange={handleTextareaChange}
                    onBlur={onSave}
                    placeholder='<nav><ul>{{#items}}<li><a href="{{url}}">{{label}}</a></li>{{/items}}</ul></nav>'
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm bg-gray-50"
                />
            </div>

            {/* CSS - Uncontrolled with ref */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional CSS (Optional)
                </label>
                <textarea
                    ref={cssRef}
                    defaultValue={style.css || ''}
                    onChange={handleTextareaChange}
                    onBlur={onSave}
                    placeholder=".my-style:hover { box-shadow: 0 10px 15px rgba(0,0,0,0.1); }"
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm bg-gray-50"
                />
            </div>

            {/* Preview */}
            {showPreview && (
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Preview
                    </label>
                    <div className="border border-gray-300 rounded-lg p-4 bg-white">
                        <style>{style.css || ''}</style>
                        <div dangerouslySetInnerHTML={{ __html: previewHTML }} />
                    </div>
                </div>
            )}
        </div>
    );
};

ComponentStylesTab.displayName = 'ComponentStylesTab';

export default ComponentStylesTab;

