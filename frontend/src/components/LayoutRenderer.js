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

    // UI Enhancement properties
    this.slotUIElements = new Map(); // Map of slot names to UI overlay elements
    this.uiConfig = { // Default UI configuration
      showIconMenu: false,
      showAddWidget: false,
      showEditSlot: false,
      showSlotVisibility: false,
      enableDragDrop: false,
      enableContextMenu: false
    };
    this.uiCallbacks = new Map(); // Map of UI event callbacks
    this.dragState = { isDragging: false, draggedElement: null, sourceSlot: null };
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
      // Clean up UI elements first
      this.removeAllSlotUI();

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
      this.slotUIElements.clear();
      this.uiCallbacks.clear();

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

  // UI Enhancement Methods (Vanilla JS)

  /**
   * Configure UI settings for slot interactions
   * @param {Object} config - UI configuration object
   */
  setUIConfig(config = {}) {
    this.uiConfig = { ...this.uiConfig, ...config };
  }

  /**
   * Set UI event callbacks
   * @param {Object} callbacks - Map of callback functions
   */
  setUICallbacks(callbacks = {}) {
    this.uiCallbacks = new Map(Object.entries(callbacks));
  }

  /**
   * Add icon menu to a slot
   * @param {string} slotName - Name of the slot
   * @param {Object} options - Menu options
   */
  addSlotIconMenu(slotName, options = {}) {
    const slotElement = this.slotContainers.get(slotName);
    if (!slotElement) {
      console.warn(`LayoutRenderer: Slot "${slotName}" not found for icon menu`);
      return;
    }

    // Remove existing UI if present
    this.removeSlotUI(slotName);

    // Create icon menu container
    const menuContainer = document.createElement('div');
    menuContainer.className = 'slot-icon-menu absolute top-2 right-2 z-20 opacity-80 hover:opacity-100 transition-opacity';
    menuContainer.setAttribute('data-slot-menu', slotName);

    // Create menu button (3 dots icon)
    const menuButton = this.createIconButton('⋯', 'bg-gray-700 hover:bg-gray-800 text-white', () => {
      this.toggleIconMenu(slotName);
    });
    menuButton.title = `Slot: ${slotName}`;
    menuContainer.appendChild(menuButton);

    // Create menu dropdown
    const menuDropdown = document.createElement('div');
    menuDropdown.className = 'slot-menu-dropdown absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-48 hidden';
    menuDropdown.setAttribute('data-menu-dropdown', slotName);

    // Add menu items
    const menuItems = this.getMenuItems(slotName, options);
    menuItems.forEach(item => {
      const menuItem = this.createMenuItem(item.icon, item.label, item.action, item.className);
      menuDropdown.appendChild(menuItem);
    });

    menuContainer.appendChild(menuDropdown);

    // Position slot container relative if not already
    if (getComputedStyle(slotElement).position === 'static') {
      slotElement.style.position = 'relative';
    }

    // Add menu to slot
    slotElement.appendChild(menuContainer);

    // Track UI element
    this.slotUIElements.set(slotName, menuContainer);

    // Add click outside listener to close menu
    this.addClickOutsideListener(slotName, menuDropdown);
  }

  /**
   * Create an icon button
   * @param {string} icon - Icon text or symbol
   * @param {string} className - CSS classes
   * @param {Function} onClick - Click handler
   * @returns {HTMLElement} Button element
   */
  createIconButton(icon, className, onClick) {
    const button = document.createElement('button');
    button.innerHTML = icon;
    button.className = `inline-flex items-center justify-center w-6 h-6 text-xs rounded transition-colors ${className}`;

    if (onClick) {
      const cleanup = () => {
        button.removeEventListener('click', onClick);
      };
      button.addEventListener('click', onClick);
      this.eventListeners.set(button, cleanup);
    }

    return button;
  }

  /**
   * Create a menu item
   * @param {string} icon - Item icon
   * @param {string} label - Item label
   * @param {Function} action - Item action
   * @param {string} className - Additional CSS classes
   * @returns {HTMLElement} Menu item element
   */
  createMenuItem(icon, label, action, className = '') {
    const item = document.createElement('button');
    item.className = `flex items-center w-full px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors ${className}`;

    item.innerHTML = `
      <span class="mr-3 text-gray-600">${icon}</span>
      <span class="text-gray-900">${this.escapeHtml(label)}</span>
    `;

    if (action) {
      const cleanup = () => {
        item.removeEventListener('click', action);
      };
      item.addEventListener('click', action);
      this.eventListeners.set(item, cleanup);
    }

    return item;
  }

  /**
   * Get menu items for a slot
   * @param {string} slotName - Name of the slot
   * @param {Object} options - Menu options
   * @returns {Array} Array of menu item configurations
   */
  getMenuItems(slotName, options = {}) {
    const items = [];

    // Add Widget item
    if (this.uiConfig.showAddWidget || options.showAddWidget) {
      items.push({
        icon: '➕',
        label: 'Add Widget',
        action: () => this.executeCallback('onAddWidget', slotName),
        className: 'text-green-700 hover:bg-green-50'
      });
    }

    // Edit Slot item
    if (this.uiConfig.showEditSlot || options.showEditSlot) {
      items.push({
        icon: '✏️',
        label: 'Edit Slot',
        action: () => this.executeCallback('onEditSlot', slotName),
        className: 'text-blue-700 hover:bg-blue-50'
      });
    }

    // Toggle Visibility item
    if (this.uiConfig.showSlotVisibility || options.showSlotVisibility) {
      const isVisible = this.isSlotVisible(slotName);
      items.push({
        icon: isVisible ? '👁️' : '🚫',
        label: isVisible ? 'Hide Slot' : 'Show Slot',
        action: () => this.toggleSlotVisibility(slotName),
        className: 'text-gray-700 hover:bg-gray-50'
      });
    }

    // Separator
    if (items.length > 0 && (options.showClearSlot || options.showSlotInfo)) {
      items.push({ separator: true });
    }

    // Clear Slot item
    if (options.showClearSlot) {
      items.push({
        icon: '🗑️',
        label: 'Clear Slot',
        action: () => this.executeCallback('onClearSlot', slotName),
        className: 'text-red-700 hover:bg-red-50'
      });
    }

    // Slot Info item
    if (options.showSlotInfo) {
      items.push({
        icon: 'ℹ️',
        label: 'Slot Info',
        action: () => this.executeCallback('onSlotInfo', slotName),
        className: 'text-gray-700 hover:bg-gray-50'
      });
    }

    return items;
  }

  /**
   * Toggle icon menu visibility
   * @param {string} slotName - Name of the slot
   */
  toggleIconMenu(slotName) {
    const dropdown = document.querySelector(`[data-menu-dropdown="${slotName}"]`);
    if (dropdown) {
      const isHidden = dropdown.classList.contains('hidden');

      // Close all other menus
      document.querySelectorAll('.slot-menu-dropdown').forEach(menu => {
        menu.classList.add('hidden');
      });

      // Toggle this menu
      if (isHidden) {
        dropdown.classList.remove('hidden');
      }
    }
  }

  /**
   * Check if slot is visible
   * @param {string} slotName - Name of the slot
   * @returns {boolean} True if visible
   */
  isSlotVisible(slotName) {
    const slotElement = this.slotContainers.get(slotName);
    return slotElement && slotElement.style.display !== 'none';
  }

  /**
   * Toggle slot visibility
   * @param {string} slotName - Name of the slot
   */
  toggleSlotVisibility(slotName) {
    const slotElement = this.slotContainers.get(slotName);
    if (slotElement) {
      const isVisible = this.isSlotVisible(slotName);
      slotElement.style.display = isVisible ? 'none' : 'block';
      slotElement.style.opacity = isVisible ? '0.5' : '1';

      // Update menu if open
      this.updateVisibilityMenuItem(slotName);

      // Execute callback
      this.executeCallback('onToggleVisibility', slotName, !isVisible);
    }
  }

  /**
   * Update visibility menu item
   * @param {string} slotName - Name of the slot
   */
  updateVisibilityMenuItem(slotName) {
    const dropdown = document.querySelector(`[data-menu-dropdown="${slotName}"]`);
    if (dropdown) {
      const visibilityItem = Array.from(dropdown.children).find(item =>
        item.textContent.includes('Hide Slot') || item.textContent.includes('Show Slot')
      );

      if (visibilityItem) {
        const isVisible = this.isSlotVisible(slotName);
        const icon = visibilityItem.querySelector('span:first-child');
        const label = visibilityItem.querySelector('span:last-child');

        if (icon && label) {
          icon.textContent = isVisible ? '👁️' : '🚫';
          label.textContent = isVisible ? 'Hide Slot' : 'Show Slot';
        }
      }
    }
  }

  /**
   * Add click outside listener for menu
   * @param {string} slotName - Name of the slot
   * @param {HTMLElement} dropdown - Dropdown element
   */
  addClickOutsideListener(slotName, dropdown) {
    const handleClickOutside = (event) => {
      const menuContainer = this.slotUIElements.get(slotName);
      if (menuContainer && !menuContainer.contains(event.target)) {
        dropdown.classList.add('hidden');
      }
    };

    // Add listener after a brief delay to avoid immediate closing
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      this.eventListeners.set(`click-outside-${slotName}`, () => {
        document.removeEventListener('click', handleClickOutside);
      });
    }, 100);
  }

  /**
   * Execute a UI callback
   * @param {string} callbackName - Name of the callback
   * @param {string} slotName - Name of the slot
   * @param {...any} args - Additional arguments
   */
  executeCallback(callbackName, slotName, ...args) {
    const callback = this.uiCallbacks.get(callbackName);
    if (typeof callback === 'function') {
      try {
        callback(slotName, ...args);
      } catch (error) {
        console.error(`LayoutRenderer: Error executing callback ${callbackName}`, error);
      }
    }
  }

  /**
   * Remove UI elements from a slot
   * @param {string} slotName - Name of the slot
   */
  removeSlotUI(slotName) {
    const uiElement = this.slotUIElements.get(slotName);
    if (uiElement) {
      uiElement.remove();
      this.slotUIElements.delete(slotName);
    }

    // Remove click outside listener
    const clickOutsideCleanup = this.eventListeners.get(`click-outside-${slotName}`);
    if (clickOutsideCleanup) {
      clickOutsideCleanup();
      this.eventListeners.delete(`click-outside-${slotName}`);
    }
  }

  /**
   * Remove all UI elements
   */
  removeAllSlotUI() {
    this.slotUIElements.forEach((element, slotName) => {
      this.removeSlotUI(slotName);
    });
  }

  /**
   * Add icon menus to all slots
   * @param {Object} options - Global menu options
   */
  addIconMenusToAllSlots(options = {}) {
    this.getSlotNames().forEach(slotName => {
      this.addSlotIconMenu(slotName, options);
    });
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