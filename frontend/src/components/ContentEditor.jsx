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

  // Memoize the layout renderer to prevent unnecessary re-creation
  const layoutRenderer = useMemo(() => {
    if (!rendererRef.current) {
      rendererRef.current = new LayoutRenderer();
      rendererRef.current.setWidgetRenderer(createWidgetElement);
    }
    return rendererRef.current;
  }, []);

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
        case 'text':
          content = `
            <div class="widget-text">
              <div class="text-sm font-medium text-gray-700 mb-2">Text Widget</div>
              <div class="text-gray-900">${escapeHtml(widget.config?.content || 'No content')}</div>
            </div>
          `;
          break;

        case 'image':
          const imageUrl = widget.config?.url ? escapeHtml(widget.config.url) : '';
          const imageAlt = widget.config?.alt ? escapeHtml(widget.config.alt) : '';
          content = `
            <div class="widget-image">
              <div class="text-sm font-medium text-gray-700 mb-2">Image Widget</div>
              ${imageUrl ?
              `<img src="${imageUrl}" alt="${imageAlt}" class="max-w-full h-auto rounded">` :
              '<div class="bg-gray-100 border-2 border-dashed border-gray-300 rounded p-8 text-center text-gray-500">No image</div>'
            }
            </div>
          `;
          break;

        case 'menu':
        case 'navigation':
          const items = Array.isArray(widget.config?.items) ? widget.config.items : [];
          content = `
            <div class="widget-menu">
              <div class="text-sm font-medium text-gray-700 mb-2">Menu Widget</div>
              <nav class="space-y-1">
                ${items.map(item => `<a href="#" class="block px-3 py-2 rounded hover:bg-gray-100">${escapeHtml(String(item))}</a>`).join('')}
              </nav>
            </div>
          `;
          break;

        case 'recent_posts':
          const postCount = Math.max(1, Math.min(parseInt(widget.config?.count) || 3, 10));
          const showDate = Boolean(widget.config?.show_date);
          content = `
            <div class="widget-recent-posts">
              <div class="text-sm font-medium text-gray-700 mb-2">Recent Posts</div>
              <div class="space-y-2 text-sm">
                ${Array.from({ length: postCount }, (_, i) =>
            `<div class="flex justify-between"><span>Post ${i + 1}</span><span class="text-gray-500">${showDate ? 'Jan ' + (i + 1) : ''}</span></div>`
          ).join('')}
              </div>
            </div>
          `;
          break;

        case 'social_media':
          const platforms = Array.isArray(widget.config?.platforms) ? widget.config.platforms : [];
          content = `
            <div class="widget-social">
              <div class="text-sm font-medium text-gray-700 mb-2">Social Media</div>
              <div class="flex space-x-2">
                ${platforms.map(platform => {
            const platformName = escapeHtml(String(platform));
            const initial = platformName.charAt(0).toUpperCase();
            return `<div class="w-8 h-8 bg-blue-500 rounded flex items-center justify-center text-white text-xs">${initial}</div>`;
          }).join('')}
              </div>
            </div>
          `;
          break;

        case 'copyright':
          const year = parseInt(widget.config?.year) || new Date().getFullYear();
          const company = escapeHtml(widget.config?.company || 'Your Company');
          content = `
            <div class="widget-copyright">
              <div class="text-sm font-medium text-gray-700 mb-2">Copyright</div>
              <div class="text-sm text-gray-600">© ${year} ${company}</div>
            </div>
          `;
          break;

        default:
          const configJson = widget.config ? escapeHtml(JSON.stringify(widget.config, null, 2)) : '';
          content = `
            <div class="widget-default">
              <div class="text-sm font-medium text-gray-700 mb-2">${escapeHtml(widget.type)} Widget</div>
              <div class="text-xs text-gray-500">
                <pre class="bg-gray-50 p-2 rounded text-xs overflow-x-auto">${configJson}</pre>
              </div>
            </div>
          `;
      }

      element.innerHTML = content;

      // Add edit button if in editable mode with proper event handling
      if (editable) {
        const editButton = document.createElement('button');
        editButton.className = 'widget-edit-btn absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity';
        editButton.textContent = 'Edit';

        const handleEditClick = (e) => {
          e.stopPropagation();
          console.log('Edit widget:', widget);
        };

        editButton.addEventListener('click', handleEditClick);

        element.style.position = 'relative';
        element.appendChild(editButton);

        // Add hover handlers with proper cleanup
        const handleMouseEnter = () => {
          editButton.style.opacity = '1';
        };

        const handleMouseLeave = () => {
          editButton.style.opacity = '0';
        };

        element.addEventListener('mouseenter', handleMouseEnter);
        element.addEventListener('mouseleave', handleMouseLeave);

        // Store cleanup function for this widget element
        const cleanup = () => {
          editButton.removeEventListener('click', handleEditClick);
          element.removeEventListener('mouseenter', handleMouseEnter);
          element.removeEventListener('mouseleave', handleMouseLeave);
        };

        eventListenersRef.current.set(element, cleanup);
      }

      return element;
    } catch (error) {
      console.error('ContentEditor: Error creating widget element', error);

      // Return error element
      const errorElement = document.createElement('div');
      errorElement.className = 'widget-error border border-red-300 bg-red-50 rounded p-3 mb-2';
      errorElement.textContent = `Widget Error: ${error.message}`;
      return errorElement;
    }
  }, [editable]);

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

  // Use imperative handle if ref is provided
  React.useImperativeHandle(React.forwardRef(() => { }), () => api, [api]);

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