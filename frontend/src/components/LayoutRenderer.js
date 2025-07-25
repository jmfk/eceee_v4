/**
 * LayoutRenderer - Custom DOM renderer for JSON layout structures
 * 
 * Renders JSON layout data directly to DOM elements bypassing React's virtual DOM.
 * Supports slot-based widget rendering with default widget fallbacks.
 */

class LayoutRenderer {
  constructor() {
    this.slotContainers = new Map(); // Map of slot names to DOM elements
    this.slotConfigs = new Map(); // Map of slot names to their configurations
    this.widgetRenderer = null; // Will be set externally for widget rendering
  }

  /**
   * Render layout JSON structure to a DOM element
   * @param {Object} layout - JSON layout structure
   * @param {React.RefObject} targetRef - React ref to target DOM element
   */
  render(layout, targetRef) {
    if (!targetRef.current) {
      console.warn('LayoutRenderer: Target ref is not available');
      return;
    }

    try {
      // Clear existing content
      targetRef.current.innerHTML = '';
      
      // Reset internal maps
      this.slotContainers.clear();
      this.slotConfigs.clear();

      // Render the layout structure
      const rootElement = this.renderNode(layout.structure || layout);
      targetRef.current.appendChild(rootElement);

      console.log('LayoutRenderer: Layout rendered successfully', {
        slots: Array.from(this.slotContainers.keys()),
        configs: Array.from(this.slotConfigs.keys())
      });

    } catch (error) {
      console.error('LayoutRenderer: Error rendering layout', error);
      targetRef.current.innerHTML = `<div class="error">Error rendering layout: ${error.message}</div>`;
    }
  }

  /**
   * Update widgets in a specific slot
   * @param {string} slotName - Name of the slot to update
   * @param {Array} widgets - Array of widget objects to render
   */
  updateSlot(slotName, widgets = []) {
    const container = this.slotContainers.get(slotName);
    
    if (!container) {
      console.warn(`LayoutRenderer: Slot "${slotName}" not found`);
      return;
    }

    try {
      // Clear existing content
      container.innerHTML = '';

      if (widgets.length > 0) {
        // Render provided widgets
        widgets.forEach((widget, index) => {
          const widgetElement = this.renderWidget(widget);
          if (widgetElement) {
            container.appendChild(widgetElement);
          }
        });
      } else {
        // No widgets provided, use defaults if available
        const slotConfig = this.slotConfigs.get(slotName);
        if (slotConfig?.defaultWidgets?.length > 0) {
          slotConfig.defaultWidgets.forEach(defaultWidget => {
            const widgetElement = this.renderWidget(defaultWidget);
            if (widgetElement) {
              container.appendChild(widgetElement);
            }
          });
        } else {
          // No widgets or defaults - show placeholder
          container.innerHTML = `
            <div class="slot-placeholder p-4 border-2 border-dashed border-gray-300 rounded text-center text-gray-500">
              <span class="text-sm">Empty slot: ${slotName}</span>
            </div>
          `;
        }
      }

      console.log(`LayoutRenderer: Updated slot "${slotName}" with ${widgets.length} widgets`);

    } catch (error) {
      console.error(`LayoutRenderer: Error updating slot "${slotName}"`, error);
      container.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
  }

  /**
   * Set the widget renderer function
   * @param {Function} renderer - Function that takes a widget object and returns DOM element
   */
  setWidgetRenderer(renderer) {
    this.widgetRenderer = renderer;
  }

  /**
   * Clean up and remove all event listeners
   */
  destroy() {
    this.slotContainers.clear();
    this.slotConfigs.clear();
    this.widgetRenderer = null;
  }

  /**
   * Get slot configuration by name
   * @param {string} slotName - Name of the slot
   * @returns {Object|null} Slot configuration object
   */
  getSlotConfig(slotName) {
    return this.slotConfigs.get(slotName) || null;
  }

  /**
   * Get all available slot names
   * @returns {Array<string>} Array of slot names
   */
  getSlotNames() {
    return Array.from(this.slotContainers.keys());
  }

  // Private methods

  /**
   * Render a JSON node to DOM element
   * @param {Object} node - JSON node to render
   * @returns {Node} DOM node
   */
  renderNode(node) {
    if (!node || typeof node !== 'object') {
      return document.createTextNode(String(node || ''));
    }

    switch (node.type) {
      case 'element':
        return this.renderElement(node);
      case 'slot':
        return this.renderSlotElement(node);
      case 'text':
        return this.renderTextNode(node);
      default:
        console.warn(`LayoutRenderer: Unknown node type "${node.type}"`);
        return document.createTextNode('');
    }
  }

  /**
   * Render an HTML element node
   * @param {Object} node - Element node object
   * @returns {HTMLElement} DOM element
   */
  renderElement(node) {
    const element = document.createElement(node.tag || 'div');

    // Apply CSS classes
    if (node.classes) {
      element.className = node.classes;
    }

    // Apply attributes
    if (node.attributes) {
      Object.entries(node.attributes).forEach(([key, value]) => {
        element.setAttribute(key, String(value));
      });
    }

    // Render children
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(child => {
        const childElement = this.renderNode(child);
        if (childElement) {
          element.appendChild(childElement);
        }
      });
    }

    return element;
  }

  /**
   * Render a slot element
   * @param {Object} node - Slot node object
   * @returns {HTMLElement} DOM element
   */
  renderSlotElement(node) {
    const element = document.createElement(node.tag || 'div');

    // Apply CSS classes
    if (node.classes) {
      element.className = node.classes;
    }

    // Apply attributes (excluding widget slot attributes)
    if (node.attributes) {
      Object.entries(node.attributes).forEach(([key, value]) => {
        element.setAttribute(key, String(value));
      });
    }

    // Add slot identification
    const slotName = node.slot?.name;
    if (slotName) {
      element.setAttribute('data-slot-name', slotName);
      element.setAttribute('data-slot-title', node.slot.title || '');
      
      // Store slot reference and configuration
      this.slotContainers.set(slotName, element);
      this.slotConfigs.set(slotName, node.slot);

      // Initialize slot with default widgets if available
      if (node.slot.defaultWidgets?.length > 0) {
        node.slot.defaultWidgets.forEach(defaultWidget => {
          const widgetElement = this.renderWidget(defaultWidget);
          if (widgetElement) {
            element.appendChild(widgetElement);
          }
        });
      } else {
        // Show placeholder for empty slot
        element.innerHTML = `
          <div class="slot-placeholder p-4 border-2 border-dashed border-gray-300 rounded text-center text-gray-500">
            <div class="text-sm font-medium">${node.slot.title || slotName}</div>
            ${node.slot.description ? `<div class="text-xs mt-1">${node.slot.description}</div>` : ''}
            <div class="text-xs mt-2 opacity-75">Click to add widgets</div>
          </div>
        `;
      }
    }

    return element;
  }

  /**
   * Render a text node
   * @param {Object} node - Text node object
   * @returns {Text} DOM text node
   */
  renderTextNode(node) {
    // Process Django template variables if needed
    // For now, just return the content as-is
    const content = this.processDjangoVariables(node.content || '');
    return document.createTextNode(content);
  }

  /**
   * Render a widget object to DOM element
   * @param {Object} widget - Widget object with type and config
   * @returns {HTMLElement|null} DOM element or null if rendering failed
   */
  renderWidget(widget) {
    try {
      // Use external widget renderer if available
      if (this.widgetRenderer && typeof this.widgetRenderer === 'function') {
        return this.widgetRenderer(widget);
      }

      // Fallback: create simple widget representation
      return this.createDefaultWidgetElement(widget);

    } catch (error) {
      console.error('LayoutRenderer: Error rendering widget', error, widget);
      return this.createErrorWidgetElement(error.message);
    }
  }

  /**
   * Create a default widget element representation
   * @param {Object} widget - Widget object
   * @returns {HTMLElement} DOM element
   */
  createDefaultWidgetElement(widget) {
    const element = document.createElement('div');
    element.className = 'widget-placeholder border border-gray-300 rounded p-3 mb-2';
    
    element.innerHTML = `
      <div class="text-sm font-medium text-gray-700">${widget.type || 'Unknown Widget'}</div>
      ${widget.config ? `<div class="text-xs text-gray-500 mt-1">${JSON.stringify(widget.config, null, 2)}</div>` : ''}
    `;

    return element;
  }

  /**
   * Create an error widget element
   * @param {string} message - Error message
   * @returns {HTMLElement} DOM element
   */
  createErrorWidgetElement(message) {
    const element = document.createElement('div');
    element.className = 'widget-error border border-red-300 bg-red-50 rounded p-3 mb-2';
    element.innerHTML = `<div class="text-sm text-red-700">Widget Error: ${message}</div>`;
    return element;
  }

  /**
   * Process Django template variables in text content
   * @param {string} content - Text content that may contain Django variables
   * @returns {string} Processed content
   */
  processDjangoVariables(content) {
    // For now, just return content as-is
    // In a real implementation, you might want to:
    // - Replace {{ variable }} with actual values
    // - Handle {% tag %} template tags
    // - Process filters like {{ variable|filter }}
    return content;
  }
}

export default LayoutRenderer;