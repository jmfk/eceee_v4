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

const ContentEditorWithWidgetFactory = forwardRef(({
    layoutJson,
    editable = false,
    onSlotClick,
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
    const [selectedSlot, setSelectedSlot] = useState(null);

    // Get notification context for confirmation dialogs
    const { showConfirm } = useNotificationContext();

    // Get current widgets from pageVersionData
    const currentWidgets = useMemo(() => {
        return pageVersionData?.widgets || {};
    }, [pageVersionData?.widgets]);

    // Get page ID from webpageData
    const pageId = webpageData?.id;

    // Handle widget actions - pass widget to PageEditor which handles toggle logic
    const handleWidgetEdit = useCallback((slotName, index, widget) => {
        if (onOpenWidgetEditor) {
            onOpenWidgetEditor(widget, slotName);
        }
    }, [onOpenWidgetEditor]);

    const handleWidgetDelete = useCallback(async (slotName, index, widget) => {
        const confirmed = await showConfirm({
            title: 'Remove Widget',
            message: `Are you sure you want to remove this ${widget.type} widget?`,
            confirmText: 'Remove',
            confirmButtonStyle: 'danger'
        });

        if (confirmed && onUpdate) {
            const updatedWidgets = { ...currentWidgets };
            if (updatedWidgets[slotName]) {
                updatedWidgets[slotName] = updatedWidgets[slotName].filter(w => w.id !== widget.id);
            }

            onUpdate({ widgets: updatedWidgets });

            if (onDirtyChange) {
                onDirtyChange(true, `removed widget from slot ${slotName}`);
            }
        }
    }, [currentWidgets, onUpdate, onDirtyChange, showConfirm]);

    // Preview functionality removed from PageEditor
    const handleWidgetPreview = useCallback(() => {
        // No preview functionality in PageEditor
    }, []);

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
                onPreview: handleWidgetPreview
            });

            // Set up confirmation dialog callback for widget removal
            rendererRef.current.showConfirmDialog = async (title, message, onConfirm) => {
                const confirmed = await showConfirm({
                    title: 'Remove Widget',
                    message: title,
                    confirmText: 'Remove',
                    confirmButtonStyle: 'danger'
                });
                if (confirmed) {
                    onConfirm();
                }
            };

            // Set up widget editor callback for slide-out panel
            if (onOpenWidgetEditor) {
                rendererRef.current.openWidgetEditor = onOpenWidgetEditor;
            }
        }
        return rendererRef.current;
    }, [editable, showConfirm, onOpenWidgetEditor, handleWidgetEdit, handleWidgetDelete, handleWidgetPreview]);

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

                let updatedWidgets = { ...currentWidgets };

                switch (action) {
                    case WIDGET_ACTIONS.ADD:
                        if (!updatedWidgets[slotName]) {
                            updatedWidgets[slotName] = [];
                        }
                        updatedWidgets[slotName] = [...updatedWidgets[slotName], widgetData];
                        break;

                    case WIDGET_ACTIONS.REMOVE:
                        if (updatedWidgets[slotName]) {
                            updatedWidgets[slotName] = updatedWidgets[slotName].filter(
                                widget => widget.id !== widgetData
                            );
                        }
                        break;

                    case WIDGET_ACTIONS.CLEAR:
                        updatedWidgets[slotName] = [];
                        break;

                    case WIDGET_ACTIONS.UPDATE:
                    case WIDGET_ACTIONS.EDIT:
                        if (updatedWidgets[slotName]) {
                            updatedWidgets[slotName] = updatedWidgets[slotName].map(
                                widget => widget.id === widgetData.id ? widgetData : widget
                            );
                        }
                        break;

                    default:
                        console.warn('ContentEditorWithWidgetFactory: Unknown widget data action', action);
                        return;
                }

                onUpdate({ widgets: updatedWidgets });

                if (onDirtyChange && action !== WIDGET_ACTIONS.UPDATE) {
                    onDirtyChange(true, `widget ${action} in slot ${slotName}`);
                }
            }
        });

    }, [layoutRenderer, onDirtyChange, onUpdate, currentWidgets, webpageData, pageVersionData]);

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

    // Update widgets when widgets prop changes
    const widgetsRef = useRef(null);
    const widgetsJsonString = JSON.stringify(currentWidgets);

    useEffect(() => {
        if (!layoutRenderer || !currentWidgets) {
            return;
        }

        // Skip if widgets content hasn't actually changed
        if (widgetsRef.current === widgetsJsonString) {
            return;
        }

        widgetsRef.current = widgetsJsonString;

        // Load widget data and update slots
        const updateSlots = () => {
            layoutRenderer.loadWidgetData(currentWidgets);

            Object.entries(currentWidgets).forEach(([slotName, slotWidgets]) => {
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
    }, [widgetsJsonString, layoutRenderer, currentWidgets]);

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
    }, [currentWidgets]);

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
        setSelectedSlot,
        getSelectedSlot: () => selectedSlot,
        saveWidgets,
        layoutRenderer
    }), [updateSlot, getSlots, getSlotConfig, selectedSlot, saveWidgets, layoutRenderer]);

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
