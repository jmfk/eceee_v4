/**
 * LayoutRenderer.js
 * Renders layout JSON as DOM elements with widget support and UI enhancements
 */

// Constants for widget actions to eliminate magic strings
const WIDGET_ACTIONS = {
  ADD: 'add',
  REMOVE: 'remove',
  UPDATE: 'update',
  CLEAR: 'clear'
};

// Constants for widget menu icons
const WIDGET_ICONS = {
  MENU: 'svg:menu',
  EDIT: 'svg:edit',
  TRASH: 'svg:trash'
};

// Constants for error types
const ERROR_TYPES = {
  WIDGET_NOT_FOUND: 'WIDGET_NOT_FOUND',
  CONFIG_EXTRACTION_ERROR: 'CONFIG_EXTRACTION_ERROR',
  CALLBACK_EXECUTION_ERROR: 'CALLBACK_EXECUTION_ERROR',
  LAYOUT_VALIDATION_ERROR: 'LAYOUT_VALIDATION_ERROR',
  RENDERING_ERROR: 'RENDERING_ERROR',
  CLEANUP_ERROR: 'CLEANUP_ERROR',
  AUTO_SAVE_ERROR: 'AUTO_SAVE_ERROR'
};

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
      enableContextMenu: false
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

    // Version management properties
    this.currentVersion = null; // Currently loaded version data
    this.pageVersions = []; // Available versions for this page
    this.pageId = null; // Current page ID
    this.versionSelectorElement = null; // Version selector UI element
    this.versionCallbacks = new Map(); // Map of version-related callbacks

    // NEW: Widget data change callbacks for single source of truth
    this.widgetDataCallbacks = new Map(); // Map of widget data change callbacks
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

      // console.log('LayoutRenderer: Layout rendered successfully', {
      //   slots: Array.from(this.slotContainers.keys()),
      //   configs: Array.from(this.slotConfigs.keys())
      // });

      // Ensure slot menus are added after rendering is complete
      if (this.uiConfig.showIconMenu) {
        setTimeout(() => {
          this.addIconMenusToAllSlots({
            showAddWidget: this.uiConfig.showAddWidget,
            showSlotInfo: true,
            showClearSlot: true
          });
          // Add global click outside listener for all menus
          this.addGlobalClickOutsideListener();
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
      // Remove tracked event listeners only for elements within this container
      this.eventListeners.forEach((cleanup, element) => {
        // Check if element is a valid Node and if it's contained within the container
        if (element instanceof Node && container.contains(element) && typeof cleanup === 'function') {
          cleanup();
          this.eventListeners.delete(element);
        }
      });

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
    if (this.isDestroyed) {
      return;
    }

    const container = this.slotContainers.get(slotName);

    if (!container) {
      return;
    }
    try {
      // Validate widgets array
      if (!Array.isArray(widgets)) {
        throw new Error('Widgets must be an array');
      }

      // Clean up existing content in slot (but preserve menu state)
      this.cleanup(container);

      if (widgets.length > 0) {
        // Render provided widgets
        widgets.forEach((widget, index) => {
          try {
            // Use renderWidgetInstance for full widget instances with controls
            const widgetElement = this.renderWidgetInstance(widget);
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
        // // No widgets provided, use defaults if available
        // const slotConfig = this.slotConfigs.get(slotName);
        // if (slotConfig?.defaultWidgets?.length > 0) {
        //   slotConfig.defaultWidgets.forEach((defaultWidget, index) => {
        //     try {
        //       const widgetElement = this.renderWidget(defaultWidget);
        //       if (widgetElement) {
        //         container.appendChild(widgetElement);
        //       }
        //     } catch (error) {
        //       console.error(`LayoutRenderer: Error rendering default widget ${index} in slot ${slotName}`, error);
        //       const errorElement = this.createErrorWidgetElement(`Default widget ${index + 1}: ${error.message}`);
        //       container.appendChild(errorElement);
        //     }
        //   });
        // } else {
        //   // No widgets or defaults - show placeholder
        //   container.innerHTML = `
        //     <div class="slot-placeholder p-4 border-2 border-dashed border-gray-300 rounded text-center text-gray-500">
        //       <span class="text-sm">${this.escapeHtml(`Empty slot: ${slotName}`)}</span>
        //     </div>
        //   `;
        // }
      }

      // Re-add slot menu if UI is enabled and it's not already present
      if (this.uiConfig.showIconMenu && !container.querySelector('[data-slot-menu]')) {
        this.addSlotIconMenu(slotName, {
          showAddWidget: this.uiConfig.showAddWidget,
          showSlotInfo: true,
          showClearSlot: true
        });
      }

    } catch (error) {
      console.error(`LayoutRenderer: Error updating slot "${slotName}"`, error);
      this.renderError(container, `Failed to update slot: ${error.message}`);
    }
  }

  /**
   * Clear all widgets from a specific slot
   * @param {string} slotName - Name of the slot to clear
   */
  clearSlot(slotName) {
    try {
      const slotElement = this.slotContainers.get(slotName);
      if (!slotElement) {
        console.warn(`LayoutRenderer: Cannot clear slot "${slotName}" - slot not found`);
        return;
      }

      // NEW: Notify parent component to update pageData.widgets instead of directly clearing DOM
      this.executeWidgetDataCallback(WIDGET_ACTIONS.CLEAR, slotName, []);

    } catch (error) {
      console.error(`LayoutRenderer: Error clearing slot "${slotName}"`, error);
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
        action: () => {
          // Clear all widgets from the slot
          this.clearSlot(slotName);
          // Mark as dirty for unified save system
          this.markAsDirty(`Cleared slot: ${slotName}`);
        },
        className: 'text-red-700 hover:bg-red-50'
      });
    }

    // Slot Info item
    if (options.showSlotInfo) {
      items.push({
        icon: 'svg:info',
        label: 'Slot Info',
        action: () => {
          // Note: Callback removed - slot info is display-only
          // console.log(`Slot info requested: ${slotName}`);
        },
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
 * Toggle widget menu visibility
 * @param {string} widgetId - ID of the widget
 */
  toggleWidgetMenu(widgetId) {
    const dropdown = document.querySelector(`[data-widget-menu="${widgetId}"]`);

    if (dropdown) {
      const isHidden = dropdown.classList.contains('hidden');

      // Close all other widget menus
      document.querySelectorAll('.widget-menu-dropdown').forEach(menu => {
        menu.classList.add('hidden');
      });

      // Close all slot menus too
      document.querySelectorAll('.slot-menu-dropdown').forEach(menu => {
        menu.classList.add('hidden');
      });

      // Toggle this menu
      if (isHidden) {
        dropdown.classList.remove('hidden');
      } else {
        dropdown.classList.add('hidden');
      }
    }
  }

  /**
   * Hide widget menu
   * @param {string} widgetId - ID of the widget
   */
  hideWidgetMenu(widgetId) {
    const dropdown = document.querySelector(`[data-widget-menu="${widgetId}"]`);
    if (dropdown) {
      dropdown.classList.add('hidden');
    }
  }

  /**
   * Edit widget functionality
   * @param {string} widgetId - ID of the widget
   * @param {Object} widgetInstance - Widget instance data
   */
  editWidget(widgetId, widgetInstance) {
    // For now, just log the edit request
    // In the future, this could open an edit modal or inline editor
    console.log(`Edit widget requested: ${widgetInstance.name} (${widgetId})`, widgetInstance);

    // TODO: Implement widget editing functionality
    // This could:
    // 1. Open a modal with widget-specific edit form
    // 2. Switch to inline editing mode
    // 3. Use the widget data callback system to update pageData.widgets
    alert(`Edit functionality for ${widgetInstance.name} widget is coming soon!`);
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
   * Add global click outside listener for all menus
   */
  addGlobalClickOutsideListener() {
    if (this.eventListeners.has('global-click-outside')) {
      return; // Already exists
    }

    const handleGlobalClickOutside = (event) => {
      // Check if click is outside any menu
      const isInsideSlotMenu = event.target.closest('.slot-icon-menu');
      const isInsideWidgetMenu = event.target.closest('.widget-menu-container');

      if (!isInsideSlotMenu && !isInsideWidgetMenu) {
        // Close all menus
        document.querySelectorAll('.slot-menu-dropdown, .widget-menu-dropdown').forEach(menu => {
          menu.classList.add('hidden');
        });
      }
    };

    document.addEventListener('click', handleGlobalClickOutside);
    this.eventListeners.set('global-click-outside', () => {
      document.removeEventListener('click', handleGlobalClickOutside);
    });
  }

  /**
   * Execute a UI callback
   * @param {string} callbackName - Name of the callback
   * @param {string} slotName - Name of the slot
   * @param {...any} args - Additional arguments
   */
  executeCallback(callbackName, slotName, ...args) {
    // Simplified: Only handle essential callbacks
    if (callbackName === 'onDirtyStateChanged') {
      const callback = this.uiCallbacks.get(callbackName);
      if (typeof callback === 'function') {
        try {
          // console.log(`🔄 DIRTY STATE: Executing callback with isDirty=${slotName}, reason=${args[0]}`);
          callback(slotName, ...args); // For onDirtyStateChanged: slotName is actually isDirty
        } catch (error) {
          this.handleError(ERROR_TYPES.CALLBACK_EXECUTION_ERROR,
            `executing dirty state callback with isDirty=${slotName}`,
            error,
            { isDirty: slotName, reason: args[0] });
        }
      } else {
        console.warn(`🔄 DIRTY STATE: No dirty state callback registered`);
      }
    } else {
      // Log removed callbacks for debugging
      // console.log(`LayoutRenderer: Ignoring removed callback: ${callbackName}`);
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
    // console.log('LayoutRenderer: Page marked as saved - default widgets will not be auto-created');
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
    // console.log('LayoutRenderer: Page state reset - default widgets will be auto-created');
  }

  /**
   * Collect all widget data from rendered slots
   * @returns {Object} Object with slot names as keys and widget arrays as values
   */
  collectAllWidgetData() {
    const widgetData = {};


    this.slotContainers.forEach((slotElement, slotName) => {
      const widgets = this.collectWidgetDataFromSlot(slotName);

      // Always include all slots in payload, even if empty
      widgetData[slotName] = widgets;
    });

    // console.log('🔍 DEBUG: Final widget data payload:', widgetData);
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
    // console.log(`🔍 DEBUG: Slot "${slotName}" has ${widgetElements.length} widget elements in DOM`);

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
        this.handleError(ERROR_TYPES.CONFIG_EXTRACTION_ERROR,
          `collecting widget data from element in slot ${slotName}`,
          error,
          { slotName, widgetElement });
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
    const contentElement = widgetElement.querySelector('.widget-content');
    if (!contentElement) {
      return {};
    }

    try {
      // Use strategy pattern for widget config extraction
      const extractorMethod = `extract${this.capitalizeFirst(widgetType)}WidgetConfig`;
      if (typeof this[extractorMethod] === 'function') {
        return this[extractorMethod](contentElement);
      } else {
        return this.extractDefaultWidgetConfig(widgetElement);
      }
    } catch (error) {
      console.error(`LayoutRenderer: ${ERROR_TYPES.CONFIG_EXTRACTION_ERROR} for ${widgetType} widget`, error);
      return {};
    }
  }

  /**
   * Capitalize first letter of a string
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Extract text widget configuration
   * @param {HTMLElement} contentElement - Widget content element
   * @returns {Object} Text widget configuration
   */
  extractTextWidgetConfig(contentElement) {
    const config = {};
    const textElement = contentElement.firstElementChild;

    if (textElement) {
      config.content = textElement.textContent || textElement.innerText;

      // Extract fontSize and alignment from class
      const classList = Array.from(textElement.classList);
      const fontSizeClass = classList.find(cls => cls.startsWith('text-'));
      if (fontSizeClass) {
        config.fontSize = fontSizeClass.replace('text-', '');
      }

      const alignmentClass = classList.find(cls => cls.startsWith('text-'));
      if (alignmentClass && ['left', 'center', 'right'].includes(alignmentClass.replace('text-', ''))) {
        config.alignment = alignmentClass.replace('text-', '');
      }
    }

    return config;
  }

  /**
   * Extract image widget configuration
   * @param {HTMLElement} contentElement - Widget content element
   * @returns {Object} Image widget configuration
   */
  extractImageWidgetConfig(contentElement) {
    const config = {};
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

    return config;
  }

  /**
   * Extract button widget configuration
   * @param {HTMLElement} contentElement - Widget content element
   * @returns {Object} Button widget configuration
   */
  extractButtonWidgetConfig(contentElement) {
    const config = {};
    const buttonElement = contentElement.querySelector('button');

    if (buttonElement) {
      config.text = buttonElement.textContent;

      // Extract style and size from classes
      const classList = Array.from(buttonElement.classList);

      // Determine style
      if (classList.includes('bg-blue-600')) config.style = 'primary';
      else if (classList.includes('bg-gray-200')) config.style = 'secondary';
      else if (classList.includes('bg-green-600')) config.style = 'success';
      else if (classList.includes('bg-red-600')) config.style = 'danger';

      // Determine size
      if (classList.includes('px-3')) config.size = 'small';
      else if (classList.includes('px-6')) config.size = 'large';
      else config.size = 'medium';
    }

    return config;
  }

  /**
   * Extract card widget configuration
   * @param {HTMLElement} contentElement - Widget content element
   * @returns {Object} Card widget configuration
   */
  extractCardWidgetConfig(contentElement) {
    const config = {};

    const titleElement = contentElement.querySelector('h3');
    const contentTextElement = contentElement.querySelector('p');
    const cardImgElement = contentElement.querySelector('img');
    const cardButtonElement = contentElement.querySelector('button');

    if (titleElement) config.title = titleElement.textContent;
    if (contentTextElement) config.content = contentTextElement.textContent;
    if (cardImgElement) config.imageUrl = cardImgElement.src;
    config.showButton = !!cardButtonElement;

    return config;
  }

  /**
   * Extract list widget configuration
   * @param {HTMLElement} contentElement - Widget content element
   * @returns {Object} List widget configuration
   */
  extractListWidgetConfig(contentElement) {
    const config = {};
    const listElement = contentElement.querySelector('ol, ul');

    if (listElement) {
      config.type = listElement.tagName.toLowerCase() === 'ol' ? 'ordered' : 'unordered';
      const items = Array.from(listElement.querySelectorAll('li')).map(li => li.textContent);
      config.items = items;
    }

    return config;
  }

  /**
   * Extract spacer widget configuration
   * @param {HTMLElement} contentElement - Widget content element
   * @returns {Object} Spacer widget configuration
   */
  extractSpacerWidgetConfig(contentElement) {
    const config = {};
    const spacerElement = contentElement.firstElementChild;

    if (spacerElement) {
      const height = spacerElement.style.height;
      if (height === '16px') config.height = 'small';
      else if (height === '64px') config.height = 'large';
      else config.height = 'medium';

      config.backgroundColor = spacerElement.style.backgroundColor || 'transparent';
    }

    return config;
  }

  /**
   * Extract divider widget configuration
   * @param {HTMLElement} contentElement - Widget content element
   * @returns {Object} Divider widget configuration
   */
  extractDividerWidgetConfig(contentElement) {
    const config = {};
    const dividerElement = contentElement.querySelector('hr');

    if (dividerElement) {
      const classList = Array.from(dividerElement.classList);

      // Determine style
      if (classList.includes('border-dashed')) config.style = 'dashed';
      else if (classList.includes('border-dotted')) config.style = 'dotted';
      else config.style = 'solid';

      // Determine color
      if (classList.includes('border-black')) config.color = 'black';
      else if (classList.includes('border-blue-300')) config.color = 'blue';
      else config.color = 'gray';

      // Determine thickness
      config.thickness = classList.includes('border-2') ? 'thick' : 'thin';
    }

    return config;
  }

  /**
   * Extract video widget configuration
   * @param {HTMLElement} contentElement - Widget content element
   * @returns {Object} Video widget configuration
   */
  extractVideoWidgetConfig(contentElement) {
    const config = {};
    const videoElement = contentElement.querySelector('video');

    if (videoElement) {
      const sourceElement = videoElement.querySelector('source');
      if (sourceElement) config.src = sourceElement.src;

      config.controls = videoElement.controls;
      config.autoplay = videoElement.autoplay;

      if (videoElement.poster) config.poster = videoElement.poster;
    }

    return config;
  }

  /**
   * Extract default widget configuration for unknown widget types
   * @param {HTMLElement} widgetElement - Widget element
   * @returns {Object} Default widget configuration
   */
  extractDefaultWidgetConfig(widgetElement) {
    // For unknown widget types, try to preserve any data attributes
    const dataAttrs = Array.from(widgetElement.attributes)
      .filter(attr => attr.name.startsWith('data-widget-config-'))
      .reduce((acc, attr) => {
        const key = attr.name.replace('data-widget-config-', '');
        acc[key] = attr.value;
        return acc;
      }, {});

    return dataAttrs;
  }

  /**
   * Save widget data for all slots
   * @param {Object} widgetData - Object with slot names as keys and widget arrays as values
   */
  saveWidgetData(widgetData) {
    // console.log('saveWidgetData:', widgetData);
    // Store widget data internally
    this.savedWidgetData.clear();
    Object.entries(widgetData).forEach(([slotName, widgets]) => {
      this.savedWidgetData.set(slotName, [...widgets]); // Deep copy
    });

    // Mark page as saved
    this.markPageAsSaved();

    // console.log('LayoutRenderer: Widget data saved:', widgetData);
  }

  /**
 * Save current widget state from all rendered slots
 * @returns {Object} The collected and saved widget data
 * @deprecated This method is kept for backward compatibility but should use pageData.widgets as single source of truth
 */
  saveCurrentWidgetState() {
    // console.log('🔄 SAVE SIGNAL: LayoutRenderer.saveCurrentWidgetState() called (DEPRECATED)');

    // For backward compatibility, still collect from DOM if needed
    // But the new approach should use pageData.widgets directly
    const widgetData = this.collectAllWidgetData();
    this.saveWidgetData(widgetData);

    // console.log('✅ SAVE SIGNAL: LayoutRenderer data collection completed (consider using pageData.widgets directly)');
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

      // console.log('LayoutRenderer: Widget data loaded:', widgetData);
    }
  }

  /**
   * Configure auto-save settings
   * @param {Object} config - Auto-save configuration
   */
  setAutoSaveConfig(config = {}) {
    this.autoSaveEnabled = config.enabled !== false;
    this.autoSaveDelay = config.delay || 2000;
    // console.log(`LayoutRenderer: Auto-save configured - enabled: ${this.autoSaveEnabled}, delay: ${this.autoSaveDelay}ms`);
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
      // console.log(`🔄 DIRTY STATE: LayoutRenderer marked as dirty - ${reason}`);

      // Execute callback for dirty state change
      // console.log(`🔄 DIRTY STATE: LayoutRenderer executing onDirtyStateChanged callback`);
      this.executeCallback('onDirtyStateChanged', true, reason);
    }

    // Note: Auto-save removed - unified save system handles all saves
  }

  /**
   * Mark page as clean (no unsaved changes)
   */
  markAsClean() {
    if (this.isDirty) {
      this.isDirty = false;
      // console.log('LayoutRenderer: Page marked as clean');

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
        // console.log('LayoutRenderer: Auto-saving page...');

        try {
          const widgetData = this.saveCurrentWidgetState();
          // console.log('LayoutRenderer: Auto-save completed');

          // Execute callback for auto-save
          this.executeCallback('onAutoSave', widgetData);

        } catch (error) {
          console.error('LayoutRenderer: Auto-save failed', error);
          this.executeCallback('onAutoSaveError', error);
        }
      }
      this.autoSaveTimeoutId = null;
    }, this.autoSaveDelay);

    // console.log(`LayoutRenderer: Auto-save scheduled in ${this.autoSaveDelay}ms`);
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

      // NEW: Notify parent component to update pageData.widgets instead of directly adding to slot
      this.executeWidgetDataCallback(WIDGET_ACTIONS.ADD, slotName, widgetInstance);

      // Close modal
      closeModal();

      // console.log(`LayoutRenderer: Widget "${widgetDef.name}" added to slot "${slotName}"`);

    } catch (error) {
      this.handleError(ERROR_TYPES.WIDGET_NOT_FOUND,
        `handling widget selection for type=${widgetType}, slot=${slotName}`,
        error,
        { widgetType, slotName });
      alert(`Error adding widget: ${error.message}`);
    }
  }

  /**
 * Add a widget instance to a slot and render it
 * @param {string} slotName - Name of the target slot
 * @param {Object} widgetInstance - Widget instance to add
 * @param {boolean} isLoading - True if loading saved widget (don't mark dirty)
 */
  addWidgetToSlot(slotName, widgetInstance, isLoading = false) {
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

      // Only mark page as dirty if this is a new widget, not a loaded one
      if (!isLoading) {
        this.markAsDirty(`widget added: ${widgetInstance.name} to ${slotName}`);
      }
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
    const widget = this.createWidgetContainer(id, type);

    // Add widget header with name and controls
    const header = this.createWidgetHeader(id, name, widgetInstance);
    widget.appendChild(header);

    // Add widget content
    const content = this.renderWidgetContent(type, config);
    widget.appendChild(content);

    return widget;
  }

  /**
   * Create the main widget container element
   * @param {string} id - Widget ID
   * @param {string} type - Widget type
   * @returns {HTMLElement} Widget container element
   */
  createWidgetContainer(id, type) {
    const widget = document.createElement('div');
    widget.className = 'rendered-widget mb-4 p-4 border border-gray-200 rounded-lg bg-white relative';
    widget.setAttribute('data-widget-id', id);
    widget.setAttribute('data-widget-type', type);
    return widget;
  }

  /**
   * Create the widget header with title and controls
   * @param {string} id - Widget ID
   * @param {string} name - Widget name
   * @param {Object} widgetInstance - Complete widget instance for menu actions
   * @returns {HTMLElement} Widget header element
   */
  createWidgetHeader(id, name, widgetInstance) {
    const header = document.createElement('div');
    header.className = 'widget-header flex items-center justify-between mb-3 pb-2 border-b border-gray-100';

    const title = document.createElement('span');
    title.className = 'text-sm font-medium text-gray-700';
    title.textContent = name;

    const controls = this.createWidgetControls(id, name, widgetInstance);

    header.appendChild(title);
    header.appendChild(controls);

    return header;
  }

  /**
   * Create widget control buttons and menu
   * @param {string} id - Widget ID
   * @param {string} name - Widget name
   * @param {Object} widgetInstance - Complete widget instance for menu actions
   * @returns {HTMLElement} Controls container element
   */
  createWidgetControls(id, name, widgetInstance) {
    const controls = document.createElement('div');
    controls.className = 'relative';

    const menuContainer = document.createElement('div');
    menuContainer.className = 'widget-menu-container relative';

    // Create kebab menu button
    const menuButton = this.createIconButton(WIDGET_ICONS.MENU, 'text-gray-400 hover:text-gray-600 w-5 h-5', () => {
      this.toggleWidgetMenu(id);
    });
    menuButton.title = `Widget options for ${name}`;
    menuContainer.appendChild(menuButton);

    // Create menu dropdown
    const menuDropdown = this.createWidgetMenuDropdown(id, name, widgetInstance);
    menuContainer.appendChild(menuDropdown);

    controls.appendChild(menuContainer);
    return controls;
  }

  /**
   * Create the widget menu dropdown with edit and remove options
   * @param {string} id - Widget ID
   * @param {string} name - Widget name
   * @param {Object} widgetInstance - Complete widget instance for menu actions
   * @returns {HTMLElement} Menu dropdown element
   */
  createWidgetMenuDropdown(id, name, widgetInstance) {
    const menuDropdown = document.createElement('div');
    menuDropdown.className = 'widget-menu-dropdown absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-32 hidden z-30';
    menuDropdown.setAttribute('data-widget-menu', id);

    // Add edit menu item
    const editItem = this.createMenuItem(WIDGET_ICONS.EDIT, 'Edit', () => {
      this.editWidget(id, widgetInstance);
      this.hideWidgetMenu(id);
    }, 'text-blue-700 hover:bg-blue-50');
    menuDropdown.appendChild(editItem);

    // Add remove menu item  
    const removeItem = this.createMenuItem(WIDGET_ICONS.TRASH, 'Remove', () => {
      if (confirm(`Remove ${name} widget?`)) {
        this.removeWidgetFromSlot(id);
      }
      this.hideWidgetMenu(id);
    }, 'text-red-700 hover:bg-red-50');
    menuDropdown.appendChild(removeItem);

    return menuDropdown;
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

      // NEW: Notify parent component to update pageData.widgets instead of directly removing from DOM
      this.executeWidgetDataCallback(WIDGET_ACTIONS.REMOVE, slotName, widgetId);

      // console.log(`LayoutRenderer: Widget ${widgetId} removed from slot ${slotName}`);
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

            // Note: Callback removed - auto-created widgets are logged via markAsDirty
            // console.log(`Auto-created widget: ${widgetInstance.name} in ${slotName}`);

            // console.log(`LayoutRenderer: Auto-created widget "${widgetInstance.name}" in slot "${slotName}"`);

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
    // console.log("LayoutRenderer renderSlotElement", node)
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
      // console.log(`🔍 DEBUG: Registered slot "${slotName}" in slotContainers. Total slots: ${this.slotContainers.size}`);

      // Automatically add slot icon menu if UI is enabled
      if (this.uiConfig.showIconMenu) {
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
        // console.log(`LayoutRenderer: Loading ${savedWidgets.length} saved widgets for slot "${slotName}"`);
        savedWidgets.forEach((widgetInstance, index) => {
          try {
            this.addWidgetToSlot(slotName, widgetInstance, true); // isLoading = true
          } catch (error) {
            console.error(`LayoutRenderer: Error rendering saved widget ${index} in slot ${slotName}`, error);
            const errorElement = this.createErrorWidgetElement(`Saved widget ${index + 1}: ${error.message}`);
            element.appendChild(errorElement);
          }
        });
        // } else if (node.slot.defaultWidgets && Array.isArray(node.slot.defaultWidgets) && node.slot.defaultWidgets.length > 0) {
        //   // Check if we should convert default widgets to real widget instances
        //   if (!this.pageHasBeenSaved && !this.defaultWidgetsProcessed) {
        //     // Convert default widgets to actual widget instances for new/unsaved pages
        //     // console.log(`LayoutRenderer: Converting ${node.slot.defaultWidgets.length} default widgets to instances for slot "${slotName}"`);
        //     this.convertDefaultWidgetsToInstances(slotName, node.slot.defaultWidgets);
        //   } else {
        //     // For saved pages without saved widgets, render default widgets as placeholders (legacy behavior)
        //     // console.log(`LayoutRenderer: Rendering ${node.slot.defaultWidgets.length} default widgets as placeholders for slot "${slotName}"`);
        //     node.slot.defaultWidgets.forEach((defaultWidget, index) => {
        //       try {
        //         const widgetElement = this.renderWidget(defaultWidget);
        //         if (widgetElement) {
        //           element.appendChild(widgetElement);
        //         }
        //       } catch (error) {
        //         console.error(`LayoutRenderer: Error rendering default widget ${index} in slot ${slotName}`, error);
        //         const errorElement = this.createErrorWidgetElement(`Default widget ${index + 1}: ${error.message}`);
        //         element.appendChild(errorElement);
        //       }
        //     });
        //   }
      } else {
        // Show placeholder for empty slot
        // console.log(`LayoutRenderer: No saved or default widgets for slot "${slotName}" - showing placeholder`);
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

  // ========================================
  // Version Management Methods
  // ========================================

  /**
   * Initialize version management for a page
   * @param {number} pageId - Page ID
   * @param {Object} initialVersion - Initial version data
   */
  initializeVersionManagement(pageId, initialVersion = null) {
    this.pageId = pageId;
    this.currentVersion = initialVersion;
    this.pageVersions = [];

    // Load available versions for this page
    this.loadPageVersions();
  }

  /**
   * Load all versions for the current page
   */
  async loadPageVersions() {
    if (!this.pageId) {
      console.warn('LayoutRenderer: No page ID set for version loading');
      return;
    }

    try {
      // Import the versions API client
      const { getPageVersionsList } = await import('../api/versions.js');
      const versionsData = await getPageVersionsList(this.pageId);

      this.pageVersions = versionsData.versions || [];

      // If no current version is set, use the current published version
      if (!this.currentVersion && versionsData.current_version) {
        const currentVersionData = this.pageVersions.find(v => v.id === versionsData.current_version);
        if (currentVersionData) {
          this.currentVersion = currentVersionData;
        }
      }

      // Update version selector if it exists
      this.updateVersionSelector();

    } catch (error) {
      console.error('LayoutRenderer: Error loading page versions', error);
    }
  }

  /**
   * Add version selector UI to the layout container
   * @param {HTMLElement} container - Container element to add version selector to
   */
  addVersionSelector(container) {
    if (!container || this.versionSelectorElement) {
      return; // Already exists or invalid container
    }

    // Create version selector container
    const selectorContainer = document.createElement('div');
    selectorContainer.className = 'version-selector-container fixed top-4 left-4 z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-3 max-w-sm';

    // Create version indicator
    const versionIndicator = document.createElement('div');
    versionIndicator.className = 'version-indicator mb-2';
    selectorContainer.appendChild(versionIndicator);

    // Create version dropdown
    const versionSelect = document.createElement('select');
    versionSelect.className = 'version-select w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
    versionSelect.setAttribute('data-version-select', 'true');

    // Add change listener
    versionSelect.addEventListener('change', (e) => {
      const versionId = parseInt(e.target.value);
      this.switchToVersion(versionId);
    });

    selectorContainer.appendChild(versionSelect);

    // Create action buttons container
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'version-actions mt-2 flex gap-2';

    // Refresh button
    const refreshButton = this.createIconButton('↻', 'bg-gray-500 hover:bg-gray-600 text-white text-xs px-2 py-1', () => {
      this.loadPageVersions();
    });
    refreshButton.title = 'Refresh versions';
    actionsContainer.appendChild(refreshButton);

    selectorContainer.appendChild(actionsContainer);

    // Add to container
    container.appendChild(selectorContainer);
    this.versionSelectorElement = selectorContainer;

    // Initial population
    this.updateVersionSelector();
  }

  /**
   * Update the version selector UI with current data
   */
  updateVersionSelector() {
    if (!this.versionSelectorElement) {
      return;
    }

    const indicator = this.versionSelectorElement.querySelector('.version-indicator');
    const select = this.versionSelectorElement.querySelector('.version-select');

    if (!indicator || !select) {
      return;
    }

    // Update indicator
    if (this.currentVersion) {
      const statusClass = this.currentVersion.status === 'published' ? 'text-green-600' : 'text-orange-600';
      const statusIcon = this.currentVersion.status === 'published' ? '✓' : '⚠';
      indicator.innerHTML = `
        <div class="text-sm font-medium text-gray-700">
          <span class="${statusClass}">${statusIcon}</span>
          Version ${this.currentVersion.version_number}
          <span class="text-xs text-gray-500">(${this.currentVersion.status})</span>
        </div>
        <div class="text-xs text-gray-600">${this.escapeHtml(this.currentVersion.description || 'No description')}</div>
      `;
    } else {
      indicator.innerHTML = '<div class="text-sm text-gray-500">No version selected</div>';
    }

    // Update select options
    select.innerHTML = '';

    if (this.pageVersions.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Loading versions...';
      option.disabled = true;
      select.appendChild(option);
      return;
    }

    // Add "Latest saved" option (first version or current)
    const latestOption = document.createElement('option');
    latestOption.value = this.pageVersions[0]?.id || '';
    latestOption.textContent = '🚧 Latest saved';
    if (this.currentVersion && this.currentVersion.id === this.pageVersions[0]?.id) {
      latestOption.selected = true;
    }
    select.appendChild(latestOption);

    // Add published version option
    const publishedVersion = this.pageVersions.find(v => v.status === 'published' && v.is_current);
    if (publishedVersion) {
      const publishedOption = document.createElement('option');
      publishedOption.value = publishedVersion.id;
      publishedOption.textContent = '✓ Published version';
      if (this.currentVersion && this.currentVersion.id === publishedVersion.id) {
        publishedOption.selected = true;
      }
      select.appendChild(publishedOption);
    }

    // Add separator
    if (this.pageVersions.length > 2) {
      const separator = document.createElement('option');
      separator.value = '';
      separator.textContent = '─────────────────';
      separator.disabled = true;
      select.appendChild(separator);

      // Add other versions
      this.pageVersions.slice(publishedVersion ? 1 : 1).forEach(version => {
        if (publishedVersion && version.id === publishedVersion.id) {
          return; // Skip already added published version
        }

        const option = document.createElement('option');
        option.value = version.id;
        const statusIcon = version.status === 'published' ? '✓' : version.status === 'draft' ? '📝' : '📋';
        option.textContent = `${statusIcon} v${version.version_number} - ${version.description || 'No description'}`;

        if (this.currentVersion && this.currentVersion.id === version.id) {
          option.selected = true;
        }

        select.appendChild(option);
      });
    }
  }

  /**
   * Switch to a different version
   * @param {number} versionId - Version ID to switch to
   */
  async switchToVersion(versionId) {
    if (!versionId) {
      return;
    }

    try {
      // Import the versions API client
      const { getVersionWidgets } = await import('../api/versions.js');
      const versionData = await getVersionWidgets(versionId);

      // Update current version
      this.currentVersion = versionData;

      // Load the widget data for this version
      this.loadWidgetData(versionData.widgets || {});

      // Update the version selector
      this.updateVersionSelector();

      // Trigger version change callback if set
      const callback = this.versionCallbacks.get('version-changed');
      if (callback && typeof callback === 'function') {
        callback(versionData);
      }

      // console.log('LayoutRenderer: Switched to version', versionData.version_number);

    } catch (error) {
      console.error('LayoutRenderer: Error switching to version', error);

      // Show error notification if possible
      const errorCallback = this.versionCallbacks.get('version-error');
      if (errorCallback && typeof errorCallback === 'function') {
        errorCallback(`Failed to load version: ${error.message}`);
      }
    }
  }

  /**
   * Remove version selector UI
   */
  removeVersionSelector() {
    if (this.versionSelectorElement) {
      this.versionSelectorElement.remove();
      this.versionSelectorElement = null;
    }
  }

  /**
   * Set version-related callbacks
   * @param {string} event - Event name ('version-changed', 'version-error')
   * @param {Function} callback - Callback function
   */
  setVersionCallback(event, callback) {
    if (typeof callback === 'function') {
      this.versionCallbacks.set(event, callback);
    }
  }

  /**
   * Get current version information
   * @returns {Object|null} Current version data
   */
  getCurrentVersion() {
    return this.currentVersion;
  }

  /**
   * Get available versions
   * @returns {Array} Array of version objects
   */
  getAvailableVersions() {
    return this.pageVersions;
  }

  /**
   * Set widget data change callbacks
   * @param {Object} callbacks - Map of callback functions
   */
  setWidgetDataCallbacks(callbacks = {}) {
    this.widgetDataCallbacks = new Map(Object.entries(callbacks));
  }

  /**
   * Standardized error handling method
   * @param {string} errorType - Type of error (use ERROR_TYPES constants)
   * @param {string} context - Context where error occurred
   * @param {Error} error - The actual error object
   * @param {any} additionalData - Additional data for debugging
   */
  handleError(errorType, context, error, additionalData = null) {
    const errorMessage = `LayoutRenderer [${errorType}]: ${context}`;
    console.error(errorMessage, error);

    if (additionalData) {
      console.debug('Additional error context:', additionalData);
    }

    // Could be extended to send errors to monitoring service
    // this.reportToMonitoring?.(errorType, context, error, additionalData);
  }

  /**
   * Execute widget data callback
   * @param {string} action - Action type (use WIDGET_ACTIONS constants)
   * @param {string} slotName - Name of the slot
   * @param {Object} widgetData - Widget data (for add/update) or widget ID (for remove)
   * @param {...any} args - Additional arguments
   */
  executeWidgetDataCallback(action, slotName, widgetData, ...args) {
    const callback = this.widgetDataCallbacks.get('widgetDataChanged');
    if (typeof callback === 'function') {
      try {
        // console.log(`🔄 WIDGET DATA: Executing callback for action=${action}, slot=${slotName}`);
        callback(action, slotName, widgetData, ...args);
      } catch (error) {
        this.handleError(ERROR_TYPES.CALLBACK_EXECUTION_ERROR,
          `widget data callback for action=${action}, slot=${slotName}`,
          error,
          { action, slotName, widgetData });
      }
    } else {
      console.warn(`🔄 WIDGET DATA: No widgetDataChanged callback registered`);
    }
  }
}

export default LayoutRenderer;