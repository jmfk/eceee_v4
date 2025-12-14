/**
 * Breakpoint Property Editor Component
 * 
 * Edits properties for a single breakpoint (sm/md/lg/xl) with:
 * - Form mode with themed selectors (colors, fonts, numeric)
 * - CSS mode with textarea
 * - Copy/paste functionality
 * - Add property pills for unused properties
 */

import React, { useRef } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, Clipboard, Trash2, FileText, Code } from 'lucide-react';
import ColorSelector from '../../form-fields/ColorSelector';
import FontSelector from '../../form-fields/FontSelector';
import NumericInput from '../../form-fields/NumericInput';
import { cssPropertyToKebab } from '../utils/cssConversion';

const BreakpointPropertyEditor = ({
    groupIndex,
    part,
    breakpoint,
    breakpointProps,
    breakpointLabel,
    availableProperties,
    colors,
    fonts,
    group,
    // State
    isExpanded,
    editMode,
    clipboard,
    copiedIndicator,
    layoutInputValues,
    // Handlers
    onToggle,
    onSetEditMode,
    onCopy,
    onPaste,
    onRemoveBreakpoint,
    onUpdateProperty,
    onPropertyBlur,
    onAddProperty,
    onOpenSelectorPopup,
    onDirty,
}) => {
    const cssTextareaRef = useRef(null);
    const modeKey = `${groupIndex}-${part}-${breakpoint}`;
    const currentMode = editMode[modeKey] || 'form';

    // Convert breakpoint properties to CSS
    const breakpointToCSS = () => {
        if (!breakpointProps || Object.keys(breakpointProps).length === 0) return '';
        let css = '';
        for (const [prop, value] of Object.entries(breakpointProps)) {
            const cssProp = cssPropertyToKebab(prop);
            css += `${cssProp}: ${value};\n`;
        }
        return css;
    };

    // Handle CSS textarea blur
    const handleCSSBlur = (e) => {
        try {
            const cssText = e.target.value;
            const properties = {};
            const propMatches = cssText.matchAll(/\s*([a-z-]+)\s*:\s*([^;]+);/g);
            for (const match of propMatches) {
                const cssProp = match[1];
                const value = match[2].trim();
                const camelProp = cssProp.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
                properties[camelProp] = value;
            }

            // Pass parsed properties back to parent for updating
            onPaste(properties);
        } catch (error) {
            console.error('Failed to parse CSS:', error);
        }
    };

    // Get part-specific selectors for display
    const partSelectors = group.calculatedSelectors?.layout_part_selectors?.[part];

    const usedProperties = Object.keys(breakpointProps);
    const unusedProperties = Object.entries(availableProperties)
        .filter(([prop]) => !usedProperties.includes(prop));

    return (
        <div className="mb-3 last:mb-0 border border-gray-200 rounded-lg bg-white shadow-sm">
            {/* Breakpoint Header - Collapsible */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-t-lg border-b border-gray-200">
                <button
                    type="button"
                    onClick={onToggle}
                    className="flex items-center gap-2 flex-1 text-left"
                >
                    {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-600" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                    )}
                    <div className="flex-1">
                        <div className="font-mono text-sm font-semibold text-gray-900">
                            {breakpointLabel}
                        </div>
                        {/* Breakpoint Selectors Display */}
                        {partSelectors && partSelectors.length > 0 && (
                            <div className="mt-1">
                                {partSelectors.length === 1 ? (
                                    <div className="inline-block px-1.5 py-0.5 bg-purple-50 text-purple-600 text-xs font-mono rounded">
                                        {partSelectors[0]}
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenSelectorPopup('breakpoint', partSelectors, { x: e.clientX, y: e.clientY });
                                        }}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 text-purple-600 text-xs font-mono rounded hover:bg-purple-100 transition-colors"
                                    >
                                        {partSelectors.length} selectors
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </button>
                <div className="flex gap-1">
                    {/* Copy/Paste Buttons */}
                    <button
                        type="button"
                        onClick={() => onCopy(breakpointProps)}
                        className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                        title={`Copy ${part} ${breakpoint} properties`}
                    >
                        {copiedIndicator === `layout-${modeKey}` ? (
                            <Check className="w-4 h-4 text-green-600" />
                        ) : (
                            <Copy className="w-4 h-4" />
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onPaste}
                        disabled={!clipboard || clipboard.type !== 'layoutBreakpoint'}
                        className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={`Paste ${clipboard?.part || ''} ${clipboard?.breakpoint || ''} properties`}
                    >
                        <Clipboard className="w-4 h-4" />
                    </button>

                    {/* Form/CSS Toggle */}
                    <button
                        type="button"
                        onClick={() => onSetEditMode(modeKey, 'form')}
                        className={`inline-flex items-center px-2 py-1 text-xs rounded transition-colors ${currentMode === 'form'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        <FileText className="w-3 h-3 mr-1" />
                        Form
                    </button>
                    <button
                        type="button"
                        onClick={() => onSetEditMode(modeKey, 'css')}
                        className={`inline-flex items-center px-2 py-1 text-xs rounded transition-colors ${currentMode === 'css'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        <Code className="w-3 h-3 mr-1" />
                        CSS
                    </button>

                    {/* Delete Breakpoint Button */}
                    <button
                        type="button"
                        onClick={onRemoveBreakpoint}
                        className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        title="Remove this breakpoint"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {isExpanded && (currentMode === 'css' ? (
                <div className="p-2">
                    <textarea
                        ref={cssTextareaRef}
                        defaultValue={breakpointToCSS()}
                        onChange={() => {
                            if (onDirty) onDirty();
                        }}
                        onBlur={handleCSSBlur}
                        className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        rows={5}
                        placeholder="width: 100%;&#10;padding: 1rem;&#10;gap: 0.5rem;"
                    />
                </div>
            ) : (
                <>
                    {/* Property forms for used properties */}
                    {usedProperties.length > 0 && (
                        <div className="p-4 space-y-3">
                            {Object.entries(availableProperties)
                                .filter(([prop]) => usedProperties.includes(prop))
                                .map(([prop, config]) => {
                                    const key = `${groupIndex}-${part}-${breakpoint}-${prop}`;
                                    const storedValue = breakpointProps[prop] || '';
                                    const value = layoutInputValues[key] !== undefined ? layoutInputValues[key] : storedValue;

                                    return (
                                        <div key={prop} className="flex gap-2 items-start">
                                            <div className="flex-1">
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    {config.label}
                                                </label>
                                                {config.type === 'color' ? (
                                                    <ColorSelector
                                                        value={value}
                                                        onChange={(newValue) => onUpdateProperty(groupIndex, part, breakpoint, prop, newValue || null, true)}
                                                        colors={colors}
                                                        className="w-full"
                                                    />
                                                ) : config.type === 'font' ? (
                                                    <FontSelector
                                                        fontFamily={value}
                                                        fontWeight={breakpointProps.fontWeight}
                                                        onFontFamilyChange={(newValue) => onUpdateProperty(groupIndex, part, breakpoint, prop, newValue || null, true)}
                                                        onFontWeightChange={(newWeight) => onUpdateProperty(groupIndex, part, breakpoint, 'fontWeight', newWeight || null, true)}
                                                        fonts={fonts}
                                                        className="w-full"
                                                    />
                                                ) : config.type === 'numeric' ? (
                                                    <NumericInput
                                                        value={value}
                                                        onChange={(newValue) => onUpdateProperty(groupIndex, part, breakpoint, prop, newValue || null)}
                                                        onBlur={() => onPropertyBlur(groupIndex, part, breakpoint, prop)}
                                                        property={prop}
                                                        className="w-full"
                                                    />
                                                ) : config.type === 'select' ? (
                                                    <select
                                                        value={value}
                                                        onChange={(e) => onUpdateProperty(groupIndex, part, breakpoint, prop, e.target.value || null, true)}
                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="">None</option>
                                                        {config.options?.map(opt => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={value}
                                                        onChange={(e) => onUpdateProperty(groupIndex, part, breakpoint, prop, e.target.value || null)}
                                                        onBlur={() => onPropertyBlur(groupIndex, part, breakpoint, prop)}
                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder={config.placeholder}
                                                    />
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => onUpdateProperty(groupIndex, part, breakpoint, prop, null, true)}
                                                className="mt-6 p-1 text-red-600 hover:text-red-700"
                                                title="Remove property"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                        </div>
                    )}

                    {/* Add Property Pills */}
                    {unusedProperties.length > 0 && (
                        <div className="flex flex-wrap gap-2 px-4 pb-4">
                            {unusedProperties.map(([prop, config]) => (
                                <button
                                    key={prop}
                                    type="button"
                                    onClick={() => onAddProperty(groupIndex, part, breakpoint, prop)}
                                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                                    title={`Add ${config.label}`}
                                >
                                    + {config.label}
                                </button>
                            ))}
                        </div>
                    )}
                </>
            ))}
        </div>
    );
};

export default BreakpointPropertyEditor;


