/**
 * Targeting Section Component
 * 
 * Section for configuring design group targeting with:
 * - Targeting mode toggle (widget-slot vs css-classes)
 * - Widget type selection with autocomplete and pills
 * - Slot selection with autocomplete and pills
 * - CSS selector textarea for custom targeting
 * - Calculated selectors display
 */

import React from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import WidgetTypeAutocomplete from '../autocomplete/WidgetTypeAutocomplete';
import SlotAutocomplete from '../autocomplete/SlotAutocomplete';

const TargetingSection = ({
    group,
    groupIndex,
    widgetTypes = [],
    availableSlots = [],
    isLoadingTypes,
    isLoadingSlots,
    // State
    isExpanded,
    // Handlers
    onToggle,
    onUpdateTargetingMode,
    onAddWidgetType,
    onRemoveWidgetType,
    onAddSlot,
    onRemoveSlot,
    onUpdateTargetCssClasses,
}) => {
    const selectedTypes = group.widgetTypes || (group.widgetType ? [group.widgetType] : []);
    const selectedSlots = group.slots || (group.slot ? [group.slot] : []);

    return (
        <div className="border-t border-gray-200">
            <button
                type="button"
                onClick={() => onToggle(groupIndex)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
                {isExpanded ? (
                    <ChevronDown size={18} className="text-gray-600" />
                ) : (
                    <ChevronRight size={18} className="text-gray-600" />
                )}
                <span className="text-sm font-semibold text-gray-900">
                    Targeting
                </span>
            </button>

            {isExpanded && (
                <div className="px-4 pb-4">
                    {/* Targeting Mode Toggle */}
                    <div className="mb-4 flex gap-2">
                        <button
                            type="button"
                            onClick={() => onUpdateTargetingMode(groupIndex, 'widget-slot')}
                            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${(group.targetingMode || 'widget-slot') === 'widget-slot'
                                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                                }`}
                        >
                            Widget/Slot
                        </button>
                        <button
                            type="button"
                            onClick={() => onUpdateTargetingMode(groupIndex, 'css-classes')}
                            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${group.targetingMode === 'css-classes'
                                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                                }`}
                        >
                            CSS Classes
                        </button>
                    </div>

                    {(group.targetingMode || 'widget-slot') === 'widget-slot' ? (
                        <div className="grid grid-cols-2 gap-4">
                            {/* Widget Types */}
                            <div>
                                <label className="block text-xs text-gray-700 font-medium mb-1">Apply to Widget Types:</label>

                                <WidgetTypeAutocomplete
                                    availableWidgets={widgetTypes.filter(wt => !selectedTypes.includes(wt.type))}
                                    onSelect={(widgetType) => onAddWidgetType(groupIndex, widgetType)}
                                    disabled={isLoadingTypes}
                                />
                                <div className="text-xs text-gray-500 mt-1">Search and select widget types to apply this design group. Empty = all widgets</div>

                                {/* Selected widget types as pills */}
                                {selectedTypes.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {selectedTypes.map(wtType => {
                                            const widgetMeta = widgetTypes.find(wt => wt.type === wtType);
                                            return (
                                                <div
                                                    key={wtType}
                                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded border border-blue-200"
                                                >
                                                    <span>{widgetMeta?.name || wtType}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => onRemoveWidgetType(groupIndex, wtType)}
                                                        className="hover:bg-blue-200 rounded-sm p-0.5 transition-colors"
                                                        title="Remove widget type"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Slots */}
                            <div>
                                <label className="block text-xs text-gray-700 font-medium mb-1">Apply to Slots:</label>

                                <SlotAutocomplete
                                    availableSlots={availableSlots.filter(slot => !selectedSlots.includes(slot.name))}
                                    onSelect={(slotName) => onAddSlot(groupIndex, slotName)}
                                    disabled={isLoadingSlots}
                                />
                                <div className="text-xs text-gray-500 mt-1">Search and select slots to apply this design group. Empty = all slots</div>

                                {/* Selected slots as pills */}
                                {selectedSlots.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {selectedSlots.map(slotName => (
                                            <div
                                                key={slotName}
                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded border border-green-200"
                                            >
                                                <span>{slotName}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => onRemoveSlot(groupIndex, slotName)}
                                                    className="hover:bg-green-200 rounded-sm p-0.5 transition-colors"
                                                    title="Remove slot"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs text-gray-700 font-medium mb-1">Target CSS Selectors:</label>
                            <textarea
                                value={group.targetCssClasses || ''}
                                onChange={(e) => onUpdateTargetCssClasses(groupIndex, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                                placeholder=".my-custom-class, .another-class&#10;.complex > .selector&#10;#specific-id"
                            />
                            <div className="text-xs text-gray-500 mt-1">Enter CSS selectors (one per line or comma-separated). Used exactly as entered.</div>
                        </div>
                    )}

                    {/* Calculated Selectors Display */}
                    {group.calculatedSelectors && group.calculatedSelectors.base_selectors && group.calculatedSelectors.base_selectors.length > 0 && (
                        <div className="mt-3 flex items-center gap-2">
                            <span className="text-xs text-gray-500">→</span>
                            <div className="flex flex-wrap gap-1">
                                {group.calculatedSelectors.base_selectors.map((selector, idx) => (
                                    <span key={idx} className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono rounded">
                                        {selector || '(global)'}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TargetingSection;






