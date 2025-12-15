/**
 * Tag Group Editor Component
 * 
 * Edits styles for a single tag group (e.g., h1, p, a) with:
 * - Header with actions (import, copy, paste, remove)
 * - Form/CSS toggle for each variant
 * - Property form fields for form mode
 * - CSS textarea for CSS mode
 * - Support for pseudo-classes (a, a:hover, etc.)
 */

import React, { useRef } from 'react';
import { ChevronDown, ChevronRight, FileUp, Copy, Check, Clipboard, Trash2, FileText, Code } from 'lucide-react';
import PropertyFormFields from './PropertyFormFields';
import { CSS_PROPERTIES } from '../utils/propertyConfig';
import { stylesToCSS } from '../utils/cssConversion';

const TagGroupEditor = ({
    tagGroup,
    group,
    groupIndex,
    colors,
    fonts,
    // State
    isExpanded,
    editMode,
    clipboard,
    copiedIndicator,
    elementInputValues,
    // Handlers
    onToggle,
    onImport,
    onCopy,
    onPaste,
    onRemove,
    onToggleEditMode,
    onUpdateElement,
    onRemoveProperty,
    onElementPropertyBlur,
    onElementPaste,
    onOpenSelectorPopup,
    onDirty,
}) => {
    const cssTextareaRefs = useRef({});
    const baseStyles = group.elements[tagGroup.base] || {};

    // Handle CSS blur - parse and update
    const handleCSSBlur = (variant) => {
        const editModeKey = `${groupIndex}-${tagGroup.base}-${variant}`;
        const ref = cssTextareaRefs.current[editModeKey];
        if (!ref) return;

        const cssText = ref.value;
        const styles = {};
        const rules = cssText.match(/([a-z-]+)\s*:\s*([^;]+)/gi) || [];
        rules.forEach(rule => {
            const [prop, value] = rule.split(':').map(s => s.trim());
            const camelProp = prop.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            styles[camelProp] = value.replace(/;$/, '');
        });

        // Pass parsed styles to parent
        onUpdateElement(variant, styles);
    };

    return (
        <div
            className="border border-gray-200 rounded-lg overflow-hidden"
            onPaste={(e) => onElementPaste(e, tagGroup.base)}
            tabIndex={-1}
        >
            {/* Tag Header */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 border-b border-gray-200">
                {/* Only show toggle for links */}
                {tagGroup.hasGroup && (
                    <button
                        type="button"
                        onClick={onToggle}
                        className="text-gray-600 hover:text-gray-900"
                    >
                        {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                        ) : (
                            <ChevronRight className="w-4 h-4" />
                        )}
                    </button>
                )}

                <div className="flex-1">
                    <div className="font-mono text-sm font-semibold text-gray-900">{tagGroup.label}</div>
                    {tagGroup.hasGroup && (
                        <div className="text-xs text-gray-500 font-mono">{tagGroup.variants.join(', ')}</div>
                    )}
                    {/* Tag Selectors Display */}
                    {group.calculatedSelectors?.base_selectors && group.calculatedSelectors.base_selectors.length > 0 && (
                        <div className="mt-1">
                            {group.calculatedSelectors.base_selectors.length === 1 ? (
                                <div className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs font-mono rounded">
                                    {group.calculatedSelectors.base_selectors[0] || '(global)'}
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenSelectorPopup('tag', group.calculatedSelectors.base_selectors, { x: e.clientX, y: e.clientY });
                                    }}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs font-mono rounded hover:bg-blue-100 transition-colors"
                                >
                                    {group.calculatedSelectors.base_selectors.length} selectors
                                    <ChevronDown className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={() => onImport(tagGroup.base)}
                        className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                        title="Import CSS for this element"
                    >
                        <FileUp className="w-4 h-4" />
                    </button>

                    <button
                        type="button"
                        onClick={() => onCopy(tagGroup.base, baseStyles)}
                        className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                        title="Copy tag styles"
                    >
                        {copiedIndicator === `tag-${tagGroup.base}` ? (
                            <Check className="w-4 h-4 text-green-600" />
                        ) : (
                            <Copy className="w-4 h-4" />
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => onPaste(tagGroup.base)}
                        disabled={!clipboard || clipboard.type !== 'tag'}
                        className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Paste tag styles"
                    >
                        <Clipboard className="w-4 h-4" />
                    </button>

                    <button
                        type="button"
                        onClick={() => onRemove(tagGroup)}
                        className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Tag Content */}
            {isExpanded && (
                <div className="p-4 space-y-4">
                    {/* Render each variant */}
                    {tagGroup.variants.map(variant => {
                        const styles = group.elements[variant] || {};
                        const styleEntries = Object.entries(styles);
                        const editModeKey = `${groupIndex}-${tagGroup.base}-${variant}`;
                        const currentEditMode = editMode[editModeKey] || 'form';

                        return (
                            <div key={variant} className="space-y-3 border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
                                <div className="flex items-center justify-between">
                                    {variant !== tagGroup.base && (
                                        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                            {variant}
                                        </div>
                                    )}

                                    {/* Form/CSS Toggle */}
                                    <div className="flex gap-1 ml-auto">
                                        <button
                                            type="button"
                                            onClick={() => onToggleEditMode(tagGroup.base, variant)}
                                            className={`inline-flex items-center px-2 py-1 text-xs rounded transition-colors ${currentEditMode === 'form'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            <FileText className="w-3 h-3 mr-1" />
                                            Form
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onToggleEditMode(tagGroup.base, variant)}
                                            className={`inline-flex items-center px-2 py-1 text-xs rounded transition-colors ${currentEditMode === 'css'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            <Code className="w-3 h-3 mr-1" />
                                            CSS
                                        </button>
                                    </div>
                                </div>

                                {currentEditMode === 'form' ? (
                                    /* Form View */
                                    <>
                                        {/* Existing Properties */}
                                        {styleEntries.map(([property, value]) => {
                                            const key = `${groupIndex}-${variant}-${property}`;
                                            const displayValue = elementInputValues[key] !== undefined ? elementInputValues[key] : value;

                                            return (
                                                <div key={property} className="flex gap-2 items-start">
                                                    <div className="flex-1">
                                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                                            {CSS_PROPERTIES[property]?.label || property}
                                                        </label>
                                                        <PropertyFormFields
                                                            property={property}
                                                            value={displayValue}
                                                            config={CSS_PROPERTIES[property]}
                                                            groupIndex={groupIndex}
                                                            element={variant}
                                                            elementStyles={styles}
                                                            colors={colors}
                                                            fonts={fonts}
                                                            onChange={(newValue, immediate, actualProperty) => {
                                                                onUpdateElement(variant, actualProperty || property, newValue, immediate);
                                                            }}
                                                            onBlur={() => onElementPropertyBlur(variant, property)}
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => onRemoveProperty(variant, property)}
                                                        className="mt-6 p-1 text-red-600 hover:text-red-700"
                                                        title="Remove property"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            );
                                        })}

                                        {/* Add Property */}
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(CSS_PROPERTIES)
                                                .filter(([prop]) => !styles[prop])
                                                .map(([prop, config]) => (
                                                    <button
                                                        key={prop}
                                                        type="button"
                                                        onClick={() => onUpdateElement(variant, prop, '', false)}
                                                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                                                        title={`Add ${config.label}`}
                                                    >
                                                        + {config.label}
                                                    </button>
                                                ))}
                                        </div>
                                    </>
                                ) : (
                                    /* CSS View - uncontrolled with ref to prevent re-rendering */
                                    <textarea
                                        ref={(el) => {
                                            if (el) cssTextareaRefs.current[editModeKey] = el;
                                        }}
                                        defaultValue={stylesToCSS(styles)}
                                        onChange={() => {
                                            if (onDirty) onDirty();
                                        }}
                                        onBlur={() => handleCSSBlur(variant)}
                                        className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        rows={Math.max(5, Object.keys(styles).length + 2)}
                                        placeholder="property: value;"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TagGroupEditor;





