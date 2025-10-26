/**
 * Typography Tab Component
 * 
 * Grouped HTML element styling with widget_type/slot targeting.
 */

import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Eye, EyeOff, FileJson, FileCode } from 'lucide-react';
import { createTypographyGroup, getWidgetTypes, getSupportedHTMLElements, resolveColor, generateTypographyCSS } from '../../utils/themeUtils';
import TypographyPreview from './TypographyPreview';
import ComboboxSelect from './ComboboxSelect';
import NumericInput from './NumericInput';
import CodeEditorPanel from './CodeEditorPanel';

const TypographyTab = ({ typography, colors, fonts, onChange }) => {
    const [expandedGroups, setExpandedGroups] = useState(new Set([0]));

    const groups = typography?.groups || [];

    // Get base font from theme fonts or use default
    const getBaseFont = () => {
        if (fonts?.google_fonts && fonts.google_fonts.length > 0) {
            return `${fonts.google_fonts[0].family}, sans-serif`;
        }
        return 'Inter, sans-serif';
    };

    const handleAddGroup = () => {
        const baseFont = getBaseFont();
        const newGroup = createTypographyGroup(`Group ${groups.length + 1}`, baseFont);
        const updatedTypography = {
            ...typography,
            groups: [...groups, newGroup],
        };
        onChange(updatedTypography);
        // Expand the new group
        setExpandedGroups(new Set([...expandedGroups, groups.length]));
    };

    const handleUpdateGroup = (index, updates) => {
        const updatedGroups = [...groups];
        updatedGroups[index] = { ...updatedGroups[index], ...updates };
        onChange({ ...typography, groups: updatedGroups });
    };

    const handleRemoveGroup = (index) => {
        const updatedGroups = groups.filter((_, i) => i !== index);
        onChange({ ...typography, groups: updatedGroups });
        // Remove from expanded set
        const newExpanded = new Set(expandedGroups);
        newExpanded.delete(index);
        setExpandedGroups(newExpanded);
    };

    const toggleGroup = (index) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedGroups(newExpanded);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Typography Groups</h3>
                <button
                    type="button"
                    onClick={handleAddGroup}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Group
                </button>
            </div>

            <div className="text-sm text-gray-600">
                Typography groups define styles for HTML elements. Groups can target specific widget types or slots.
                Groups are applied in order, with more specific groups overriding general ones.
            </div>

            {/* Split layout: Groups on left, Preview on right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Groups List */}
                <div className="space-y-3">
                    {groups.length > 0 ? (
                        groups.map((group, index) => (
                            <TypographyGroup
                                key={index}
                                group={group}
                                index={index}
                                isExpanded={expandedGroups.has(index)}
                                colors={colors}
                                fonts={fonts}
                                onToggle={() => toggleGroup(index)}
                                onUpdate={(updates) => handleUpdateGroup(index, updates)}
                                onRemove={() => handleRemoveGroup(index)}
                            />
                        ))
                    ) : (
                        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                            <p className="text-gray-500">
                                No typography groups defined. Click "Add Group" to create default typography.
                            </p>
                        </div>
                    )}
                </div>

                {/* Preview - Always visible */}
                <div className="lg:sticky lg:top-6 lg:self-start">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Live Preview</h4>
                        <TypographyPreview typography={typography} colors={colors} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// Typography Group Component
const TypographyGroup = ({ group, index, isExpanded, colors, fonts, onToggle, onUpdate, onRemove }) => {
    const [viewMode, setViewMode] = useState('visual'); // 'visual', 'json', 'css'
    const widgetTypes = getWidgetTypes();
    const htmlElements = getSupportedHTMLElements();

    // Build font options from theme fonts
    const fontOptions = [];
    if (fonts?.google_fonts) {
        fonts.google_fonts.forEach(font => {
            fontOptions.push({
                value: `${font.family}, sans-serif`,
                label: font.family,
                family: font.family
            });
        });
    }
    // Add common system fonts
    fontOptions.push(
        { value: 'system-ui, sans-serif', label: 'System UI', family: 'system-ui' },
        { value: 'monospace', label: 'Monospace', family: 'monospace' },
        { value: 'serif', label: 'Serif', family: 'serif' }
    );

    // Build color options from theme colors
    const colorOptions = Object.keys(colors || {}).map(colorName => ({
        value: colorName,
        label: colorName,
        color: colors[colorName]
    }));

    const handleElementUpdate = (elementTag, property, value) => {
        const updatedElements = {
            ...group.elements,
            [elementTag]: {
                ...group.elements[elementTag],
                [property]: value,
            },
        };
        onUpdate({ elements: updatedElements });
    };

    const handleRemoveElement = (elementTag) => {
        const updatedElements = { ...group.elements };
        delete updatedElements[elementTag];
        onUpdate({ elements: updatedElements });
    };

    const hasTargeting = group.widget_type || group.widgetType || group.slot;

    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Group Header */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onToggle}
                        className="flex items-center gap-2 flex-1 text-left"
                    >
                        {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="font-semibold text-gray-900">{group.name}</span>
                        {hasTargeting && (
                            <span className="text-xs text-gray-500">
                                (Targeted)
                            </span>
                        )}
                    </button>

                    <div className="flex items-center gap-2">
                        {isExpanded && (
                            <div className="inline-flex rounded-md shadow-sm mr-2" role="group">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('visual')}
                                    className={`px-2 py-1 text-xs font-medium border ${viewMode === 'visual'
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        } rounded-l-md`}
                                >
                                    <Eye className="w-3 h-3 inline" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('json')}
                                    className={`px-2 py-1 text-xs font-medium border-t border-b ${viewMode === 'json'
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <FileJson className="w-3 h-3 inline" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('css')}
                                    className={`px-2 py-1 text-xs font-medium border ${viewMode === 'css'
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        } rounded-r-md`}
                                >
                                    <FileCode className="w-3 h-3 inline" />
                                </button>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={onRemove}
                            className="text-red-600 hover:text-red-700"
                            title="Remove group"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Group Content */}
            {isExpanded && (
                <div className="p-4 space-y-4">
                    {/* JSON/CSS Editor Modes */}
                    {viewMode === 'json' && (
                        <CodeEditorPanel
                            data={group}
                            onChange={(updated) => onUpdate(updated)}
                            mode="json"
                            label="Group Configuration JSON"
                        />
                    )}

                    {viewMode === 'css' && (
                        <CodeEditorPanel
                            data={group}
                            mode="css"
                            label="Generated CSS Preview"
                            readOnly={true}
                            generateCSS={(data) => {
                                const tempTypography = { groups: [data] };
                                return generateTypographyCSS(tempTypography, colors, '.theme-content', data.widget_type, data.slot);
                            }}
                        />
                    )}

                    {/* Visual Editor Mode */}
                    {viewMode === 'visual' && (
                        <>
                            {/* Group Settings */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Group Name
                                    </label>
                                    <input
                                        type="text"
                                        value={group.name}
                                        onChange={(e) => onUpdate({ name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Widget Type (Optional)
                                    </label>
                                    <select
                                        value={group.widget_type || group.widgetType || ''}
                                        onChange={(e) => onUpdate({ widget_type: e.target.value || null })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {widgetTypes.map((wt) => (
                                            <option key={wt.value || 'null'} value={wt.value || ''}>
                                                {wt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Slot (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={group.slot || ''}
                                        onChange={(e) => onUpdate({ slot: e.target.value || null })}
                                        placeholder="e.g., header, footer"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Element Editors */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-gray-900">HTML Elements</h4>
                                    <ElementSelector
                                        onSelect={(elementTag) => {
                                            if (!group.elements[elementTag]) {
                                                handleElementUpdate(elementTag, 'font', '');
                                            }
                                        }}
                                        existingElements={Object.keys(group.elements || {})}
                                    />
                                </div>

                                {Object.keys(group.elements || {}).length > 0 ? (
                                    <div className="space-y-3">
                                        {Object.keys(group.elements).map((elementTag) => (
                                            <ElementEditor
                                                key={elementTag}
                                                elementTag={elementTag}
                                                styles={group.elements[elementTag]}
                                                colors={colors}
                                                fonts={fonts}
                                                onUpdate={(property, value) => handleElementUpdate(elementTag, property, value)}
                                                onRemove={() => handleRemoveElement(elementTag)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-500 text-center py-4 border border-dashed border-gray-300 rounded">
                                        No elements defined. Click "Add Element" to start styling.
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// Element Selector Component
const ElementSelector = ({ onSelect, existingElements }) => {
    const [showMenu, setShowMenu] = useState(false);
    const htmlElements = getSupportedHTMLElements();
    const availableElements = htmlElements.filter(el => !existingElements.includes(el.tag));

    if (availableElements.length === 0) {
        return null;
    }

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
                <Plus className="w-3 h-3 mr-1" />
                Add Element
            </button>

            {showMenu && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20 max-h-60 overflow-y-auto">
                        {availableElements.map((el) => (
                            <button
                                key={el.tag}
                                type="button"
                                onClick={() => {
                                    onSelect(el.tag);
                                    setShowMenu(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                            >
                                <div className="font-medium">&lt;{el.tag}&gt;</div>
                                <div className="text-xs text-gray-500">{el.label}</div>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// Element Editor Component
const ElementEditor = ({ elementTag, styles, colors, fonts, onUpdate, onRemove }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const elementInfo = getSupportedHTMLElements().find(el => el.tag === elementTag);
    const isListElement = elementTag === 'ul' || elementTag === 'ol';

    // Build font options from theme fonts
    const fontOptions = [];
    if (fonts?.google_fonts) {
        fonts.google_fonts.forEach(font => {
            fontOptions.push({
                value: `${font.family}, sans-serif`,
                label: font.family,
            });
        });
    }
    // Add system fonts
    fontOptions.push(
        { value: 'system-ui, sans-serif', label: 'System UI' },
        { value: 'monospace', label: 'Monospace' },
        { value: 'serif', label: 'Serif' }
    );

    // Build color options
    const colorOptions = Object.keys(colors || {}).map(colorName => ({
        value: colorName,
        label: colorName,
        color: colors[colorName]
    }));

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2 flex-1 text-left"
                >
                    {isExpanded ? (
                        <ChevronDown className="w-3 h-3 text-gray-500" />
                    ) : (
                        <ChevronRight className="w-3 h-3 text-gray-500" />
                    )}
                    <span className="text-sm font-medium text-gray-900">
                        &lt;{elementTag}&gt; - {elementInfo?.label || elementTag}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={onRemove}
                    className="text-red-600 hover:text-red-700"
                    title="Remove element"
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>

            {isExpanded && (
                <div className="p-3 bg-white space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        {/* Font */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Font Family
                            </label>
                            <ComboboxSelect
                                value={styles.font || ''}
                                onChange={(value) => onUpdate('font', value)}
                                options={fontOptions}
                                placeholder="Select font"
                                allowCustom={true}
                                renderOption={(option, { active }) => (
                                    <span className={`block truncate ${active ? 'font-medium' : 'font-normal'}`}>
                                        {option.label}
                                    </span>
                                )}
                            />
                        </div>

                        {/* Size */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Size
                            </label>
                            <NumericInput
                                value={styles.size || ''}
                                onChange={(value) => onUpdate('size', value)}
                                units={['rem', 'px', 'em', '%']}
                                keywords={['inherit', 'initial', 'unset']}
                                placeholder="1"
                                step={0.125}
                            />
                        </div>

                        {/* Line Height */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Line Height
                            </label>
                            <NumericInput
                                value={styles.lineHeight || ''}
                                onChange={(value) => onUpdate('lineHeight', value)}
                                units={['rem', 'px', 'em']}
                                keywords={['normal', 'inherit']}
                                placeholder="1.6"
                                step={0.1}
                                allowUnitless={true}
                            />
                        </div>

                        {/* Font Weight */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Font Weight
                            </label>
                            <select
                                value={styles.fontWeight || ''}
                                onChange={(e) => onUpdate('fontWeight', e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="">Default</option>
                                <option value="300">Light (300)</option>
                                <option value="400">Normal (400)</option>
                                <option value="500">Medium (500)</option>
                                <option value="600">Semibold (600)</option>
                                <option value="700">Bold (700)</option>
                                <option value="800">Extra Bold (800)</option>
                                <option value="900">Black (900)</option>
                            </select>
                        </div>

                        {/* Color */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Color
                            </label>
                            <ComboboxSelect
                                value={styles.color || ''}
                                onChange={(value) => onUpdate('color', value)}
                                options={colorOptions}
                                placeholder="Select color"
                                renderOption={(option, { active }) => (
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-4 h-4 rounded border border-gray-300"
                                            style={{ backgroundColor: option.color }}
                                        />
                                        <span className={`block truncate ${active ? 'font-medium' : 'font-normal'}`}>
                                            {option.label}
                                        </span>
                                    </div>
                                )}
                            />
                        </div>

                        {/* Letter Spacing */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Letter Spacing
                            </label>
                            <NumericInput
                                value={styles.letterSpacing || ''}
                                onChange={(value) => onUpdate('letterSpacing', value)}
                                units={['rem', 'px', 'em']}
                                keywords={['normal', 'inherit']}
                                placeholder="0"
                                step={0.05}
                            />
                        </div>

                        {/* Margin Bottom */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Margin Bottom
                            </label>
                            <NumericInput
                                value={styles.marginBottom || ''}
                                onChange={(value) => onUpdate('marginBottom', value)}
                                units={['rem', 'px', 'em', '%']}
                                keywords={['auto', 'inherit']}
                                placeholder="1"
                                step={0.25}
                            />
                        </div>

                        {/* Margin Top */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Margin Top
                            </label>
                            <NumericInput
                                value={styles.marginTop || ''}
                                onChange={(value) => onUpdate('marginTop', value)}
                                units={['rem', 'px', 'em', '%']}
                                keywords={['auto', 'inherit']}
                                placeholder="0"
                                step={0.25}
                            />
                        </div>

                        {/* List-specific properties */}
                        {isListElement && (
                            <>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Bullet Type
                                    </label>
                                    <select
                                        value={styles.bulletType || ''}
                                        onChange={(e) => onUpdate('bulletType', e.target.value)}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="">Default</option>
                                        {elementTag === 'ul' ? (
                                            <>
                                                <option value="disc">Disc</option>
                                                <option value="circle">Circle</option>
                                                <option value="square">Square</option>
                                                <option value="none">None</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="decimal">Decimal</option>
                                                <option value="lower-alpha">Lower Alpha</option>
                                                <option value="upper-alpha">Upper Alpha</option>
                                                <option value="lower-roman">Lower Roman</option>
                                                <option value="upper-roman">Upper Roman</option>
                                                <option value="none">None</option>
                                            </>
                                        )}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Padding Left
                                    </label>
                                    <NumericInput
                                        value={styles.paddingLeft || ''}
                                        onChange={(value) => onUpdate('paddingLeft', value)}
                                        units={['rem', 'px', 'em', '%']}
                                        keywords={['inherit']}
                                        placeholder="1.5"
                                        step={0.25}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TypographyTab;

