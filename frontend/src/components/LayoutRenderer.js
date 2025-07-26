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
    this.eventListeners = new Map(); // Track event listeners for cleanup
    this.isDestroyed = false; // Track destruction state
  }

  /**
   * Validate layout JSON structure
   * @param {Object} layout - JSON layout structure to validate
   * @returns {boolean} True if valid, false otherwise
   */
  validateLayout(layout) {
    try {
      if (!layout || typeof layout !== 'object') {
        return false;
      }

      const structure = layout.structure || layout;
      return this.validateNode(structure);
    } catch (error) {
      console.error('LayoutRenderer: Layout validation error', error);
      return false;
    }
  }

  /**
   * Validate a single node in the layout structure
   * @param {Object} node - Node to validate
   * @returns {boolean} True if valid, false otherwise
   */
  validateNode(node) {
    if (!node || typeof node !== 'object') {
      return false;
    }

    const validTypes = ['element', 'slot', 'text'];
    if (!validTypes.includes(node.type)) {
      return false;
    }

    // Validate children if present
    if (node.children !== undefined) {
      if (!Array.isArray(node.children)) {
        return false; // Children must be an array if present
      }
      return node.children.every(child => this.validateNode(child));
    }

    return true;
  }

  /**
   * Render layout JSON structure to a DOM element
   * @param {Object} layout - JSON layout structure
   * @param {React.RefObject} targetRef - React ref to target DOM element
   */
  render(layout, targetRef) {
    if (this.isDestroyed) {
      console.warn('LayoutRenderer: Cannot render on destroyed instance');
      return;
    }

    if (!targetRef.current) {
      console.warn('LayoutRenderer: Target ref is not available');
      return;
    }

    try {
      // Validate layout structure first
      if (!this.validateLayout(layout)) {
        throw new Error('Invalid layout structure');
      }

      // Clean up existing content and listeners
      this.cleanup(targetRef.current);

      // Reset internal maps
      this.slotContainers.clear();
      this.slotConfigs.clear();

      // Render the layout structure
      const rootElement = this.renderNode(layout.structure || layout);
      if (rootElement) {
        targetRef.current.appendChild(rootElement);
      }

      console.log('LayoutRenderer: Layout rendered successfully', {
        slots: Array.from(this.slotContainers.keys()),
        configs: Array.from(this.slotConfigs.keys())
      });

    } catch (error) {
      console.error('LayoutRenderer: Error rendering layout', error);
      this.renderError(targetRef.current, error.message);
    }
  }

  /**
   * Clean up existing content and event listeners
   * @param {HTMLElement} container - Container to clean up
   */
  cleanup(container) {
    try {
      // Remove tracked event listeners
      this.eventListeners.forEach((cleanup, element) => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
      this.eventListeners.clear();

      // Efficiently clear container using removeChild (faster than innerHTML)
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    } catch (error) {
      console.error('LayoutRenderer: Error during cleanup', error);
      // Fallback to innerHTML if removeChild fails
      container.innerHTML = '';
    }
  }

  /**
   * Render error message in container
   * @param {HTMLElement} container - Container to render error in
   * @param {string} message - Error message
   */
  renderError(container, message) {
    try {
      container.innerHTML = `
        <div class="error-container p-4 border border-red-300 bg-red-50 rounded">
          <div class="text-red-700 font-medium">Layout Rendering Error</div>
          <div class="text-red-600 text-sm mt-1">${this.escapeHtml(message)}</div>
        </div>
      `;
    } catch (error) {
      console.error('LayoutRenderer: Error rendering error message', error);
      container.textContent = 'Error rendering layout';
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Update widgets in a specific slot
   * @param {string} slotName - Name of the slot to update
   * @param {Array} widgets - Array of widget objects to render
   */
  updateSlot(slotName, widgets = []) {
    console.log("LayoutRenderer updateSlot", slotName, widgets)
    if (this.isDestroyed) {
      console.warn('LayoutRenderer: Cannot update slot on destroyed instance');
      return;
    }

    const container = this.slotContainers.get(slotName);

    if (!container) {
      console.warn(`LayoutRenderer: Slot "${slotName}" not found`);
      return;
    }

    try {
      // Validate widgets array
      if (!Array.isArray(widgets)) {
        throw new Error('Widgets must be an array');
      }

      // Clean up existing content in slot
      this.cleanup(container);

      if (widgets.length > 0) {
        // Render provided widgets
        widgets.forEach((widget, index) => {
          try {
            const widgetElement = this.renderWidget(widget);
            if (widgetElement) {
              container.appendChild(widgetElement);
            }
          } catch (error) {
            console.error(`LayoutRenderer: Error rendering widget ${index} in slot ${slotName}`, error);
            const errorElement = this.createErrorWidgetElement(`Widget ${index + 1}: ${error.message}`);
            container.appendChild(errorElement);
          }
        });
      } else {
        // No widgets provided, use defaults if available
        const slotConfig = this.slotConfigs.get(slotName);
        if (slotConfig?.defaultWidgets?.length > 0) {
          slotConfig.defaultWidgets.forEach((defaultWidget, index) => {
            try {
              const widgetElement = this.renderWidget(defaultWidget);
              if (widgetElement) {
                container.appendChild(widgetElement);
              }
            } catch (error) {
              console.error(`LayoutRenderer: Error rendering default widget ${index} in slot ${slotName}`, error);
              const errorElement = this.createErrorWidgetElement(`Default widget ${index + 1}: ${error.message}`);
              container.appendChild(errorElement);
            }
          });
        } else {
          // No widgets or defaults - show placeholder
          container.innerHTML = `
            <div class="slot-placeholder p-4 border-2 border-dashed border-gray-300 rounded text-center text-gray-500">
              <span class="text-sm">${this.escapeHtml(`Empty slot: ${slotName}`)}</span>
            </div>
          `;
        }
      }

      console.log(`LayoutRenderer: Updated slot "${slotName}" with ${widgets.length} widgets`);

    } catch (error) {
      console.error(`LayoutRenderer: Error updating slot "${slotName}"`, error);
      this.renderError(container, `Failed to update slot: ${error.message}`);
    }
  }

  /**
   * Set the widget renderer function
   * @param {Function} renderer - Function that takes a widget object and returns DOM element
   */
  setWidgetRenderer(renderer) {
    if (typeof renderer !== 'function') {
      console.warn('LayoutRenderer: Widget renderer must be a function');
      return;
    }
    this.widgetRenderer = renderer;
  }

  /**
   * Clean up and remove all event listeners
   */
  destroy() {
    try {
      // Clean up event listeners
      this.eventListeners.forEach((cleanup) => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });

      // Clear all maps
      this.slotContainers.clear();
      this.slotConfigs.clear();
      this.eventListeners.clear();

      // Reset references
      this.widgetRenderer = null;
      this.isDestroyed = true;

      console.log('LayoutRenderer: Instance destroyed successfully');
    } catch (error) {
      console.error('LayoutRenderer: Error during destruction', error);
    }
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

  /**
   * Add event listener with cleanup tracking
   * @param {HTMLElement} element - Element to add listener to
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {Object} options - Event listener options
   */
  addTrackedEventListener(element, event, handler, options = {}) {
    try {
      element.addEventListener(event, handler, options);

      const cleanup = () => {
        element.removeEventListener(event, handler, options);
      };

      this.eventListeners.set(element, cleanup);
    } catch (error) {
      console.error('LayoutRenderer: Error adding event listener', error);
    }
  }

  // Private methods

  /**
   * Render a JSON node to DOM element
   * @param {Object} node - JSON node to render
   * @returns {Node} DOM node
   */
  renderNode(node) {
    try {
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
    } catch (error) {
      console.error('LayoutRenderer: Error rendering node', error, node);
      return this.createErrorElement(`Node rendering failed: ${error.message}`);
    }
  }

  /**
   * Create error element for failed node rendering
   * @param {string} message - Error message
   * @returns {HTMLElement} Error element
   */
  createErrorElement(message) {
    const element = document.createElement('div');
    element.className = 'node-error border border-red-300 bg-red-50 rounded p-2 text-red-700 text-sm';
    element.textContent = message;
    return element;
  }

  /**
   * Render an HTML element node
   * @param {Object} node - Element node object
   * @returns {HTMLElement} DOM element
   */
  renderElement(node) {
    try {
      // Validate tag name
      const tagName = node.tag !== undefined ? node.tag : 'div';
      if (typeof tagName !== 'string' || tagName === '' || !tagName.match(/^[a-zA-Z][a-zA-Z0-9-]*$/)) {
        throw new Error(`Invalid tag name: ${tagName}`);
      }

      const element = document.createElement(tagName);

      // Apply CSS classes
      if (node.classes) {
        if (typeof node.classes === 'string') {
          element.className = node.classes;
        } else {
          console.warn('LayoutRenderer: Classes must be a string');
        }
      }

      // Apply attributes
      if (node.attributes && typeof node.attributes === 'object') {
        Object.entries(node.attributes).forEach(([key, value]) => {
          try {
            // Validate attribute name
            if (typeof key === 'string' && key.match(/^[a-zA-Z-][a-zA-Z0-9-]*$/)) {
              element.setAttribute(key, String(value));
            } else {
              console.warn(`LayoutRenderer: Invalid attribute name: ${key}`);
            }
          } catch (error) {
            console.warn(`LayoutRenderer: Error setting attribute ${key}`, error);
          }
        });
      }

      // Render children
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => {
          try {
            const childElement = this.renderNode(child);
            if (childElement) {
              element.appendChild(childElement);
            }
          } catch (error) {
            console.error('LayoutRenderer: Error rendering child node', error);
            const errorElement = this.createErrorElement(`Child render error: ${error.message}`);
            element.appendChild(errorElement);
          }
        });
      }

      return element;
    } catch (error) {
      console.error('LayoutRenderer: Error rendering element', error, node);
      return this.createErrorElement(`Element render error: ${error.message}`);
    }
  }

  /**
   * Render a slot element
   * @param {Object} node - Slot node object
   * @returns {HTMLElement} DOM element
   */
  renderSlotElement(node) {
    console.log("LayoutRenderer renderSlotElement", node)
    try {
      // Validate slot configuration
      if (!node.slot || typeof node.slot !== 'object') {
        throw new Error('Slot node missing slot configuration');
      }

      const slotName = node.slot.name;
      if (!slotName || typeof slotName !== 'string') {
        throw new Error('Slot missing valid name');
      }

      // Validate tag name
      const tagName = node.tag !== undefined ? node.tag : 'div';
      if (typeof tagName !== 'string' || tagName === '' || !tagName.match(/^[a-zA-Z][a-zA-Z0-9-]*$/)) {
        throw new Error(`Invalid tag name: ${tagName}`);
      }

      const element = document.createElement(tagName);

      // Apply CSS classes
      if (node.classes) {
        if (typeof node.classes === 'string') {
          element.className = node.classes;
        } else {
          console.warn('LayoutRenderer: Classes must be a string');
        }
      }

      // Apply attributes (excluding widget slot attributes)
      if (node.attributes && typeof node.attributes === 'object') {
        Object.entries(node.attributes).forEach(([key, value]) => {
          try {
            // Validate attribute name
            if (typeof key === 'string' && key.match(/^[a-zA-Z-][a-zA-Z0-9-]*$/)) {
              element.setAttribute(key, String(value));
            } else {
              console.warn(`LayoutRenderer: Invalid attribute name: ${key}`);
            }
          } catch (error) {
            console.warn(`LayoutRenderer: Error setting attribute ${key}`, error);
          }
        });
      }

      // Add slot identification
      element.setAttribute('data-slot-name', slotName);
      element.setAttribute('data-slot-title', node.slot.title || '');

      // Store slot reference and configuration
      this.slotContainers.set(slotName, element);
      this.slotConfigs.set(slotName, node.slot);

      // Initialize slot with default widgets if available
      if (node.slot.defaultWidgets && Array.isArray(node.slot.defaultWidgets) && node.slot.defaultWidgets.length > 0) {
        node.slot.defaultWidgets.forEach((defaultWidget, index) => {
          try {
            const widgetElement = this.renderWidget(defaultWidget);
            if (widgetElement) {
              element.appendChild(widgetElement);
            }
          } catch (error) {
            console.error(`LayoutRenderer: Error rendering default widget ${index} in slot ${slotName}`, error);
            const errorElement = this.createErrorWidgetElement(`Default widget ${index + 1}: ${error.message}`);
            element.appendChild(errorElement);
          }
        });
      } else {
        // Show placeholder for empty slot
        const title = node.slot.title || slotName;
        const description = node.slot.description || '';

        element.innerHTML = `
          <div class="slot-placeholder p-4 border-2 border-dashed border-gray-300 rounded text-center text-gray-500">
            <div class="text-sm font-medium">${this.escapeHtml(title)}</div>
            ${description ? `<div class="text-xs mt-1">${this.escapeHtml(description)}</div>` : ''}
            <div class="text-xs mt-2 opacity-75">Click to add widgets</div>
          </div>
        `;
      }

      return element;
    } catch (error) {
      console.error('LayoutRenderer: Error rendering slot element', error, node);
      return this.createErrorElement(`Slot render error: ${error.message}`);
    }
  }

  /**
   * Render a text node
   * @param {Object} node - Text node object
   * @returns {Text} DOM text node
   */
  renderTextNode(node) {
    try {
      if (!node.content) {
        return document.createTextNode('');
      }

      // Process Django template variables if needed
      const content = this.processDjangoVariables(String(node.content));
      return document.createTextNode(content);
    } catch (error) {
      console.error('LayoutRenderer: Error rendering text node', error, node);
      return document.createTextNode(`[Text Error: ${error.message}]`);
    }
  }

  /**
   * Render a widget object to DOM element
   * @param {Object} widget - Widget object with type and config
   * @returns {HTMLElement|null} DOM element or null if rendering failed
   */
  renderWidget(widget) {
    console.log("LayoutRenderer widget", widget)
    try {
      // Validate widget object
      if (!widget || typeof widget !== 'object') {
        throw new Error('Invalid widget object');
      }

      if (!widget.type || typeof widget.type !== 'string') {
        throw new Error('Widget missing valid type');
      }

      // Use external widget renderer if available
      if (this.widgetRenderer && typeof this.widgetRenderer === 'function') {
        const result = this.widgetRenderer(widget);
        if (result && result instanceof Node) {
          return result;
        } else {
          throw new Error('Widget renderer did not return a valid DOM node');
        }
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
    try {
      const element = document.createElement('div');
      element.className = 'widget-placeholder border border-gray-300 rounded p-3 mb-2';

      const widgetType = this.escapeHtml(widget.type || 'Unknown Widget');
      const configText = widget.config ? this.escapeHtml(JSON.stringify(widget.config, null, 2)) : '';

      element.innerHTML = `
        <div class="text-sm font-medium text-gray-700">${widgetType}</div>
        ${configText ? `<div class="text-xs text-gray-500 mt-1"><pre>${configText}</pre></div>` : ''}
      `;

      return element;
    } catch (error) {
      console.error('LayoutRenderer: Error creating default widget element', error);
      return this.createErrorWidgetElement('Failed to create widget placeholder');
    }
  }

  /**
   * Create an error widget element
   * @param {string} message - Error message
   * @returns {HTMLElement} DOM element
   */
  createErrorWidgetElement(message) {
    try {
      const element = document.createElement('div');
      element.className = 'widget-error border border-red-300 bg-red-50 rounded p-3 mb-2';
      element.innerHTML = `<div class="text-sm text-red-700">Widget Error: ${this.escapeHtml(message)}</div>`;
      return element;
    } catch (error) {
      console.error('LayoutRenderer: Error creating error widget element', error);
      const fallbackElement = document.createElement('div');
      fallbackElement.textContent = 'Widget Error';
      fallbackElement.className = 'widget-error';
      return fallbackElement;
    }
  }

  /**
   * Process Django template variables in text content
   * @param {string} content - Text content that may contain Django variables
   * @returns {string} Processed content
   */
  processDjangoVariables(content) {
    try {
      // For now, just return content as-is
      // In a real implementation, you might want to:
      // - Replace {{ variable }} with actual values
      // - Handle {% tag %} template tags  
      // - Process filters like {{ variable|filter }}
      return String(content);
    } catch (error) {
      console.error('LayoutRenderer: Error processing Django variables', error);
      return '[Template Processing Error]';
    }
  }
}

export default LayoutRenderer;