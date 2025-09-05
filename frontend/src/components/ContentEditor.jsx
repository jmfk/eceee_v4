/**
 * ContentEditor - Visual page editor using custom layout renderer
 * 
 * Provides a visual interface for editing page content with slot-based widget management.
 * Uses LayoutRenderer for direct DOM manipulation instead of React's virtual DOM.
 */

import React, { useRef, useEffect, useCallback, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import LayoutRenderer from './LayoutRenderer';
import { WIDGET_ACTIONS } from '../utils/widgetConstants';
import { useNotificationContext } from './NotificationManager';
import { useRenderTracker, useEffectTracker, useStabilityTracker } from '../utils/debugHooks';

const ContentEditor = forwardRef(({
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
  // Debug tracking
  const renderCount = useRenderTracker('ContentEditor', {
    layoutJson, editable, webpageData, pageVersionData, isNewPage
  })
  useStabilityTracker(layoutJson, 'ContentEditor.layoutJson')
  useStabilityTracker(webpageData, 'ContentEditor.webpageData')
  useStabilityTracker(pageVersionData, 'ContentEditor.pageVersionData')

  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const eventListenersRef = useRef(new Map()); // Track event listeners for cleanup
  const slotInteractivitySetupRef = useRef(false); // Track if interactivity is already set up

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Get notification context for confirmation dialogs
  const { showConfirm } = useNotificationContext();

  // Get current widgets from pageVersionData (only source of widgets)
  const currentWidgets = useMemo(() => {
    return pageVersionData?.widgets || {};
  }, [pageVersionData?.widgets]);

  // Get page ID from webpageData (the main page record)
  const pageId = webpageData?.id;

  // Early return if critical props are missing
  if (!webpageData && !pageVersionData) {
    console.warn("ContentEditor: No valid page data provided - component may not render properly");
  }

  // Create a widget DOM element using the shared widget renderer
  const createWidgetElement = useCallback((widget) => {
    // Import the shared widget renderer utility
    const { createWidgetElement: createSharedWidgetElement } = require('../utils/widgetRenderer');
    return createSharedWidgetElement(widget);
  }, []);

  // Memoize the layout renderer to prevent unnecessary re-creation
  const layoutRenderer = useMemo(() => {
    // Always create new renderer when editable state changes
    if (!rendererRef.current || rendererRef.current.editable !== editable) {
      // Clean up existing renderer if it exists
      if (rendererRef.current) {
        rendererRef.current.cleanup();
      }
      rendererRef.current = new LayoutRenderer({ editable });
      rendererRef.current.setWidgetRenderer(createWidgetElement);

      // No confirmation dialog needed for widget removal

      // Set up widget editor callback for slide-out panel
      if (onOpenWidgetEditor) {
        rendererRef.current.openWidgetEditor = onOpenWidgetEditor;
      }
    }
    return rendererRef.current;
  }, [createWidgetElement, editable, onOpenWidgetEditor]);



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
      // Notify parent component about version change via onUpdate
      if (onUpdate) {
        onUpdate({
          webpageData,
          pageVersionData: versionData,
          versionChanged: true // Signal that this is a version change
        });
      }
    });

    layoutRenderer.setVersionCallback('version-error', (errorMessage) => {
      console.error('ContentEditor: Version error', errorMessage);
      setError(errorMessage);
    });

  }, [layoutRenderer, pageId, isNewPage, onUpdate, webpageData, pageVersionData?.versionId, pageVersionData?.versionNumber, pageVersionData?.versionTitle, pageVersionData?.publicationStatus]);

  // Sync current version with LayoutRenderer when pageVersionData changes
  useEffect(() => {
    if (!layoutRenderer || !pageVersionData?.versionId) {
      return;
    }

    // Update LayoutRenderer's current version when PageEditor switches versions
    const currentVersion = {
      id: pageVersionData.versionId,
      versionNumber: pageVersionData.versionNumber,
      versionTitle: pageVersionData.versionTitle || pageVersionData.description || 'No description',
      publicationStatus: pageVersionData.publicationStatus || 'draft'
    };

    layoutRenderer.currentVersion = currentVersion;
    layoutRenderer.updateVersionSelector();
  }, [layoutRenderer, pageVersionData?.versionId, pageVersionData?.versionNumber, pageVersionData?.versionTitle, pageVersionData?.publicationStatus]);

  // Apply theme to layout renderer when pageVersionData theme changes
  useEffect(() => {
    if (!layoutRenderer || !pageVersionData?.theme) return;

    // Fetch and apply theme
    const applyTheme = async () => {
      try {
        const { themesApi } = await import('../api');
        const theme = await themesApi.get(pageVersionData.theme);
        layoutRenderer.applyTheme(theme);
      } catch (error) {
        console.error('ContentEditor: Error applying theme', error);
      }
    };

    applyTheme();
  }, [layoutRenderer, pageVersionData?.theme]);

  // Set up dirty state communication with LayoutRenderer
  useEffect(() => {
    if (!layoutRenderer) return;

    layoutRenderer.setUICallbacks({
      onDirtyStateChanged: (isDirty, reason) => {
        // Propagate dirty state up to PageEditor
        if (onDirtyChange) {
          onDirtyChange(isDirty, reason);
        }
      }
    });

    // NEW: Set up widget data change callbacks for single source of truth
    layoutRenderer.setWidgetDataCallbacks({
      widgetDataChanged: (action, slotName, widgetData) => {


        if (!onUpdate) {
          console.warn('ContentEditor: Cannot update widget data - missing onUpdate callback');
          return;
        }

        // Create updated widgets from current state
        let updatedWidgets = { ...currentWidgets };

        switch (action) {
          case WIDGET_ACTIONS.ADD:
            // Add widget to slot array
            if (!updatedWidgets[slotName]) {
              updatedWidgets[slotName] = [];
            }
            updatedWidgets[slotName] = [...updatedWidgets[slotName], widgetData];
            break;

          case WIDGET_ACTIONS.REMOVE:
            // Remove widget by ID from slot array
            // Note: widgetData is just the widgetId string for REMOVE action


            if (updatedWidgets[slotName]) {
              const beforeCount = updatedWidgets[slotName].length;
              updatedWidgets[slotName] = updatedWidgets[slotName].filter(
                widget => widget.id !== widgetData
              );
              const afterCount = updatedWidgets[slotName].length;

            }
            break;

          case WIDGET_ACTIONS.CLEAR:
            // Clear all widgets from slot
            updatedWidgets[slotName] = [];
            break;

          case WIDGET_ACTIONS.UPDATE:
          case WIDGET_ACTIONS.EDIT:
            // Update existing widget in slot
            if (updatedWidgets[slotName]) {
              updatedWidgets[slotName] = updatedWidgets[slotName].map(
                widget => widget.id === widgetData.id ? widgetData : widget
              );
            }
            break;

          default:
            console.warn('ContentEditor: Unknown widget data action', action);
            return;
        }

        // Update pageVersionData with new widgets through parent component


        // Pass only the widgets field update, not the entire objects
        onUpdate({
          widgets: updatedWidgets
        });

        // Only mark as dirty for persistent changes (not real-time preview updates)
        if (onDirtyChange && action !== WIDGET_ACTIONS.UPDATE) {
          onDirtyChange(true, `widget ${action} in slot ${slotName}`);
        }


      }
    });

  }, [layoutRenderer, onDirtyChange, onUpdate, currentWidgets, webpageData, pageVersionData]);

  // Cleanup function for event listeners
  const cleanupEventListeners = useCallback(() => {
    eventListenersRef.current.forEach((cleanup, element) => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    });
    eventListenersRef.current.clear();
  }, []);

  // Add tracked event listener
  const addTrackedEventListener = useCallback((element, event, handler, options = {}) => {
    try {
      element.addEventListener(event, handler, options);

      const cleanup = () => {
        element.removeEventListener(event, handler, options);
      };

      eventListenersRef.current.set(element, cleanup);
    } catch (error) {
      console.error('ContentEditor: Error adding event listener', error);
    }
  }, []);

  // Setup slot interactivity (only when editable)
  const setupSlotInteractivity = useCallback(() => {
    if (!containerRef.current || !editable) return;

    const slotElements = containerRef.current.querySelectorAll('[data-slot-name]');

    slotElements.forEach(slotElement => {
      const slotName = slotElement.getAttribute('data-slot-name');

      // Add visual feedback classes
      slotElement.classList.add('slot-editable');

      // Create click handler
      const handleSlotClick = (e) => {
        e.stopPropagation();
        setSelectedSlot(slotName);

        // Call external slot click handler if provided
        if (onSlotClick) {
          onSlotClick(slotName, slotElement);
        }
      };

      // Add tracked event listener
      addTrackedEventListener(slotElement, 'click', handleSlotClick);
    });
  }, [onSlotClick, addTrackedEventListener, editable]);

  // Utility to handle fixed positioned elements within the layout container
  const handleFixedPositioning = useCallback(() => {
    if (!containerRef.current) return;

    // Find all fixed positioned elements within the container
    const fixedElements = containerRef.current.querySelectorAll('*');

    fixedElements.forEach(element => {
      const computedStyle = window.getComputedStyle(element);

      if (computedStyle.position === 'fixed') {
        // Add a class to identify converted elements
        element.classList.add('fixed-contained');

        // Convert fixed positioning to absolute within the containing block
        element.style.position = 'absolute';

        // Ensure the element stays within bounds
        element.style.maxWidth = '100%';
        element.style.maxHeight = '100%';
      }
    });
  }, []);

  // Setup function to handle layout interactivity and positioning
  const setupLayoutInteractivity = useCallback(() => {
    if (!containerRef.current || !editable) return;

    const timeout = setTimeout(() => {
      try {
        // Handle fixed positioning conversion
        handleFixedPositioning();

        // Setup slot interactivity
        setupSlotInteractivity();

        // Mark interactivity as set up
        slotInteractivitySetupRef.current = true;
      } catch (error) {
        console.error('ContentEditor: Error setting up layout interactivity', error);
        setError('Failed to setup layout interactivity');
      }
    }, 100);

    return () => {
      clearTimeout(timeout);
    };
  }, [editable, handleFixedPositioning, setupSlotInteractivity]);

  // Render layout when layoutJson changes
  useEffectTracker('ContentEditor.renderLayout', [layoutJson, layoutRenderer, cleanupEventListeners, editable])
  useEffect(() => {
    if (!layoutJson || !containerRef.current) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Clean up existing event listeners
      cleanupEventListeners();

      // Render the layout
      layoutRenderer.render(layoutJson, containerRef);

      setIsLoading(false);
    } catch (err) {
      console.error('ContentEditor: Error rendering layout', err);
      setError(err.message);
      setIsLoading(false);
    }
  }, [layoutJson, layoutRenderer, cleanupEventListeners, editable]);

  // Update widgets when widgets prop changes (with proper React state management)
  const widgetsRef = useRef(null);
  const widgetsJsonString = JSON.stringify(currentWidgets);

  useEffectTracker('ContentEditor.updateWidgets', [widgetsJsonString, layoutRenderer, currentWidgets])
  useEffect(() => {
    if (!layoutRenderer || !currentWidgets) {
      return;
    }

    // Skip if widgets content hasn't actually changed
    if (widgetsRef.current === widgetsJsonString) {
      return;
    }

    widgetsRef.current = widgetsJsonString;

    // Use current widgets directly
    let widgetsToLoad = currentWidgets;

    // Use React's scheduling to batch widget updates
    const updateSlots = () => {
      // Load widget data and mark page as saved BEFORE updating slots
      layoutRenderer.loadWidgetData(widgetsToLoad);

      Object.entries(widgetsToLoad).forEach(([slotName, slotWidgets]) => {
        try {
          layoutRenderer.updateSlot(slotName, slotWidgets);
        } catch (error) {
          console.error(`ContentEditor: Error updating slot ${slotName}`, error);
        }
      });
    };

    // Schedule update for next frame to avoid blocking UI
    const timeoutId = setTimeout(updateSlots, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [widgetsJsonString, layoutRenderer, currentWidgets]);

  // Inject CSS styles for slot interactivity with proper cleanup
  useEffect(() => {
    const styleId = 'content-editor-styles';

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
      
      .widget-item:hover .widget-edit-btn {
        opacity: 1;
      }
      
      /* Preview mode styles - disable editing visual cues */
      .preview-mode .slot-editable {
        cursor: default;
      }
      
      .preview-mode .slot-editable:hover {
        box-shadow: none;
      }
      
      .preview-mode .widget-item:hover .widget-edit-btn,
      .preview-mode .widget-edit-btn {
        display: none !important;
      }
      
      .preview-mode .layout-container {
        border: none !important;
      }

      /* Device content styles for mobile/tablet preview */
      .device-content {
        overflow: visible !important;
        height: auto !important;
        min-height: auto !important;
      }
      
      .device-content .layout-container {
        height: auto !important;
        min-height: auto !important;
        overflow: visible !important;
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

  // Set up layout interactivity (slots and positioning) in edit mode with proper cleanup
  useEffect(() => {
    if (!containerRef.current || !editable || slotInteractivitySetupRef.current) {
      return;
    }

    return setupLayoutInteractivity();
  }, [editable, setupLayoutInteractivity]);



  // Handle slot updates from external sources
  const updateSlot = useCallback((slotName, newWidgets) => {
    if (layoutRenderer) {
      layoutRenderer.updateSlot(slotName, newWidgets);
    }
    // Note: onWidgetUpdate removed - unified save system handles persistence
  }, [layoutRenderer]);

  // Get available slots
  const getSlots = useCallback(() => {
    if (layoutRenderer) {
      return layoutRenderer.getSlotNames();
    }
    return [];
  }, [layoutRenderer]);

  // Get slot configuration
  const getSlotConfig = useCallback((slotName) => {
    if (layoutRenderer) {
      return layoutRenderer.getSlotConfig(slotName);
    }
    return null;
  }, [layoutRenderer]);

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
      const styleToRemove = document.getElementById('content-editor-styles');
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, [cleanupEventListeners]);

  // NEW: Return current widget data from currentWidgets (single source of truth)
  const saveWidgets = useCallback((options = {}) => {

    if (!currentWidgets) {
      console.warn("⚠️ SAVE SIGNAL: currentWidgets not available");
      return {};
    }

    try {
      // Simply return the current widgets - no DOM collection needed
      return currentWidgets;
    } catch (error) {
      console.error("❌ SAVE SIGNAL: ContentEditor save failed", error);
      throw error;
    }
  }, [currentWidgets]);

  // Enable auto-save functionality
  const enableAutoSave = useCallback((enabled = false, delay = 5000) => {
    if (!layoutRenderer) return;

    layoutRenderer.autoSaveEnabled = enabled;
    layoutRenderer.autoSaveDelay = delay;
  }, [layoutRenderer]);

  // Manually trigger auto-save check
  const triggerAutoSave = useCallback(() => {
    if (!layoutRenderer) return;
    layoutRenderer.scheduleAutoSave('manual_trigger');
  }, [layoutRenderer]);

  // Set up auto-save when editing is enabled AND widgets are loaded
  useEffect(() => {
    if (editable && layoutRenderer && currentWidgets) {
      // Delay auto-save activation to ensure widgets are loaded first
      const autoSaveTimeoutId = setTimeout(() => {
        enableAutoSave(true, 10000);
      }, 100); // Small delay to ensure widget loading is complete

      return () => clearTimeout(autoSaveTimeoutId);
    } else if (layoutRenderer) {
      // Disable auto-save for non-editable mode or when no widgets
      enableAutoSave(false);
    }
  }, [editable, layoutRenderer, currentWidgets, enableAutoSave]);

  // Expose methods for external use
  const api = useMemo(() => ({
    updateSlot,
    getSlots,
    getSlotConfig,
    setSelectedSlot,
    getSelectedSlot: () => selectedSlot,
    saveWidgets,
    enableAutoSave,
    triggerAutoSave,
    layoutRenderer  // Expose layoutRenderer for unified save system
  }), [updateSlot, getSlots, getSlotConfig, selectedSlot, saveWidgets, enableAutoSave, triggerAutoSave, layoutRenderer]);

  // Expose API methods to parent components via ref
  useImperativeHandle(ref, () => api, [api]);

  // Cleanup version management on unmount
  useEffect(() => {
    return () => {
      if (layoutRenderer) {
        // Clear version callbacks only (we don't use LayoutRenderer's version selector)
        layoutRenderer.versionCallbacks?.clear();
      }
    };
  }, [layoutRenderer]);



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
    <div className={`content-editor relative h-full flex flex-col ${className}`}>
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
          height: '100%', // Use full available height from parent
          // Additional styling for visual boundaries
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
          backgroundColor: 'white'
        }}
      />


    </div>
  );
});

// Add display name for debugging
ContentEditor.displayName = 'ContentEditor';

export default ContentEditor;