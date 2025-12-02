/**
 * AllSlotsEditor - Accordion view of all slots
 * 
 * Displays all slots (including those not in current layout) in an accordion interface.
 * Allows users to manage widgets in any slot regardless of the current layout.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Layout, AlertCircle } from 'lucide-react';
import { layoutsApi } from '../api/layouts';
import { getAllSlotNames, categorizeSlots, formatSlotName, getSlotMetadata, getSlotsFromLayout } from '../utils/slotUtils';
import WidgetSlot from '../layouts/easy-layouts/WidgetSlot';
import PageWidgetSelectionModal from '../editors/page-editor/PageWidgetSelectionModal';

const AllSlotsEditor = ({
    widgets = {},
    onWidgetChange,
    editable = true,
    // PageEditor-specific props
    currentVersion,
    webpageData,
    pageVersionData,
    onVersionChange,
    onOpenWidgetEditor,
    context,
    // Local widget state management
    sharedComponentId,
    publishWidgetOperation,
    // Widget inheritance props
    inheritedWidgets = {},
    slotInheritanceRules = {},
    hasInheritedContent = false,
    refetchInheritance,
    // Path variables for dynamic content
    pathVariables = {},
    simulatedPath,
    onSimulatedPathChange,
}) => {
    console.log('[AllSlotsEditor] Render - sharedComponentId:', sharedComponentId, 'widgets:', widgets);
    
    // Use ref to always have current widgets
    const widgetsRef = useRef(widgets);
    useEffect(() => {
        widgetsRef.current = widgets;
        console.log('[AllSlotsEditor] widgets updated:', Object.keys(widgets).map(k => `${k}:${widgets[k]?.length || 0}`));
    }, [widgets]);
    // Fetch all slots from API
    const { data: slotsData, isLoading: isLoadingSlots } = useQuery({
        queryKey: ['allSlots'],
        queryFn: async () => {
            try {
                const response = await layoutsApi.codeLayouts.allSlots(true);
                // wrapApiCall already returns response.data, so response is the data
                return response || { slots: [], total: 0 };
            } catch (error) {
                console.error('Error fetching all slots:', error);
                return { slots: [], total: 0 };
            }
        },
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    // Get current layout name
    const currentLayoutName = pageVersionData?.codeLayout || webpageData?.codeLayout || null;

    // Fetch current layout to get its slots
    const { data: currentLayoutData } = useQuery({
        queryKey: ['layout', currentLayoutName],
        queryFn: async () => {
            if (!currentLayoutName) return null;
            try {
                const response = await layoutsApi.codeLayouts.get(currentLayoutName);
                // wrapApiCall already returns response.data, so response is the data
                return response || null;
            } catch (error) {
                console.error(`Error fetching layout ${currentLayoutName}:`, error);
                return null;
            }
        },
        enabled: !!currentLayoutName,
        staleTime: 5 * 60 * 1000,
    });

    // Get current layout slots
    const currentLayoutSlots = useMemo(() => {
        if (!currentLayoutData) return [];
        const slots = getSlotsFromLayout(currentLayoutData);
        return slots;
    }, [currentLayoutData]);

    // Accordion state - track which slots are expanded
    const [expandedSlots, setExpandedSlots] = useState(new Set());

    // Widget modal state
    const [widgetModalOpen, setWidgetModalOpen] = useState(false);
    const [selectedSlotForModal, setSelectedSlotForModal] = useState(null);
    const [selectedSlotMetadata, setSelectedSlotMetadata] = useState(null);

    // Get all slots and categorize them
    const categorizedSlots = useMemo(() => {
        if (!slotsData) {
            return {
                currentLayout: [],
                otherLayoutsWithWidgets: [],
                availableSlots: [],
                all: [],
                allWithCurrentFlag: []
            };
        }

        return categorizeSlots(
            slotsData.slots || [],
            currentLayoutSlots,
            widgets
        );
    }, [slotsData, currentLayoutSlots, widgets]);

    // Get all slot names (union of API and page data)
    const allSlotNames = useMemo(() => {
        if (!slotsData) return [];
        return getAllSlotNames(slotsData.slots || [], widgets);
    }, [slotsData, widgets]);

    // Toggle accordion item
    const toggleSlot = useCallback((slotName) => {
        setExpandedSlots(prev => {
            const next = new Set(prev);
            if (next.has(slotName)) {
                next.delete(slotName);
            } else {
                next.add(slotName);
            }
            return next;
        });
    }, []);

    // Expand all / Collapse all
    const expandAll = useCallback(() => {
        setExpandedSlots(new Set(allSlotNames));
    }, [allSlotNames]);

    const collapseAll = useCallback(() => {
        setExpandedSlots(new Set());
    }, []);

    // Handle widget actions (same as ReactLayoutRenderer)
    const handleWidgetAction = useCallback((action, slotName, widget, ...args) => {
        console.log('[AllSlotsEditor] handleWidgetAction:', action, slotName, args);
        if (!onWidgetChange) {
            console.warn('[AllSlotsEditor] No onWidgetChange');
            return;
        }

        switch (action) {
            case 'add': {
                const widgetType = args[0] || 'easy_widgets.ContentWidget';
                const insertPosition = args[1];

                // Use ref to get current widgets
                const updatedWidgets = { ...widgetsRef.current };
                const slotWidgets = [...(updatedWidgets[slotName] || [])];

                // Create default widget config
                const newWidget = {
                    id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    type: widgetType,
                    config: {},
                };

                if (insertPosition !== undefined && insertPosition !== null && insertPosition >= 0) {
                    slotWidgets.splice(insertPosition, 0, newWidget);
                } else {
                    slotWidgets.push(newWidget);
                }

                updatedWidgets[slotName] = slotWidgets;
                console.log('[AllSlotsEditor] Adding widget:', newWidget, 'to slot:', slotName);
                console.log('[AllSlotsEditor] Calling onWidgetChange with sourceId:', sharedComponentId);
                onWidgetChange(updatedWidgets, { sourceId: sharedComponentId });
                break;
            }

            case 'edit': {
                const widgetIndex = args[0];
                if (onOpenWidgetEditor) {
                    // Ensure widget has required fields for WidgetEditorPanel
                    const widgetData = {
                        ...widget,
                        id: widget.id || `widget-${widgetIndex}`,
                        type: widget.type,
                        config: widget.config || {},
                        slotName: slotName,
                        context: {
                            ...(context || {}),
                            slotName,
                            widgetId: widget.id || `widget-${widgetIndex}`,
                            mode: 'edit',
                            contextType: 'page'
                        }
                    };
                    
                    // Verify widget has type before opening editor
                    if (!widgetData.type) {
                        console.error('[AllSlotsEditor] Widget missing type field:', widget);
                        return;
                    }
                    
                    onOpenWidgetEditor(widgetData);
                }
                break;
            }

            case 'delete': {
                const deleteIndex = args[0];
                const updatedWidgets = { ...widgetsRef.current };
                const deletedWidget = updatedWidgets[slotName]?.[deleteIndex];
                
                if (updatedWidgets[slotName]) {
                    updatedWidgets[slotName] = updatedWidgets[slotName].filter((_, i) => i !== deleteIndex);
                }
                onWidgetChange(updatedWidgets, { sourceId: widget?.id });
                break;
            }

            case 'moveUp': {
                const moveUpIndex = args[0];
                if (moveUpIndex > 0) {
                    const updatedWidgets = { ...widgetsRef.current };
                    if (updatedWidgets[slotName]) {
                        const slotWidgets = [...updatedWidgets[slotName]];
                        [slotWidgets[moveUpIndex - 1], slotWidgets[moveUpIndex]] =
                            [slotWidgets[moveUpIndex], slotWidgets[moveUpIndex - 1]];
                        updatedWidgets[slotName] = slotWidgets;
                        onWidgetChange(updatedWidgets, { sourceId: widget?.id });
                    }
                }
                break;
            }

            case 'moveDown': {
                const moveDownIndex = args[0];
                const slotWidgets = widgetsRef.current[slotName] || [];
                if (moveDownIndex < slotWidgets.length - 1) {
                    const updatedWidgets = { ...widgetsRef.current };
                    if (updatedWidgets[slotName]) {
                        const slotWidgetsCopy = [...updatedWidgets[slotName]];
                        [slotWidgetsCopy[moveDownIndex], slotWidgetsCopy[moveDownIndex + 1]] =
                            [slotWidgetsCopy[moveDownIndex + 1], slotWidgetsCopy[moveDownIndex]];
                        updatedWidgets[slotName] = slotWidgetsCopy;
                        onWidgetChange(updatedWidgets, { sourceId: widget?.id });
                    }
                }
                break;
            }

            case 'configChange': {
                const widgetId = args[0];
                const newConfig = args[1];
                const updatedWidgets = { ...widgetsRef.current };
                if (updatedWidgets[slotName]) {
                    updatedWidgets[slotName] = updatedWidgets[slotName].map(w =>
                        w.id === widgetId ? { ...w, config: newConfig } : w
                    );
                }
                onWidgetChange(updatedWidgets, { sourceId: widgetId });
                break;
            }

            default:
                console.warn(`Unknown widget action: ${action}`);
        }
    }, [onWidgetChange, onOpenWidgetEditor, context, sharedComponentId]);

    // Handle show widget modal
    const handleShowWidgetModal = useCallback((slotName, metadata) => {
        setSelectedSlotForModal(slotName);
        setSelectedSlotMetadata(metadata);
        setWidgetModalOpen(true);
    }, []);

    // Handle widget selection
    const handleWidgetSelection = useCallback((widgetType) => {
        if (selectedSlotForModal) {
            handleWidgetAction('add', selectedSlotForModal, null, widgetType);
        }
        setWidgetModalOpen(false);
        setSelectedSlotForModal(null);
        setSelectedSlotMetadata(null);
    }, [selectedSlotForModal, handleWidgetAction]);

    // Handle clear slot
    const handleClearSlot = useCallback((slotName) => {
        const updatedWidgets = { ...widgetsRef.current };
        updatedWidgets[slotName] = [];
        onWidgetChange(updatedWidgets, { sourceId: sharedComponentId });
    }, [onWidgetChange, sharedComponentId]);

    // Page context for widgets
    const pageContext = useMemo(() => ({
        versionId: currentVersion?.id || pageVersionData?.versionId,
        isPublished: pageVersionData?.publicationStatus === 'published',
        onVersionChange,
        onPublishingAction: (action) => {
            if (onVersionChange) {
                switch (action) {
                    case 'publish':
                        onVersionChange('publish_current');
                        break;
                    case 'schedule':
                        onVersionChange('schedule_current');
                        break;
                    case 'unpublish':
                        onVersionChange('unpublish_current');
                        break;
                }
            }
        },
        parentComponentId: sharedComponentId,
        contextType: 'page',
        pageId: context?.pageId || webpageData?.id,
        webpageData: webpageData,
        pageVersionData: pageVersionData,
        onOpenWidgetEditor,
        pathVariables: pathVariables,
        simulatedPath: simulatedPath,
        onSimulatedPathChange: onSimulatedPathChange
    }), [currentVersion, pageVersionData, onVersionChange, sharedComponentId, context, webpageData, onOpenWidgetEditor, pathVariables, simulatedPath, onSimulatedPathChange]);

    if (isLoadingSlots) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Show all slots if we have any slots
    const hasAnySlots = categorizedSlots.allWithCurrentFlag && categorizedSlots.allWithCurrentFlag.length > 0;

    return (
        <div className="all-slots-editor w-full h-full overflow-y-auto">
            {/* Header with controls */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">All Slots</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Manage widgets in all slots, including those not in the current layout
                    </p>
                    {slotsData && (
                        <p className="text-xs text-gray-500 mt-1">
                            {slotsData.total || 0} total slots available
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={expandAll}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded transition-colors"
                    >
                        Expand All
                    </button>
                    <button
                        onClick={collapseAll}
                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded transition-colors"
                    >
                        Collapse All
                    </button>
                </div>
            </div>

            {/* Slots accordion */}
            <div className="px-6 py-4 space-y-2">
                {/* Unified list of all slots */}
                {categorizedSlots.allWithCurrentFlag && categorizedSlots.allWithCurrentFlag.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <Layout className="h-4 w-4" />
                            All Slots ({categorizedSlots.allWithCurrentFlag.length})
                        </h3>
                        <div className="space-y-2">
                            {categorizedSlots.allWithCurrentFlag.map(slot => (
                                <SlotAccordionItem
                                    key={slot.name}
                                    slot={slot}
                                    widgets={widgets}
                                    isExpanded={expandedSlots.has(slot.name)}
                                    onToggle={toggleSlot}
                                    onWidgetAction={handleWidgetAction}
                                    onShowWidgetModal={handleShowWidgetModal}
                                    onClearSlot={handleClearSlot}
                                    pageContext={pageContext}
                                    editable={editable}
                                    inheritedWidgets={inheritedWidgets}
                                    slotInheritanceRules={slotInheritanceRules}
                                    currentLayoutSlots={currentLayoutSlots}
                                    isCurrent={slot.isCurrent}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {!hasAnySlots && (
                    <div className="text-center py-12 text-gray-500">
                        <Layout className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <p>No slots available</p>
                        {slotsData && slotsData.slots && slotsData.slots.length === 0 && (
                            <p className="text-sm text-gray-400 mt-2">
                                No layouts are registered or no slots are defined in layouts.
                            </p>
                        )}
                        {!slotsData && (
                            <p className="text-sm text-gray-400 mt-2">
                                Loading slots data...
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Widget Selection Modal */}
            <PageWidgetSelectionModal
                isOpen={widgetModalOpen}
                onClose={() => {
                    setWidgetModalOpen(false);
                    setSelectedSlotForModal(null);
                    setSelectedSlotMetadata(null);
                }}
                onWidgetSelect={handleWidgetSelection}
                slotName={selectedSlotForModal}
                slotLabel={selectedSlotMetadata?.label || selectedSlotForModal}
                allowedWidgetTypes={selectedSlotMetadata?.allowedWidgetTypes}
            />
        </div>
    );
};

// Accordion item component for each slot
const SlotAccordionItem = ({
    slot,
    widgets,
    isExpanded,
    onToggle,
    onWidgetAction,
    onShowWidgetModal,
    onClearSlot,
    pageContext,
    editable,
    inheritedWidgets,
    slotInheritanceRules,
    currentLayoutSlots = [],
    isCurrent = false,
}) => {
    const slotWidgets = widgets[slot.name] || [];
    const widgetCount = slotWidgets.length;
    const slotMetadata = slot.metadata || {};
    const slotTitle = slotMetadata.title || formatSlotName(slot.name);
    const slotDescription = slotMetadata.description || '';
    
    // Get width from dimensions (prefer desktop, fallback to tablet, then mobile)
    const dimensions = slotMetadata.dimensions || {};
    const desktopWidth = dimensions.desktop?.width;
    const tabletWidth = dimensions.tablet?.width;
    const mobileWidth = dimensions.mobile?.width;
    const slotWidth = desktopWidth || tabletWidth || mobileWidth;
    
    // Convert width to max-width style (if it's a number, assume pixels)
    const maxWidthStyle = slotWidth && typeof slotWidth === 'number' 
        ? { maxWidth: `${slotWidth}px` } 
        : {};

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden" style={maxWidthStyle}>
            {/* Accordion header */}
            <button
                onClick={() => onToggle(slot.name)}
                className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
            >
                <div className="flex items-center gap-3 flex-1">
                    {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                    ) : (
                        <ChevronRight className="h-5 w-5 text-gray-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{slotTitle}</span>
                            {isCurrent ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                                    Current
                                </span>
                            ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800">
                                    Not Current
                                </span>
                            )}
                        </div>
                        {slotDescription && (
                            <p className="text-sm text-gray-600 mt-0.5 truncate">{slotDescription}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                        {slotWidth && (
                            <span className="text-xs text-gray-400 font-mono">
                                {slotWidth}px
                            </span>
                        )}
                        <span className="text-sm text-gray-500">
                            {widgetCount} widget{widgetCount !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
            </button>

            {/* Accordion content */}
            {isExpanded && (
                <div className="p-4 bg-white">
                    <WidgetSlot
                        name={slot.name}
                        label={slotTitle}
                        description={slotDescription}
                        widgets={widgets}
                        onWidgetAction={onWidgetAction}
                        editable={editable}
                        pageContext={pageContext}
                        onShowWidgetModal={onShowWidgetModal}
                        onClearSlot={onClearSlot}
                        allowedWidgetTypes={slotMetadata.allowedWidgetTypes || ['*']}
                        maxWidgets={slotMetadata.max_widgets || 20}
                        slotType="content"
                        slotMode="edit"
                        widgetPath={[]}
                        inheritedWidgets={inheritedWidgets}
                        slotInheritanceRules={slotInheritanceRules}
                    />
                </div>
            )}
        </div>
    );
};

export default AllSlotsEditor;
