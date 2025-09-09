/**
 * PageEditorCore - Hybrid layout renderer with React widgets
 * 
 * This uses the existing LayoutRenderer for layout structure but overrides
 * widget rendering to use PageWidgetFactory with shared React widgets.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Layout, Plus, Eye, Settings } from 'lucide-react'
import { PageWidgetFactory, createPageEditorEventSystem } from './index'
import { useWidgetEvents } from '../../contexts/WidgetEventContext'
import { useWidgets, getWidgetDisplayName, createDefaultWidgetConfig } from '../../hooks/useWidgets'
import { filterAvailableWidgetTypes } from '../../utils/widgetTypeValidation'
import {
    getCoreWidgetIcon as getWidgetIcon,
    getCoreWidgetCategory as getWidgetCategory,
    getCoreWidgetDescription as getWidgetDescription
} from '../../widgets'
import SimplifiedLayoutRenderer from './SimplifiedLayoutRenderer'
import { simplifiedLayoutsApi, layoutFormatUtils } from '../../api/simplifiedLayouts'
import { useNotificationContext } from '../../components/NotificationManager'

const PageEditorCore = forwardRef(({
    layoutJson,
    webpageData,
    pageVersionData,
    onUpdate,
    isNewPage,
    onOpenWidgetEditor,
    editable = true,
    onDirtyChange,
    // PageEditor-specific props
    currentVersion,
    availableVersions,
    onVersionChange
}, ref) => {
    const containerRef = useRef(null);
    const rendererRef = useRef(null);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Get notification context
    const { showConfirm } = useNotificationContext();

    // Create PageEditor-specific event system
    const baseWidgetEvents = useWidgetEvents();
    const pageEventSystem = useMemo(() =>
        createPageEditorEventSystem(baseWidgetEvents),
        [baseWidgetEvents]
    );

    // Get current widgets from pageVersionData
    const currentWidgets = useMemo(() => {
        return pageVersionData?.widgets || {};
    }, [pageVersionData?.widgets]);

    // Get version context
    const versionId = currentVersion?.id || pageVersionData?.versionId;
    const isPublished = pageVersionData?.publicationStatus === 'published';
    const pageId = webpageData?.id;

    // Use the shared widget hook
    const {
        widgetTypes,
        addWidget,
        updateWidget,
        deleteWidget
    } = useWidgets(currentWidgets);

    // PageEditor-specific widget handlers (defined before layoutRenderer)
    const handleEditWidget = useCallback((slotName, index, widget) => {
        // Check if editing a published version
        if (isPublished && onVersionChange) {
            const shouldCreateVersion = window.confirm(
                'This page is published. Do you want to create a new version for your changes?'
            );
            if (shouldCreateVersion) {
                onVersionChange('create_new');
                return;
            }
        }

        if (onOpenWidgetEditor) {
            onOpenWidgetEditor({ ...widget, slotName });
        }
    }, [isPublished, onVersionChange, onOpenWidgetEditor]);

    const handleDeleteWidget = useCallback((slotName, index, widget) => {
        // Additional confirmation for published pages
        if (isPublished) {
            const confirmMessage = 'This will delete the widget from a published page. Are you sure?';
            if (!window.confirm(confirmMessage)) {
                return;
            }
        }

        // Remove widget
        deleteWidget(slotName, index);

        // Emit PageEditor-specific widget removed event
        pageEventSystem.emitWidgetRemoved(slotName, widget.id, {
            versionId,
            isPublished,
            pageId
        });

        // Update parent
        const updatedWidgets = { ...currentWidgets };
        if (updatedWidgets[slotName]) {
            updatedWidgets[slotName] = updatedWidgets[slotName].filter((_, i) => i !== index);
        }
        onUpdate({ widgets: updatedWidgets });

        if (onDirtyChange) {
            onDirtyChange(true, `removed widget from slot ${slotName}`);
        }
    }, [isPublished, deleteWidget, pageEventSystem, versionId, pageId, currentWidgets, onUpdate, onDirtyChange]);

    const handleMoveWidget = useCallback((slotName, fromIndex, toIndex, widget) => {
        const updatedWidgets = { ...currentWidgets };
        if (updatedWidgets[slotName]) {
            const slotWidgets = [...updatedWidgets[slotName]];
            const [movedWidget] = slotWidgets.splice(fromIndex, 1);
            slotWidgets.splice(toIndex, 0, movedWidget);
            updatedWidgets[slotName] = slotWidgets;
        }

        // Emit PageEditor-specific widget moved event
        pageEventSystem.emitWidgetMoved(slotName, widget.id, fromIndex, toIndex, {
            versionId,
            isPublished,
            pageId
        });

        onUpdate({ widgets: updatedWidgets });

        if (onDirtyChange) {
            onDirtyChange(true, `moved widget in slot ${slotName}`);
        }
    }, [currentWidgets, pageEventSystem, versionId, isPublished, pageId, onUpdate, onDirtyChange]);

    const handleConfigChange = useCallback((widgetId, slotName, newConfig) => {
        const updatedWidgets = { ...currentWidgets };
        if (updatedWidgets[slotName]) {
            updatedWidgets[slotName] = updatedWidgets[slotName].map(w =>
                w.id === widgetId ? { ...w, config: newConfig } : w
            );
        }

        // Emit PageEditor-specific widget changed event
        pageEventSystem.emitWidgetChanged(widgetId, slotName, { id: widgetId, config: newConfig }, 'config', {
            versionId,
            isPublished,
            pageId
        });

        onUpdate({ widgets: updatedWidgets });

        if (onDirtyChange) {
            onDirtyChange(true, `updated widget config in slot ${slotName}`);
        }
    }, [currentWidgets, pageEventSystem, versionId, isPublished, pageId, onUpdate, onDirtyChange]);

    const handlePublishingAction = useCallback((action, actionVersionId) => {
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
                default:
                    console.warn('Unknown publishing action:', action);
            }
        }
    }, [onVersionChange]);

    // Create and configure the hybrid layout renderer
    const layoutRenderer = useMemo(() => {
        if (!rendererRef.current || rendererRef.current.editable !== editable) {
            // Clean up existing renderer if it exists
            if (rendererRef.current) {
                rendererRef.current.cleanup();
            }

            // Create simplified layout renderer
            rendererRef.current = new SimplifiedLayoutRenderer({ editable });

            // Set PageEditor context
            rendererRef.current.setPageContext({
                versionId,
                isPublished,
                pageId,
                currentVersion,
                availableVersions
            });

            // Set PageEditor event system
            rendererRef.current.setPageEventSystem(pageEventSystem);

            // Set PageWidgetFactory component
            rendererRef.current.setPageWidgetFactory(PageWidgetFactory);

            // Set widget data accessor
            rendererRef.current.setWidgetDataAccessor((slotName) => {
                return currentWidgets[slotName] || [];
            });

            // Set widget action handlers
            rendererRef.current.setWidgetActionHandlers({
                onEdit: handleEditWidget,
                onDelete: handleDeleteWidget,
                onMoveUp: (slotName, index, widget) => handleMoveWidget(slotName, index, index - 1, widget),
                onMoveDown: (slotName, index, widget) => handleMoveWidget(slotName, index, index + 1, widget),
                onConfigChange: handleConfigChange,
                onVersionChange: onVersionChange,
                onPublishingAction: handlePublishingAction
            });
        }
        return rendererRef.current;
    }, [editable, versionId, isPublished, pageId, currentVersion, availableVersions, pageEventSystem, currentWidgets, handleEditWidget, handleDeleteWidget, handleMoveWidget, handleConfigChange, onVersionChange, handlePublishingAction]);

    // Additional widget handler for adding widgets
    const handleAddWidget = useCallback((slotName, widgetType) => {
        // Check if adding to a published version
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

        // Emit PageEditor-specific widget added event
        pageEventSystem.emitWidgetAdded(slotName, newWidget, {
            versionId,
            isPublished,
            pageId,
            layoutRenderer: layoutRenderer
        });

        // Notify parent of changes
        const updatedWidgets = { ...currentWidgets };
        if (!updatedWidgets[slotName]) updatedWidgets[slotName] = [];
        updatedWidgets[slotName].push(newWidget);
        onUpdate({ widgets: updatedWidgets });

        if (onDirtyChange) {
            onDirtyChange(true, `added widget to slot ${slotName}`);
        }
    }, [isPublished, onVersionChange, addWidget, pageEventSystem, versionId, pageId, layoutRenderer, currentWidgets, onUpdate, onDirtyChange]);

    // Note: Widget rendering is now handled by PageLayoutRendererWithReact
    // The LayoutRenderer will call renderWidget() which uses PageWidgetFactory

    // Listen to PageEditor-specific events
    useEffect(() => {
        const unsubscribeChanged = pageEventSystem.onWidgetChanged((payload) => {
            if (payload.versionId === versionId) {
                console.log('PageEditor widget changed:', payload);
            }
        }, versionId);

        const unsubscribeVersionPublished = pageEventSystem.onVersionPublished((payload) => {
            console.log('PageEditor version published:', payload);
        });

        return () => {
            unsubscribeChanged();
            unsubscribeVersionPublished();
        };
    }, [pageEventSystem, versionId]);

    // Render layout when layoutJson or widgets change
    useEffect(() => {
        if (!layoutRenderer || !layoutJson || !containerRef.current) return;

        const renderLayout = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // Load widget data into renderer
                layoutRenderer.loadWidgetData(currentWidgets);

                // Detect layout format and handle accordingly
                let layoutToRender = layoutJson;

                if (layoutFormatUtils.isLegacyFormat(layoutJson)) {
                    console.warn('PageEditorCore: Legacy layout format detected, attempting to get simplified version');

                    try {
                        // Try to get simplified version
                        const layoutName = layoutJson.layout?.name;
                        if (layoutName) {
                            const simplifiedResponse = await simplifiedLayoutsApi.get(layoutName);
                            if (simplifiedResponse.success && simplifiedResponse.layout) {
                                layoutToRender = simplifiedResponse.layout;
                                console.log('PageEditorCore: Using simplified layout format');
                            }
                        }
                    } catch (simplifiedError) {
                        console.warn('PageEditorCore: Failed to get simplified layout, converting legacy:', simplifiedError);
                        layoutToRender = layoutFormatUtils.convertLegacyToSimplified(layoutJson);
                    }
                }

                // Render the layout with React widgets (no Django templates)
                await layoutRenderer.render(layoutToRender, containerRef);

                // Emit layout rendered event
                pageEventSystem.emitLayoutRendered(layoutRenderer, {
                    versionId,
                    isPublished,
                    pageId,
                    format: layoutFormatUtils.getFormatVersion(layoutToRender)
                });

            } catch (error) {
                console.error('PageEditorCore: Layout rendering failed', error);
                setError(error.message);
            } finally {
                setIsLoading(false);
            }
        };

        renderLayout();
    }, [layoutRenderer, layoutJson, currentWidgets, pageEventSystem, versionId, isPublished, pageId]);

    // Update widgets when they change
    useEffect(() => {
        if (!layoutRenderer || !currentWidgets) return;

        // Update all slots with current widgets
        Object.entries(currentWidgets).forEach(([slotName, slotWidgets]) => {
            try {
                layoutRenderer.updateSlot(slotName, slotWidgets);
            } catch (error) {
                console.error(`PageEditorCore: Error updating slot ${slotName}`, error);
            }
        });
    }, [layoutRenderer, currentWidgets]);

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
        saveWidgets: async () => {
            try {
                // Mark layout renderer as clean after successful save
                if (layoutRenderer) {
                    layoutRenderer.markAsClean();
                }

                // Emit PageEditor-specific save event
                pageEventSystem.emitPageSaved({ widgets: currentWidgets }, {
                    versionId,
                    isPublished,
                    pageId,
                    saveStrategy: 'page-editor-hybrid'
                });

                return {
                    success: true,
                    data: currentWidgets,
                    module: 'page-editor-hybrid',
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                console.error('PageEditorCore: Save widgets failed', error);
                throw error;
            }
        },

        enableAutoSave: (enabled, interval = 10000) => {
            console.log('PageEditorCore: Auto-save', enabled ? 'enabled' : 'disabled', `interval: ${interval}ms`);
        },

        // Expose layout renderer for compatibility
        layoutRenderer: layoutRenderer,

        // PageEditor-specific methods
        getCurrentVersion: () => currentVersion,
        getVersionId: () => versionId,
        isPublishedVersion: () => isPublished,
        pageEventSystem
    }), [currentWidgets, layoutRenderer, pageEventSystem, versionId, isPublished, pageId, currentVersion]);

    if (!layoutJson) {
        return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
                <div className="text-center text-gray-500">
                    <Layout className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Layout Selected</h3>
                    <p>Choose a layout to start editing this page</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full bg-red-50">
                <div className="text-center">
                    <div className="text-red-600 text-lg font-medium mb-2">Layout Rendering Error</div>
                    <div className="text-red-500 text-sm">{error}</div>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Rendering page layout with React widgets...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-editor-core h-full">
            {/* Page Editor Header */}
            <div className="bg-white border-b border-gray-200 p-4 mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            Page Layout Editor
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Layout rendering with shared React widgets • Version: {versionId || 'new'}
                            {isPublished && <span className="text-green-600"> • Published</span>}
                        </p>
                    </div>

                    <div className="flex items-center space-x-3">
                        <span className="text-sm text-gray-500">
                            {Object.keys(currentWidgets).reduce((total, slotName) =>
                                total + (currentWidgets[slotName]?.length || 0), 0
                            )} widgets
                        </span>

                        {editable && (
                            <div className="flex items-center space-x-2">
                                <Eye className="h-4 w-4 text-gray-400" />
                                <span className="text-sm text-gray-500">Edit Mode</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Layout Container - Rendered by LayoutRenderer */}
            <div
                ref={containerRef}
                className="page-layout-container flex-1 overflow-auto p-4"
            />
        </div>
    );
});

PageEditorCore.displayName = 'PageEditorCore';

export default PageEditorCore;
