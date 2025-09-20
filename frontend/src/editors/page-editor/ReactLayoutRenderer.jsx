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
import { useUnifiedData, usePageWidgets } from '../../contexts/unified-data';
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

    // Use unified data operations
    const { dispatch } = useUnifiedData();
    const pageWidgetsOps = usePageWidgets(currentVersion?.page_id || pageVersionData?.pageId || '');

    // Get version context
    const versionId = currentVersion?.id || pageVersionData?.versionId;
    const isPublished = pageVersionData?.publicationStatus === 'published';

    // Widget management is now handled by UnifiedDataContext through pageWidgetsOps

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

    // Handle widget actions
    const handleWidgetAction = useCallback(async (action, slotName, widget, ...args) => {

        switch (action) {
            case 'add':
                const widgetType = args[0] || 'core_widgets.ContentWidget';


                const widgetConfig = createDefaultWidgetConfig(widgetType);

                // Dispatch add widget operation - this will handle state updates
                try {
                    const newWidgetId = await pageWidgetsOps.addWidget(slotName, widgetType, widgetConfig);

                    if (onDirtyChange) {
                        onDirtyChange(true, `added widget to ${slotName}`);
                    }
                } catch (error) {
                    console.error('Failed to add widget:', error);
                }
                break;

            case 'edit':
                const widgetIndex = args[0];
                if (onOpenWidgetEditor) {
                    onOpenWidgetEditor({ ...widget, slotName });
                }
                break;

            case 'delete':
                const deleteIndex = args[0];

                const updatedWidgetsDelete = { ...widgets };
                if (updatedWidgetsDelete[slotName]) {
                    updatedWidgetsDelete[slotName] = updatedWidgetsDelete[slotName].filter((_, i) => i !== deleteIndex);
                }

                if (onWidgetChange) {
                    onWidgetChange(updatedWidgetsDelete);
                }

                if (onDirtyChange) {
                    onDirtyChange(true, `removed widget from ${slotName}`);
                }

                // Dispatch remove widget operation
                try {
                    await pageWidgetsOps.removeWidget(widget.id);
                } catch (error) {
                    console.error('Failed to remove widget:', error);
                }
                break;

            case 'moveUp':
                const moveUpIndex = args[0];
                if (moveUpIndex > 0) {
                    const updatedWidgetsUp = { ...widgets };
                    if (updatedWidgetsUp[slotName]) {
                        const slotWidgets = [...updatedWidgetsUp[slotName]];
                        [slotWidgets[moveUpIndex - 1], slotWidgets[moveUpIndex]] =
                            [slotWidgets[moveUpIndex], slotWidgets[moveUpIndex - 1]];
                        updatedWidgetsUp[slotName] = slotWidgets;
                    }

                    if (onWidgetChange) {
                        onWidgetChange(updatedWidgetsUp);
                    }

                    if (onDirtyChange) {
                        onDirtyChange(true, `moved widget up in ${slotName}`);
                    }

                    // Dispatch move widget operation
                    try {
                        await pageWidgetsOps.moveWidget(widget.id, slotName, moveUpIndex - 1);
                    } catch (error) {
                        console.error('Failed to move widget up:', error);
                    }
                }
                break;

            case 'moveDown':
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
                        onWidgetChange(updatedWidgetsDown);
                    }

                    if (onDirtyChange) {
                        onDirtyChange(true, `moved widget down in ${slotName}`);
                    }

                    // Dispatch move widget operation
                    try {
                        await pageWidgetsOps.moveWidget(widget.id, slotName, moveDownIndex + 1);
                    } catch (error) {
                        console.error('Failed to move widget down:', error);
                    }
                }
                break;

            case 'configChange':
                const newConfig = args[0];
                const updatedWidgetsConfig = { ...widgets };
                if (updatedWidgetsConfig[slotName]) {
                    updatedWidgetsConfig[slotName] = updatedWidgetsConfig[slotName].map(w =>
                        w.id === widget.id ? { ...w, config: newConfig } : w
                    );
                }

                if (onWidgetChange) {
                    onWidgetChange(updatedWidgetsConfig);
                }

                if (onDirtyChange) {
                    onDirtyChange(true, `updated widget config in ${slotName}`);
                }

                // Dispatch widget config update operation
                try {
                    await dispatch({
                        type: 'UPDATE_WIDGET_CONFIG',
                        payload: {
                            id: widget.id,
                            config: newConfig
                        }
                    });
                } catch (error) {
                    console.error('Failed to update widget config:', error);
                }
                break;

            default:
                break;
        }
    }, [widgets, onWidgetChange, onDirtyChange, onOpenWidgetEditor, pageWidgetsOps, versionId, isPublished, onVersionChange]);

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
            onWidgetChange(updatedWidgets);
        }

        if (onDirtyChange) {
            onDirtyChange(true, `cleared slot ${slotName}`);
        }

        // Clear slot by removing all widgets
        try {
            const slotWidgets = widgets[slotName] || [];
            for (const widget of slotWidgets) {
                await pageWidgetsOps.removeWidget(widget.id);
            }
        } catch (error) {
            console.error('Failed to clear slot:', error);
        }
    }, [widgets, onWidgetChange, onDirtyChange, pageWidgetsOps, versionId, isPublished, dispatch]);

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
                // Page save is handled by the unified context automatically

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
        // Removed pageEventSystem - now using unified data operations
    }), [widgets, layoutName, versionId, isPublished]);

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
