/**
 * PageEditorCore - PageEditor-specific widget rendering system
 * 
 * This component renders widgets using the shared React widgets (not Django templates)
 * but with PageEditor-specific implementation that's separate from ObjectContentEditor.
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

    // State for filtered widget types
    const [filteredWidgetTypes, setFilteredWidgetTypes] = useState([]);
    const [isFilteringTypes, setIsFilteringTypes] = useState(false);

    // Widget editor panel state
    const [widgetEditorOpen, setWidgetEditorOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState(null);

    // Get available widget types from the layout's slot configurations
    const rawAvailableWidgetTypes = useMemo(() => {
        if (!layoutJson?.slots) return [];

        const allWidgetControls = [];
        layoutJson.slots.forEach(slot => {
            if (slot.allowedWidgetTypes && Array.isArray(slot.allowedWidgetTypes)) {
                slot.allowedWidgetTypes.forEach(widgetType => {
                    // Avoid duplicates
                    if (!allWidgetControls.some(existing => existing.type === widgetType)) {
                        allWidgetControls.push({
                            type: widgetType,
                            display_name: getWidgetDisplayName(widgetType, widgetTypes),
                            name: getWidgetDisplayName(widgetType, widgetTypes),
                            defaultConfig: createDefaultWidgetConfig(widgetType)
                        });
                    }
                });
            }
        });

        return allWidgetControls;
    }, [layoutJson?.slots, widgetTypes]);

    // Filter widget types to only include available ones from server
    useEffect(() => {
        const filterTypes = async () => {
            if (rawAvailableWidgetTypes.length === 0) {
                setFilteredWidgetTypes([]);
                return;
            }

            setIsFilteringTypes(true);
            try {
                const filtered = await filterAvailableWidgetTypes(rawAvailableWidgetTypes);
                setFilteredWidgetTypes(filtered);
            } catch (error) {
                console.error('Error filtering widget types:', error);
                // Fallback to raw types on error
                setFilteredWidgetTypes(rawAvailableWidgetTypes);
            } finally {
                setIsFilteringTypes(false);
            }
        };

        filterTypes();
    }, [rawAvailableWidgetTypes]);

    // PageEditor-specific widget handlers
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
            layoutRenderer: null // We're not using LayoutRenderer anymore
        });

        // Notify parent of changes
        const updatedWidgets = { ...currentWidgets };
        if (!updatedWidgets[slotName]) updatedWidgets[slotName] = [];
        updatedWidgets[slotName].push(newWidget);
        onUpdate({ widgets: updatedWidgets });

        if (onDirtyChange) {
            onDirtyChange(true, `added widget to slot ${slotName}`);
        }
    }, [isPublished, onVersionChange, addWidget, pageEventSystem, versionId, pageId, currentWidgets, onUpdate, onDirtyChange]);

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

    // Handle publishing actions
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

    // Render a single widget using PageWidgetFactory
    const renderWidget = useCallback((widget, slotName, index, slotWidgets) => {
        return (
            <div key={widget.id || index} className="mb-4">
                <PageWidgetFactory
                    widget={widget}
                    slotName={slotName}
                    index={index}
                    onEdit={handleEditWidget}
                    onDelete={handleDeleteWidget}
                    onMoveUp={(slot, idx, w) => handleMoveWidget(slot, idx, idx - 1, w)}
                    onMoveDown={(slot, idx, w) => handleMoveWidget(slot, idx, idx + 1, w)}
                    onConfigChange={handleConfigChange}
                    canMoveUp={index > 0}
                    canMoveDown={index < slotWidgets.length - 1}
                    mode="editor"
                    showControls={editable}
                    // PageEditor-specific props
                    layoutRenderer={null} // Not using LayoutRenderer
                    versionId={versionId}
                    isPublished={isPublished}
                    onVersionChange={onVersionChange}
                    onPublishingAction={handlePublishingAction}
                />
            </div>
        );
    }, [handleEditWidget, handleDeleteWidget, handleMoveWidget, handleConfigChange, handlePublishingAction, editable, versionId, isPublished, onVersionChange]);

    // Render a slot with its widgets
    const renderSlot = useCallback((slot) => {
        const slotWidgets = currentWidgets[slot.name] || [];

        return (
            <div
                key={slot.name}
                className="page-editor-slot border border-gray-200 rounded-lg p-6 mb-6"
                data-slot-name={slot.name}
            >
                {/* Slot Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                            <Layout className="h-5 w-5 mr-2 text-gray-600" />
                            {slot.label || slot.name}
                            <span className="ml-3 text-sm text-gray-500 font-normal">
                                ({slotWidgets.length} widgets)
                            </span>
                            {isPublished && (
                                <span className="ml-3 inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                                    Published
                                </span>
                            )}
                        </h3>
                        {slot.description && (
                            <p className="text-sm text-gray-600 mt-1">{slot.description}</p>
                        )}
                    </div>

                    {editable && (
                        <button
                            onClick={() => handleAddWidget(slot.name, 'core_widgets.ContentWidget')}
                            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Widget
                        </button>
                    )}
                </div>

                {/* Widgets */}
                <div className="space-y-4">
                    {slotWidgets.length > 0 ? (
                        slotWidgets.map((widget, index) =>
                            renderWidget(widget, slot.name, index, slotWidgets)
                        )
                    ) : (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
                            <Layout className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm">No widgets in this slot</p>
                            {editable && (
                                <p className="text-xs mt-1">Click "Add Widget" to get started</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }, [currentWidgets, renderWidget, editable, handleAddWidget, isPublished]);

    // Parse layout JSON to extract slots
    const layoutSlots = useMemo(() => {
        if (!layoutJson) return [];

        // Handle different layout JSON formats
        if (layoutJson.slots && Array.isArray(layoutJson.slots)) {
            return layoutJson.slots;
        }

        // Fallback: create slots based on current widgets
        return Object.keys(currentWidgets).map(slotName => ({
            name: slotName,
            label: slotName.charAt(0).toUpperCase() + slotName.slice(1),
            description: `Content area for ${slotName}`
        }));
    }, [layoutJson, currentWidgets]);

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

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
        saveWidgets: async () => {
            try {
                // Emit PageEditor-specific save event
                pageEventSystem.emitPageSaved({ widgets: currentWidgets }, {
                    versionId,
                    isPublished,
                    pageId,
                    saveStrategy: 'page-editor-core'
                });

                return {
                    success: true,
                    data: currentWidgets,
                    module: 'page-editor-core',
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

        // PageEditor-specific methods
        getCurrentVersion: () => currentVersion,
        getVersionId: () => versionId,
        isPublishedVersion: () => isPublished,
        pageEventSystem
    }), [currentWidgets, pageEventSystem, versionId, isPublished, pageId, currentVersion]);

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

    return (
        <div className="page-editor-core">
            {/* Page Editor Header */}
            <div className="bg-white border-b border-gray-200 p-4 mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            Page Content Editor
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Using shared React widgets • Version: {versionId || 'new'}
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

            {/* Layout Slots */}
            <div className="page-editor-slots space-y-6 p-4">
                {layoutSlots.length > 0 ? (
                    layoutSlots.map(renderSlot)
                ) : (
                    <div className="text-center py-12 text-gray-500">
                        <Layout className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Slots Configured</h3>
                        <p>This layout doesn't have any widget slots configured.</p>
                    </div>
                )}
            </div>
        </div>
    );
});

PageEditorCore.displayName = 'PageEditorCore';

export default PageEditorCore;
