/**
 * Layout Part Editor Component
 * 
 * Edits properties for a single layout part (e.g., "header", "footer") with:
 * - Multiple breakpoint editors
 * - Collapsible UI
 * - Add/remove breakpoints (standard and custom)
 * - Part-level actions
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, Settings } from 'lucide-react';
import BreakpointPropertyEditor from './BreakpointPropertyEditor';
import CustomBreakpointsModal from './CustomBreakpointsModal';

const STANDARD_BREAKPOINTS = ['sm', 'md', 'lg', 'xl'];

const LayoutPartEditor = ({
    groupIndex,
    part,
    partProps,
    partLabel,
    availableProperties,
    group,
    colors,
    fonts,
    breakpoints,
    // State
    isExpanded,
    expandedBreakpoints,
    editMode,
    clipboard,
    copiedIndicator,
    layoutInputValues,
    // Handlers
    onToggle,
    onRemovePart,
    onAddBreakpoint,
    onRemoveBreakpoint,
    onToggleBreakpoint,
    onSetEditMode,
    onCopyBreakpoint,
    onPasteBreakpoint,
    onUpdateProperty,
    onPropertyBlur,
    onAddProperty,
    onDirty,
}) => {
    const [showCustomBreakpointsModal, setShowCustomBreakpointsModal] = useState(false);

    // Get breakpoint pixel value
    const getBreakpointValue = (bp) => {
        // Check if it's a custom breakpoint (numeric string)
        if (!isNaN(bp)) {
            return parseInt(bp);
        }
        // Standard breakpoint from theme
        return breakpoints[bp] || 0;
    };

    // Get breakpoint label for display
    const getBreakpointLabel = (bp) => {
        // Custom breakpoint (numeric)
        if (!isNaN(bp)) {
            return `${bp}px`;
        }
        // Standard breakpoint
        const labels = {
            sm: 'sm',
            md: `md (≥${breakpoints.md}px)`,
            lg: `lg (≥${breakpoints.lg}px)`,
            xl: `xl (≥${breakpoints.xl}px)`,
        };
        return labels[bp] || bp;
    };

    // Check if a breakpoint is custom
    const isCustomBreakpoint = (bp) => !isNaN(bp);

    // Get all breakpoints (standard + custom) for this part
    const getAllBreakpoints = () => {
        const customBps = Object.keys(partProps || {}).filter(bp =>
            bp !== 'default' && !STANDARD_BREAKPOINTS.includes(bp)
        );
        return [...STANDARD_BREAKPOINTS, ...customBps];
    };

    // Sort breakpoints by pixel value
    const sortBreakpoints = (bps) => {
        return [...bps].sort((a, b) => {
            // 'default' always comes first
            if (a === 'default') return -1;
            if (b === 'default') return 1;

            const aValue = getBreakpointValue(a);
            const bValue = getBreakpointValue(b);
            return aValue - bValue;
        });
    };

    // Handle updating a custom breakpoint (changing its pixel value)
    const handleUpdateBreakpoint = (oldValue, newValue) => {
        // Get the properties from the old breakpoint
        const oldProps = partProps[oldValue] || {};

        // Remove the old breakpoint and add the new one with the same properties
        onRemoveBreakpoint(oldValue);
        onAddBreakpoint(newValue);

        // If there were properties, we need to copy them over
        // This is handled by the parent component via onDirty
        if (Object.keys(oldProps).length > 0) {
            // The properties will need to be manually copied
            // This will be handled by a more sophisticated update in the parent
            setTimeout(() => {
                // Trigger a property update for each property in the old breakpoint
                Object.entries(oldProps).forEach(([prop, value]) => {
                    onUpdateProperty(groupIndex, part, newValue, prop, value, true);
                });
            }, 100);
        }
    };

    // Separate breakpoints into used vs unused (standard only)
    const usedStandardBreakpoints = STANDARD_BREAKPOINTS.filter(bp => {
        const breakpointKey = `${groupIndex}-${part}-${bp}`;
        return breakpointKey in expandedBreakpoints ||
            (bp in partProps && Object.keys(partProps[bp]).length > 0);
    });

    const unusedStandardBreakpoints = STANDARD_BREAKPOINTS.filter(bp => {
        const breakpointKey = `${groupIndex}-${part}-${bp}`;
        return !(breakpointKey in expandedBreakpoints) &&
            !(bp in partProps && Object.keys(partProps[bp]).length > 0);
    });

    // Get custom breakpoints that are in use
    const customBreakpoints = Object.keys(partProps || {}).filter(bp =>
        bp !== 'default' && !STANDARD_BREAKPOINTS.includes(bp)
    );

    // Combine and sort all used breakpoints
    const allUsedBreakpoints = sortBreakpoints([...usedStandardBreakpoints, ...customBreakpoints]);

    return (
        <div className="bg-white rounded border border-gray-200">
            {/* Part Header - Collapsible */}
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-t transition-colors">
                <button
                    type="button"
                    onClick={onToggle}
                    className="flex items-center gap-2 flex-1 text-left"
                >
                    {isExpanded ? (
                        <ChevronDown size={14} className="text-gray-600" />
                    ) : (
                        <ChevronRight size={14} className="text-gray-600" />
                    )}
                    <span className="text-xs font-semibold text-gray-700">
                        {partLabel}
                    </span>
                    {availableProperties && (
                        <span className="text-xs text-gray-500">
                            {Object.keys(availableProperties).length} {Object.keys(availableProperties).length === 1 ? 'property' : 'properties'}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemovePart();
                    }}
                    className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                    title="Remove this layout part"
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>

            {isExpanded && (
                <div className="p-3 pt-0">
                    {/* Pills for unused standard breakpoints + custom breakpoint button */}
                    <div className="flex flex-wrap gap-2 mb-2">
                        {unusedStandardBreakpoints.map(bp => (
                            <button
                                key={bp}
                                type="button"
                                onClick={() => onAddBreakpoint(bp)}
                                className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
                                title={`Add ${getBreakpointLabel(bp)}`}
                            >
                                + {getBreakpointLabel(bp)}
                            </button>
                        ))}

                        {/* Custom breakpoint button */}
                        <button
                            type="button"
                            onClick={() => setShowCustomBreakpointsModal(true)}
                            className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition-colors flex items-center gap-1"
                            title="Manage custom breakpoints"
                        >
                            <Settings size={12} />
                            Custom Breakpoints
                            {customBreakpoints.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 bg-purple-200 text-purple-800 rounded-full text-xs font-medium">
                                    {customBreakpoints.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Collapsible sections for used breakpoints (sorted) */}
                    {allUsedBreakpoints.map(breakpoint => {
                        const breakpointKey = `${groupIndex}-${part}-${breakpoint}`;
                        const isBreakpointExpanded = expandedBreakpoints[breakpointKey] === true;
                        const breakpointProps = partProps[breakpoint] || {};

                        return (
                            <BreakpointPropertyEditor
                                key={breakpoint}
                                groupIndex={groupIndex}
                                part={part}
                                breakpoint={breakpoint}
                                breakpointProps={breakpointProps}
                                breakpointLabel={getBreakpointLabel(breakpoint)}
                                availableProperties={availableProperties}
                                colors={colors}
                                fonts={fonts}
                                group={group}
                                isExpanded={isBreakpointExpanded}
                                editMode={editMode}
                                clipboard={clipboard}
                                copiedIndicator={copiedIndicator}
                                layoutInputValues={layoutInputValues}
                                onToggle={() => onToggleBreakpoint(breakpoint)}
                                onSetEditMode={onSetEditMode}
                                onCopy={(data) => onCopyBreakpoint(breakpoint, data)}
                                onPaste={() => onPasteBreakpoint(breakpoint)}
                                onRemoveBreakpoint={() => onRemoveBreakpoint(breakpoint)}
                                onUpdateProperty={onUpdateProperty}
                                onPropertyBlur={onPropertyBlur}
                                onAddProperty={onAddProperty}
                                onDirty={onDirty}
                            />
                        );
                    })}
                </div>
            )}

            {/* Custom Breakpoints Modal */}
            <CustomBreakpointsModal
                isOpen={showCustomBreakpointsModal}
                onClose={() => setShowCustomBreakpointsModal(false)}
                partProps={partProps}
                breakpoints={breakpoints}
                onAddBreakpoint={onAddBreakpoint}
                onRemoveBreakpoint={onRemoveBreakpoint}
                onUpdateBreakpoint={handleUpdateBreakpoint}
                groupIndex={groupIndex}
                part={part}
            />
        </div>
    );
};

export default LayoutPartEditor;




