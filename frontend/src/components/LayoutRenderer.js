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
      showIconMenu: true,  // Enable icon menus by default
      showAddWidget: true,
      showEditSlot: false,      // Disabled - removed from menu
      showSlotVisibility: false, // Disabled - removed from menu
      enableDragDrop: false,
      enableContextMenu: false,
      enableAddSlotUI: false
    };
    this.uiCallbacks = new Map(); // Map of UI event callbacks
    this.dragState = { isDragging: false, draggedElement: null, sourceSlot: null };
    this.customWidgets = null; // Custom widget definitions (if any)
    this.pageHasBeenSaved = false; // Track if page/layout has been saved
    this.defaultWidgetsProcessed = false; // Track if defaults have been processed
    this.savedWidgetData = new Map(); // Map of slot names to saved widget arrays
    this.isDirty = false; // Track if page has unsaved changes
    this.autoSaveEnabled = true; // Enable automatic saving
    this.autoSaveDelay = 2000; // Auto-save delay in milliseconds (2 seconds)
    this.autoSaveTimeoutId = null; // Timeout ID for pending auto-save
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

      // Reset default widget processing for new layout
      this.defaultWidgetsProcessed = false;

      // Reset dirty state for new layout render
      this.markAsClean();

      // Render the layout structure
      const rootElement = this.renderNode(layout.structure || layout);
      if (rootElement) {
        targetRef.current.appendChild(rootElement);
      }

      console.log('LayoutRenderer: Layout rendered successfully', {
        slots: Array.from(this.slotContainers.keys()),
        configs: Array.from(this.slotConfigs.keys())
      });

      // Ensure slot menus are added after rendering is complete
      if (this.uiConfig.showIconMenu) {
        setTimeout(() => {
          this.addIconMenusToAllSlots({
            showAddWidget: this.uiConfig.showAddWidget,
            showSlotInfo: true,
            showClearSlot: true
          });
        }, 200);
      }

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

      // Cancel pending auto-save
      if (this.autoSaveTimeoutId) {
        clearTimeout(this.autoSaveTimeoutId);
        this.autoSaveTimeoutId = null;
      }

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
      this.savedWidgetData.clear();

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
    const menuButton = this.createIconButton('svg:menu', 'bg-gray-700 hover:bg-gray-800 text-white', () => {
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
      if (item.type === 'separator') {
        // Create separator element
        const separator = document.createElement('div');
        separator.className = 'border-t border-gray-200 my-1';
        menuDropdown.appendChild(separator);
      } else {
        // Create regular menu item
        const menuItem = this.createMenuItem(item.icon, item.label, item.action, item.className);
        menuDropdown.appendChild(menuItem);
      }
    });

    menuContainer.appendChild(menuDropdown);

    // Position slot container relative if not already and add some styling
    const computedStyle = getComputedStyle(slotElement);
    if (computedStyle.position === 'static') {
      slotElement.style.position = 'relative';
    }

    // Ensure slot has some minimum styling for better visibility
    if (slotElement.offsetHeight < 20) {
      slotElement.style.minHeight = '40px';
    }

    // Add hover effect to make slots more discoverable
    slotElement.style.transition = 'background-color 0.2s ease, border-color 0.2s ease';
    slotElement.addEventListener('mouseenter', () => {
      if (!slotElement.style.backgroundColor || slotElement.style.backgroundColor === 'transparent') {
        slotElement.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
        slotElement.style.borderColor = 'rgba(59, 130, 246, 0.2)';
      }
    });

    slotElement.addEventListener('mouseleave', () => {
      if (slotElement.style.backgroundColor === 'rgba(59, 130, 246, 0.05)') {
        slotElement.style.backgroundColor = '';
        slotElement.style.borderColor = '';
      }
    });

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

    // Check if icon is provided and is a string
    if (icon && typeof icon === 'string') {
      if (icon.startsWith('svg:')) {
        button.innerHTML = this.createSVGIcon(icon.replace('svg:', ''));
      } else {
        button.innerHTML = `<span style="font-family: Arial, sans-serif; font-weight: bold;">${this.escapeHtml(icon)}</span>`;
      }
    } else {
      // Fallback to plus icon if no icon provided
      button.innerHTML = this.createSVGIcon('plus');
    }

    button.className = `inline-flex items-center justify-center w-6 h-6 text-xs rounded transition-colors ${className || ''}`;

    if (onClick && typeof onClick === 'function') {
      const cleanup = () => {
        button.removeEventListener('click', onClick);
      };
      button.addEventListener('click', onClick);
      this.eventListeners.set(button, cleanup);
    }

    return button;
  }

  /**
 * Create SVG icon for better cross-browser compatibility
 * @param {string} iconName - Name of the icon
 * @returns {string} SVG HTML string
 */
  createSVGIcon(iconName) {
    if (!iconName || typeof iconName !== 'string') {
      iconName = 'plus'; // default fallback
    }

    const icons = {
      plus: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
               <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2z"/>
             </svg>`,
      menu: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
               <circle cx="3" cy="8" r="1.5"/>
               <circle cx="8" cy="8" r="1.5"/>
               <circle cx="13" cy="8" r="1.5"/>
             </svg>`,
      edit: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
               <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708L4.5 15.207l-3.5.5.5-3.5L12.146.146zM11.207 2L2 11.207l-.25 1.75 1.75-.25L13.207 3 11.207 2z"/>
             </svg>`,
      trash: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
              </svg>`,
      info: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
               <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
               <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
             </svg>`
    };

    const result = icons[iconName] || icons.plus; // fallback to plus if icon not found
    return result;
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

    // Create icon span only if icon is provided
    if (icon) {
      const iconSpan = document.createElement('span');
      iconSpan.className = 'mr-3 text-gray-600 flex items-center justify-center w-4';

      if (typeof icon === 'string' && icon.startsWith('svg:')) {
        iconSpan.innerHTML = this.createSVGIcon(icon.replace('svg:', ''));
      } else {
        iconSpan.innerHTML = `<span style="font-family: Arial, sans-serif; font-weight: bold;">${icon}</span>`;
      }

      item.appendChild(iconSpan);
    }

    // Create label span
    if (label) {
      const labelSpan = document.createElement('span');
      labelSpan.className = 'text-gray-900';
      labelSpan.textContent = label;
      item.appendChild(labelSpan);
    }

    if (action && typeof action === 'function') {
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
        icon: 'svg:plus',
        label: 'Add Widget',
        action: () => this.showWidgetSelectionModal(slotName),
        className: 'text-green-700 hover:bg-green-50'
      });
    }

    // Add separator before destructive/info actions
    if (items.length > 0 && (options.showClearSlot || options.showSlotInfo)) {
      items.push({
        type: 'separator'
      });
    }

    // Clear Slot item
    if (options.showClearSlot) {
      items.push({
        icon: 'svg:trash',
        label: 'Clear Slot',
        action: () => this.executeCallback('onClearSlot', slotName),
        className: 'text-red-700 hover:bg-red-50'
      });
    }

    // Slot Info item
    if (options.showSlotInfo) {
      items.push({
        icon: 'svg:info',
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

  /**
   * Enable slot menus for all rendered slots
   * @param {Object} options - Menu configuration options
   */
  enableSlotMenus(options = {}) {
    this.setUIConfig({
      showIconMenu: true,
      showAddWidget: options.showAddWidget !== false
    });

    // Add menus to existing slots
    this.addIconMenusToAllSlots({
      showAddWidget: this.uiConfig.showAddWidget,
      showSlotInfo: true,
      showClearSlot: true,
      ...options
    });
  }

  /**
   * Disable slot menus
   */
  disableSlotMenus() {
    this.setUIConfig({
      showIconMenu: false,
      showAddWidget: false
    });

    // Remove existing menus
    this.removeAllSlotUI();
  }

  // Widget Selection Modal Methods

  /**
   * Show widget selection modal for a specific slot
   * @param {string} slotName - Name of the slot to add widget to
   * @param {Object} options - Modal configuration options
   */
  showWidgetSelectionModal(slotName, options = {}) {
    // Remove existing widget modal
    const existingModal = document.querySelector('.widget-selection-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'widget-selection-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-90vh overflow-hidden';

    // Get available widgets
    const availableWidgets = this.getAvailableWidgets();
    const slotConfig = this.getSlotConfig(slotName);

    modal.innerHTML = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Add Widget to Slot</h3>
            <p class="text-sm text-gray-600">${slotConfig?.title || slotName}</p>
          </div>
          <button class="widget-modal-close text-gray-400 hover:text-gray-600 transition-colors">
            <span class="text-xl">×</span>
          </button>
        </div>
        
        <div class="mb-4">
          <input type="text" placeholder="Search widgets..." 
                 class="widget-search w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        
        <div class="widget-grid grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
          ${availableWidgets.map(widget => this.createWidgetCard(widget)).join('')}
        </div>
        
        <div class="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
          <button class="widget-modal-cancel px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Set up modal event handlers
    this.setupWidgetModalHandlers(overlay, slotName);

    // Track for cleanup
    this.slotUIElements.set('widget-selection-modal', overlay);
  }

  /**
   * Set custom widget definitions
   * @param {Array} widgets - Array of widget definitions
   */
  setAvailableWidgets(widgets) {
    this.customWidgets = widgets;
  }

  /**
   * Mark the page/layout as saved
   * This prevents default widgets from being auto-created on subsequent renders
   */
  markPageAsSaved() {
    this.pageHasBeenSaved = true;
    console.log('LayoutRenderer: Page marked as saved - default widgets will not be auto-created');
  }

  /**
   * Check if the page has been saved
   * @returns {boolean} True if page has been saved
   */
  hasPageBeenSaved() {
    return this.pageHasBeenSaved;
  }

  /**
   * Reset the page saved state (for new pages/layouts)
   */
  resetPageSavedState() {
    this.pageHasBeenSaved = false;
    this.defaultWidgetsProcessed = false;
    this.savedWidgetData.clear();
    this.markAsClean(); // Reset dirty state
    console.log('LayoutRenderer: Page state reset - default widgets will be auto-created');
  }

  /**
   * Collect all widget data from rendered slots
   * @returns {Object} Object with slot names as keys and widget arrays as values
   */
  collectAllWidgetData() {
    const widgetData = {};

    this.slotContainers.forEach((slotElement, slotName) => {
      const widgets = this.collectWidgetDataFromSlot(slotName);
      if (widgets.length > 0) {
        widgetData[slotName] = widgets;
      }
    });

    console.log('LayoutRenderer: Collected widget data from all slots:', widgetData);
    return widgetData;
  }

  /**
   * Collect widget data from a specific slot
   * @param {string} slotName - Name of the slot
   * @returns {Array} Array of widget instance objects
   */
  collectWidgetDataFromSlot(slotName) {
    const slotElement = this.slotContainers.get(slotName);
    if (!slotElement) {
      console.warn(`LayoutRenderer: Slot "${slotName}" not found for data collection`);
      return [];
    }

    const widgets = [];
    const widgetElements = slotElement.querySelectorAll('.rendered-widget[data-widget-id][data-widget-type]');

    widgetElements.forEach(widgetElement => {
      try {
        const widgetId = widgetElement.getAttribute('data-widget-id');
        const widgetType = widgetElement.getAttribute('data-widget-type');
        const nameElement = widgetElement.querySelector('.widget-header span');
        const widgetName = nameElement ? nameElement.textContent : `${widgetType} Widget`;

        // Extract widget configuration from rendered content
        const config = this.extractWidgetConfigFromDOM(widgetElement, widgetType);

        const widgetInstance = {
          id: widgetId,
          type: widgetType,
          name: widgetName,
          config: config
        };

        widgets.push(widgetInstance);

      } catch (error) {
        console.error(`LayoutRenderer: Error collecting widget data from element`, error, widgetElement);
      }
    });

    return widgets;
  }

  /**
   * Extract widget configuration from its DOM representation
   * @param {HTMLElement} widgetElement - The widget DOM element
   * @param {string} widgetType - Type of the widget
   * @returns {Object} Widget configuration object
   */
  extractWidgetConfigFromDOM(widgetElement, widgetType) {
    const config = {};
    const contentElement = widgetElement.querySelector('.widget-content');

    if (!contentElement) {
      return config;
    }

    try {
      switch (widgetType) {
        case 'text':
          const textElement = contentElement.firstElementChild;
          if (textElement) {
            config.content = textElement.textContent || textElement.innerText;
            // Extract fontSize from class
            const classList = Array.from(textElement.classList);
            const fontSizeClass = classList.find(cls => cls.startsWith('text-'));
            if (fontSizeClass) {
              config.fontSize = fontSizeClass.replace('text-', '');
            }
            // Extract alignment from class
            const alignmentClass = classList.find(cls => cls.startsWith('text-'));
            if (alignmentClass && ['left', 'center', 'right'].includes(alignmentClass.replace('text-', ''))) {
              config.alignment = alignmentClass.replace('text-', '');
            }
          }
          break;

        case 'image':
          const imgElement = contentElement.querySelector('img');
          if (imgElement) {
            config.src = imgElement.src;
            config.alt = imgElement.alt;
            config.width = imgElement.style.width || '100%';
          }
          const captionElement = contentElement.querySelector('p');
          if (captionElement) {
            config.caption = captionElement.textContent;
          }
          break;

        case 'button':
          const buttonElement = contentElement.querySelector('button');
          if (buttonElement) {
            config.text = buttonElement.textContent;
            // Extract style and size from classes (simplified)
            const classList = Array.from(buttonElement.classList);
            if (classList.includes('bg-blue-600')) config.style = 'primary';
            else if (classList.includes('bg-gray-200')) config.style = 'secondary';
            else if (classList.includes('bg-green-600')) config.style = 'success';
            else if (classList.includes('bg-red-600')) config.style = 'danger';

            if (classList.includes('px-3')) config.size = 'small';
            else if (classList.includes('px-6')) config.size = 'large';
            else config.size = 'medium';
          }
          break;

        case 'card':
          const titleElement = contentElement.querySelector('h3');
          const contentTextElement = contentElement.querySelector('p');
          const cardImgElement = contentElement.querySelector('img');
          const cardButtonElement = contentElement.querySelector('button');

          if (titleElement) config.title = titleElement.textContent;
          if (contentTextElement) config.content = contentTextElement.textContent;
          if (cardImgElement) config.imageUrl = cardImgElement.src;
          config.showButton = !!cardButtonElement;
          break;

        case 'list':
          const listElement = contentElement.querySelector('ol, ul');
          if (listElement) {
            config.type = listElement.tagName.toLowerCase() === 'ol' ? 'ordered' : 'unordered';
            const items = Array.from(listElement.querySelectorAll('li')).map(li => li.textContent);
            config.items = items;
          }
          break;

        case 'spacer':
          const spacerElement = contentElement.firstElementChild;
          if (spacerElement) {
            const height = spacerElement.style.height;
            if (height === '16px') config.height = 'small';
            else if (height === '64px') config.height = 'large';
            else config.height = 'medium';
            config.backgroundColor = spacerElement.style.backgroundColor || 'transparent';
          }
          break;

        case 'divider':
          const dividerElement = contentElement.querySelector('hr');
          if (dividerElement) {
            const classList = Array.from(dividerElement.classList);
            if (classList.includes('border-dashed')) config.style = 'dashed';
            else if (classList.includes('border-dotted')) config.style = 'dotted';
            else config.style = 'solid';

            if (classList.includes('border-black')) config.color = 'black';
            else if (classList.includes('border-blue-300')) config.color = 'blue';
            else config.color = 'gray';

            config.thickness = classList.includes('border-2') ? 'thick' : 'thin';
          }
          break;

        case 'video':
          const videoElement = contentElement.querySelector('video');
          if (videoElement) {
            const sourceElement = videoElement.querySelector('source');
            if (sourceElement) config.src = sourceElement.src;
            config.controls = videoElement.controls;
            config.autoplay = videoElement.autoplay;
            if (videoElement.poster) config.poster = videoElement.poster;
          }
          break;

        default:
          // For unknown widget types, try to preserve any data attributes
          const dataAttrs = Array.from(widgetElement.attributes)
            .filter(attr => attr.name.startsWith('data-widget-config-'))
            .reduce((acc, attr) => {
              const key = attr.name.replace('data-widget-config-', '');
              acc[key] = attr.value;
              return acc;
            }, {});
          Object.assign(config, dataAttrs);
      }

    } catch (error) {
      console.error(`LayoutRenderer: Error extracting config for ${widgetType} widget`, error);
    }

    return config;
  }

  /**
   * Save widget data for all slots
   * @param {Object} widgetData - Object with slot names as keys and widget arrays as values
   */
  saveWidgetData(widgetData) {
    // Store widget data internally
    this.savedWidgetData.clear();
    Object.entries(widgetData).forEach(([slotName, widgets]) => {
      this.savedWidgetData.set(slotName, [...widgets]); // Deep copy
    });

    // Mark page as saved
    this.markPageAsSaved();

    console.log('LayoutRenderer: Widget data saved:', widgetData);
  }

  /**
 * Save current widget state from all rendered slots
 * @returns {Object} The collected and saved widget data
 */
  saveCurrentWidgetState() {
    const widgetData = this.collectAllWidgetData();
    this.saveWidgetData(widgetData);

    // Mark as clean after successful save
    this.markAsClean();

    // Execute callback for saving page data
    this.executeCallback('onSavePageData', widgetData);

    return widgetData;
  }

  /**
   * Load widget data for a specific slot
   * @param {string} slotName - Name of the slot
   * @returns {Array} Array of saved widget instances for the slot
   */
  getSlotWidgetData(slotName) {
    return this.savedWidgetData.get(slotName) || [];
  }

  /**
   * Check if a slot has saved widget data
   * @param {string} slotName - Name of the slot
   * @returns {boolean} True if slot has saved widgets
   */
  hasSlotWidgetData(slotName) {
    const widgets = this.savedWidgetData.get(slotName);
    return widgets && widgets.length > 0;
  }

  /**
 * Load widget data from external source (e.g., API response)
 * @param {Object} widgetData - Object with slot names as keys and widget arrays as values
 */
  loadWidgetData(widgetData) {
    this.savedWidgetData.clear();

    if (widgetData && typeof widgetData === 'object') {
      Object.entries(widgetData).forEach(([slotName, widgets]) => {
        if (Array.isArray(widgets)) {
          this.savedWidgetData.set(slotName, [...widgets]); // Deep copy
        }
      });

      // Mark as saved since we're loading existing data
      this.pageHasBeenSaved = true;
      this.markAsClean();

      console.log('LayoutRenderer: Widget data loaded:', widgetData);
    }
  }

  /**
   * Configure auto-save settings
   * @param {Object} config - Auto-save configuration
   */
  setAutoSaveConfig(config = {}) {
    this.autoSaveEnabled = config.enabled !== false;
    this.autoSaveDelay = config.delay || 2000;
    console.log(`LayoutRenderer: Auto-save configured - enabled: ${this.autoSaveEnabled}, delay: ${this.autoSaveDelay}ms`);
  }

  /**
   * Check if the page has unsaved changes
   * @returns {boolean} True if page is dirty (has unsaved changes)
   */
  isDirtyState() {
    return this.isDirty;
  }

  /**
   * Mark page as dirty (has unsaved changes) and trigger auto-save
   * @param {string} reason - Reason for marking dirty (for logging)
   */
  markAsDirty(reason = 'unknown') {
    if (!this.isDirty) {
      this.isDirty = true;
      console.log(`LayoutRenderer: Page marked as dirty - ${reason}`);

      // Execute callback for dirty state change
      this.executeCallback('onDirtyStateChanged', true, reason);
    }

    // Trigger auto-save if enabled
    if (this.autoSaveEnabled) {
      this.triggerAutoSave();
    }
  }

  /**
   * Mark page as clean (no unsaved changes)
   */
  markAsClean() {
    if (this.isDirty) {
      this.isDirty = false;
      console.log('LayoutRenderer: Page marked as clean');

      // Cancel pending auto-save
      if (this.autoSaveTimeoutId) {
        clearTimeout(this.autoSaveTimeoutId);
        this.autoSaveTimeoutId = null;
      }

      // Execute callback for dirty state change
      this.executeCallback('onDirtyStateChanged', false, 'saved');
    }
  }

  /**
   * Trigger auto-save with debouncing
   */
  triggerAutoSave() {
    // Cancel existing auto-save timeout
    if (this.autoSaveTimeoutId) {
      clearTimeout(this.autoSaveTimeoutId);
    }

    // Set new auto-save timeout
    this.autoSaveTimeoutId = setTimeout(() => {
      if (this.isDirty && this.autoSaveEnabled) {
        console.log('LayoutRenderer: Auto-saving page...');

        try {
          const widgetData = this.saveCurrentWidgetState();
          console.log('LayoutRenderer: Auto-save completed');

          // Execute callback for auto-save
          this.executeCallback('onAutoSave', widgetData);

        } catch (error) {
          console.error('LayoutRenderer: Auto-save failed', error);
          this.executeCallback('onAutoSaveError', error);
        }
      }
      this.autoSaveTimeoutId = null;
    }, this.autoSaveDelay);

    console.log(`LayoutRenderer: Auto-save scheduled in ${this.autoSaveDelay}ms`);
  }

  /**
   * Mark page as dirty due to widget edit
   * @param {string} widgetId - ID of the edited widget
   * @param {Object} widgetInstance - Widget instance that was edited
   */
  markWidgetAsEdited(widgetId, widgetInstance) {
    this.markAsDirty(`widget edited: ${widgetInstance.name} (${widgetId})`);
  }

  /**
   * Get available widgets for selection
   * @returns {Array} Array of widget definitions
   */
  getAvailableWidgets() {
    // Return custom widgets if set, otherwise return default widgets
    if (this.customWidgets && Array.isArray(this.customWidgets)) {
      return this.customWidgets;
    }

    return [
      {
        type: 'text',
        name: 'Text Block',
        description: 'Simple text content with formatting options',
        icon: 'T',
        category: 'content',
        config: {
          content: 'Enter your text here...',
          fontSize: 'medium',
          alignment: 'left'
        }
      },
      {
        type: 'image',
        name: 'Image',
        description: 'Display images with captions and links',
        icon: '🖼',
        category: 'media',
        config: {
          src: '',
          alt: '',
          caption: '',
          width: '100%'
        }
      },
      {
        type: 'button',
        name: 'Button',
        description: 'Interactive button with customizable styling',
        icon: '◯',
        category: 'interactive',
        config: {
          text: 'Click me',
          style: 'primary',
          size: 'medium',
          action: 'link'
        }
      },
      {
        type: 'card',
        name: 'Card',
        description: 'Content card with title, text, and optional image',
        icon: '📄',
        category: 'layout',
        config: {
          title: 'Card Title',
          content: 'Card description goes here...',
          imageUrl: '',
          showButton: false
        }
      },
      {
        type: 'list',
        name: 'List',
        description: 'Ordered or unordered list of items',
        icon: '≡',
        category: 'content',
        config: {
          items: ['Item 1', 'Item 2', 'Item 3'],
          type: 'unordered',
          style: 'default'
        }
      },
      {
        type: 'spacer',
        name: 'Spacer',
        description: 'Add spacing between content elements',
        icon: '↕',
        category: 'layout',
        config: {
          height: 'medium',
          backgroundColor: 'transparent'
        }
      },
      {
        type: 'divider',
        name: 'Divider',
        description: 'Horizontal line to separate content sections',
        icon: '—',
        category: 'layout',
        config: {
          style: 'solid',
          color: 'gray',
          thickness: 'thin'
        }
      },
      {
        type: 'video',
        name: 'Video',
        description: 'Embed videos from various sources',
        icon: '▶',
        category: 'media',
        config: {
          src: '',
          autoplay: false,
          controls: true,
          poster: ''
        }
      }
    ];
  }

  /**
   * Create widget card HTML for the selection grid
   * @param {Object} widget - Widget definition
   * @returns {string} HTML string for widget card
   */
  createWidgetCard(widget) {
    return `
      <div class="widget-card border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
           data-widget-type="${widget.type}">
        <div class="flex items-start space-x-3">
          <div class="widget-icon bg-gray-100 rounded-lg w-12 h-12 flex items-center justify-center text-xl font-bold text-gray-600">
            ${this.escapeHtml(widget.icon)}
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-semibold text-gray-900 mb-1">${this.escapeHtml(widget.name)}</h4>
            <p class="text-xs text-gray-600 leading-relaxed">${this.escapeHtml(widget.description)}</p>
            <div class="mt-2">
              <span class="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                ${this.escapeHtml(widget.category)}
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Setup event handlers for widget selection modal
   * @param {HTMLElement} overlay - Modal overlay element
   * @param {string} slotName - Target slot name
   */
  setupWidgetModalHandlers(overlay, slotName) {
    const closeButton = overlay.querySelector('.widget-modal-close');
    const cancelButton = overlay.querySelector('.widget-modal-cancel');
    const searchInput = overlay.querySelector('.widget-search');
    const widgetCards = overlay.querySelectorAll('.widget-card');

    // Close handlers
    const closeModal = () => {
      overlay.remove();
      this.slotUIElements.delete('widget-selection-modal');
    };

    closeButton.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    // Search functionality
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      widgetCards.forEach(card => {
        const widgetType = card.dataset.widgetType;
        const widgetName = card.querySelector('h4').textContent.toLowerCase();
        const widgetDesc = card.querySelector('p').textContent.toLowerCase();

        const matches = widgetName.includes(searchTerm) ||
          widgetDesc.includes(searchTerm) ||
          widgetType.includes(searchTerm);

        card.style.display = matches ? 'block' : 'none';
      });
    });

    // Widget selection handlers
    widgetCards.forEach(card => {
      card.addEventListener('click', () => {
        const widgetType = card.dataset.widgetType;
        this.handleWidgetSelection(widgetType, slotName, closeModal);
      });
    });
  }

  /**
 * Handle widget selection and add to slot
 * @param {string} widgetType - Type of widget selected
 * @param {string} slotName - Target slot name
 * @param {Function} closeModal - Function to close the modal
 */
  handleWidgetSelection(widgetType, slotName, closeModal) {
    try {
      // Find widget definition
      const availableWidgets = this.getAvailableWidgets();
      const widgetDef = availableWidgets.find(w => w.type === widgetType);

      if (!widgetDef) {
        throw new Error(`Widget type "${widgetType}" not found`);
      }

      // Create widget instance with default config
      const widgetInstance = {
        id: this.generateWidgetId(),
        type: widgetDef.type,
        name: widgetDef.name,
        config: { ...widgetDef.config }
      };

      // Add widget to slot visually
      this.addWidgetToSlot(slotName, widgetInstance);

      // Execute callback for widget addition
      this.executeCallback('onWidgetSelected', slotName, widgetInstance, widgetDef);

      // Close modal
      closeModal();

      console.log(`LayoutRenderer: Widget "${widgetDef.name}" added to slot "${slotName}"`);

    } catch (error) {
      console.error('LayoutRenderer: Error handling widget selection', error);
      alert(`Error adding widget: ${error.message}`);
    }
  }

  /**
   * Add a widget instance to a slot and render it
   * @param {string} slotName - Name of the target slot
   * @param {Object} widgetInstance - Widget instance to add
   */
  addWidgetToSlot(slotName, widgetInstance) {
    const slotElement = this.slotContainers.get(slotName);
    if (!slotElement) {
      throw new Error(`Slot "${slotName}" not found`);
    }

    // Clear slot placeholder if it exists
    const placeholder = slotElement.querySelector('.slot-placeholder');
    if (placeholder) {
      placeholder.remove();
    }

    // Create and add widget element
    const widgetElement = this.renderWidgetInstance(widgetInstance);
    if (widgetElement) {
      slotElement.appendChild(widgetElement);

      // Mark page as dirty since a widget was added
      this.markAsDirty(`widget added: ${widgetInstance.name} to ${slotName}`);
    }
  }

  /**
   * Render a widget instance as a DOM element
   * @param {Object} widgetInstance - Widget instance to render
   * @returns {HTMLElement} Rendered widget element
   */
  renderWidgetInstance(widgetInstance) {
    const { id, type, name, config } = widgetInstance;

    // Create main widget container
    const widget = document.createElement('div');
    widget.className = 'rendered-widget mb-4 p-4 border border-gray-200 rounded-lg bg-white relative';
    widget.setAttribute('data-widget-id', id);
    widget.setAttribute('data-widget-type', type);

    // Add widget header with name and controls
    const header = document.createElement('div');
    header.className = 'widget-header flex items-center justify-between mb-3 pb-2 border-b border-gray-100';

    const title = document.createElement('span');
    title.className = 'text-sm font-medium text-gray-700';
    title.textContent = name;

    const controls = document.createElement('div');
    controls.className = 'flex items-center space-x-2';

    // Add edit button
    const editBtn = this.createIconButton('svg:edit', 'text-gray-400 hover:text-blue-600 w-5 h-5', () => {
      this.executeCallback('onEditWidget', id, widgetInstance);
    });
    editBtn.title = 'Edit Widget';

    // Add delete button
    const deleteBtn = this.createIconButton('svg:trash', 'text-gray-400 hover:text-red-600 w-5 h-5', () => {
      if (confirm(`Remove ${name} widget?`)) {
        this.removeWidgetFromSlot(id);
      }
    });
    deleteBtn.title = 'Remove Widget';

    controls.appendChild(editBtn);
    controls.appendChild(deleteBtn);
    header.appendChild(title);
    header.appendChild(controls);
    widget.appendChild(header);

    // Add widget content
    const content = this.renderWidgetContent(type, config);
    widget.appendChild(content);

    return widget;
  }

  /**
   * Render widget content based on type and configuration
   * @param {string} type - Widget type
   * @param {Object} config - Widget configuration
   * @returns {HTMLElement} Widget content element
   */
  renderWidgetContent(type, config) {
    const content = document.createElement('div');
    content.className = 'widget-content';

    switch (type) {
      case 'text':
        return this.renderTextWidget(config);

      case 'image':
        return this.renderImageWidget(config);

      case 'button':
        return this.renderButtonWidget(config);

      case 'card':
        return this.renderCardWidget(config);

      case 'list':
        return this.renderListWidget(config);

      case 'spacer':
        return this.renderSpacerWidget(config);

      case 'divider':
        return this.renderDividerWidget(config);

      case 'video':
        return this.renderVideoWidget(config);

      default:
        return this.renderDefaultWidget(type, config);
    }
  }

  /**
   * Render text widget
   * @param {Object} config - Widget configuration
   * @returns {HTMLElement} Text widget element
   */
  renderTextWidget(config) {
    const element = document.createElement('div');
    element.className = `text-${config.fontSize || 'medium'} text-${config.alignment || 'left'}`;
    element.innerHTML = this.escapeHtml(config.content || 'Enter your text here...');
    return element;
  }

  /**
   * Render image widget
   * @param {Object} config - Widget configuration
   * @returns {HTMLElement} Image widget element
   */
  renderImageWidget(config) {
    const container = document.createElement('div');
    container.className = 'text-center';

    if (config.src) {
      const img = document.createElement('img');
      img.src = config.src;
      img.alt = config.alt || '';
      img.className = 'max-w-full h-auto rounded';
      img.style.width = config.width || '100%';
      container.appendChild(img);

      if (config.caption) {
        const caption = document.createElement('p');
        caption.className = 'text-sm text-gray-600 mt-2';
        caption.textContent = config.caption;
        container.appendChild(caption);
      }
    } else {
      container.className += ' border-2 border-dashed border-gray-300 p-8 rounded';
      container.innerHTML = `
        <div class="text-gray-500">
          <div class="text-lg mb-2">📷</div>
          <div class="text-sm">No image selected</div>
        </div>
      `;
    }

    return container;
  }

  /**
   * Render button widget
   * @param {Object} config - Widget configuration
   * @returns {HTMLElement} Button widget element
   */
  renderButtonWidget(config) {
    const button = document.createElement('button');
    button.textContent = config.text || 'Click me';

    const styleClasses = {
      primary: 'bg-blue-600 hover:bg-blue-700 text-white',
      secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
      success: 'bg-green-600 hover:bg-green-700 text-white',
      danger: 'bg-red-600 hover:bg-red-700 text-white'
    };

    const sizeClasses = {
      small: 'px-3 py-1 text-sm',
      medium: 'px-4 py-2',
      large: 'px-6 py-3 text-lg'
    };

    button.className = `
      rounded transition-colors
      ${styleClasses[config.style] || styleClasses.primary}
      ${sizeClasses[config.size] || sizeClasses.medium}
    `;

    return button;
  }

  /**
   * Render card widget
   * @param {Object} config - Widget configuration
   * @returns {HTMLElement} Card widget element
   */
  renderCardWidget(config) {
    const card = document.createElement('div');
    card.className = 'border border-gray-200 rounded-lg p-4 bg-white';

    if (config.imageUrl) {
      const img = document.createElement('img');
      img.src = config.imageUrl;
      img.className = 'w-full h-32 object-cover rounded mb-3';
      card.appendChild(img);
    }

    const title = document.createElement('h3');
    title.className = 'text-lg font-semibold text-gray-900 mb-2';
    title.textContent = config.title || 'Card Title';
    card.appendChild(title);

    const content = document.createElement('p');
    content.className = 'text-gray-600 text-sm';
    content.textContent = config.content || 'Card description goes here...';
    card.appendChild(content);

    if (config.showButton) {
      const button = document.createElement('button');
      button.className = 'mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors';
      button.textContent = 'Learn More';
      card.appendChild(button);
    }

    return card;
  }

  /**
   * Render list widget
   * @param {Object} config - Widget configuration
   * @returns {HTMLElement} List widget element
   */
  renderListWidget(config) {
    const listTag = config.type === 'ordered' ? 'ol' : 'ul';
    const list = document.createElement(listTag);
    list.className = config.type === 'ordered' ? 'list-decimal list-inside' : 'list-disc list-inside';

    const items = config.items || ['Item 1', 'Item 2', 'Item 3'];
    items.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      li.className = 'mb-1';
      list.appendChild(li);
    });

    return list;
  }

  /**
   * Render spacer widget
   * @param {Object} config - Widget configuration
   * @returns {HTMLElement} Spacer widget element
   */
  renderSpacerWidget(config) {
    const spacer = document.createElement('div');

    const heights = {
      small: '16px',
      medium: '32px',
      large: '64px'
    };

    spacer.style.height = heights[config.height] || heights.medium;
    spacer.style.backgroundColor = config.backgroundColor || 'transparent';

    return spacer;
  }

  /**
   * Render divider widget
   * @param {Object} config - Widget configuration
   * @returns {HTMLElement} Divider widget element
   */
  renderDividerWidget(config) {
    const divider = document.createElement('hr');

    const styleClasses = {
      solid: 'border-solid',
      dashed: 'border-dashed',
      dotted: 'border-dotted'
    };

    const colorClasses = {
      gray: 'border-gray-300',
      black: 'border-black',
      blue: 'border-blue-300'
    };

    divider.className = `
      ${styleClasses[config.style] || styleClasses.solid}
      ${colorClasses[config.color] || colorClasses.gray}
      ${config.thickness === 'thick' ? 'border-2' : 'border'}
    `;

    return divider;
  }

  /**
   * Render video widget
   * @param {Object} config - Widget configuration
   * @returns {HTMLElement} Video widget element
   */
  renderVideoWidget(config) {
    const container = document.createElement('div');

    if (config.src) {
      const video = document.createElement('video');
      video.className = 'w-full rounded';
      video.controls = config.controls !== false;
      video.autoplay = config.autoplay === true;

      if (config.poster) {
        video.poster = config.poster;
      }

      const source = document.createElement('source');
      source.src = config.src;
      video.appendChild(source);

      container.appendChild(video);
    } else {
      container.className = 'border-2 border-dashed border-gray-300 p-8 rounded text-center text-gray-500';
      container.innerHTML = `
        <div class="text-lg mb-2">▶️</div>
        <div class="text-sm">No video selected</div>
      `;
    }

    return container;
  }

  /**
   * Render default widget (fallback)
   * @param {string} type - Widget type
   * @param {Object} config - Widget configuration
   * @returns {HTMLElement} Default widget element
   */
  renderDefaultWidget(type, config) {
    const element = document.createElement('div');
    element.className = 'p-4 border border-gray-300 rounded bg-gray-50';
    element.innerHTML = `
      <div class="text-sm font-medium text-gray-700">${this.escapeHtml(type)} Widget</div>
      <div class="text-xs text-gray-500 mt-1">Custom widget type</div>
    `;
    return element;
  }

  /**
 * Remove a widget from its slot
 * @param {string} widgetId - ID of the widget to remove
 */
  removeWidgetFromSlot(widgetId) {
    const widgetElement = document.querySelector(`[data-widget-id="${widgetId}"]`);
    if (widgetElement) {
      const slotElement = widgetElement.closest('[data-slot-name]');
      const slotName = slotElement?.getAttribute('data-slot-name');
      const widgetType = widgetElement.getAttribute('data-widget-type');
      const widgetName = widgetElement.querySelector('.widget-header span')?.textContent || 'Unknown Widget';

      widgetElement.remove();

      // Add placeholder back if slot is now empty
      if (slotElement && slotElement.children.length === 1) { // Only slot menu remains
        const slotConfig = this.getSlotConfig(slotName);
        const placeholder = document.createElement('div');
        placeholder.className = 'slot-placeholder p-4 border-2 border-dashed border-gray-300 rounded text-center text-gray-500';
        placeholder.innerHTML = `
          <div class="text-sm font-medium">${this.escapeHtml(slotConfig?.title || slotName)}</div>
          ${slotConfig?.description ? `<div class="text-xs mt-1">${this.escapeHtml(slotConfig.description)}</div>` : ''}
          <div class="text-xs mt-2 opacity-75">Click ••• to add widgets</div>
        `;
        slotElement.appendChild(placeholder);
      }

      // Mark page as dirty since a widget was removed
      this.markAsDirty(`widget removed: ${widgetName} from ${slotName}`);

      console.log(`LayoutRenderer: Widget ${widgetId} removed from slot ${slotName}`);
    }
  }

  /**
   * Convert default widgets to actual widget instances for new/unsaved pages
   * @param {string} slotName - Name of the slot
   * @param {Array} defaultWidgets - Array of default widget definitions
   */
  convertDefaultWidgetsToInstances(slotName, defaultWidgets) {
    try {
      const availableWidgets = this.getAvailableWidgets();

      defaultWidgets.forEach((defaultWidget, index) => {
        try {
          // Find matching widget definition by type
          const widgetDef = availableWidgets.find(w => w.type === defaultWidget.type);

          if (widgetDef) {
            // Create widget instance with merged config (default + specified)
            const widgetInstance = {
              id: this.generateWidgetId(),
              type: defaultWidget.type,
              name: defaultWidget.name || widgetDef.name,
              config: { ...widgetDef.config, ...defaultWidget.config }
            };

            // Add widget to slot
            this.addWidgetToSlot(slotName, widgetInstance);

            // Execute callback to notify about auto-created widget
            this.executeCallback('onWidgetAutoCreated', slotName, widgetInstance, widgetDef);

            console.log(`LayoutRenderer: Auto-created widget "${widgetInstance.name}" in slot "${slotName}"`);

          } else {
            // Widget type not found, create a placeholder widget
            const placeholderInstance = {
              id: this.generateWidgetId(),
              type: defaultWidget.type,
              name: defaultWidget.name || `${defaultWidget.type} Widget`,
              config: defaultWidget.config || {}
            };

            this.addWidgetToSlot(slotName, placeholderInstance);
            console.warn(`LayoutRenderer: Created placeholder for unknown widget type "${defaultWidget.type}" in slot "${slotName}"`);
          }

        } catch (error) {
          console.error(`LayoutRenderer: Error converting default widget ${index} in slot ${slotName}`, error);
        }
      });

      // Mark defaults as processed after the first render
      this.defaultWidgetsProcessed = true;

      // Mark page as dirty since default widgets were auto-created
      if (defaultWidgets.length > 0) {
        this.markAsDirty(`default widgets auto-created in ${slotName}`);
      }

    } catch (error) {
      console.error(`LayoutRenderer: Error converting default widgets for slot ${slotName}`, error);
    }
  }

  /**
   * Generate unique widget ID
   * @returns {string} Unique widget identifier
   */
  generateWidgetId() {
    return `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // New Slot Creation UI Methods

  /**
   * Enable add slot UI on layout elements
   * @param {Object} options - Configuration options for add slot UI
   */
  enableAddSlotUI(options = {}) {
    if (!this.uiConfig.enableAddSlotUI) {
      this.uiConfig.enableAddSlotUI = true;
    }

    // Add hover detection to container elements for slot insertion
    this.addSlotInsertionPoints(options);

    // Add floating add slot button
    if (options.showFloatingAddButton !== false) {
      this.addFloatingAddSlotButton(options);
    }
  }

  /**
   * Add floating add slot button to the layout
   * @param {Object} options - Button options
   */
  addFloatingAddSlotButton(options = {}) {
    // Remove existing floating button
    const existingButton = document.querySelector('.layout-add-slot-floating');
    if (existingButton) {
      existingButton.remove();
    }

    const floatingButton = document.createElement('div');
    floatingButton.className = 'layout-add-slot-floating fixed top-4 left-4 z-30 opacity-70 hover:opacity-100 transition-opacity';

    const addButton = this.createIconButton('svg:plus', 'bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 rounded-full shadow-lg', () => {
      this.showAddSlotDialog();
    });
    addButton.title = 'Add New Slot';
    floatingButton.appendChild(addButton);

    // Add to document body for global positioning
    document.body.appendChild(floatingButton);

    // Track for cleanup
    this.slotUIElements.set('floating-add-button', floatingButton);
  }

  /**
   * Add slot insertion points to layout elements
   * @param {Object} options - Insertion point options
   */
  addSlotInsertionPoints(options = {}) {
    // Find all container elements that can accept new slots
    const containers = this.findSlotContainers();

    containers.forEach(container => {
      this.addInsertionPointsToContainer(container, options);
    });
  }

  /**
   * Find all elements that can contain slots
   * @returns {Array<HTMLElement>} Array of container elements
   */
  findSlotContainers() {
    const containers = [];
    const rootElements = document.querySelectorAll('[data-slot-name]').length > 0
      ? document.querySelectorAll('[data-slot-name]').item(0).parentElement
      : document.body;

    // Look for div, section, main, article elements that aren't slots themselves
    const candidateSelectors = ['div', 'section', 'main', 'article', 'header', 'footer', 'aside'];

    candidateSelectors.forEach(selector => {
      const elements = document.querySelectorAll(`${selector}:not([data-slot-name])`);
      elements.forEach(el => {
        // Only include elements that have some structure or children
        if (el.children.length > 0 || el.className.includes('container') || el.className.includes('layout')) {
          containers.push(el);
        }
      });
    });

    return containers;
  }

  /**
   * Add insertion points to a container element
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Insertion options
   */
  addInsertionPointsToContainer(container, options = {}) {
    // Add hover behavior to show insertion points
    const showInsertionPoints = () => {
      this.showInsertionPointsInContainer(container);
    };

    const hideInsertionPoints = () => {
      this.hideInsertionPointsInContainer(container);
    };

    container.addEventListener('mouseenter', showInsertionPoints);
    container.addEventListener('mouseleave', hideInsertionPoints);

    // Track event listeners for cleanup
    this.eventListeners.set(`insertion-${container}`, () => {
      container.removeEventListener('mouseenter', showInsertionPoints);
      container.removeEventListener('mouseleave', hideInsertionPoints);
    });
  }

  /**
   * Show insertion points in a container
   * @param {HTMLElement} container - Container element
   */
  showInsertionPointsInContainer(container) {
    // Don't show if already visible or if container is a slot
    if (container.querySelector('.slot-insertion-point') || container.hasAttribute('data-slot-name')) {
      return;
    }

    // Add insertion points between children and at start/end
    const children = Array.from(container.children);

    // Add insertion point at the beginning
    const startPoint = this.createInsertionPoint('start', container);
    container.insertBefore(startPoint, container.firstChild);

    // Add insertion points between children
    children.forEach((child, index) => {
      const insertionPoint = this.createInsertionPoint(`after-${index}`, container, child);
      container.insertBefore(insertionPoint, child.nextSibling);
    });
  }

  /**
   * Hide insertion points in a container
   * @param {HTMLElement} container - Container element
   */
  hideInsertionPointsInContainer(container) {
    const insertionPoints = container.querySelectorAll('.slot-insertion-point');
    insertionPoints.forEach(point => point.remove());
  }

  /**
   * Create an insertion point element
   * @param {string} position - Position identifier
   * @param {HTMLElement} container - Parent container
   * @param {HTMLElement} referenceElement - Reference element for positioning
   * @returns {HTMLElement} Insertion point element
   */
  createInsertionPoint(position, container, referenceElement = null) {
    const insertionPoint = document.createElement('div');
    insertionPoint.className = 'slot-insertion-point flex items-center justify-center py-2 px-4 my-1 border-2 border-dashed border-blue-300 bg-blue-50 rounded opacity-0 hover:opacity-100 transition-opacity cursor-pointer';
    insertionPoint.setAttribute('data-insertion-position', position);

    const addIcon = document.createElement('span');
    addIcon.className = 'text-blue-600 text-sm font-medium flex items-center gap-2';
    addIcon.innerHTML = `
      <span class="text-blue-600 font-bold text-lg">+</span>
      <span>Add Slot Here</span>
    `;
    insertionPoint.appendChild(addIcon);

    // Add click handler
    insertionPoint.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showAddSlotDialog({
        container: container,
        position: position,
        referenceElement: referenceElement
      });
    });

    return insertionPoint;
  }

  /**
   * Show add slot configuration dialog
   * @param {Object} insertionContext - Context for where to insert the slot
   */
  showAddSlotDialog(insertionContext = {}) {
    // Remove existing dialog
    const existingDialog = document.querySelector('.add-slot-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.className = 'add-slot-dialog fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

    // Create dialog content
    const dialog = document.createElement('div');
    dialog.className = 'bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-90vh overflow-y-auto';

    dialog.innerHTML = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Add New Slot</h3>
          <button class="add-slot-close text-gray-400 hover:text-gray-600 transition-colors">
            <span class="text-xl">×</span>
          </button>
        </div>
        
        <form class="add-slot-form space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Slot Name *</label>
            <input type="text" name="slotName" required 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                   placeholder="e.g., main-content, sidebar">
            <div class="text-xs text-gray-500 mt-1">Unique identifier for the slot (lowercase, hyphens allowed)</div>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Display Title</label>
            <input type="text" name="slotTitle" 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                   placeholder="e.g., Main Content Area">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea name="slotDescription" rows="2"
                      class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Brief description of the slot's purpose"></textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Container Tag</label>
            <select name="slotTag" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="div">div</option>
              <option value="section">section</option>
              <option value="aside">aside</option>
              <option value="article">article</option>
              <option value="main">main</option>
              <option value="header">header</option>
              <option value="footer">footer</option>
            </select>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">CSS Classes</label>
            <input type="text" name="slotClasses" 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                   placeholder="e.g., col-span-2 bg-gray-50 p-4">
          </div>
          
          <div class="flex items-center">
            <input type="checkbox" name="makeDroppable" id="makeDroppable" class="mr-2">
            <label for="makeDroppable" class="text-sm text-gray-700">Make slot droppable for widgets</label>
          </div>
        </form>
        
        <div class="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
          <button class="add-slot-cancel px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button class="add-slot-confirm px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
            Add Slot
          </button>
        </div>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Add event handlers
    this.setupAddSlotDialogHandlers(overlay, insertionContext);

    // Track for cleanup
    this.slotUIElements.set('add-slot-dialog', overlay);
  }

  /**
   * Setup event handlers for add slot dialog
   * @param {HTMLElement} overlay - Dialog overlay element
   * @param {Object} insertionContext - Insertion context
   */
  setupAddSlotDialogHandlers(overlay, insertionContext) {
    const closeButton = overlay.querySelector('.add-slot-close');
    const cancelButton = overlay.querySelector('.add-slot-cancel');
    const confirmButton = overlay.querySelector('.add-slot-confirm');
    const form = overlay.querySelector('.add-slot-form');

    // Close handlers
    const closeDialog = () => {
      overlay.remove();
      this.slotUIElements.delete('add-slot-dialog');
    };

    closeButton.addEventListener('click', closeDialog);
    cancelButton.addEventListener('click', closeDialog);

    // Click outside to close
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDialog();
      }
    });

    // Confirm handler
    confirmButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleAddSlotConfirm(form, insertionContext, closeDialog);
    });

    // Auto-fill title from name
    const nameInput = form.querySelector('[name="slotName"]');
    const titleInput = form.querySelector('[name="slotTitle"]');

    nameInput.addEventListener('input', () => {
      if (!titleInput.value) {
        const name = nameInput.value;
        const title = name.split('-').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        titleInput.value = title;
      }
    });
  }

  /**
   * Handle add slot form confirmation
   * @param {HTMLFormElement} form - Form element
   * @param {Object} insertionContext - Insertion context
   * @param {Function} closeDialog - Function to close dialog
   */
  handleAddSlotConfirm(form, insertionContext, closeDialog) {
    try {
      // Collect form data
      const formData = new FormData(form);
      const slotData = {
        name: formData.get('slotName').trim(),
        title: formData.get('slotTitle').trim(),
        description: formData.get('slotDescription').trim(),
        tag: formData.get('slotTag'),
        classes: formData.get('slotClasses').trim(),
        makeDroppable: formData.get('makeDroppable') === 'on'
      };

      // Validate required fields
      if (!slotData.name) {
        alert('Slot name is required');
        return;
      }

      // Validate slot name format
      if (!slotData.name.match(/^[a-z][a-z0-9-]*$/)) {
        alert('Slot name must start with a letter and contain only lowercase letters, numbers, and hyphens');
        return;
      }

      // Check if slot name already exists
      if (this.slotContainers.has(slotData.name)) {
        alert(`Slot "${slotData.name}" already exists. Please choose a different name.`);
        return;
      }

      // Set default title if not provided
      if (!slotData.title) {
        slotData.title = slotData.name.split('-').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
      }

      // Create slot configuration
      const slotConfig = {
        name: slotData.name,
        title: slotData.title,
        description: slotData.description,
        allowedWidgets: slotData.makeDroppable ? [] : null,
        defaultWidgets: []
      };

      // Create slot JSON node
      const slotNode = {
        type: 'slot',
        tag: slotData.tag,
        classes: slotData.classes,
        slot: slotConfig
      };

      // Execute callback for adding the slot
      this.executeCallback('onAddNewSlot', slotData, slotNode, insertionContext);

      // Close dialog
      closeDialog();

      // Show success message
      console.log(`LayoutRenderer: New slot "${slotData.name}" configuration created`);

    } catch (error) {
      console.error('LayoutRenderer: Error creating new slot', error);
      alert(`Error creating slot: ${error.message}`);
    }
  }

  /**
   * Disable add slot UI
   */
  disableAddSlotUI() {
    this.uiConfig.enableAddSlotUI = false;

    // Remove floating button
    const floatingButton = document.querySelector('.layout-add-slot-floating');
    if (floatingButton) {
      floatingButton.remove();
    }

    // Remove insertion point event listeners
    this.eventListeners.forEach((cleanup, key) => {
      if (typeof key === 'string' && key.startsWith('insertion-')) {
        cleanup();
        this.eventListeners.delete(key);
      }
    });

    // Hide all insertion points
    document.querySelectorAll('.slot-insertion-point').forEach(point => point.remove());
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

      // Automatically add slot icon menu if UI is enabled
      if (this.uiConfig.showIconMenu || this.uiConfig.enableAddSlotUI) {
        // Add menu after a brief delay to ensure DOM is ready
        setTimeout(() => {
          this.addSlotIconMenu(slotName, {
            showAddWidget: this.uiConfig.showAddWidget,
            showSlotInfo: true,
            showClearSlot: true
          });
        }, 100);
      }

      // Initialize slot with widgets - priority order: saved > default > placeholder
      if (this.hasSlotWidgetData(slotName)) {
        // Load saved widgets for this slot
        const savedWidgets = this.getSlotWidgetData(slotName);
        savedWidgets.forEach((widgetInstance, index) => {
          try {
            this.addWidgetToSlot(slotName, widgetInstance);
          } catch (error) {
            console.error(`LayoutRenderer: Error rendering saved widget ${index} in slot ${slotName}`, error);
            const errorElement = this.createErrorWidgetElement(`Saved widget ${index + 1}: ${error.message}`);
            element.appendChild(errorElement);
          }
        });
      } else if (node.slot.defaultWidgets && Array.isArray(node.slot.defaultWidgets) && node.slot.defaultWidgets.length > 0) {
        // Check if we should convert default widgets to real widget instances
        if (!this.pageHasBeenSaved && !this.defaultWidgetsProcessed) {
          // Convert default widgets to actual widget instances for new/unsaved pages
          this.convertDefaultWidgetsToInstances(slotName, node.slot.defaultWidgets);
        } else {
          // For saved pages without saved widgets, render default widgets as placeholders (legacy behavior)
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
        }
      } else {
        // Show placeholder for empty slot
        const title = node.slot.title || slotName;
        const description = node.slot.description || '';

        element.innerHTML = `
          <div class="slot-placeholder p-4 border-2 border-dashed border-gray-300 rounded text-center text-gray-500">
            <div class="text-sm font-medium">${this.escapeHtml(title)}</div>
            ${description ? `<div class="text-xs mt-1">${this.escapeHtml(description)}</div>` : ''}
            <div class="text-xs mt-2 opacity-75">Click ••• to add widgets</div>
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