/**
 * Design Group Header Component
 * 
 * Header for a design group card with:
 * - Default radio button
 * - Group name input
 * - Targeting badge (widget/slot or CSS classes)
 * - Tag count
 * - Action buttons (toggle mode, import, copy, paste, clone, remove)
 */

import React from 'react';
import { Copy, Check, Clipboard, Trash2, FileText, Code, FileUp, Globe, Package } from 'lucide-react';
import { TAG_GROUPS } from '../utils/propertyConfig';

const DesignGroupHeader = ({
    group,
    groupIndex,
    widgetTypes = [],
    // State
    groupEditMode,
    clipboard,
    copiedIndicator,
    // Handlers
    onUpdateName,
    onToggleDefault,
    onToggleGroupEditMode,
    onImport,
    onCopy,
    onPaste,
    onClone,
    onRemove,
}) => {
    // Calculate tag count
    const existingTags = new Set(Object.keys(group.elements || {}));
    const tagGroupsInGroup = TAG_GROUPS.filter(tagGroup =>
        tagGroup.variants.some(v => existingTags.has(v))
    );

    return (
        <div className="p-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
            <div className="flex items-center gap-3 mb-2">
                {/* Default Group Radio Button */}
                <div className="flex items-center gap-1" title="Mark as default/base group">
                    <input
                        type="radio"
                        id={`default-group-${groupIndex}`}
                        name="default-group"
                        checked={group.isDefault === true}
                        onChange={() => onToggleDefault(groupIndex)}
                        className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <label
                        htmlFor={`default-group-${groupIndex}`}
                        className="text-xs text-gray-600 font-medium cursor-pointer"
                    >
                        Default
                    </label>
                </div>

                <input
                    type="text"
                    value={group.name}
                    onChange={(e) => onUpdateName(groupIndex, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Group name"
                />

                {/* Targeting Badge */}
                {group.targetingMode === 'css-classes' && group.targetCssClasses ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-md border border-purple-200">
                        <Code className="w-3 h-3" />
                        <span className="font-mono max-w-[200px] truncate" title={group.targetCssClasses}>
                            {group.targetCssClasses.split(/[\n,]/).filter(Boolean).length} selector{group.targetCssClasses.split(/[\n,]/).filter(Boolean).length !== 1 ? 's' : ''}
                        </span>
                    </div>
                ) : (group.widgetTypes?.length > 0 || group.widgetType || group.slots?.length > 0 || group.slot) ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-200">
                        <Package className="w-3 h-3" />
                        <span>
                            {(() => {
                                const types = group.widgetTypes?.length > 0 ? group.widgetTypes : (group.widgetType ? [group.widgetType] : []);
                                const slots = group.slots?.length > 0 ? group.slots : (group.slot ? [group.slot] : []);

                                let text = types.length > 0
                                    ? types.map(t => widgetTypes.find(w => w.type === t)?.name || t).join(', ')
                                    : 'Any';

                                if (slots.length > 0) {
                                    text += ` > ${slots.join(', ')}`;
                                }

                                return text;
                            })()}
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded-md border border-gray-200">
                        <Globe className="w-3 h-3" />
                        <span>Global</span>
                    </div>
                )}

                <div className="text-xs text-gray-500 font-medium">
                    {tagGroupsInGroup.length} tags
                </div>

                <div className="flex gap-1">
                    {/* Toggle between Tags and CSS mode */}
                    <button
                        type="button"
                        onClick={() => onToggleGroupEditMode(groupIndex)}
                        className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded transition-colors ${(groupEditMode[groupIndex] || 'tags') === 'css'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        title={(groupEditMode[groupIndex] || 'tags') === 'css' ? 'Switch to tag editor' : 'Edit all CSS'}
                    >
                        {(groupEditMode[groupIndex] || 'tags') === 'css' ? (
                            <>
                                <FileText className="w-3 h-3 mr-1" />
                                Tags
                            </>
                        ) : (
                            <>
                                <Code className="w-3 h-3 mr-1" />
                                CSS
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => onImport('group', groupIndex)}
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                        title="Import CSS to this group"
                    >
                        <FileUp className="w-4 h-4" />
                    </button>

                    <button
                        type="button"
                        onClick={() => onCopy(group)}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                        title="Copy entire group"
                    >
                        {copiedIndicator === 'group' ? (
                            <Check className="w-4 h-4 text-green-600" />
                        ) : (
                            <Copy className="w-4 h-4" />
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => onPaste(groupIndex)}
                        disabled={!clipboard || clipboard.type !== 'group'}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Paste styles to all tags (creates tags if needed)"
                    >
                        <Clipboard className="w-4 h-4" />
                    </button>

                    <button
                        type="button"
                        onClick={() => onClone(groupIndex)}
                        className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                        title="Clone this group"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                </div>

                <button
                    type="button"
                    onClick={() => onRemove(groupIndex)}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default DesignGroupHeader;




