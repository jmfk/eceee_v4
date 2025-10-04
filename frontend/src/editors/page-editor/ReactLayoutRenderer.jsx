/**
 * ReactLayoutRenderer - Pure React layout rendering
 * 
 * This renderer uses manually defined React layout components instead of
 * complex backend/frontend protocol. Simple, flexible, and maintainable.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Layout } from 'lucide-react';
import { getLayoutComponent, getLayoutMetadata, layoutExists, LAYOUT_REGISTRY } from '../../layouts';
import { useWidgets, createDefaultWidgetConfig } from '../../hooks/useWidgets';
import PageWidgetSelectionModal from './PageWidgetSelectionModal';
import { useUnifiedData } from '../../contexts/unified-data/context/UnifiedDataContext';
import { OperationTypes } from '../../contexts/unified-data/types/operations';

const ReactLayoutRenderer = forwardRef(({
    layoutName = 'single_column',
    widgets = {},
    onWidgetChange,
    editable = true,
    // PageEditor-specific props
    currentVersion,
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
    hasInheritedContent = false
}, ref) => {

    // Get UDC context (but use shared componentId from PageEditor)
    const { useExternalChanges, publishUpdate, getState } = useUnifiedData();

    // Get version context
    const versionId = currentVersion?.id || pageVersionData?.versionId;
    const isPublished = pageVersionData?.publicationStatus === 'published';

    // Use shared componentId from PageEditor (for component group coordination)
    const componentId = sharedComponentId || `react-layout-renderer-${versionId || 'unknown'}`;
    const contextType = 'page';

    // Subscribe to UDC state changes from external sources only
    useExternalChanges(componentId, (state) => {
        // External changes will be handled by PageEditor
        // ReactLayoutRenderer will get updates via props (widgets)
    })

    // Use shared widget hook
    const {
        addWidget,
        updateWidget,
        deleteWidget
    } = useWidgets(widgets);

    // Widget modal state
    const [widgetModalOpen, setWidgetModalOpen] = useState(false);
    const [selectedSlotForModal, setSelectedSlotForModal] = useState(null);

    // Page context for widgets - includes all necessary context data
    const pageContext = useMemo(() => ({
        versionId,
        isPublished,
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
        // Add missing context for widgets
        parentComponentId: componentId,
        contextType: 'page',
        pageId: context?.pageId,
        // Pass onOpenWidgetEditor for nested widgets
        onOpenWidgetEditor
    }), [versionId, isPublished, onVersionChange, componentId, context?.pageId, onOpenWidgetEditor]);

    // Handle widget actions
    const handleWidgetAction = useCallback(async (action, slotName, widget, ...args) => {
        switch (action) {
            case 'add': {
                const widgetType = args[0] || 'default_widgets.ContentWidget';

                const widgetConfig = createDefaultWidgetConfig(widgetType);
                const newWidget = addWidget(slotName, widgetType, widgetConfig);


                // 1. IMMEDIATE: Fast local update via parent (PageEditor)
                const updatedWidgets = {
                    ...widgets,
                    [slotName]: [...(widgets[slotName] || []), newWidget]
                };

                if (onWidgetChange) {
                    onWidgetChange(updatedWidgets, { sourceId: componentId });
                }

                // 2. ASYNC: Publish to UDC for external sync (other users/components)
                if (publishWidgetOperation) {
                    await publishWidgetOperation(OperationTypes.ADD_WIDGET, {
                        id: newWidget.id,
                        type: newWidget.type,
                        config: newWidget.config,
                        slot: slotName,
                        order: (widgets[slotName]?.length || 0)
                    });
                } else {
                    // Fallback to direct UDC publishing
                    await publishUpdate(componentId, OperationTypes.ADD_WIDGET, {
                        id: newWidget.id,
                        type: newWidget.type,
                        config: newWidget.config,
                        slot: slotName,
                        contextType: contextType,
                        order: (widgets[slotName]?.length || 0)
                    });
                }

                break;
            }

            case 'edit': {
                const widgetIndex = args[0];
                if (onOpenWidgetEditor) {
                    onOpenWidgetEditor({
                        ...widget,
                        slotName,
                        context: {
                            ...(context || {}),
                            slotName,
                            widgetId: widget.id,
                            mode: 'edit',
                            contextType
                        }
                    });
                }
                break;
            }

            case 'delete': {
                const deleteIndex = args[0];

                const updatedWidgetsDelete = { ...widgets };
                if (updatedWidgetsDelete[slotName]) {
                    updatedWidgetsDelete[slotName] = updatedWidgetsDelete[slotName].filter((_, i) => i !== deleteIndex);
                }

                if (onWidgetChange) {
                    onWidgetChange(updatedWidgetsDelete, { sourceId: widget.id });
                }


                // Publish to Unified Data Context
                await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, {
                    id: widget.id,
                    contextType: contextType
                });
                break;
            }

            case 'moveUp': {
                const moveUpIndex = args[0];
                if (moveUpIndex > 0) {
                    // First: Update local state for immediate UI feedback
                    const updatedWidgetsUp = { ...widgets };
                    if (updatedWidgetsUp[slotName]) {
                        const slotWidgets = [...updatedWidgetsUp[slotName]];
                        [slotWidgets[moveUpIndex - 1], slotWidgets[moveUpIndex]] =
                            [slotWidgets[moveUpIndex], slotWidgets[moveUpIndex - 1]];
                        updatedWidgetsUp[slotName] = slotWidgets;
                    }

                    if (onWidgetChange) {
                        onWidgetChange(updatedWidgetsUp, { sourceId: widget.id });
                    }

                    // Publish to Unified Data Context
                    await publishUpdate(componentId, OperationTypes.MOVE_WIDGET, {
                        //id: widget.id,
                        contextType: contextType,
                        widgets: updatedWidgetsUp
                    });
                }
                break;
            }

            case 'moveDown': {
                const moveDownIndex = args[0];
                const slotWidgets = widgets[slotName] || [];
                if (moveDownIndex < slotWidgets.length - 1) {
                    const updatedWidgetsDown = { ...widgets };
                    if (updatedWidgetsDown[slotName]) {
                        const slotWidgetsCopy = [...updatedWidgetsDown[slotName]];
                        [slotWidgetsCopy[moveDownIndex], slotWidgetsCopy[moveDownIndex + 1]] =
                            [slotWidgetsCopy[moveDownIndex + 1], slotWidgetsCopy[moveDownIndex]];
                        updatedWidgetsDown[slotName] = slotWidgetsCopy;
                    }

                    if (onWidgetChange) {
                        onWidgetChange(updatedWidgetsDown, { sourceId: widget.id });
                    }


                    // Publish to Unified Data Context
                    await publishUpdate(componentId, OperationTypes.MOVE_WIDGET, {
                        //id: widget.id,
                        contextType: contextType,
                        widgets: updatedWidgetsDown
                    });
                }
                break;
            }

            case 'configChange': {
                const newConfig = args[0];
                const updatedWidgetsConfig = { ...widgets };
                if (updatedWidgetsConfig[slotName]) {
                    updatedWidgetsConfig[slotName] = updatedWidgetsConfig[slotName].map(w =>
                        w.id === widget.id ? { ...w, config: newConfig } : w
                    );
                }

                if (onWidgetChange) {
                    onWidgetChange(updatedWidgetsConfig, { sourceId: widget.id });
                }


                // Publish to Unified Data Context
                await publishUpdate(componentId, OperationTypes.UPDATE_WIDGET_CONFIG, {
                    id: widget.id,
                    slotName,
                    contextType: contextType,
                    config: newConfig
                });
                break;
            }

            default:
                break;
        }
    }, [widgets, onWidgetChange, onOpenWidgetEditor, addWidget, publishUpdate, componentId, versionId, isPublished, onVersionChange]);

    // Widget modal handlers
    const handleShowWidgetModal = useCallback((slotName) => {
        setSelectedSlotForModal(slotName);
        setWidgetModalOpen(true);
    }, []);

    const handleCloseWidgetModal = useCallback(() => {
        setWidgetModalOpen(false);
        setSelectedSlotForModal(null);
    }, []);

    const handleWidgetSelection = useCallback((widgetType) => {
        if (selectedSlotForModal) {
            handleWidgetAction('add', selectedSlotForModal, null, widgetType);
        }
        handleCloseWidgetModal();
    }, [selectedSlotForModal, handleWidgetAction, handleCloseWidgetModal]);

    // Clear slot handler
    const handleClearSlot = useCallback(async (slotName) => {

        const updatedWidgets = { ...widgets };
        updatedWidgets[slotName] = [];

        if (onWidgetChange) {
            onWidgetChange(updatedWidgets, { sourceId: `slot-${slotName}` });
        }


        // Publish removals to Unified Data Context for all widgets in this slot
        const existingWidgetsInSlot = widgets[slotName] || [];
        for (const w of existingWidgetsInSlot) {
            await publishUpdate(componentId, OperationTypes.REMOVE_WIDGET, { id: w.id });
        }
    }, [widgets, onWidgetChange, publishUpdate, componentId, versionId, isPublished]);

    // Get layout component
    const LayoutComponent = getLayoutComponent(layoutName);

    if (!LayoutComponent) {
        return (
            <div className="layout-error bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <Layout className="h-12 w-12 mx-auto mb-4 text-red-400" />
                <h3 className="text-lg font-medium text-red-800 mb-2">Layout Not Found</h3>
                <p className="text-red-600">Layout "{layoutName}" is not available</p>
                <div className="mt-4 text-sm text-red-500">
                    Available layouts: {Object.keys(LAYOUT_REGISTRY).join(', ')}
                </div>
            </div>
        );
    }

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        saveWidgets: async () => {
            try {
                // Publish save event to Unified Data Context
                await publishUpdate(componentId, OperationTypes.SAVED_TO_SERVER, {
                    versionId,
                    isPublished,
                    widgets
                });

                return {
                    success: true,
                    data: widgets,
                    module: 'react-layout-renderer',
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                console.error('ReactLayoutRenderer: Save widgets failed', error);
                throw error;
            }
        },

        enableAutoSave: (enabled, interval = 10000) => {
            // Auto-save functionality can be implemented here if needed
        },

        // Layout-specific methods
        getLayoutName: () => layoutName,
        getLayoutMetadata: () => getLayoutMetadata(layoutName),
        getCurrentWidgets: () => widgets,
    }), [widgets, layoutName, versionId, isPublished]);

    // Render the layout component
    // Make this div act like an iframe - break out of parent constraints and use full viewport width
    return (
        <div className="react-layout-renderer w-full h-full">
            <LayoutComponent
                widgets={widgets}
                onWidgetAction={handleWidgetAction}
                editable={editable}
                pageContext={pageContext}
                onShowWidgetModal={handleShowWidgetModal}
                onClearSlot={handleClearSlot}
                widgetPath={[]} // Initialize empty path for top-level
                // Widget inheritance
                inheritedWidgets={inheritedWidgets}
                slotInheritanceRules={slotInheritanceRules}
            />

            {/* Widget Selection Modal */}
            <PageWidgetSelectionModal
                isOpen={widgetModalOpen}
                onClose={handleCloseWidgetModal}
                onWidgetSelect={handleWidgetSelection}
                slotName={selectedSlotForModal}
                slotLabel={selectedSlotForModal}
            />
        </div>
    );
});

ReactLayoutRenderer.displayName = 'ReactLayoutRenderer';

export default ReactLayoutRenderer;
