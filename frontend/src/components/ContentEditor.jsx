/**
 * ContentEditor - Visual page editor using custom layout renderer
 * 
 * Provides a visual interface for editing page content with slot-based widget management.
 * Uses LayoutRenderer for direct DOM manipulation instead of React's virtual DOM.
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import LayoutRenderer from './LayoutRenderer';

const ContentEditor = ({
  layoutJson,
  widgets = {},
  editable = false,
  onSlotClick,
  onWidgetUpdate,
  className = ''
}) => {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const eventListenersRef = useRef(new Map()); // Track event listeners for cleanup
  const slotInteractivitySetupRef = useRef(false); // Track if interactivity is already set up

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Create a widget DOM element with proper memory management
  const createWidgetElement = useCallback((widget) => {
    try {
      // Validate widget object
      if (!widget || typeof widget !== 'object' || !widget.type) {
        throw new Error('Invalid widget object');
      }

      const element = document.createElement('div');
      element.className = 'widget-item bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm';

      // Add widget data attributes (sanitized)
      const widgetType = String(widget.type).replace(/[^a-zA-Z0-9-_]/g, '');
      element.setAttribute('data-widget-type', widgetType);

      if (widget.id) {
        const widgetId = String(widget.id).replace(/[^a-zA-Z0-9-_]/g, '');
        element.setAttribute('data-widget-id', widgetId);
      }

      // Create widget content based on type with XSS protection
      const escapeHtml = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };

      let content = '';

      switch (widget.type) {
        case 'text-block':
          content = `
            <div class="text-widget">
              ${widget.config?.title ? `<h3 class="font-semibold text-gray-900 mb-2">${escapeHtml(widget.config.title)}</h3>` : ''}
              <div class="text-gray-700">${widget.config?.content || 'Text content will appear here...'}</div>
            </div>
          `;
          break;

        case 'image':
          const imgSrc = widget.config?.image_url ? escapeHtml(widget.config.image_url) : '';
          const altText = widget.config?.alt_text ? escapeHtml(widget.config.alt_text) : 'Image';
          const caption = widget.config?.caption ? escapeHtml(widget.config.caption) : '';
          content = `
            <div class="image-widget text-center">
              ${imgSrc ? `<img src="${imgSrc}" alt="${altText}" class="max-w-full h-auto rounded" />` : '<div class="bg-gray-200 h-32 rounded flex items-center justify-center text-gray-500">Image placeholder</div>'}
              ${caption ? `<p class="text-sm text-gray-600 mt-2">${caption}</p>` : ''}
            </div>
          `;
          break;

        case 'button':
          const buttonText = widget.config?.text ? escapeHtml(widget.config.text) : 'Button';
          const buttonUrl = widget.config?.url ? escapeHtml(widget.config.url) : '#';
          content = `
            <div class="button-widget text-center">
              <a href="${buttonUrl}" class="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors">
                ${buttonText}
              </a>
            </div>
          `;
          break;

        case 'spacer':
          const height = widget.config?.height === 'custom' ? widget.config?.custom_height :
            widget.config?.height === 'small' ? '16px' :
              widget.config?.height === 'large' ? '64px' : '32px';
          content = `
            <div class="spacer-widget" style="height: ${height};">
              <div class="h-full border-l-2 border-r-2 border-dashed border-gray-300 bg-gray-100 opacity-50 flex items-center justify-center">
                <span class="text-xs text-gray-500">Spacer (${height})</span>
              </div>
            </div>
          `;
          break;

        case 'html-block':
          content = `
            <div class="html-widget">
              ${widget.config?.html_content || '<div class="text-gray-500 italic">HTML content will appear here...</div>'}
            </div>
          `;
          break;

        default:
          content = `
            <div class="generic-widget text-center p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded">
              <div class="text-sm font-medium text-gray-700">${escapeHtml(widget.type)} Widget</div>
              <div class="text-xs text-gray-500 mt-1">Widget content will appear here</div>
            </div>
          `;
      }

      element.innerHTML = content;
      return element;
    } catch (error) {
      console.error('ContentEditor: Error creating widget element', error);

      // Return a safe fallback element
      const fallback = document.createElement('div');
      fallback.className = 'widget-item bg-red-50 border border-red-200 rounded-lg p-4 mb-3';
      fallback.innerHTML = `
        <div class="text-red-600 text-sm">
          <strong>Widget Error:</strong> Unable to render widget
        </div>
      `;
      return fallback;
    }
  }, []);

  // Memoize the layout renderer to prevent unnecessary re-creation
  const layoutRenderer = useMemo(() => {
    if (!rendererRef.current) {
      rendererRef.current = new LayoutRenderer();
      rendererRef.current.setWidgetRenderer(createWidgetElement);
    }
    return rendererRef.current;
  }, [createWidgetElement]);

  // Cleanup function for event listeners
  const cleanupEventListeners = useCallback(() => {
    eventListenersRef.current.forEach((cleanup, element) => {
      if (typeof cleanup === 'function') {
        try {
          cleanup();
        } catch (error) {
          console.warn('ContentEditor: Error during event listener cleanup', error);
        }
      }
    });
    eventListenersRef.current.clear();
    slotInteractivitySetupRef.current = false;
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

  // Render layout when layoutJson changes
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
  }, [layoutJson, layoutRenderer, cleanupEventListeners]);

  // Update widgets when widgets prop changes (with proper React state management)
  useEffect(() => {
    if (!layoutRenderer || !widgets) {
      return;
    }

    // Use React's scheduling to batch widget updates
    const updateSlots = () => {
      Object.entries(widgets).forEach(([slotName, slotWidgets]) => {
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
  }, [widgets, layoutRenderer]);

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
      
      .slot-selected {
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.6) !important;
      }
      
      .widget-item:hover .widget-edit-btn {
        opacity: 1;
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

  // Set up interactivity for slots in edit mode with proper cleanup
  useEffect(() => {
    if (!containerRef.current || !editable || slotInteractivitySetupRef.current) {
      return;
    }

    const setupInteractivity = () => {
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

          // Add visual selection indicator
          const previousSelected = document.querySelectorAll('.slot-selected');
          previousSelected.forEach(el => {
            el.classList.remove('slot-selected');
          });
          slotElement.classList.add('slot-selected');
        };

        // Add tracked event listener
        addTrackedEventListener(slotElement, 'click', handleSlotClick);
      });

      slotInteractivitySetupRef.current = true;
    };

    // Set up interactivity after DOM is ready
    const timeoutId = setTimeout(setupInteractivity, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [editable, onSlotClick, addTrackedEventListener]);



  // Handle slot updates from external sources
  const updateSlot = useCallback((slotName, newWidgets) => {
    if (layoutRenderer) {
      layoutRenderer.updateSlot(slotName, newWidgets);
    }

    if (onWidgetUpdate) {
      onWidgetUpdate(slotName, newWidgets);
    }
  }, [layoutRenderer, onWidgetUpdate]);

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

  // Expose methods for external use
  const api = useMemo(() => ({
    updateSlot,
    getSlots,
    getSlotConfig,
    setSelectedSlot,
    getSelectedSlot: () => selectedSlot
  }), [updateSlot, getSlots, getSlotConfig, selectedSlot]);



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
    <div className={`content-editor relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          <div className="text-gray-600">Loading layout...</div>
        </div>
      )}

      <div
        ref={containerRef}
        className={`layout-container ${editable ? 'editable' : ''}`}
        style={{
          minHeight: '400px'
        }}
      />

      {editable && selectedSlot && (
        <div className="slot-info fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-sm z-20">
          <div className="font-medium">Selected Slot: {selectedSlot}</div>
          <div className="text-gray-600 text-xs mt-1">
            Click outside to deselect
          </div>
          <button
            onClick={() => setSelectedSlot(null)}
            className="mt-2 text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
          >
            Deselect
          </button>
        </div>
      )}
    </div>
  );
};

// Add display name for debugging
ContentEditor.displayName = 'ContentEditor';

export default ContentEditor;