/**
 * Layout Part Editor Component
 * 
 * Edits properties for a single layout part (e.g., "header", "footer") with:
 * - Multiple breakpoint editors
 * - Collapsible UI
 * - Add/remove breakpoints
 * - Part-level actions
 */

import React from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import BreakpointPropertyEditor from './BreakpointPropertyEditor';

const BREAKPOINTS = ['sm', 'md', 'lg', 'xl'];

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
    onOpenSelectorPopup,
    onDirty,
}) => {
    // Get breakpoint label for display
    const getBreakpointLabel = (bp) => {
        const labels = {
            sm: 'sm',
            md: `md (≥${breakpoints.md}px)`,
            lg: `lg (≥${breakpoints.lg}px)`,
            xl: `xl (≥${breakpoints.xl}px)`,
        };
        return labels[bp] || bp;
    };

    // Separate breakpoints into used vs unused
    const usedBreakpoints = BREAKPOINTS.filter(bp => {
        const breakpointKey = `${groupIndex}-${part}-${bp}`;
        // Breakpoint is visible if explicitly added to UI OR has actual data
        return breakpointKey in expandedBreakpoints ||
            (bp in partProps && Object.keys(partProps[bp]).length > 0);
    });

    const unusedBreakpoints = BREAKPOINTS.filter(bp => {
        const breakpointKey = `${groupIndex}-${part}-${bp}`;
        // Breakpoint is pill if not added to UI and has no data
        return !(breakpointKey in expandedBreakpoints) &&
            !(bp in partProps && Object.keys(partProps[bp]).length > 0);
    });

    // Get part-specific selectors for display
    const partSelectors = group.calculatedSelectors?.layout_part_selectors?.[part];

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
                    {partSelectors && (
                        <div className="flex flex-wrap gap-1">
                            {partSelectors.map((selector, idx) => (
                                <span key={idx} className="inline-block px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-mono rounded">
                                    {selector}
                                </span>
                            ))}
                        </div>
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
                    {/* Part-specific selectors */}
                    {partSelectors && (
                        <div className="mb-2 flex items-center gap-2">
                            <span className="text-xs text-gray-500">→</span>
                            <div className="flex flex-wrap gap-1">
                                {partSelectors.map((selector, idx) => (
                                    <span key={idx} className="inline-block px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-mono rounded">
                                        {selector}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pills for unused breakpoints */}
                    {unusedBreakpoints.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {unusedBreakpoints.map(bp => (
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
                        </div>
                    )}

                    {/* Collapsible sections for used breakpoints */}
                    {usedBreakpoints.map(breakpoint => {
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
                                onOpenSelectorPopup={onOpenSelectorPopup}
                                onDirty={onDirty}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LayoutPartEditor;




