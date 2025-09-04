/**
 * ContentEditorWithWidgetFactory - Alternative to ContentEditor that uses WidgetFactory for widgets
 * 
 * Hybrid approach: Uses LayoutRenderer for layout structure but WidgetFactory for widget rendering.
 * This provides the best of both worlds - proven layout handling with modern widget UI.
 */

import React, { useRef, useEffect, useCallback, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import LayoutRendererWithWidgetFactory from './LayoutRendererWithWidgetFactory';
import { WIDGET_ACTIONS } from '../utils/widgetConstants';
import { useNotificationContext } from './NotificationManager';
import WidgetFactory from './widgets/WidgetFactory';
import useWidgetStore from '../stores/widgetStore';

const ContentEditorWithWidgetFactory = forwardRef(({
    layoutJson,
    editable = false,
    onDirtyChange,
    className = '',
    webpageData,
    pageVersionData,
    onUpdate,
    isNewPage,
    onOpenWidgetEditor
}, ref) => {
    const containerRef = useRef(null);
    const rendererRef = useRef(null);
    const eventListenersRef = useRef(new Map());

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Get notification context for confirmation dialogs
    const { showConfirm } = useNotificationContext();

    // Use Zustand store for centralized widget state management
    const {
        widgets: storeWidgets,
        initializePage,
        updateWidget,
        addWidget,
        removeWidget,
        moveWidget,
        clearSlot,
        replaceAllWidgets,
        getAllWidgets
    } = useWidgetStore();

    // Get page ID from webpageData
    const pageId = webpageData?.id;



    // Initialize store when page data is available
    useEffect(() => {
        if (pageId && pageVersionData?.widgets) {
            initializePage(pageId, pageVersionData.widgets);
        }
    }, [pageId, pageVersionData?.widgets, initializePage]);

    // Sync store with pageVersionData changes
    useEffect(() => {
        if (pageVersionData?.widgets) {
            replaceAllWidgets(pageVersionData.widgets);
        }
    }, [pageVersionData?.widgets, replaceAllWidgets]);

    // Handle widget actions - pass widget to PageEditor which handles toggle logic
    const handleWidgetEdit = useCallback((slotName, index, widget) => {
        if (onOpenWidgetEditor) {
            onOpenWidgetEditor(widget, slotName);
        }
    }, [onOpenWidgetEditor]);

    const handleWidgetDelete = useCallback(async (slotName, index, widget) => {
        // Direct removal without confirmation
        if (onUpdate) {
            // Update store immediately
            removeWidget(slotName, widget.id);

            // Get updated widgets and notify parent
            const updatedWidgets = getAllWidgets();
            onUpdate({ widgets: updatedWidgets });

            if (onDirtyChange) {
                onDirtyChange(true, `removed widget from slot ${slotName}`);
            }
        }
    }, [removeWidget, getAllWidgets, onUpdate, onDirtyChange]);



    // Move widget up in the slot
    const handleWidgetMoveUp = useCallback((slotName, index, widget) => {
        if (index <= 0) return; // Can't move the first widget up

        // Update store immediately
        moveWidget(slotName, index, index - 1);

        // Get updated widgets and notify parent
        const updatedWidgets = getAllWidgets();
        if (onUpdate) {
            onUpdate({ widgets: updatedWidgets });
        }

        if (onDirtyChange) {
            onDirtyChange(true, `moved widget up in slot ${slotName}`);
        }
    }, [moveWidget, getAllWidgets, onUpdate, onDirtyChange]);

    // Move widget down in the slot
    const handleWidgetMoveDown = useCallback((slotName, index, widget) => {
        const slotWidgets = storeWidgets[slotName] || [];
        if (index >= slotWidgets.length - 1) return; // Can't move the last widget down

        // Update store immediately
        moveWidget(slotName, index, index + 1);

        // Get updated widgets and notify parent
        const updatedWidgets = getAllWidgets();
        if (onUpdate) {
            onUpdate({ widgets: updatedWidgets });
        }

        if (onDirtyChange) {
            onDirtyChange(true, `moved widget down in slot ${slotName}`);
        }
    }, [storeWidgets, moveWidget, getAllWidgets, onUpdate, onDirtyChange]);

    // Memoize the layout renderer with WidgetFactory integration
    const layoutRenderer = useMemo(() => {
        // Always create new renderer when editable state changes
        if (!rendererRef.current || rendererRef.current.editable !== editable) {
            // Clean up existing renderer if it exists
            if (rendererRef.current) {
                rendererRef.current.cleanup();
            }

            // Create custom LayoutRenderer that supports WidgetFactory
            rendererRef.current = new LayoutRendererWithWidgetFactory({ editable });

            // Set WidgetFactory component
            rendererRef.current.setWidgetFactoryComponent(WidgetFactory);

            // Set widget action handlers
            rendererRef.current.setWidgetActionHandlers({
                onEdit: handleWidgetEdit,
                onDelete: handleWidgetDelete,
                onMoveUp: handleWidgetMoveUp,
                onMoveDown: handleWidgetMoveDown
            });


        }
        return rendererRef.current;
    }, [editable, onOpenWidgetEditor, handleWidgetEdit, handleWidgetDelete, handleWidgetMoveUp, handleWidgetMoveDown]);

    // Initialize version management when webpageData is available
    useEffect(() => {
        if (!layoutRenderer || !pageId || isNewPage) {
            return;
        }

        // Initialize version management using webpage ID and current version
        const currentVersion = pageVersionData?.versionId ? {
            id: pageVersionData.versionId,
            versionNumber: pageVersionData.versionNumber,
            versionTitle: pageVersionData.versionTitle || pageVersionData.description || 'No description',
            publicationStatus: pageVersionData.publicationStatus || 'draft'
        } : null;

        layoutRenderer.initializeVersionManagement(pageId, currentVersion);

        // Set up version callbacks
        layoutRenderer.setVersionCallback('version-changed', (versionData) => {
            if (onUpdate) {
                onUpdate({
                    webpageData,
                    pageVersionData: versionData,
                    versionChanged: true
                });
            }
        });

        layoutRenderer.setVersionCallback('version-error', (errorMessage) => {
            console.error('ContentEditorWithWidgetFactory: Version error', errorMessage);
            setError(errorMessage);
        });

    }, [layoutRenderer, pageId, isNewPage, onUpdate, webpageData, pageVersionData?.versionId, pageVersionData?.versionNumber, pageVersionData?.versionTitle, pageVersionData?.publicationStatus]);

    // Set up dirty state communication with LayoutRenderer
    useEffect(() => {
        if (!layoutRenderer) return;

        layoutRenderer.setUICallbacks({
            onDirtyStateChanged: (isDirty, reason) => {
                if (onDirtyChange) {
                    onDirtyChange(isDirty, reason);
                }
            }
        });

        // Set up widget data change callbacks
        layoutRenderer.setWidgetDataCallbacks({
            widgetDataChanged: (action, slotName, widgetData) => {
                if (!onUpdate) {
                    console.warn('ContentEditorWithWidgetFactory: Cannot update widget data - missing onUpdate callback');
                    return;
                }

                // Use store for immediate updates
                switch (action) {
                    case WIDGET_ACTIONS.ADD:
                        addWidget(slotName, widgetData);
                        break;

                    case WIDGET_ACTIONS.REMOVE:
                        removeWidget(slotName, widgetData); // widgetData is the widget ID for remove
                        break;

                    case WIDGET_ACTIONS.CLEAR:
                        clearSlot(slotName);
                        break;

                    case WIDGET_ACTIONS.UPDATE:
                    case WIDGET_ACTIONS.EDIT:
                        updateWidget(slotName, widgetData.id, widgetData);
                        break;

                    case WIDGET_ACTIONS.MOVE_UP:
                    case WIDGET_ACTIONS.MOVE_DOWN:
                        // For move operations, widgetData should contain the reordered array
                        if (Array.isArray(widgetData)) {
                            replaceAllWidgets({ ...storeWidgets, [slotName]: widgetData });
                        }
                        break;

                    default:
                        console.warn('ContentEditorWithWidgetFactory: Unknown widget data action', action);
                        return;
                }

                // Get updated widgets from store and notify parent
                const updatedWidgets = getAllWidgets();
                onUpdate({ widgets: updatedWidgets });

                if (onDirtyChange && action !== WIDGET_ACTIONS.UPDATE) {
                    onDirtyChange(true, `widget ${action} in slot ${slotName}`);
                }
            }
        });

    }, [layoutRenderer, onDirtyChange, onUpdate, addWidget, removeWidget, clearSlot, updateWidget, replaceAllWidgets, getAllWidgets, storeWidgets, webpageData, pageVersionData]);

    // Cleanup function for event listeners and React roots
    const cleanupEventListeners = useCallback(() => {
        try {
            eventListenersRef.current.forEach((cleanup, element) => {
                if (typeof cleanup === 'function') {
                    cleanup();
                }
            });
            eventListenersRef.current.clear();

            // Cleanup React roots from WidgetFactory containers
            if (containerRef.current) {
                const widgetContainers = containerRef.current.querySelectorAll('.widget-factory-container');
                widgetContainers.forEach(container => {
                    if (container._reactRoot) {
                        try {
                            container._reactRoot.unmount();
                        } catch (error) {
                            console.warn('Error unmounting React root:', error);
                        }
                    }
                });
            }
        } catch (error) {
            console.error('ContentEditorWithWidgetFactory: Error during cleanup', error);
        }
    }, []);

    // Render layout when layoutJson changes
    useEffect(() => {
        if (!layoutJson || !containerRef.current || !layoutRenderer) {
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Note: Custom LayoutRenderer handles its own cleanup

            // Render the layout using LayoutRenderer
            layoutRenderer.render(layoutJson, containerRef);

            setIsLoading(false);
        } catch (err) {
            console.error('ContentEditorWithWidgetFactory: Error rendering layout', err);
            setError(err.message);
            setIsLoading(false);
        }
    }, [layoutJson, layoutRenderer, cleanupEventListeners]);

    // Update widgets when store widgets change
    const widgetsJsonString = JSON.stringify(storeWidgets);

    useEffect(() => {
        if (!layoutRenderer) {
            return;
        }

        // Check if storeWidgets has any content
        if (!storeWidgets || Object.keys(storeWidgets).length === 0) {
            return;
        }



        // Load widget data and update slots
        const updateSlots = () => {
            layoutRenderer.loadWidgetData(storeWidgets);

            Object.entries(storeWidgets).forEach(([slotName, slotWidgets]) => {
                try {
                    layoutRenderer.updateSlot(slotName, slotWidgets);
                } catch (error) {
                    console.error(`ContentEditorWithWidgetFactory: Error updating slot ${slotName}`, error);
                }
            });
        };

        // Schedule update for next frame
        const timeoutId = setTimeout(updateSlots, 0);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [widgetsJsonString, layoutRenderer, storeWidgets]);

    // Inject CSS styles for WidgetFactory integration
    useEffect(() => {
        const styleId = 'content-editor-widget-factory-styles';

        // Remove existing styles if any
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
            existingStyle.remove();
        }

        // Add new styles
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
      .slot-editable {
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .slot-editable:hover {
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
      }
      
      .widget-factory-container .widget-item:hover .widget-edit-btn {
        opacity: 1;
      }
      
      /* Enhanced WidgetFactory styles */
      .widget-factory-container {
        margin-bottom: 0.75rem;
      }
      
      .widget-factory-container:last-child {
        margin-bottom: 0;
      }
    `;
        document.head.appendChild(style);

        // Cleanup function
        return () => {
            const styleToRemove = document.getElementById(styleId);
            if (styleToRemove) {
                styleToRemove.remove();
            }
        };
    }, []);

    // API methods for external use (same as ContentEditor)
    const updateSlot = useCallback((slotName, newWidgets) => {
        if (layoutRenderer) {
            layoutRenderer.updateSlot(slotName, newWidgets);
        }
    }, [layoutRenderer]);

    const getSlots = useCallback(() => {
        if (layoutRenderer) {
            return layoutRenderer.getSlotNames();
        }
        return [];
    }, [layoutRenderer]);

    const getSlotConfig = useCallback((slotName) => {
        if (layoutRenderer) {
            return layoutRenderer.getSlotConfig(slotName);
        }
        return null;
    }, [layoutRenderer]);

    const saveWidgets = useCallback((options = {}) => {
        const currentWidgets = getAllWidgets();

        if (!currentWidgets) {
            console.warn("⚠️ SAVE SIGNAL: currentWidgets not available");
            return {};
        }

        try {
            return currentWidgets;
        } catch (error) {
            console.error("❌ SAVE SIGNAL: ContentEditorWithWidgetFactory save failed", error);
            throw error;
        }
    }, [getAllWidgets]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Clean up all event listeners
            cleanupEventListeners();

            // Destroy layout renderer
            if (rendererRef.current) {
                rendererRef.current.destroy();
                rendererRef.current = null;
            }

            // Remove any remaining styles
            const styleToRemove = document.getElementById('content-editor-widget-factory-styles');
            if (styleToRemove) {
                styleToRemove.remove();
            }
        };
    }, [cleanupEventListeners]);

    // Expose API methods
    const api = useMemo(() => ({
        updateSlot,
        getSlots,
        getSlotConfig,
        saveWidgets,
        layoutRenderer
    }), [updateSlot, getSlots, getSlotConfig, saveWidgets, layoutRenderer]);

    useImperativeHandle(ref, () => api, [api]);

    if (error) {
        return (
            <div className={`content-editor-error p-4 border border-red-300 bg-red-50 rounded ${className}`}>
                <div className="text-red-800 font-medium">Error rendering layout</div>
                <div className="text-red-600 text-sm mt-1">{error}</div>
                <button
                    onClick={() => {
                        setError(null);
                        setIsLoading(false);
                    }}
                    className="mt-2 text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className={`content-editor-with-widget-factory relative h-full flex flex-col ${className}`}>
            {isLoading && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                    <div className="text-gray-600">Loading layout...</div>
                </div>
            )}

            <div
                ref={containerRef}
                className={`layout-container content-editor-container flex-1 ${editable ? 'editable' : ''}`}
                style={{
                    minHeight: '400px',
                    height: '100%',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                    borderRadius: '8px',
                    backgroundColor: 'white'
                }}
            />
        </div>
    );
});

// Add display name for debugging
ContentEditorWithWidgetFactory.displayName = 'ContentEditorWithWidgetFactory';

export default ContentEditorWithWidgetFactory;
