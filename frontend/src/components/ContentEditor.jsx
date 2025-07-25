/**
 * ContentEditor - Visual page editor using custom layout renderer
 * 
 * Provides a visual interface for editing page content with slot-based widget management.
 * Uses LayoutRenderer for direct DOM manipulation instead of React's virtual DOM.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import LayoutRenderer from './LayoutRenderer';

function ContentEditor({
  layoutJson,
  widgets = {},
  onWidgetUpdate,
  onSlotClick,
  editable = true,
  className = ''
}) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Initialize renderer
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.destroy();
    }

    rendererRef.current = new LayoutRenderer();

    // Set up widget renderer
    rendererRef.current.setWidgetRenderer((widget) => {
      return createWidgetElement(widget);
    });

    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy();
      }
    };
  }, []);

  // Render layout when layoutJson changes
  useEffect(() => {
    if (!layoutJson || !rendererRef.current) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      rendererRef.current.render(layoutJson, containerRef);

      // Set up slot click handlers if in editable mode
      if (editable) {
        setupSlotInteractivity();
      }

      setIsLoading(false);
    } catch (err) {
      console.error('ContentEditor: Error rendering layout', err);
      setError(err.message);
      setIsLoading(false);
    }
  }, [layoutJson, editable]);

  // Update widgets when widgets prop changes
  useEffect(() => {
    if (!rendererRef.current || !widgets) {
      return;
    }

    Object.entries(widgets).forEach(([slotName, slotWidgets]) => {
      rendererRef.current.updateSlot(slotName, slotWidgets);
    });
  }, [widgets]);

  // Inject CSS styles for slot interactivity
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

  // Set up interactivity for slots in edit mode
  const setupSlotInteractivity = useCallback(() => {
    if (!containerRef.current || !editable) {
      return;
    }

    // Add click handlers to all slot elements
    const slotElements = containerRef.current.querySelectorAll('[data-slot-name]');

    slotElements.forEach(slotElement => {
      const slotName = slotElement.getAttribute('data-slot-name');

      // Add visual feedback classes
      slotElement.classList.add('slot-editable');

      // Add click handler
      const handleSlotClick = (e) => {
        e.stopPropagation();
        setSelectedSlot(slotName);

        // Call external slot click handler if provided
        if (onSlotClick) {
          onSlotClick(slotName, slotElement);
        }

        // Add visual selection indicator
        document.querySelectorAll('.slot-selected').forEach(el => {
          el.classList.remove('slot-selected');
        });
        slotElement.classList.add('slot-selected');
      };

      slotElement.addEventListener('click', handleSlotClick);

      // Store handler reference for cleanup
      slotElement._slotClickHandler = handleSlotClick;
    });
  }, [editable, onSlotClick]);

  // Create a widget DOM element
  const createWidgetElement = useCallback((widget) => {
    const element = document.createElement('div');
    element.className = 'widget-item bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm';

    // Add widget data attributes
    element.setAttribute('data-widget-type', widget.type);
    if (widget.id) {
      element.setAttribute('data-widget-id', widget.id);
    }

    // Create widget content based on type
    let content = '';

    switch (widget.type) {
      case 'text':
        content = `
          <div class="widget-text">
            <div class="text-sm font-medium text-gray-700 mb-2">Text Widget</div>
            <div class="text-gray-900">${widget.config?.content || 'No content'}</div>
          </div>
        `;
        break;

      case 'image':
        content = `
          <div class="widget-image">
            <div class="text-sm font-medium text-gray-700 mb-2">Image Widget</div>
            ${widget.config?.url ?
            `<img src="${widget.config.url}" alt="${widget.config.alt || ''}" class="max-w-full h-auto rounded">` :
            '<div class="bg-gray-100 border-2 border-dashed border-gray-300 rounded p-8 text-center text-gray-500">No image</div>'
          }
          </div>
        `;
        break;

      case 'menu':
      case 'navigation':
        const items = widget.config?.items || [];
        content = `
          <div class="widget-menu">
            <div class="text-sm font-medium text-gray-700 mb-2">Menu Widget</div>
            <nav class="space-y-1">
              ${items.map(item => `<a href="#" class="block px-3 py-2 rounded hover:bg-gray-100">${item}</a>`).join('')}
            </nav>
          </div>
        `;
        break;

      case 'recent_posts':
        content = `
          <div class="widget-recent-posts">
            <div class="text-sm font-medium text-gray-700 mb-2">Recent Posts</div>
            <div class="space-y-2 text-sm">
              ${Array.from({ length: widget.config?.count || 3 }, (_, i) =>
          `<div class="flex justify-between"><span>Post ${i + 1}</span><span class="text-gray-500">${widget.config?.show_date ? 'Jan ' + (i + 1) : ''}</span></div>`
        ).join('')}
            </div>
          </div>
        `;
        break;

      case 'social_media':
        const platforms = widget.config?.platforms || [];
        content = `
          <div class="widget-social">
            <div class="text-sm font-medium text-gray-700 mb-2">Social Media</div>
            <div class="flex space-x-2">
              ${platforms.map(platform => `<div class="w-8 h-8 bg-blue-500 rounded flex items-center justify-center text-white text-xs">${platform[0].toUpperCase()}</div>`).join('')}
            </div>
          </div>
        `;
        break;

      case 'copyright':
        content = `
          <div class="widget-copyright">
            <div class="text-sm font-medium text-gray-700 mb-2">Copyright</div>
            <div class="text-sm text-gray-600">© ${widget.config?.year || new Date().getFullYear()} ${widget.config?.company || 'Your Company'}</div>
          </div>
        `;
        break;

      default:
        content = `
          <div class="widget-default">
            <div class="text-sm font-medium text-gray-700 mb-2">${widget.type} Widget</div>
            <div class="text-xs text-gray-500">
              <pre class="bg-gray-50 p-2 rounded text-xs overflow-x-auto">${JSON.stringify(widget.config, null, 2)}</pre>
            </div>
          </div>
        `;
    }

    element.innerHTML = content;

    // Add edit button if in editable mode
    if (editable) {
      const editButton = document.createElement('button');
      editButton.className = 'widget-edit-btn absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity';
      editButton.textContent = 'Edit';
      editButton.onclick = (e) => {
        e.stopPropagation();
        console.log('Edit widget:', widget);
      };

      element.style.position = 'relative';
      element.appendChild(editButton);

      // Show edit button on hover
      element.addEventListener('mouseenter', () => {
        editButton.style.opacity = '1';
      });
      element.addEventListener('mouseleave', () => {
        editButton.style.opacity = '0';
      });
    }

    return element;
  }, [editable]);

  // Handle slot updates from external sources
  const updateSlot = useCallback((slotName, newWidgets) => {
    if (rendererRef.current) {
      rendererRef.current.updateSlot(slotName, newWidgets);
    }

    if (onWidgetUpdate) {
      onWidgetUpdate(slotName, newWidgets);
    }
  }, [onWidgetUpdate]);

  // Get available slots
  const getSlots = useCallback(() => {
    if (rendererRef.current) {
      return rendererRef.current.getSlotNames();
    }
    return [];
  }, []);

  // Get slot configuration
  const getSlotConfig = useCallback((slotName) => {
    if (rendererRef.current) {
      return rendererRef.current.getSlotConfig(slotName);
    }
    return null;
  }, []);

  if (error) {
    return (
      <div className={`content-editor-error p-4 border border-red-300 bg-red-50 rounded ${className}`}>
        <div className="text-red-800 font-medium">Error rendering layout</div>
        <div className="text-red-600 text-sm mt-1">{error}</div>
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
        </div>
      )}

    </div>
  );
}

// Export additional utilities
ContentEditor.updateSlot = (rendererRef, slotName, widgets) => {
  if (rendererRef.current) {
    rendererRef.current.updateSlot(slotName, widgets);
  }
};

ContentEditor.getSlots = (rendererRef) => {
  if (rendererRef.current) {
    return rendererRef.current.getSlotNames();
  }
  return [];
};

export default ContentEditor;