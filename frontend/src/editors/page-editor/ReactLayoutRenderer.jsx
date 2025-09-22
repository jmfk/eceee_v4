/**
 * ReactLayoutRenderer - Pure React layout rendering
 * 
 * This renderer uses manually defined React layout components instead of
 * complex backend/frontend protocol. Simple, flexible, and maintainable.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Layout } from 'lucide-react';
import { getLayoutComponent, getLayoutMetadata, layoutExists, LAYOUT_REGISTRY } from './layouts/LayoutRegistry';
// Removed PageEditorEventSystem - now using unified data operations
import { useUnifiedData } from '../../contexts/unified-data/v2/context/UnifiedDataContext';
import { useWidgetSync } from '../../contexts/unified-data/v2/hooks/useWidgetSync';
import { useLayoutOperations } from '../../contexts/unified-data/v2/hooks/useLayoutOperations';
import { useWidgetOperations } from '../../contexts/unified-data/v2/hooks/useWidgetOperations';
import { createDefaultWidgetConfig } from '../../hooks/useWidgets';
import PageWidgetSelectionModal from './PageWidgetSelectionModal';

const ReactLayoutRenderer = forwardRef(({
    layoutName = 'single_column',
    widgets = {},
    onWidgetChange,
    editable = true,
    onDirtyChange,
    // PageEditor-specific props
    currentVersion,
    pageVersionData,
    onVersionChange,
    onOpenWidgetEditor
}, ref) => {

    // Use v2 context hooks for state management
    const { state } = useUnifiedData();
    const {
        syncWidgets,
        isContextPrimary,
        syncWidgetsFromContext,
        syncWidgetsToContext
    } = useWidgetSync(
        currentVersion?.page_id?.toString() ||
        pageVersionData?.pageId?.toString() ||
        ''
    );

    // Use specialized operation hooks
    const {
        addWidget,
        removeWidget,
        moveWidget,
        updateWidgetConfig,
        validateWidget
    } = useWidgetOperations();

    const {
        updateLayout,
        validateLayout,
        getLayoutState
    } = useLayoutOperations();

    // Get version context
    const versionId = currentVersion?.id || pageVersionData?.versionId;
    const isPublished = pageVersionData?.publicationStatus === 'published';

    // Widget management: Local state for actual data, UnifiedDataContext for isDirty tracking

    // Widget modal state
    const [widgetModalOpen, setWidgetModalOpen] = useState(false);
    const [selectedSlotForModal, setSelectedSlotForModal] = useState(null);

    // Page context for widgets
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
        }
    }), [versionId, isPublished, onVersionChange]);


    // Handle widget actions using v2 context
    const handleWidgetAction = useCallback(async (action, slotName, widget, ...args) => {
        try {
            switch (action) {
                case 'add': {
                    const widgetType = args[0] || 'core_widgets.ContentWidget';
                    const widgetConfig = createDefaultWidgetConfig(widgetType);

                    // Validate widget before adding
                    const isValid = await validateWidget({ type: widgetType, config: widgetConfig });
                    if (!isValid) {
                        throw new Error('Invalid widget configuration');
                    }

                    // Add widget using v2 context
                    const newWidget = await addWidget({
                        type: widgetType,
                        config: widgetConfig,
                        slotName,
                        order: (widgets[slotName] || []).length
                    });

                    // Update local state
                    const updatedWidgets = { ...widgets };
                    if (!updatedWidgets[slotName]) updatedWidgets[slotName] = [];
                    updatedWidgets[slotName].push(newWidget);

                    // Notify parent
                    if (onWidgetChange) {
                        onWidgetChange(updatedWidgets);
                    }
                    if (onDirtyChange) {
                        onDirtyChange(true, `added widget to ${slotName}`);
                    }
                    break;
                }

                case 'edit':
                    if (onOpenWidgetEditor) {
                        onOpenWidgetEditor({ ...widget, slotName });
                    }
                    break;

                case 'delete': {
                    // Remove widget using v2 context
                    await removeWidget(widget.id);

                    // Update local state
                    const updatedWidgets = { ...widgets };
                    if (updatedWidgets[slotName]) {
                        updatedWidgets[slotName] = updatedWidgets[slotName].filter(w => w.id !== widget.id);
                    }

                    // Notify parent
                    if (onWidgetChange) {
                        onWidgetChange(updatedWidgets);
                    }
                    if (onDirtyChange) {
                        onDirtyChange(true, `removed widget from ${slotName}`);
                    }
                    break;
                }

                case 'moveUp': {
                    const moveUpIndex = args[0];
                    if (moveUpIndex > 0) {
                        // Move widget using v2 context
                        await moveWidget(widget.id, slotName, moveUpIndex - 1);

                        // Update local state
                        const updatedWidgets = { ...widgets };
                        if (updatedWidgets[slotName]) {
                            const slotWidgets = [...updatedWidgets[slotName]];
                            [slotWidgets[moveUpIndex - 1], slotWidgets[moveUpIndex]] =
                                [slotWidgets[moveUpIndex], slotWidgets[moveUpIndex - 1]];
                            updatedWidgets[slotName] = slotWidgets;
                        }

                        // Notify parent
                        if (onWidgetChange) {
                            onWidgetChange(updatedWidgets);
                        }
                        if (onDirtyChange) {
                            onDirtyChange(true, `moved widget up in ${slotName}`);
                        }
                    }
                    break;
                }

                case 'moveDown': {
                    const moveDownIndex = args[0];
                    const slotWidgets = widgets[slotName] || [];
                    if (moveDownIndex < slotWidgets.length - 1) {
                        // Move widget using v2 context
                        await moveWidget(widget.id, slotName, moveDownIndex + 1);

                        // Update local state
                        const updatedWidgets = { ...widgets };
                        if (updatedWidgets[slotName]) {
                            const slotWidgets = [...updatedWidgets[slotName]];
                            [slotWidgets[moveDownIndex], slotWidgets[moveDownIndex + 1]] =
                                [slotWidgets[moveDownIndex + 1], slotWidgets[moveDownIndex]];
                            updatedWidgets[slotName] = slotWidgets;
                        }

                        // Notify parent
                        if (onWidgetChange) {
                            onWidgetChange(updatedWidgets);
                        }
                        if (onDirtyChange) {
                            onDirtyChange(true, `moved widget down in ${slotName}`);
                        }
                    }
                    break;
                }

                case 'configChange': {
                    const newConfig = args[0];

                    // Validate config before updating
                    const isValid = await validateWidget({ ...widget, config: newConfig });
                    if (!isValid) {
                        throw new Error('Invalid widget configuration');
                    }

                    // Update config using v2 context
                    await updateWidgetConfig(widget.id, newConfig);

                    // Update local state
                    const updatedWidgets = { ...widgets };
                    if (updatedWidgets[slotName]) {
                        updatedWidgets[slotName] = updatedWidgets[slotName].map(w =>
                            w.id === widget.id ? { ...w, config: newConfig } : w
                        );
                    }

                    // Notify parent
                    if (onWidgetChange) {
                        onWidgetChange(updatedWidgets);
                    }
                    if (onDirtyChange) {
                        onDirtyChange(true, `updated widget config in ${slotName}`);
                    }
                    break;
                }

                default:
                    break;
            }
        } catch (error) {
            console.error('❌ Failed to handle widget action:', error);
            throw error;
        }
    }, [widgets, onWidgetChange, onDirtyChange, onOpenWidgetEditor, addWidget, removeWidget, moveWidget, updateWidgetConfig, validateWidget]);

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

    // Clear slot handler using v2 context
    const handleClearSlot = useCallback(async (slotName) => {
        try {
            // Get widgets to clear
            const widgetsToRemove = widgets[slotName] || [];

            // Remove each widget using v2 context
            for (const widget of widgetsToRemove) {
                await removeWidget(widget.id);
            }

            // Update local state
            const updatedWidgets = { ...widgets };
            updatedWidgets[slotName] = [];

            // Notify parent
            if (onWidgetChange) {
                onWidgetChange(updatedWidgets);
            }
            if (onDirtyChange) {
                onDirtyChange(true, `cleared slot ${slotName}`);
            }
        } catch (error) {
            console.error('❌ Failed to clear slot:', error);
            throw error;
        }
    }, [widgets, onWidgetChange, onDirtyChange, removeWidget]);

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

    // Expose methods to parent using v2 context
    useImperativeHandle(ref, () => ({
        saveWidgets: async () => {
            try {
                // Validate layout before saving
                const isValid = await validateLayout(layoutName);
                if (!isValid) {
                    throw new Error('Invalid layout configuration');
                }

                // Update layout in v2 context
                await updateLayout(layoutName);

                // Return success result
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

        // Layout-specific methods
        getLayoutName: () => layoutName,
        getLayoutMetadata: () => getLayoutMetadata(layoutName),
        getCurrentWidgets: () => widgets,
        getLayoutState: () => getLayoutState(),
        validateLayout: () => validateLayout(layoutName)
    }), [widgets, layoutName, updateLayout, validateLayout, getLayoutState]);

    // Render the layout component
    return (
        <div className="react-layout-renderer w-full h-full">
            <LayoutComponent
                widgets={widgets}
                onWidgetAction={handleWidgetAction}
                editable={editable}
                pageContext={pageContext}
                onShowWidgetModal={handleShowWidgetModal}
                onClearSlot={handleClearSlot}
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
