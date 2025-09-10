/**
 * ReactLayoutRenderer - Pure React layout rendering
 * 
 * This renderer uses manually defined React layout components instead of
 * complex backend/frontend protocol. Simple, flexible, and maintainable.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Layout } from 'lucide-react';
import { getLayoutComponent, getLayoutMetadata, layoutExists, LAYOUT_REGISTRY } from './layouts/LayoutRegistry';
import { createPageEditorEventSystem } from './PageEditorEventSystem';
import { useWidgetEvents } from '../../contexts/WidgetEventContext';
import { useWidgets, createDefaultWidgetConfig } from '../../hooks/useWidgets';

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

    // Create PageEditor event system
    const baseWidgetEvents = useWidgetEvents();
    const pageEventSystem = useMemo(() =>
        createPageEditorEventSystem(baseWidgetEvents),
        [baseWidgetEvents]
    );

    // Get version context
    const versionId = currentVersion?.id || pageVersionData?.versionId;
    const isPublished = pageVersionData?.publicationStatus === 'published';

    // Use shared widget hook
    const {
        addWidget,
        updateWidget,
        deleteWidget
    } = useWidgets(widgets);

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
    const handleWidgetAction = useCallback((action, slotName, widget, ...args) => {

        switch (action) {
            case 'add':
                const widgetType = args[0] || 'core_widgets.ContentWidget';

                // Check if adding to published version
                if (isPublished && onVersionChange) {
                    const shouldCreateVersion = window.confirm(
                        'This page is published. Do you want to create a new version for your changes?'
                    );
                    if (shouldCreateVersion) {
                        onVersionChange('create_new');
                        return;
                    }
                }

                const widgetConfig = createDefaultWidgetConfig(widgetType);
                const newWidget = addWidget(slotName, widgetType, widgetConfig);

                // Update widgets
                const updatedWidgets = { ...widgets };
                if (!updatedWidgets[slotName]) updatedWidgets[slotName] = [];
                updatedWidgets[slotName].push(newWidget);

                if (onWidgetChange) {
                    onWidgetChange(updatedWidgets);
                }

                if (onDirtyChange) {
                    onDirtyChange(true, `added widget to ${slotName}`);
                }

                // Emit event
                pageEventSystem.emitWidgetAdded(slotName, newWidget, { versionId, isPublished });
                break;

            case 'edit':
                const widgetIndex = args[0];
                if (onOpenWidgetEditor) {
                    onOpenWidgetEditor({ ...widget, slotName });
                }
                break;

            case 'delete':
                const deleteIndex = args[0];

                // Confirmation for published pages
                if (isPublished) {
                    const confirmMessage = 'This will delete the widget from a published page. Are you sure?';
                    if (!window.confirm(confirmMessage)) {
                        return;
                    }
                }

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

                // Emit event
                pageEventSystem.emitWidgetRemoved(slotName, widget.id, { versionId, isPublished });
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

                    // Emit event
                    pageEventSystem.emitWidgetMoved(slotName, widget.id, moveUpIndex, moveUpIndex - 1, { versionId, isPublished });
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

                    // Emit event
                    pageEventSystem.emitWidgetMoved(slotName, widget.id, moveDownIndex, moveDownIndex + 1, { versionId, isPublished });
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

                // Emit event
                pageEventSystem.emitWidgetChanged(widget.id, slotName, { ...widget, config: newConfig }, 'config', { versionId, isPublished });
                break;

            default:
                break;
        }
    }, [widgets, onWidgetChange, onDirtyChange, onOpenWidgetEditor, addWidget, pageEventSystem, versionId, isPublished, onVersionChange]);

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
                // Emit save event
                pageEventSystem.emitPageSaved({ widgets }, { versionId, isPublished });

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
        pageEventSystem
    }), [widgets, layoutName, pageEventSystem, versionId, isPublished]);

    // Render the layout component
    return (
        <div className="react-layout-renderer w-full h-full">
            <LayoutComponent
                widgets={widgets}
                onWidgetAction={handleWidgetAction}
                editable={editable}
                pageContext={pageContext}
            />
        </div>
    );
});

ReactLayoutRenderer.displayName = 'ReactLayoutRenderer';

export default ReactLayoutRenderer;
