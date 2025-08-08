/**
 * LayoutRenderer.js
 * Renders layout JSON as DOM elements with widget support and UI enhancements
 */

// Constants for widget actions to eliminate magic strings
import { WIDGET_ACTIONS } from '../utils/widgetConstants';
import DjangoTemplateRenderer from '../utils/DjangoTemplateRenderer.js';

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
  constructor(options = {}) {
    this.slotContainers = new Map(); // Map of slot names to DOM elements
    this.slotConfigs = new Map(); // Map of slot names to their configurations
    this.widgetRenderer = null; // Will be set externally for widget rendering
    this.eventListeners = new Map(); // Track event listeners for cleanup
    this.isDestroyed = false; // Track destruction state

    // Extract editable option (defaults to true for backward compatibility)
    const { editable = true } = options;
    this.editable = editable;

    // UI Enhancement properties
    this.slotUIElements = new Map(); // Map of slot names to UI overlay elements
    this.uiConfig = { // UI configuration based on editable mode
      showIconMenu: editable,  // Only show icon menus in editable mode
      showAddWidget: editable, // Only show add widget in editable mode
      showEditSlot: false,      // Disabled - removed from menu
      showSlotVisibility: false, // Disabled - removed from menu
      enableDragDrop: editable, // Only enable drag/drop in editable mode
      enableContextMenu: editable // Only enable context menu in editable mode
    };
    this.uiCallbacks = new Map(); // Map of UI event callbacks
    this.dragState = { isDragging: false, draggedElement: null, sourceSlot: null };
    this.customWidgets = null; // Custom widget definitions (if any)
    this.cachedApiWidgets = null; // Cached widgets from API
    this.widgetTypesPromise = null; // Promise for ongoing API request
    this.debug = this.isDevelopmentMode(); // Initialize debug mode

    // Template JSON caching for performance
    this.templateCache = new Map(); // Cache for processed templates
    this.templatePreprocessCache = new Map(); // Cache for preprocessed template structures
    this.cacheMetrics = { hits: 0, misses: 0, evictions: 0 }; // Performance metrics
    this.cacheLocks = new Map(); // Prevent race conditions in cache operations
    this.injectedStyles = new Set(); // Track injected styles for cleanup
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

    // Initialize Django Template Renderer for template processing
    this.templateRenderer = new DjangoTemplateRenderer();
    this.templateRenderer.setDebugMode(this.isDevelopmentMode());
  }

  /**
   * Fetch widget types from the API
   * @returns {Promise<Array>} Promise resolving to array of widget definitions
   */
  async fetchWidgetTypes() {
    // Return existing promise if already fetching
    if (this.widgetTypesPromise) {
      return this.widgetTypesPromise;
    }

    // Return cached widgets if available and not expired
    if (this.cachedApiWidgets && Array.isArray(this.cachedApiWidgets)) {
      return this.cachedApiWidgets;
    }

    try {
      // Import widgetsApi at the top of the file or load it dynamically
      const { widgetsApi } = await import('../api');

      this.widgetTypesPromise = widgetsApi.getTypes(true) // includeTemplateJson = true
        .then(apiWidgets => {
          // Transform API response to widget card format
          const transformedWidgets = this.transformApiWidgetsToCardFormat(apiWidgets);

          // Cache the transformed widgets
          this.cachedApiWidgets = transformedWidgets;

          // Preload widget templates in the background for performance
          setTimeout(() => {
            this.preloadWidgetTemplates(transformedWidgets);
          }, 100);

          return transformedWidgets;
        })
        .catch(error => {
          console.error('LayoutRenderer: Error fetching widget types from API:', error);
          // Don't cache anything on error, just return empty array
          console.warn('LayoutRenderer: API error - no widgets available until API is restored');
          return [];
        })
        .finally(() => {
          // Clear the promise so future calls can make new requests
          this.widgetTypesPromise = null;
        });

      return await this.widgetTypesPromise;
    } catch (error) {
      console.error('LayoutRenderer: Unexpected error in fetchWidgetTypes:', error);
      this.widgetTypesPromise = null;
      console.warn('LayoutRenderer: Unexpected error - no widgets available until API is restored');
      return [];
    }
  }

  /**
   * Transform API widget response to widget card format
   * @param {Array} apiWidgets - Widget types from API
   * @returns {Array} Transformed widget definitions
   */
  transformApiWidgetsToCardFormat(apiWidgets) {
    if (!Array.isArray(apiWidgets)) {
      console.warn('LayoutRenderer: API response is not an array - invalid API response format');
      return [];
    }

    return apiWidgets
      .filter(apiWidget => apiWidget.is_active !== false) // Only include active widgets
      .map(apiWidget => {
        try {
          // Extract default config from configuration schema
          const defaultConfig = this.extractDefaultConfigFromSchema(apiWidget.configuration_schema);

          // Generate appropriate icon and category based on widget class and name
          const iconAndCategory = this.generateIconAndCategory(apiWidget);

          return {
            type: apiWidget.type, // Use unique type id from API
            name: apiWidget.name,
            description: apiWidget.description || 'No description available',
            icon: iconAndCategory.icon,
            category: iconAndCategory.category,
            config: defaultConfig,
            // Store original API data for potential use in widget creation
            _apiData: {
              widget_class: apiWidget.widget_class,
              configuration_schema: apiWidget.configuration_schema,
              template_json: apiWidget.template_json
            }
          };
        } catch (error) {
          console.error(`LayoutRenderer: Error transforming widget "${apiWidget.name}":`, error);
          // Return a placeholder widget for failed transformations
          return {
            type: 'unknown',
            name: apiWidget.name || 'Unknown Widget',
            description: 'Widget configuration error',
            icon: '⚠️',
            category: 'other',
            config: {},
            _error: error.message
          };
        }
      });
  }

  /**
   * Extract default configuration from JSON schema
   * @param {Object} schema - JSON schema for widget configuration
   * @returns {Object} Default configuration object
   */
  extractDefaultConfigFromSchema(schema) {
    const config = {};

    if (!schema || typeof schema !== 'object' || !schema.properties) {
      return config;
    }

    Object.entries(schema.properties).forEach(([key, fieldSchema]) => {
      if (fieldSchema.default !== undefined) {
        config[key] = fieldSchema.default;
      } else if (fieldSchema.type === 'string') {
        config[key] = '';
      } else if (fieldSchema.type === 'boolean') {
        config[key] = false;
      } else if (fieldSchema.type === 'integer' || fieldSchema.type === 'number') {
        config[key] = fieldSchema.minimum || 0;
      } else if (fieldSchema.type === 'array') {
        config[key] = [];
      } else if (fieldSchema.type === 'object') {
        config[key] = {};
      }
    });

    return config;
  }

  /**
   * Generate appropriate icon and category for a widget
   * @param {Object} apiWidget - Widget data from API
   * @returns {Object} Object with icon and category properties
   */
  generateIconAndCategory(apiWidget) {
    const name = (apiWidget.name || '').toLowerCase();
    const className = (apiWidget.widget_class || '').toLowerCase();

    // Define icon and category mappings
    const mappings = [
      { keywords: ['text', 'paragraph', 'content'], icon: 'T', category: 'content' },
      { keywords: ['button', 'link', 'cta'], icon: '◯', category: 'interactive' },
      { keywords: ['image', 'picture', 'photo'], icon: '🖼', category: 'media' },
      { keywords: ['video', 'media'], icon: '🎥', category: 'media' },
      { keywords: ['card', 'tile'], icon: '📄', category: 'layout' },
      { keywords: ['list', 'menu'], icon: '≡', category: 'content' },
      { keywords: ['table', 'grid'], icon: '⋮⋯', category: 'layout' },
      { keywords: ['form', 'input'], icon: '📝', category: 'interactive' },
      { keywords: ['calendar', 'date'], icon: '📅', category: 'interactive' },
      { keywords: ['map', 'location'], icon: '🗺', category: 'media' },
      { keywords: ['chart', 'graph'], icon: '📊', category: 'data' },
      { keywords: ['separator', 'divider'], icon: '─', category: 'layout' },
      { keywords: ['hero', 'banner'], icon: '🏆', category: 'layout' },
      { keywords: ['testimonial', 'quote'], icon: '💬', category: 'content' },
      { keywords: ['gallery', 'slideshow'], icon: '🖼', category: 'media' }
    ];

    // Find matching mapping
    for (const mapping of mappings) {
      if (mapping.keywords.some(keyword =>
        name.includes(keyword) || className.includes(keyword))) {
        return { icon: mapping.icon, category: mapping.category };
      }
    }

    // Default fallback
    return { icon: '🧩', category: 'other' };
  }

  /**
   * Convert widget class name to type identifier
   * @param {string} widgetClass - Python widget class name
   * @returns {string} Type identifier for internal use
   */
  getWidgetTypeFromClass(widgetClass) {
    if (!widgetClass) return 'unknown';

    // Convert PascalCase class name to lowercase type
    // e.g., "TextWidget" -> "text", "ButtonWidget" -> "button"
    return widgetClass
      .replace(/Widget$/, '') // Remove "Widget" suffix
      .replace(/([A-Z])/g, (match, letter) => letter.toLowerCase())
      .replace(/^([a-z])/, (match, letter) => letter.toLowerCase());
  }

  /**
   * Validate layout JSON structure
   * @param {Object} layout - JSON layout structure to validate
   * @returns {boolean} True if valid, false otherwise
   */
  validateLayout(layout) {
    try {
      if (!layout || typeof layout !== 'object') {
        if (this.debug) {
          console.warn('LayoutRenderer: Layout is not an object', { layout, type: typeof layout });
        }
        return false;
      }

      const structure = layout.structure || layout;
      const isValid = this.validateNode(structure);

      if (!isValid && this.debug) {
        console.warn('LayoutRenderer: Layout validation failed', {
          layout,
          structure,
          layoutKeys: Object.keys(layout),
          structureType: typeof structure,
          hasStructure: 'structure' in layout
        });
      }

      return isValid;
    } catch (error) {
      console.error('LayoutRenderer: Layout validation error', error);
      if (this.debug) {
        console.error('LayoutRenderer: Layout that caused error:', layout);
      }
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
      if (this.debug) {
        console.warn('LayoutRenderer: Invalid node - not an object', node);
      }
      return false;
    }

    const validTypes = ['element', 'slot', 'text'];
    if (!validTypes.includes(node.type)) {
      if (this.debug) {
        console.warn('LayoutRenderer: Invalid node type', {
          type: node.type,
          validTypes,
          node: node
        });
      }
      return false;
    }

    // Validate children if present
    if (node.children !== undefined) {
      if (!Array.isArray(node.children)) {
        if (this.debug) {
          console.warn('LayoutRenderer: Children must be an array', {
            children: node.children,
            type: typeof node.children
          });
        }
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

      // Handle both sync and async results
      if (rootElement && typeof rootElement.then === 'function') {
        // It's a Promise (contains slots)
        rootElement.then(resolvedElement => {
          if (resolvedElement && targetRef.current) {
            targetRef.current.appendChild(resolvedElement);
          }
        }).catch(error => {
          console.error('LayoutRenderer: Error rendering async root element', error);
          this.renderError(targetRef.current, error.message);
        });
      } else if (rootElement) {
        // It's a regular DOM element
        targetRef.current.appendChild(rootElement);
      }

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

      // Preload widget types in the background for faster widget selection
      this.preloadWidgetTypes();

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
          <div class="text-red-600 text-sm mt-1">${this.templateRenderer.escapeHtml(message)}</div>
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
  async updateSlot(slotName, widgets = []) {
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
        for (let index = 0; index < widgets.length; index++) {
          const widget = widgets[index];
          try {
            // Use renderWidgetInstance for full widget instances with controls
            widget.slotName = slotName;
            const widgetElement = await this.renderWidgetInstance(widget);
            if (widgetElement) {
              container.appendChild(widgetElement);
            }
          } catch (error) {
            console.error(`LayoutRenderer: Error rendering widget ${index} in slot ${slotName}`, error);
            const errorElement = this.createErrorWidgetElement(`Widget ${index + 1}: ${error.message}`);
            container.appendChild(errorElement);
          }
        }
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
        //       <span class="text-sm">${this.templateRenderer.escapeHtml(`Empty slot: ${slotName}`)}</span>
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

    // Add hover effect to make slots more discoverable (only in editable mode)
    if (this.editable) {
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

    // Check if icon is provided and is a string
    if (icon && typeof icon === 'string') {
      if (icon.startsWith('svg:')) {
        button.innerHTML = this.createSVGIcon(icon.replace('svg:', ''));
      } else {
        button.innerHTML = `<span style="font-family: Arial, sans-serif; font-weight: bold;">${icon}</span>`;
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

      // Close all other slot menus
      document.querySelectorAll('.slot-menu-dropdown').forEach(menu => {
        menu.classList.add('hidden');
      });
      // Close all widget menus too
      document.querySelectorAll('.widget-menu-dropdown').forEach(menu => {
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
    // TODO: Implement widget editing functionality
    // This could:
    // 1. Open a modal with widget-specific edit form
    // 2. Switch to inline editing mode
    // 3. Use the widget data callback system to update pageData.widgets
    alert(`Edit functionality for ${widgetInstance.name} widget is coming soon!`);
  }

  /**
   * Edit widget instance using configuration_schema
   * @param {string} widgetId - ID of the widget to edit
   * @param {Object} widgetInstance - Widget instance to edit
   */
  async editWidget(widgetId, widgetInstance) {
    // Remove any existing edit modal
    const existingModal = document.querySelector('.widget-edit-modal');
    if (existingModal) existingModal.remove();

    // Look up widget definition by type
    const availableWidgets = await this.getAvailableWidgets();
    const widgetDef = availableWidgets.find(w => w.type === widgetInstance.type);

    // Prefer schema from widgetDef, fallback to instance _apiData
    const schema = widgetDef?._apiData?.configuration_schema || widgetInstance._apiData?.configuration_schema || {};
    const config = widgetInstance.config || {};

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'widget-edit-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-90vh overflow-y-auto';

    // Modal header
    modal.innerHTML = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">Edit ${this.templateRenderer.escapeHtml(widgetInstance.name)}</h3>
          <button class="widget-edit-close text-gray-400 hover:text-gray-600 transition-colors"><span class="text-xl">×</span></button>
        </div>
        <form class="widget-edit-form space-y-4"></form>
        <div class="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
          <button type="button" class="widget-edit-cancel px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">Cancel</button>
          <button type="submit" class="widget-edit-save px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">Save</button>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Generate form fields from schema
    const form = modal.querySelector('.widget-edit-form');
    this.generateFormFieldsFromSchema(form, schema, config);

    // Close modal handler
    const closeModal = () => overlay.remove();
    modal.querySelector('.widget-edit-close').addEventListener('click', closeModal);
    modal.querySelector('.widget-edit-cancel').addEventListener('click', closeModal);

    // Save handler
    modal.querySelector('.widget-edit-save').addEventListener('click', (e) => {
      e.preventDefault();
      const newConfig = this.getFormConfigFromSchema(form, schema, config);
      // Update widget config and re-render
      widgetInstance.config = newConfig;
      // Ensure type is preserved
      if (!widgetInstance.type && widgetDef?.type) {
        widgetInstance.type = widgetDef.type;
      }
      this.executeWidgetDataCallback(WIDGET_ACTIONS.EDIT, widgetInstance.slotName, widgetInstance);
      //this.markWidgetAsEdited(widgetId, widgetInstance);
      this.updateSlot(widgetInstance.slotName, this.getSlotWidgetData(widgetInstance.slotName));
      closeModal();
    });
  }

  /**
   * Generate form fields from JSON schema (vanilla JS)
   * @param {HTMLElement} form - Form element to append fields to
   * @param {Object} schema - JSON schema
   * @param {Object} config - Current config values
   */
  generateFormFieldsFromSchema(form, schema, config) {
    if (!schema || !schema.properties) return;
    Object.entries(schema.properties).forEach(([key, field]) => {
      const value = config[key] !== undefined ? config[key] : field.default || '';
      const label = document.createElement('label');
      label.className = 'block text-sm font-medium text-gray-700';
      label.textContent = field.title || key;
      label.htmlFor = `widget-edit-${key}`;
      form.appendChild(label);
      let input;
      if (field.enum) {
        input = document.createElement('select');
        input.className = 'block w-full border border-gray-300 rounded-md px-3 py-2';
        input.id = `widget-edit-${key}`;
        input.name = key;
        field.enum.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          if (opt === value) option.selected = true;
          input.appendChild(option);
        });
      } else if (field.type === 'boolean') {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'ml-2';
        input.id = `widget-edit-${key}`;
        input.name = key;
        input.checked = !!value;
      } else if (field.type === 'integer' || field.type === 'number') {
        input = document.createElement('input');
        input.type = 'number';
        input.className = 'block w-full border border-gray-300 rounded-md px-3 py-2';
        input.id = `widget-edit-${key}`;
        input.name = key;
        input.value = value;
      } else if (field.format === 'textarea' || field.format === 'richtext') {
        input = document.createElement('textarea');
        input.className = 'block w-full border border-gray-300 rounded-md px-3 py-2';
        input.id = `widget-edit-${key}`;
        input.name = key;
        input.value = value;
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.className = 'block w-full border border-gray-300 rounded-md px-3 py-2';
        input.id = `widget-edit-${key}`;
        input.name = key;
        input.value = value;
      }
      form.appendChild(input);
    });
    // Debug: log config used for form
  }

  /**
   * Read config values from form fields based on schema
   * @param {HTMLElement} form - Form element
   * @param {Object} schema - JSON schema
   * @param {Object} oldConfig - Previous config (for fallback)
   * @returns {Object} New config
   */
  getFormConfigFromSchema(form, schema, oldConfig) {
    const config = { ...oldConfig };
    if (!schema || !schema.properties) return config;
    Object.entries(schema.properties).forEach(([key, field]) => {
      const input = form.querySelector(`[name="${key}"]`);
      if (!input) return;
      if (field.enum) {
        config[key] = input.value;
      } else if (field.type === 'boolean') {
        config[key] = input.checked;
      } else if (field.type === 'integer' || field.type === 'number') {
        config[key] = input.value === '' ? null : Number(input.value);
      } else if (field.format === 'textarea' || field.format === 'richtext') {
        config[key] = input.value;
      } else {
        config[key] = input.value;
      }
    });
    return config;
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
  async showWidgetSelectionModal(slotName, options = {}) {
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

    const slotConfig = this.getSlotConfig(slotName);

    // Initially show loading state
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
        
        <div class="flex items-center justify-center py-12">
          <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="mt-2 text-sm text-gray-600">Loading widgets...</p>
          </div>
        </div>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Set up basic modal event handlers for close button
    const closeButton = overlay.querySelector('.widget-modal-close');
    const closeModal = () => {
      overlay.remove();
      this.slotUIElements.delete('widget-selection-modal');
    };
    closeButton.addEventListener('click', closeModal);

    // Track for cleanup
    this.slotUIElements.set('widget-selection-modal', overlay);

    try {
      // Fetch available widgets from API
      const availableWidgets = await this.fetchWidgetTypes();

      // Update modal content with widgets
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

      // Set up complete modal event handlers with widgets loaded
      this.setupWidgetModalHandlers(overlay, slotName);

    } catch (error) {
      console.error('LayoutRenderer: Error loading widgets for modal:', error);

      // Show error state
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
          
          <div class="flex items-center justify-center py-12">
            <div class="text-center">
              <div class="text-red-500 text-4xl mb-2">⚠️</div>
              <p class="text-sm text-gray-600">Error loading widgets</p>
              <p class="text-xs text-gray-500 mt-1">${error.message}</p>
              <button class="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors widget-retry">
                Retry
              </button>
            </div>
          </div>
        </div>
      `;

      // Set up retry functionality
      const retryButton = overlay.querySelector('.widget-retry');
      if (retryButton) {
        retryButton.addEventListener('click', () => {
          overlay.remove();
          this.slotUIElements.delete('widget-selection-modal');
          this.showWidgetSelectionModal(slotName, options);
        });
      }

      // Re-setup close button after content update
      const newCloseButton = overlay.querySelector('.widget-modal-close');
      if (newCloseButton) {
        newCloseButton.addEventListener('click', closeModal);
      }
    }
  }

  /**
   * Set custom widget definitions
   * @param {Array} widgets - Array of widget definitions
   */
  setAvailableWidgets(widgets) {
    this.customWidgets = widgets;
  }

  /**
   * Preload widget types from API in the background
   * This helps ensure widget selection modal loads quickly
   */
  preloadWidgetTypes() {
    // Don't preload if we already have cached widgets or custom widgets
    if (this.cachedApiWidgets || this.customWidgets || this.widgetTypesPromise) {
      return;
    }

    // Start fetching in background without waiting
    this.fetchWidgetTypes().catch(() => { });
  }

  /**
   * Mark the page/layout as saved
   * This prevents default widgets from being auto-created on subsequent renders
   */
  markPageAsSaved() {
    this.pageHasBeenSaved = true;
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
    // Store widget data internally
    this.savedWidgetData.clear();
    Object.entries(widgetData).forEach(([slotName, widgets]) => {
      this.savedWidgetData.set(slotName, [...widgets]); // Deep copy
    });

    // Mark page as saved
    this.markPageAsSaved();

  }

  /**
 * Save current widget state from all rendered slots
 * @returns {Object} The collected and saved widget data
 * @deprecated This method is kept for backward compatibility but should use pageData.widgets as single source of truth
 */
  saveCurrentWidgetState() {
    // For backward compatibility, still collect from DOM if needed
    // But the new approach should use pageData.widgets directly
    const widgetData = this.collectAllWidgetData();
    this.saveWidgetData(widgetData);

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

    }
  }

  /**
   * Configure auto-save settings
   * @param {Object} config - Auto-save configuration
   */
  setAutoSaveConfig(config = {}) {
    this.autoSaveEnabled = config.enabled !== false;
    this.autoSaveDelay = config.delay || 2000;
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

      // Execute callback for dirty state change
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

        try {
          const widgetData = this.saveCurrentWidgetState();

          // Execute callback for auto-save
          this.executeCallback('onAutoSave', widgetData);

        } catch (error) {
          console.error('LayoutRenderer: Auto-save failed', error);
          this.executeCallback('onAutoSaveError', error);
        }
      }
      this.autoSaveTimeoutId = null;
    }, this.autoSaveDelay);

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
 * Get available widgets for selection (async version)
 * @returns {Promise<Array>} Promise resolving to array of widget definitions
 */
  async getAvailableWidgets() {
    // Return custom widgets if set
    if (this.customWidgets && Array.isArray(this.customWidgets)) {
      return this.customWidgets;
    }

    // If we have cached API widgets, return them immediately
    if (this.cachedApiWidgets && Array.isArray(this.cachedApiWidgets)) {
      return this.cachedApiWidgets;
    }

    // If no cached widgets, fetch them from API
    try {
      const widgets = await this.fetchWidgetTypes();
      return widgets;
    } catch (error) {
      console.error('LayoutRenderer: Error fetching widgets in getAvailableWidgets:', error);
      this.handleNoWidgetsAvailable();
      return [];
    }
  }

  /**
   * Synchronous version for backward compatibility (deprecated)
   * @returns {Array} Array of widget definitions or empty array if not loaded
   * @deprecated Use getAvailableWidgets() async version instead
   */
  getAvailableWidgetsSync() {
    // Return custom widgets if set
    if (this.customWidgets && Array.isArray(this.customWidgets)) {
      return this.customWidgets;
    }

    // Return cached API widgets if available
    if (this.cachedApiWidgets && Array.isArray(this.cachedApiWidgets)) {
      return this.cachedApiWidgets;
    }

    // No widgets available yet
    console.warn('LayoutRenderer: No widgets loaded yet - use async getAvailableWidgets() instead');
    return [];
  }

  /**
   * Handle case when no widgets are available from backend
   */
  handleNoWidgetsAvailable() {
    try {
      // Emit a custom event that React components can listen to
      const event = new CustomEvent('layoutRenderer:noWidgets', {
        detail: {
          message: 'No widgets available from backend API',
          timestamp: new Date().toISOString(),
          renderer: this
        }
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(event);
      }
    } catch (error) {
      console.error('LayoutRenderer: Error dispatching no widgets event', error);
    }
  }

  /**
   * Force refresh widgets from API (useful for debugging)
   */
  async forceRefreshWidgets() {
    this.cachedApiWidgets = null;
    this.widgetTypesPromise = null;
    return await this.fetchWidgetTypes();
  }

  /**
   * Get default fallback widgets
   * @returns {Array} Array of default widget definitions
   */


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
            ${this.templateRenderer.escapeHtml(widget.icon)}
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-semibold text-gray-900 mb-1">${this.templateRenderer.escapeHtml(widget.name)}</h4>
            <p class="text-xs text-gray-600 leading-relaxed">${this.templateRenderer.escapeHtml(widget.description)}</p>
            <div class="mt-2">
              <span class="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                ${this.templateRenderer.escapeHtml(widget.category)}
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
      // Find widget definition using sync version for immediate response
      const availableWidgets = this.getAvailableWidgetsSync();
      const widgetDef = availableWidgets.find(w => w.type === widgetType);

      if (!widgetDef) {
        throw new Error(`Widget type "${widgetType}" not found`);
      }

      // Create widget instance with default config, unique type id, and slotName
      const widgetInstance = {
        id: this.generateWidgetId(),
        type: widgetDef.type, // Always use the unique type id
        name: widgetDef.name,
        config: { ...widgetDef.config },
        slotName // <-- always set slotName
      };

      // NEW: Notify parent component to update pageData.widgets instead of directly adding to slot
      this.executeWidgetDataCallback(WIDGET_ACTIONS.ADD, slotName, widgetInstance);

      // Close modal
      closeModal();

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
  async addWidgetToSlot(slotName, widgetInstance, isLoading = false) {
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
    widgetInstance.slotName = slotName;
    const widgetElement = await this.renderWidgetInstance(widgetInstance);
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
  async renderWidgetInstance(widgetInstance) {
    const { id, type, name, config } = widgetInstance;

    // Create main widget container
    const widget = this.createWidgetContainer(id, type);

    // Add widget header with name and controls (only in editable mode)
    if (this.editable) {
      const header = this.createWidgetHeader(id, name, widgetInstance);
      widget.appendChild(header);
    }

    // Add widget content - pass full widgetInstance for template_json access
    const content = await this.renderWidgetContent(type, config, widgetInstance);
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
      // Use React confirmation dialog instead of browser confirm
      if (this.showConfirmDialog) {
        this.showConfirmDialog(
          `Remove ${name} widget?`,
          'This action cannot be undone.',
          () => this.removeWidgetFromSlot(id)
        );
      } else {
        // Fallback to direct removal if no confirmation dialog is available
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
   * @param {Object} widgetInstance - Full widget instance (optional, for template_json access)
   * @returns {HTMLElement} Widget content element
   */
  async renderWidgetContent(type, config, widgetInstance = null) {
    try {
      // Check if widget has template_json available for rendering
      // Look up widget definition by type
      const availableWidgets = await this.getAvailableWidgets();
      const widgetDef = availableWidgets.find(w => w.type === widgetInstance.type);

      if (widgetInstance &&
        widgetDef?._apiData &&
        widgetDef?._apiData?.template_json) {

        try {
          // Use template_json rendering with caching
          return this.renderFromTemplateJsonCached(
            widgetDef._apiData.template_json,
            config,
            type,
            widgetInstance.id // Pass widget ID for CSS scoping
          );
        } catch (templateError) {
          console.error(`LayoutRenderer: template_json rendering failed for "${type}", falling back to legacy`, templateError);
          // Fall through to legacy rendering
        }
      }

      // Legacy rendering fallback or for widgets without template_json
      return this.renderWidgetContentLegacy(type, config);

    } catch (error) {
      console.error('LayoutRenderer: Error in renderWidgetContent', error);
      return this.createErrorWidgetElement(`Widget render error: ${error.message}`);
    }
  }

  /**
   * Legacy widget content rendering (existing switch statement logic)
   * @param {string} type - Widget type
   * @param {Object} config - Widget configuration
   * @returns {HTMLElement} Widget content element
   */
  renderWidgetContentLegacy(type, config) {
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
    element.textContent = config.content || 'Enter your text here...';
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
      <div class="text-sm font-medium text-gray-700">${this.templateRenderer.escapeHtml(type)} Widget</div>
      <div class="text-xs text-gray-500 mt-1">Custom widget type</div>
    `;
    return element;
  }

  /**
 * Remove a widget from its slot
 * @param {string} widgetId - ID of the widget to remove
 */
  removeWidgetFromSlot(widgetId) {
    const widgetElement = document.querySelector(`.rendered-widget[data-widget-id="${widgetId}"]`);

    if (widgetElement) {
      const slotElement = widgetElement.closest('[data-slot-name]');

      const slotName = slotElement?.getAttribute('data-slot-name');
      const widgetType = widgetElement.getAttribute('data-widget-type');
      const widgetName = widgetElement.querySelector('.widget-header span')?.textContent || 'Unknown Widget';


      // NEW: Notify parent component to update pageData.widgets instead of directly removing from DOM
      this.executeWidgetDataCallback(WIDGET_ACTIONS.REMOVE, slotName, widgetId);

    } else {
      console.warn('LayoutRenderer: No widget element found for widgetId:', widgetId);
    }
  }

  /**
   * Convert default widgets to actual widget instances for new/unsaved pages
   * @param {string} slotName - Name of the slot
   * @param {Array} defaultWidgets - Array of default widget definitions
   */
  async convertDefaultWidgetsToInstances(slotName, defaultWidgets) {
    try {
      const availableWidgets = await this.getAvailableWidgets();

      for (let index = 0; index < defaultWidgets.length; index++) {
        const defaultWidget = defaultWidgets[index];
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
            await this.addWidgetToSlot(slotName, widgetInstance);

          } else {
            // Widget type not found, create a placeholder widget
            const placeholderInstance = {
              id: this.generateWidgetId(),
              type: defaultWidget.type,
              name: defaultWidget.name || `${defaultWidget.type} Widget`,
              config: defaultWidget.config || {}
            };

            await this.addWidgetToSlot(slotName, placeholderInstance);
            console.warn(`LayoutRenderer: Created placeholder for unknown widget type "${defaultWidget.type}" in slot "${slotName}"`);
          }

        } catch (error) {
          console.error(`LayoutRenderer: Error converting default widget ${index} in slot ${slotName}`, error);
        }
      }

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
   * @returns {Node|Promise<Node>} DOM node (slots return Promise)
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
          return this.renderSlotElement(node); // This returns a Promise now
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
        for (const child of node.children) {
          try {
            const childElement = this.renderNode(child);
            // Handle both sync and async results
            if (childElement && typeof childElement.then === 'function') {
              // It's a Promise (slot element)
              childElement.then(resolvedElement => {
                if (resolvedElement) {
                  element.appendChild(resolvedElement);
                }
              }).catch(error => {
                console.error('LayoutRenderer: Error rendering async child node', error);
                const errorElement = this.createErrorElement(`Async child render error: ${error.message}`);
                element.appendChild(errorElement);
              });
            } else if (childElement) {
              // It's a regular DOM element
              element.appendChild(childElement);
            }
          } catch (error) {
            console.error('LayoutRenderer: Error rendering child node', error);
            const errorElement = this.createErrorElement(`Child render error: ${error.message}`);
            element.appendChild(errorElement);
          }
        }
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
  async renderSlotElement(node) {
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
        for (let index = 0; index < savedWidgets.length; index++) {
          const widgetInstance = savedWidgets[index];
          try {
            await this.addWidgetToSlot(slotName, widgetInstance, true); // isLoading = true
          } catch (error) {
            console.error(`LayoutRenderer: Error rendering saved widget ${index} in slot ${slotName}`, error);
            const errorElement = this.createErrorWidgetElement(`Saved widget ${index + 1}: ${error.message}`);
            element.appendChild(errorElement);
          }
        }
      } else {
        // Show placeholder for empty slot
        const title = node.slot.title || slotName;
        const description = node.slot.description || '';

        element.innerHTML = `
          <div class="slot-placeholder p-4 border-2 border-dashed border-gray-300 rounded text-center text-gray-500">
            <div class="text-sm font-medium">${this.templateRenderer.escapeHtml(title)}</div>
            ${description ? `<div class="text-xs mt-1">${this.templateRenderer.escapeHtml(description)}</div>` : ''}
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

  // ======================================================================
  // TEMPLATE JSON PROCESSING ENGINE
  // ======================================================================

  /**
   * Render widget content from template_json structure
   * @param {Object} templateJson - Parsed template JSON from backend
   * @param {Object} config - Widget configuration object
   * @param {string} widgetType - Widget type identifier
   * @param {string} widgetId - Widget ID for CSS scoping (optional)
   * @returns {HTMLElement} Rendered widget content element
   */
  renderFromTemplateJson(templateJson, config, widgetType, widgetId = null) {
    try {
      // Validate template_json structure
      if (!templateJson || typeof templateJson !== 'object') {
        throw new Error('Invalid template_json object');
      }

      if (!templateJson.structure) {
        throw new Error('template_json missing structure property');
      }


      // Process the template structure with config and template logic support
      const templateTags = templateJson.template_tags || [];
      let element;

      if (templateTags.length > 0 && (templateTags.includes('if') || templateTags.includes('for'))) {
        // Use enhanced processing for templates with logic
        element = this.templateRenderer.processTemplateStructureWithLogic(templateJson.structure, config, templateTags);
      } else {
        // Use standard processing for simple templates
        element = this.templateRenderer.processTemplateStructure(templateJson.structure, config);
      }

      // Handle inline CSS if present
      if (templateJson.has_inline_css) {
        this.processInlineStyles(templateJson, config, widgetId);
      }

      return element;

    } catch (error) {
      console.error(`LayoutRenderer: Error rendering template_json for widget "${widgetType}"`, error);

      // Enhanced error handling with detailed fallback
      return this.createTemplateErrorElement(error, widgetType, {
        templateJson,
        config,
        widgetId
      });
    }
  }

  /**
   * Recursively process template structure and convert to DOM elements
   * @param {Object} structure - Template structure object
   * @param {Object} config - Widget configuration
   * @returns {HTMLElement|Text|DocumentFragment} DOM node
   */
  processTemplateStructure(structure, config) {
    try {
      if (!structure || typeof structure !== 'object') {
        throw new Error('Invalid template structure');
      }

      switch (structure.type) {
        case 'element':
          return this.templateRenderer.createElementFromTemplate(structure, config);

        case 'template_text':
          return this.templateRenderer.processTemplateText(structure, config);

        case 'text':
          return this.templateRenderer.processStaticText(structure);

        case 'style':
          return this.templateRenderer.processStyleElement(structure, config);

        case 'fragment':
          return this.templateRenderer.processFragment(structure, config);

        default:
          console.warn(`LayoutRenderer: Unknown template structure type: ${structure.type}`);
          return document.createTextNode(`[Unknown template type: ${structure.type}]`);
      }

    } catch (error) {
      return this.templateRenderer.handleTemplateStructureError(error, structure, config);
    }
  }

  /**
   * Create DOM element from template element structure
   * @param {Object} elementData - Template element data
   * @param {Object} config - Widget configuration
   * @returns {HTMLElement} DOM element
   */
  createElementFromTemplate(elementData, config) {
    try {
      // Create the base element
      const element = document.createElement(elementData.tag || 'div');

      // Process classes with template variables
      if (elementData.classes) {
        const processedClasses = this.templateRenderer.resolveTemplateVariables(elementData.classes, config);
        element.className = processedClasses;
      }

      // Process static attributes
      if (elementData.attributes) {
        Object.entries(elementData.attributes).forEach(([key, value]) => {
          element.setAttribute(key, value);
        });
      }

      // Process template attributes (attributes with variables)
      if (elementData.template_attributes) {
        this.templateRenderer.processTemplateAttributes(element, elementData.template_attributes, config);
      }

      // Process children recursively
      if (elementData.children && Array.isArray(elementData.children)) {
        elementData.children.forEach(child => {
          const childNode = this.templateRenderer.processTemplateStructure(child, config);
          if (childNode) {
            element.appendChild(childNode);
          }
        });
      }

      return element;

    } catch (error) {
      return this.templateRenderer.handleTemplateStructureError(error, elementData, config);
    }
  }

  /**
   * Process template attributes that contain variables
   * @param {HTMLElement} element - Target DOM element
   * @param {Object} templateAttrs - Template attributes with variables
   * @param {Object} config - Widget configuration
   */
  processTemplateAttributes(element, templateAttrs, config) {
    try {
      Object.entries(templateAttrs).forEach(([attrName, attrData]) => {
        if (attrData && attrData.value) {
          const resolvedValue = this.templateRenderer.resolveTemplateVariables(attrData.value, config);
          element.setAttribute(attrName, resolvedValue);
        }
      });
    } catch (error) {
      console.error('LayoutRenderer: Error processing template attributes', error);
    }
  }

  /**
   * Process template text with variable substitution
   * @param {Object} textData - Template text data
   * @param {Object} config - Widget configuration
   * @returns {Text} DOM text node
   */
  processTemplateText(textData, config) {
    try {
      if (!textData.content) {
        return document.createTextNode('');
      }

      const resolvedContent = this.templateRenderer.resolveTemplateVariables(textData.content, config);
      return document.createTextNode(resolvedContent);

    } catch (error) {
      return this.templateRenderer.handleTemplateStructureError(error, textData, config);
    }
  }

  /**
   * Process static text (no variables)
   * @param {Object} textData - Static text data
   * @returns {Text} DOM text node
   */
  processStaticText(textData) {
    return document.createTextNode(textData.content || '');
  }

  /**
   * Process template fragment (multiple root elements)
   * @param {Object} fragmentData - Fragment data with children
   * @param {Object} config - Widget configuration
   * @returns {DocumentFragment} Document fragment containing all children
   */
  processFragment(fragmentData, config) {
    const fragment = document.createDocumentFragment();

    if (fragmentData.children && Array.isArray(fragmentData.children)) {
      fragmentData.children.forEach(child => {
        const childNode = this.templateRenderer.processTemplateStructure(child, config);
        if (childNode) {
          fragment.appendChild(childNode);
        }
      });
    }

    return fragment;
  }

  /**
   * Resolve Django template variables in a string
   * @param {string} templateString - String containing {{ variable }} patterns
   * @param {Object} config - Widget configuration object
   * @returns {string} String with variables resolved to actual values
   */
  resolveTemplateVariables(templateString, config) {
    try {
      if (typeof templateString !== 'string') {
        return String(templateString || '');
      }

      // Replace {{ config.field }} patterns with actual values
      return templateString.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expression) => {
        try {
          // Clean up the expression
          const cleanExpression = expression.trim();

          // Handle basic config.field access
          if (cleanExpression.startsWith('config.')) {
            const fieldPath = cleanExpression.substring(7); // Remove 'config.'
            const value = this.templateRenderer.getNestedValue(config, fieldPath);

            // Apply basic Django filters if present
            if (cleanExpression.includes('|')) {
              return this.templateRenderer.applyTemplateFilters(value, cleanExpression);
            }

            return value !== undefined ? String(value) : '';
          }

          // For non-config variables, return empty string for now
          console.warn(`LayoutRenderer: Unhandled template variable: ${cleanExpression}`);
          return '';

        } catch (error) {
          console.error('LayoutRenderer: Error resolving template variable', error, expression);
          return match; // Return original if resolution fails
        }
      });

    } catch (error) {
      console.error('LayoutRenderer: Error in resolveTemplateVariables', error);
      return templateString;
    }
  }

  /**
   * Get nested value from object using dot notation (with prototype pollution protection)
   * @param {Object} obj - Object to search in
   * @param {string} path - Dot-separated path (e.g., 'style.color')
   * @returns {*} Value at path or undefined
   */
  getNestedValue(obj, path) {
    try {
      // Validate path to prevent prototype pollution
      if (typeof path !== 'string' || path.includes('__proto__') || path.includes('constructor') || path.includes('prototype')) {
        console.warn('LayoutRenderer: Potentially dangerous path blocked:', path);
        return undefined;
      }

      return path.split('.').reduce((current, key) => {
        // Additional validation on each key
        if (typeof key !== 'string' || key === '__proto__' || key === 'constructor' || key === 'prototype') {
          throw new Error(`Dangerous property access blocked: ${key}`);
        }

        // Only access own properties, not inherited ones
        if (current && current.hasOwnProperty && current.hasOwnProperty(key)) {
          return current[key];
        }

        return undefined;
      }, obj);
    } catch (error) {
      console.error('LayoutRenderer: Error getting nested value', error, path);
      return undefined;
    }
  }

  /**
   * Apply basic Django template filters to a value
   * @param {*} value - Value to filter
   * @param {string} expression - Full expression with filters
   * @returns {string} Filtered value
   */
  applyTemplateFilters(value, expression) {
    try {
      // Extract filter part after the pipe
      const filterPart = expression.split('|')[1];
      if (!filterPart) return String(value || '');

      const filterName = filterPart.trim().split(':')[0];
      const filterArg = filterPart.includes(':') ? filterPart.split(':')[1].replace(/"/g, '') : null;

      switch (filterName) {
        case 'default':
          return value !== undefined && value !== null && value !== '' ? String(value) : (filterArg || '');

        case 'linebreaks':
          return String(value || '').replace(/\n/g, '<br>');

        case 'safe':
          // For now, just return as string - would need proper HTML escaping in production
          return String(value || '');

        case 'escape':
          return this.templateRenderer.escapeHtml(String(value || ''));

        default:
          console.warn(`LayoutRenderer: Unhandled template filter: ${filterName}`);
          return String(value || '');
      }

    } catch (error) {
      console.error('LayoutRenderer: Error applying template filters', error);
      return String(value || '');
    }
  }

  /**
   * Process style elements with template variables (placeholder for Phase 5)
   * @param {Object} styleData - Style element data
   * @param {Object} config - Widget configuration
   * @returns {HTMLStyleElement} Style element
   */
  processStyleElement(styleData, config) {
    // Placeholder implementation - will be enhanced in Phase 5
    const styleElement = document.createElement('style');

    if (styleData.css) {
      const processedCSS = this.templateRenderer.resolveTemplateVariables(styleData.css, config);
      styleElement.textContent = processedCSS;
    }

    return styleElement;
  }

  /**
   * Process conditional logic in template structure
   * @param {Object} structure - Template structure that may contain conditionals
   * @param {Object} config - Widget configuration
   * @param {Array} templateTags - Array of template tags used in the template
   * @returns {HTMLElement|Text|DocumentFragment|null} Processed element or null if condition fails
   */
  processConditionalLogic(structure, config, templateTags = []) {
    try {
      // Check if this structure has conditional logic
      if (structure.condition) {
        const shouldRender = this.templateRenderer.evaluateCondition(structure.condition, config);
        if (!shouldRender) {
          return null; // Don't render this element
        }
      }

      // Check for template tags that indicate conditional rendering
      if (templateTags.includes('if')) {
        // Look for conditional attributes or patterns in the structure
        if (structure.conditionalRender) {
          const shouldRender = this.templateRenderer.evaluateCondition(structure.conditionalRender, config);
          if (!shouldRender) {
            return null;
          }
        }
      }

      // Process the structure normally if condition passes
      return this.templateRenderer.processTemplateStructure(structure, config);

    } catch (error) {
      console.error('LayoutRenderer: Error processing conditional logic', error, structure);
      return this.templateRenderer.processTemplateStructure(structure, config); // Fallback to normal processing
    }
  }

  /**
   * Evaluate a conditional expression
   * @param {string|Object} condition - Condition to evaluate
   * @param {Object} config - Widget configuration
   * @returns {boolean} True if condition passes, false otherwise
   */
  evaluateCondition(condition, config) {
    try {
      if (typeof condition === 'string') {
        // Handle string conditions like "config.show_title"
        if (condition.startsWith('config.')) {
          const fieldPath = condition.substring(7); // Remove 'config.'
          const value = this.templateRenderer.getNestedValue(config, fieldPath);
          return Boolean(value);
        }

        // Handle negation like "not config.hide_element"
        if (condition.startsWith('not ')) {
          const innerCondition = condition.substring(4).trim();
          return !this.templateRenderer.evaluateCondition(innerCondition, config);
        }

        // Handle comparison operators
        if (condition.includes('==')) {
          const [left, right] = condition.split('==').map(s => s.trim());
          const leftValue = this.templateRenderer.resolveTemplateVariables(`{{ ${left} }}`, config);
          const rightValue = right.replace(/['"]/g, ''); // Remove quotes
          return leftValue === rightValue;
        }

        if (condition.includes('!=')) {
          const [left, right] = condition.split('!=').map(s => s.trim());
          const leftValue = this.templateRenderer.resolveTemplateVariables(`{{ ${left} }}`, config);
          const rightValue = right.replace(/['"]/g, ''); // Remove quotes
          return leftValue !== rightValue;
        }

        // Default: try to resolve as template variable
        const resolvedValue = this.templateRenderer.resolveTemplateVariables(`{{ ${condition} }}`, config);
        return Boolean(resolvedValue);
      }

      if (typeof condition === 'object' && condition !== null) {
        // Handle object-based conditions
        if (condition.type === 'field_check') {
          const value = this.templateRenderer.getNestedValue(config, condition.field);
          return Boolean(value);
        }

        if (condition.type === 'comparison') {
          const leftValue = this.templateRenderer.getNestedValue(config, condition.left);
          const rightValue = condition.right;
          switch (condition.operator) {
            case '==': return leftValue == rightValue;
            case '!=': return leftValue != rightValue;
            case '>': return leftValue > rightValue;
            case '<': return leftValue < rightValue;
            case '>=': return leftValue >= rightValue;
            case '<=': return leftValue <= rightValue;
            default: return Boolean(leftValue);
          }
        }
      }

      return Boolean(condition);

    } catch (error) {
      console.error('LayoutRenderer: Error evaluating condition', error, condition);
      console.warn(`LayoutRenderer: Condition evaluation failed for: "${condition}" - this may indicate a configuration error`);

      // In development mode, be more verbose about the failure
      if (this.isDevelopmentMode()) {
        console.warn('LayoutRenderer: Failed condition details:', {
          condition,
          error: error.message,
          stack: error.stack?.split('\n').slice(0, 3)
        });
      }

      return false; // Fail safe - don't render if condition evaluation fails
    }
  }

  /**
   * Process loop logic in template structure
   * @param {Object} structure - Template structure that may contain loops
   * @param {Object} config - Widget configuration
   * @param {Array} templateTags - Array of template tags used in the template
   * @returns {DocumentFragment} Fragment containing all loop iterations
   */
  processLoopLogic(structure, config, templateTags = []) {
    try {
      const fragment = document.createDocumentFragment();

      // Check if this structure has loop logic
      if (structure.loop && structure.loop.iterable) {
        const iterableValue = this.templateRenderer.getNestedValue(config, structure.loop.iterable);

        if (Array.isArray(iterableValue)) {
          iterableValue.forEach((item, index) => {
            // Create a new config context for this iteration
            const iterationConfig = {
              ...config,
              [structure.loop.variable || 'item']: item,
              forloop: {
                counter: index + 1,
                counter0: index,
                first: index === 0,
                last: index === iterableValue.length - 1,
                length: iterableValue.length
              }
            };

            // Process the template structure with the iteration context
            const iterationElement = this.processTemplateStructure(structure.template, iterationConfig);
            if (iterationElement) {
              fragment.appendChild(iterationElement);
            }
          });
        }
      }

      return fragment;

    } catch (error) {
      console.error('LayoutRenderer: Error processing loop logic', error, structure);
      return document.createDocumentFragment(); // Return empty fragment on error
    }
  }

  /**
   * Enhanced processTemplateStructure with template logic support
   * @param {Object} structure - Template structure object
   * @param {Object} config - Widget configuration
   * @param {Array} templateTags - Array of template tags (for context)
   * @returns {HTMLElement|Text|DocumentFragment} DOM node
   */
  processTemplateStructureWithLogic(structure, config, templateTags = []) {
    try {
      if (!structure || typeof structure !== 'object') {
        throw new Error('Invalid template structure');
      }

      // Handle conditional logic first
      if (structure.condition || (templateTags.includes('if') && structure.conditionalRender)) {
        const result = this.templateRenderer.processConditionalLogic(structure, config, templateTags);
        if (result === null) {
          return document.createTextNode(''); // Return empty text node if condition fails
        }
        return result;
      }

      // Handle loop logic
      if (structure.loop || (templateTags.includes('for') && structure.iterable)) {
        return this.templateRenderer.processLoopLogic(structure, config, templateTags);
      }

      // Handle enhanced template logic for existing types
      switch (structure.type) {
        case 'element':
          return this.templateRenderer.createElementFromTemplateWithLogic(structure, config, templateTags);

        case 'template_text':
          // Check for conditional text rendering
          if (structure.showIf) {
            const shouldShow = this.templateRenderer.evaluateCondition(structure.showIf, config);
            if (!shouldShow) {
              return document.createTextNode('');
            }
          }
          return this.templateRenderer.processTemplateText(structure, config);

        case 'conditional_block':
          // Special type for conditional blocks
          const shouldRender = this.templateRenderer.evaluateCondition(structure.condition, config);
          if (shouldRender && structure.content) {
            return this.templateRenderer.processTemplateStructureWithLogic(structure.content, config, templateTags);
          }
          return document.createTextNode('');

        default:
          // Fall back to regular processing
          return this.templateRenderer.processTemplateStructure(structure, config);
      }

    } catch (error) {
      console.error('LayoutRenderer: Error processing template structure with logic', error, structure);
      return document.createTextNode(`[Logic Error: ${error.message}]`);
    }
  }

  /**
   * Enhanced element creation with template logic support
   * @param {Object} elementData - Template element data
   * @param {Object} config - Widget configuration
   * @param {Array} templateTags - Array of template tags
   * @returns {HTMLElement} DOM element
   */
  createElementFromTemplateWithLogic(elementData, config, templateTags = []) {
    try {
      // Check element-level conditions
      if (elementData.showIf) {
        const shouldShow = this.templateRenderer.evaluateCondition(elementData.showIf, config);
        if (!shouldShow) {
          return document.createTextNode(''); // Return empty text node if condition fails
        }
      }

      // Create the base element using existing method
      const element = this.templateRenderer.createElementFromTemplate(elementData, config);

      // Enhanced children processing with logic support
      if (elementData.children && Array.isArray(elementData.children)) {
        // Clear existing children (from base method) and reprocess with logic
        element.innerHTML = '';

        elementData.children.forEach(child => {
          const childNode = this.templateRenderer.processTemplateStructureWithLogic(child, config, templateTags);
          if (childNode && childNode.nodeType) {
            element.appendChild(childNode);
          }
        });
      }

      return element;

    } catch (error) {
      console.error('LayoutRenderer: Error creating element with logic', error, elementData);
      const errorElement = document.createElement('div');
      errorElement.className = 'widget-error';
      errorElement.textContent = `Element Logic Error: ${error.message}`;
      return errorElement;
    }
  }

  /**
   * Process inline styles and inject them into the document
   * @param {Object} templateJson - Full template JSON
   * @param {Object} config - Widget configuration
   * @param {string} widgetId - Unique widget ID for scoping styles
   */
  processInlineStyles(templateJson, config, widgetId = null) {
    try {
      if (!templateJson.has_inline_css) {
        return;
      }

      // Find all style elements in the template structure
      const styleElements = this.extractStyleElements(templateJson.structure);

      if (styleElements.length === 0) {
        return;
      }

      // Process each style element
      styleElements.forEach((styleData, index) => {
        if (styleData.css) {
          const processedCSS = this.templateRenderer.resolveTemplateVariables(styleData.css, config);
          const scopedCSS = widgetId ? this.scopeCSS(processedCSS, widgetId) : processedCSS;

          // Inject the CSS into the document
          this.injectWidgetStyles(scopedCSS, widgetId, index);
        }
      });

    } catch (error) {
      console.error('LayoutRenderer: Error processing inline styles', error);
    }
  }

  /**
   * Extract all style elements from template structure recursively
   * @param {Object} structure - Template structure to search
   * @returns {Array} Array of style element data
   */
  extractStyleElements(structure) {
    const styleElements = [];

    const extractFromNode = (node) => {
      if (!node || typeof node !== 'object') {
        return;
      }

      // Check if this node is a style element
      if (node.type === 'style' && node.css) {
        styleElements.push(node);
      }

      // Check if this is an element with inline styles
      if (node.type === 'element' && node.attributes && node.attributes.style) {
        styleElements.push({
          type: 'inline_style',
          css: node.attributes.style,
          selector: node.tag
        });
      }

      // Recursively check children
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(child => extractFromNode(child));
      }

      // Check template structures
      if (node.template) {
        extractFromNode(node.template);
      }

      // Check conditional content
      if (node.content) {
        extractFromNode(node.content);
      }
    };

    extractFromNode(structure);
    return styleElements;
  }

  /**
   * Scope CSS rules to a specific widget instance
   * @param {string} css - Original CSS content
   * @param {string} widgetId - Widget ID for scoping
   * @returns {string} Scoped CSS content
   */
  scopeCSS(css, widgetId) {
    try {
      if (!widgetId || !css) {
        return css;
      }

      const widgetSelector = `[data-widget-id="${widgetId}"]`;

      // Simple CSS scoping - prepend widget selector to all rules
      const scopedCSS = css.replace(/([^{}]+){/g, (match, selector) => {
        // Clean up the selector
        const cleanSelector = selector.trim();

        // Skip @-rules (media queries, keyframes, etc.)
        if (cleanSelector.startsWith('@')) {
          return match;
        }

        // Scope the selector
        const scopedSelector = cleanSelector
          .split(',')
          .map(s => `${widgetSelector} ${s.trim()}`)
          .join(', ');

        return `${scopedSelector} {`;
      });

      return scopedCSS;

    } catch (error) {
      console.error('LayoutRenderer: Error scoping CSS', error);
      return css; // Return original CSS if scoping fails
    }
  }

  /**
   * Inject processed CSS into document head (with memory leak protection)
   * @param {string} cssContent - CSS content to inject
   * @param {string} widgetId - Widget ID for identification
   * @param {number} styleIndex - Index for multiple styles per widget
   */
  injectWidgetStyles(cssContent, widgetId, styleIndex = 0) {
    try {
      if (!cssContent) {
        return;
      }

      // Create unique ID for this style element
      const styleId = widgetId
        ? `widget-styles-${widgetId}-${styleIndex}`
        : `template-styles-${Date.now()}-${styleIndex}`;

      // Remove existing style element if it exists
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
        this.injectedStyles.delete(styleId);
      }

      // Clean up any orphaned styles periodically
      this.cleanupOrphanedStyles();

      // Create new style element
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = cssContent;
      styleElement.setAttribute('data-widget-styles', 'true');
      styleElement.setAttribute('data-injected-at', Date.now().toString());

      if (widgetId) {
        styleElement.setAttribute('data-widget-id', widgetId);
      }

      // Inject into document head
      document.head.appendChild(styleElement);

      // Track this style for cleanup
      this.injectedStyles.add(styleId);

    } catch (error) {
      console.error('LayoutRenderer: Error injecting widget styles', error);
    }
  }

  /**
   * Clean up widget styles when widget is removed
   * @param {string} widgetId - Widget ID to clean up styles for
   */
  cleanupWidgetStyles(widgetId) {
    try {
      if (!widgetId) {
        return;
      }

      // Find and remove all style elements for this widget
      const widgetStyles = document.querySelectorAll(`style[data-widget-id="${widgetId}"]`);
      widgetStyles.forEach(styleElement => {
        styleElement.remove();
      });

    } catch (error) {
      console.error('LayoutRenderer: Error cleaning up widget styles', error);
    }
  }

  /**
   * Enhanced processStyleElement with improved CSS processing
   * @param {Object} styleData - Style element data
   * @param {Object} config - Widget configuration
   * @returns {HTMLStyleElement} Style element
   */
  processStyleElement(styleData, config) {
    try {
      const styleElement = document.createElement('style');

      if (styleData.css) {
        const processedCSS = this.templateRenderer.resolveTemplateVariables(styleData.css, config);
        styleElement.textContent = processedCSS;

        // Add metadata for tracking
        styleElement.setAttribute('data-template-style', 'true');

        // Apply scoping if in widget context
        if (styleData.scope && styleData.widgetId) {
          const scopedCSS = this.scopeCSS(processedCSS, styleData.widgetId);
          styleElement.textContent = scopedCSS;
        }
      }

      return styleElement;

    } catch (error) {
      console.error('LayoutRenderer: Error processing style element', error, styleData);
      const errorElement = document.createElement('style');
      errorElement.textContent = `/* Style processing error: ${error.message} */`;
      return errorElement;
    }
  }

  /**
   * Process CSS variables and custom properties
   * @param {string} css - CSS content
   * @param {Object} config - Widget configuration
   * @returns {string} CSS with resolved variables
   */
  processCSSVariables(css, config) {
    try {
      if (!css) return css;

      // Process CSS custom properties with template variables
      return css.replace(/var\(--([^,)]+)(?:,\s*([^)]+))?\)/g, (match, varName, fallback) => {
        // Try to resolve the variable from config
        const configValue = this.templateRenderer.getNestedValue(config, varName);

        if (configValue !== undefined) {
          return configValue;
        }

        // Use fallback if provided
        if (fallback) {
          return fallback;
        }

        // Keep original var() if no resolution available
        return match;
      });

    } catch (error) {
      console.error('LayoutRenderer: Error processing CSS variables', error);
      return css;
    }
  }

  /**
   * Create a detailed error element for template rendering failures
   * @param {Error} error - The error that occurred
   * @param {string} widgetType - Widget type that failed
   * @param {Object} context - Additional context for debugging
   * @returns {HTMLElement} Error element with debugging information
   */
  createTemplateErrorElement(error, widgetType, context = {}) {
    try {
      const errorContainer = document.createElement('div');
      errorContainer.className = 'widget-error bg-red-50 border border-red-200 rounded-lg p-4 text-red-700';

      // Error header
      const header = document.createElement('div');
      header.className = 'font-semibold text-red-800 mb-2';
      header.textContent = `Template Rendering Error: ${widgetType}`;
      errorContainer.appendChild(header);

      // Error message
      const message = document.createElement('div');
      message.className = 'text-sm mb-2';
      message.textContent = error.message;
      errorContainer.appendChild(message);

      // Error details (in development mode)
      if (this.isDevelopmentMode()) {
        const details = this.createErrorDetails(error, context);
        errorContainer.appendChild(details);
      }

      // Fallback action button
      const fallbackButton = this.createFallbackButton(widgetType, context);
      if (fallbackButton) {
        errorContainer.appendChild(fallbackButton);
      }

      return errorContainer;

    } catch (fallbackError) {
      console.error('LayoutRenderer: Error creating error element', fallbackError);

      // Ultimate fallback - simple text element
      const simpleError = document.createElement('div');
      simpleError.className = 'widget-error-simple text-red-600 p-2 border border-red-300';
      simpleError.textContent = `Widget Error: ${widgetType} - ${error.message}`;
      return simpleError;
    }
  }

  /**
   * Create detailed error information for debugging
   * @param {Error} error - The error that occurred
   * @param {Object} context - Additional context
   * @returns {HTMLElement} Error details element
   */
  createErrorDetails(error, context) {
    const details = document.createElement('details');
    details.className = 'mt-2';

    const summary = document.createElement('summary');
    summary.className = 'cursor-pointer text-xs text-red-600 hover:text-red-800';
    summary.textContent = 'Error Details (Development Mode)';
    details.appendChild(summary);

    const content = document.createElement('div');
    content.className = 'mt-2 text-xs font-mono bg-red-100 p-2 rounded border';

    const errorInfo = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n') // First 5 lines of stack
      },
      context: {
        hasTemplateJson: !!context.templateJson,
        hasConfig: !!context.config,
        widgetId: context.widgetId,
        templateStructureType: context.templateJson?.structure?.type,
        templateTags: context.templateJson?.template_tags,
        configKeys: context.config ? Object.keys(context.config) : []
      },
      timestamp: new Date().toISOString()
    };

    content.textContent = JSON.stringify(errorInfo, null, 2);
    details.appendChild(content);

    return details;
  }

  /**
   * Create fallback action button for error recovery
   * @param {string} widgetType - Widget type that failed
   * @param {Object} context - Additional context
   * @returns {HTMLElement|null} Fallback button or null
   */
  createFallbackButton(widgetType, context) {
    try {
      const button = document.createElement('button');
      button.className = 'mt-2 px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700';
      button.textContent = 'Use Legacy Rendering';

      button.addEventListener('click', () => {
        try {
          // Try to render using legacy method
          const legacyContent = this.renderWidgetContentLegacy(widgetType, context.config || {});

          // Replace the error element with legacy content
          const errorElement = button.closest('.widget-error');
          if (errorElement && legacyContent) {
            errorElement.parentNode.replaceChild(legacyContent, errorElement);
          }

        } catch (legacyError) {
          console.error('LayoutRenderer: Legacy rendering also failed', legacyError);
          button.textContent = 'All Rendering Failed';
          button.disabled = true;
        }
      });

      return button;

    } catch (error) {
      console.error('LayoutRenderer: Error creating fallback button', error);
      return null;
    }
  }

  /**
   * Enhanced error handling for template structure processing
   * @param {Error} error - The error that occurred
   * @param {Object} structure - Template structure that caused the error
   * @param {Object} config - Widget configuration
   * @returns {HTMLElement} Error element or safe fallback
   */
  handleTemplateStructureError(error, structure, config) {
    try {
      // Enhanced error logging with more context
      console.error('LayoutRenderer: Template structure error', {
        error: error.message,
        stack: error.stack,
        structure: structure,
        config: this.debug ? config : 'Enable debug mode for config details',
        timestamp: new Date().toISOString()
      });

      // Try to create a safe fallback based on structure type
      switch (structure?.type) {
        case 'element':
          return this.createSafeElementFallback(structure, config, error);

        case 'template_text':
          return this.templateRenderer.createSafeTextFallback(structure, config, error);

        case 'text':
          const textError = document.createElement('span');
          textError.className = 'template-error-text';
          textError.style.color = '#dc2626';
          textError.style.backgroundColor = '#fef2f2';
          textError.style.padding = '2px 4px';
          textError.style.borderRadius = '2px';
          textError.textContent = `[LayoutRenderer Text Error: ${error.message}] Content: "${structure.content || 'undefined'}"`;
          return textError;

        default:
          const unknownError = document.createElement('span');
          unknownError.className = 'template-error-unknown';
          unknownError.style.color = '#dc2626';
          unknownError.style.backgroundColor = '#fef2f2';
          unknownError.style.padding = '2px 4px';
          unknownError.style.border = '1px solid #dc2626';
          unknownError.style.borderRadius = '2px';
          unknownError.textContent = `[LayoutRenderer ${structure?.type || 'Unknown'} Error: ${error.message}]`;
          return unknownError;
      }

    } catch (fallbackError) {
      console.error('LayoutRenderer: Fallback creation failed', fallbackError);
      const criticalError = document.createElement('span');
      criticalError.style.color = '#dc2626';
      criticalError.style.fontWeight = 'bold';
      criticalError.textContent = `[LayoutRenderer Critical Error: ${error.message}]`;
      return criticalError;
    }
  }

  /**
   * Create safe element fallback when element processing fails
   * @param {Object} structure - Element structure
   * @param {Object} config - Widget configuration
   * @returns {HTMLElement} Safe fallback element
   */
  createSafeElementFallback(structure, config, originalError = null) {
    try {
      const element = document.createElement(structure.tag || 'div');
      element.className = 'template-error-fallback border border-orange-300 bg-orange-50 p-2';

      // Add safe attributes
      if (structure.attributes) {
        Object.entries(structure.attributes).forEach(([key, value]) => {
          try {
            if (typeof value === 'string' && !value.includes('<')) {
              element.setAttribute(key, value);
            }
          } catch (attrError) {
            console.warn('LayoutRenderer: Skipping unsafe attribute', key, value);
          }
        });
      }

      // Add detailed error information
      const errorInfo = this.templateRenderer.createErrorInfoElement(originalError, structure, config, 'LayoutRenderer Element');
      element.appendChild(errorInfo);

      return element;

    } catch (error) {
      console.error('LayoutRenderer: Safe element fallback failed', error);
      const div = document.createElement('div');
      div.textContent = '[Element Error]';
      return div;
    }
  }

  /**
   * Create safe text fallback when text processing fails
   * @param {Object} structure - Text structure
   * @param {Object} config - Widget configuration
   * @returns {Text} Safe text node
   */
  createSafeTextFallback(structure, config) {
    try {
      // Try to extract any text content safely
      let content = structure.content || '[Text processing error]';

      // Remove any template variables that failed to resolve
      content = content.replace(/\{\{[^}]*\}\}/g, '[Variable Error]');

      return document.createTextNode(content);

    } catch (error) {
      console.error('LayoutRenderer: Safe text fallback failed', error);
      return document.createTextNode('[Text Error]');
    }
  }

  /**
   * Validate template_json structure before processing
   * @param {Object} templateJson - Template JSON to validate
   * @returns {Object} Validation result with errors
   */
  validateTemplateJson(templateJson) {
    const errors = [];
    const warnings = [];

    try {
      // Check basic structure
      if (!templateJson || typeof templateJson !== 'object') {
        errors.push('Invalid template_json: not an object');
        return { isValid: false, errors, warnings };
      }

      if (!templateJson.structure) {
        errors.push('Missing required structure property');
      }

      // Validate structure recursively
      if (templateJson.structure) {
        this.validateTemplateStructure(templateJson.structure, errors, warnings);
      }

      // Check template variables
      if (templateJson.template_variables && !Array.isArray(templateJson.template_variables)) {
        warnings.push('template_variables should be an array');
      }

      // Check template tags
      if (templateJson.template_tags && !Array.isArray(templateJson.template_tags)) {
        warnings.push('template_tags should be an array');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { isValid: false, errors, warnings };
    }
  }

  /**
   * Validate template structure recursively
   * @param {Object} structure - Structure to validate
   * @param {Array} errors - Array to collect errors
   * @param {Array} warnings - Array to collect warnings
   */
  validateTemplateStructure(structure, errors, warnings) {
    try {
      if (!structure || typeof structure !== 'object') {
        errors.push('Invalid structure: not an object');
        return;
      }

      if (!structure.type) {
        errors.push('Structure missing type property');
        return;
      }

      const validTypes = ['element', 'template_text', 'text', 'style', 'fragment', 'conditional_block', 'loop_block'];
      if (!validTypes.includes(structure.type)) {
        warnings.push(`Unknown structure type: ${structure.type}`);
      }

      // Validate type-specific properties
      switch (structure.type) {
        case 'conditional_block':
          if (!structure.condition || typeof structure.condition !== 'string') {
            errors.push('conditional_block missing valid condition property');
          }
          if (!structure.content) {
            errors.push('conditional_block missing content property');
          } else {
            this.validateTemplateStructure(structure.content, errors, warnings);
          }
          break;

        case 'loop_block':
          if (!structure.loop || typeof structure.loop !== 'string') {
            errors.push('loop_block missing valid loop property');
          }
          if (!structure.content) {
            errors.push('loop_block missing content property');
          } else {
            this.validateTemplateStructure(structure.content, errors, warnings);
          }
          break;

        case 'fragment':
          if (!structure.children || !Array.isArray(structure.children)) {
            warnings.push('fragment should have children array');
          }
          break;

        case 'element':
          if (!structure.tag || typeof structure.tag !== 'string') {
            errors.push('element missing valid tag property');
          }
          break;
      }

      // Validate children if present
      if (structure.children && Array.isArray(structure.children)) {
        structure.children.forEach((child, index) => {
          this.validateTemplateStructure(child, errors, warnings);
        });
      }

    } catch (error) {
      errors.push(`Structure validation error: ${error.message}`);
    }
  }

  /**
   * Check if we're in development mode for enhanced error reporting
   * @returns {boolean} True if in development mode
   */
  isDevelopmentMode() {
    try {
      // Check various indicators of development mode
      return (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.port === '3000' ||
        window.location.search.includes('debug=true') ||
        localStorage.getItem('layoutRenderer.debug') === 'true'
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Enhanced createErrorWidgetElement with better error handling
   * @param {string} message - Error message
   * @param {Object} context - Additional context
   * @returns {HTMLElement} Error widget element
   */
  createErrorWidgetElement(message, context = {}) {
    try {
      const errorElement = document.createElement('div');
      errorElement.className = 'widget-error bg-red-50 border border-red-200 rounded p-3 text-red-700';

      const icon = document.createElement('span');
      icon.textContent = '⚠️ ';

      const text = document.createElement('span');
      text.textContent = message;

      errorElement.appendChild(icon);
      errorElement.appendChild(text);

      // Add context information in development mode
      if (this.isDevelopmentMode() && context) {
        const details = document.createElement('details');
        details.className = 'mt-2';

        const summary = document.createElement('summary');
        summary.className = 'text-xs cursor-pointer';
        summary.textContent = 'Error Context';
        details.appendChild(summary);

        const contextContent = document.createElement('pre');
        contextContent.className = 'text-xs mt-1 p-2 bg-red-100 rounded overflow-auto max-h-32';
        contextContent.textContent = JSON.stringify(context, null, 2);
        details.appendChild(contextContent);

        errorElement.appendChild(details);
      }

      return errorElement;

    } catch (error) {
      console.error('LayoutRenderer: Error creating error widget element', error);

      // Ultimate fallback
      const simple = document.createElement('div');
      simple.className = 'text-red-600 p-2';
      simple.textContent = `Error: ${message}`;
      return simple;
    }
  }

  /**
   * Enhanced renderFromTemplateJson with caching
   * @param {Object} templateJson - Parsed template JSON from backend
   * @param {Object} config - Widget configuration object
   * @param {string} widgetType - Widget type identifier
   * @param {string} widgetId - Widget ID for CSS scoping (optional)
   * @returns {HTMLElement} Rendered widget content element
   */
  renderFromTemplateJsonCached(templateJson, config, widgetType, widgetId = null) {
    try {
      // Create cache key based on template structure and config
      const cacheKey = this.generateTemplateCacheKey(templateJson, config, widgetType);

      // Check if we have a cached preprocessed template
      const cachedTemplate = this.getFromTemplateCache(cacheKey);
      if (cachedTemplate) {
        this.cacheMetrics.hits++;

        // Clone and process the cached template with current config
        return this.processCachedTemplate(cachedTemplate, config, widgetId);
      }

      this.cacheMetrics.misses++;

      // Validate template_json structure before processing
      const validation = this.validateTemplateJson(templateJson);
      if (!validation.isValid) {
        throw new Error(`Invalid template_json: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        console.warn(`LayoutRenderer: Template warnings for "${widgetType}":`, validation.warnings);
      }

      // Preprocess the template structure for caching
      const preprocessedTemplate = this.preprocessTemplateStructure(templateJson);

      // Cache the preprocessed template
      this.setTemplateCache(cacheKey, preprocessedTemplate, templateJson);

      // Process the template with current config
      return this.processCachedTemplate(preprocessedTemplate, config, widgetId);

    } catch (error) {
      console.error(`LayoutRenderer: Error in cached template rendering for "${widgetType}"`, error);

      // Enhanced error handling with detailed fallback
      return this.createTemplateErrorElement(error, widgetType, {
        templateJson,
        config,
        widgetId,
        cacheMetrics: this.cacheMetrics
      });
    }
  }

  /**
   * Generate a cache key for template caching
   * @param {Object} templateJson - Template JSON
   * @param {Object} config - Widget configuration
   * @param {string} widgetType - Widget type
   * @returns {string} Cache key
   */
  generateTemplateCacheKey(templateJson, config, widgetType) {
    try {
      // Create a cache key based on template structure and config schema
      const templateHash = this.hashObject(templateJson.structure);
      const configSchema = this.extractConfigSchema(config);
      const configHash = this.hashObject(configSchema);

      return `${widgetType}_${templateHash}_${configHash}`;

    } catch (error) {
      console.warn('LayoutRenderer: Error generating cache key, using fallback', error);
      return `${widgetType}_${Date.now()}_${Math.random()}`;
    }
  }

  /**
   * Simple object hashing for cache keys
   * @param {Object} obj - Object to hash
   * @returns {string} Hash string
   */
  hashObject(obj) {
    try {
      const str = JSON.stringify(obj, Object.keys(obj).sort());
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return hash.toString(36);
    } catch (error) {
      return 'hash_error';
    }
  }

  /**
   * Extract configuration schema for caching (structure without values)
   * @param {Object} config - Widget configuration
   * @returns {Object} Configuration schema
   */
  extractConfigSchema(config) {
    try {
      if (!config || typeof config !== 'object') {
        return {};
      }

      const schema = {};
      Object.keys(config).forEach(key => {
        const value = config[key];
        schema[key] = typeof value;

        // For objects, recursively extract schema
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          schema[key] = { type: 'object', keys: Object.keys(value) };
        } else if (Array.isArray(value)) {
          schema[key] = { type: 'array', length: value.length };
        }
      });

      return schema;
    } catch (error) {
      return {};
    }
  }

  /**
   * Preprocess template structure for efficient caching
   * @param {Object} templateJson - Original template JSON
   * @returns {Object} Preprocessed template structure
   */
  preprocessTemplateStructure(templateJson) {
    try {
      return {
        structure: this.preprocessNode(templateJson.structure),
        templateTags: templateJson.template_tags || [],
        templateVariables: templateJson.template_variables || [],
        hasInlineCSS: templateJson.has_inline_css || false,
        metadata: {
          preprocessedAt: Date.now(),
          structureType: templateJson.structure?.type
        }
      };
    } catch (error) {
      console.error('LayoutRenderer: Error preprocessing template structure', error);
      throw error;
    }
  }

  /**
   * Recursively preprocess template nodes for caching
   * @param {Object} node - Template node to preprocess
   * @returns {Object} Preprocessed node
   */
  preprocessNode(node) {
    try {
      if (!node || typeof node !== 'object') {
        return node;
      }

      const preprocessed = { ...node };

      // Preprocess children recursively
      if (node.children && Array.isArray(node.children)) {
        preprocessed.children = node.children.map(child => this.preprocessNode(child));
      }

      // Preprocess template-specific structures
      if (node.template) {
        preprocessed.template = this.preprocessNode(node.template);
      }

      if (node.content && typeof node.content === 'object') {
        preprocessed.content = this.preprocessNode(node.content);
      }

      return preprocessed;
    } catch (error) {
      console.error('LayoutRenderer: Error preprocessing node', error, node);
      return node; // Return original on error
    }
  }

  /**
   * Process cached template with current configuration
   * @param {Object} cachedTemplate - Preprocessed template from cache
   * @param {Object} config - Current widget configuration
   * @param {string} widgetId - Widget ID for CSS scoping
   * @returns {HTMLElement} Rendered element
   */
  processCachedTemplate(cachedTemplate, config, widgetId) {
    try {
      const templateTags = cachedTemplate.templateTags || [];
      let element;

      if (templateTags.length > 0 && (templateTags.includes('if') || templateTags.includes('for'))) {
        // Use enhanced processing for templates with logic
        element = this.templateRenderer.processTemplateStructureWithLogic(cachedTemplate.structure, config, templateTags);
      } else {
        // Use standard processing for simple templates
        element = this.processTemplateStructure(cachedTemplate.structure, config);
      }

      // Handle inline CSS if present
      if (cachedTemplate.hasInlineCSS) {
        // Reconstruct templateJson for CSS processing
        const templateJson = {
          structure: cachedTemplate.structure,
          has_inline_css: cachedTemplate.hasInlineCSS
        };
        this.processInlineStyles(templateJson, config, widgetId);
      }

      return element;

    } catch (error) {
      console.error('LayoutRenderer: Error processing cached template', error);
      throw error;
    }
  }

  /**
   * Get template from cache (with race condition protection)
   * @param {string} cacheKey - Cache key
   * @returns {Object|null} Cached template or null
   */
  getFromTemplateCache(cacheKey) {
    try {
      // Check if another operation is currently processing this key
      if (this.cacheLocks.has(cacheKey)) {
        return null; // Return null to trigger fresh processing
      }

      const cached = this.templateCache.get(cacheKey);
      if (cached) {
        // Update access time for LRU eviction
        cached.lastAccessed = Date.now();
        return cached.template;
      }
      return null;
    } catch (error) {
      console.error('LayoutRenderer: Error getting from template cache', error);
      return null;
    }
  }

  /**
   * Set template in cache with LRU eviction (with race condition protection)
   * @param {string} cacheKey - Cache key
   * @param {Object} template - Preprocessed template
   * @param {Object} originalTemplateJson - Original template JSON for metadata
   */
  setTemplateCache(cacheKey, template, originalTemplateJson) {
    try {
      // Lock this key to prevent race conditions
      this.cacheLocks.set(cacheKey, Date.now());

      const maxCacheSize = 100; // Maximum number of cached templates

      // Check if cache needs cleaning
      if (this.templateCache.size >= maxCacheSize) {
        this.evictLeastRecentlyUsedTemplates(maxCacheSize * 0.8); // Keep 80% of max
      }

      this.templateCache.set(cacheKey, {
        template,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        originalSize: JSON.stringify(originalTemplateJson).length,
        widgetType: template.metadata?.structureType
      });

      // Release the lock
      this.cacheLocks.delete(cacheKey);

    } catch (error) {
      console.error('LayoutRenderer: Error setting template cache', error);
      // Ensure lock is released even on error
      this.cacheLocks.delete(cacheKey);
    }
  }

  /**
   * Evict least recently used templates from cache
   * @param {number} targetSize - Target cache size after eviction
   */
  evictLeastRecentlyUsedTemplates(targetSize) {
    try {
      const entries = Array.from(this.templateCache.entries());

      // Sort by last accessed time (oldest first)
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

      const toEvict = entries.length - targetSize;
      for (let i = 0; i < toEvict; i++) {
        this.templateCache.delete(entries[i][0]);
        this.cacheMetrics.evictions++;
      }

    } catch (error) {
      console.error('LayoutRenderer: Error evicting templates from cache', error);
    }
  }

  /**
   * Preload and cache widget templates for faster rendering
   * @param {Array} widgets - Array of widget definitions with template_json
   */
  async preloadWidgetTemplates(widgets) {
    try {
      if (!Array.isArray(widgets)) {
        return;
      }

      const preloadPromises = widgets.map(async (widget) => {
        try {
          if (widget._apiData?.template_json) {
            // Create a sample config for preprocessing
            const sampleConfig = this.createSampleConfig(widget._apiData.configuration_schema);

            // Preprocess and cache the template
            const cacheKey = this.generateTemplateCacheKey(
              widget._apiData.template_json,
              sampleConfig,
              widget.type
            );

            if (!this.getFromTemplateCache(cacheKey)) {
              const preprocessed = this.preprocessTemplateStructure(widget._apiData.template_json);
              this.setTemplateCache(cacheKey, preprocessed, widget._apiData.template_json);
            }
          }
        } catch (error) {
          console.warn(`LayoutRenderer: Failed to preload template for widget "${widget.type}"`, error);
        }
      });

      await Promise.all(preloadPromises);

    } catch (error) {
      console.error('LayoutRenderer: Error preloading widget templates', error);
    }
  }

  /**
   * Create sample configuration from schema for template preprocessing
   * @param {Object} schema - Configuration schema
   * @returns {Object} Sample configuration
   */
  createSampleConfig(schema) {
    try {
      if (!schema || typeof schema !== 'object') {
        return {};
      }

      const sampleConfig = {};

      // Extract properties from JSON schema
      if (schema.properties) {
        Object.entries(schema.properties).forEach(([key, propSchema]) => {
          sampleConfig[key] = this.createSampleValue(propSchema);
        });
      }

      return sampleConfig;

    } catch (error) {
      console.warn('LayoutRenderer: Error creating sample config', error);
      return {};
    }
  }

  /**
   * Create sample value based on property schema
   * @param {Object} propSchema - Property schema
   * @returns {*} Sample value
   */
  createSampleValue(propSchema) {
    try {
      switch (propSchema.type) {
        case 'string':
          return propSchema.default || 'sample_text';
        case 'number':
        case 'integer':
          return propSchema.default || 0;
        case 'boolean':
          return propSchema.default || false;
        case 'array':
          return propSchema.default || [];
        case 'object':
          return propSchema.default || {};
        default:
          return propSchema.default || '';
      }
    } catch (error) {
      return '';
    }
  }

  /**
   * Get cache performance metrics
   * @returns {Object} Cache metrics
   */
  getCacheMetrics() {
    const hitRate = this.cacheMetrics.hits + this.cacheMetrics.misses > 0
      ? (this.cacheMetrics.hits / (this.cacheMetrics.hits + this.cacheMetrics.misses) * 100).toFixed(2)
      : 0;

    return {
      ...this.cacheMetrics,
      hitRate: `${hitRate}%`,
      cacheSize: this.templateCache.size,
      memoryUsage: this.estimateCacheMemoryUsage()
    };
  }

  /**
   * Estimate cache memory usage
   * @returns {string} Estimated memory usage
   */
  estimateCacheMemoryUsage() {
    try {
      let totalSize = 0;
      this.templateCache.forEach(entry => {
        totalSize += entry.originalSize || 0;
      });

      // Convert to human readable format
      if (totalSize < 1024) {
        return `${totalSize}B`;
      } else if (totalSize < 1024 * 1024) {
        return `${(totalSize / 1024).toFixed(1)}KB`;
      } else {
        return `${(totalSize / (1024 * 1024)).toFixed(1)}MB`;
      }
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Clean up orphaned styles that no longer have associated widgets
   */
  cleanupOrphanedStyles() {
    try {
      // Only run cleanup periodically to avoid performance impact
      if (!this.lastStyleCleanup || Date.now() - this.lastStyleCleanup > 60000) { // 1 minute
        this.lastStyleCleanup = Date.now();

        const orphanedStyles = [];
        this.injectedStyles.forEach(styleId => {
          const styleElement = document.getElementById(styleId);
          if (!styleElement) {
            // Style element was removed externally
            orphanedStyles.push(styleId);
          } else {
            const widgetId = styleElement.getAttribute('data-widget-id');
            if (widgetId) {
              // Check if the widget still exists in DOM
              const widgetElement = document.querySelector(`.rendered-widget[data-widget-id="${widgetId}"]`);
              if (!widgetElement) {
                // Widget was removed but style wasn't cleaned up
                styleElement.remove();
                orphanedStyles.push(styleId);
              }
            }
          }
        });

        // Remove orphaned styles from tracking
        orphanedStyles.forEach(styleId => {
          this.injectedStyles.delete(styleId);
        });


      }
    } catch (error) {
      console.error('LayoutRenderer: Error during style cleanup', error);
    }
  }

  /**
   * Clear template cache and clean up all injected styles
   */
  clearTemplateCache() {
    try {
      this.templateCache.clear();
      this.cacheLocks.clear();
      this.cacheMetrics = { hits: 0, misses: 0, evictions: 0 };

      // Clean up all injected styles
      this.injectedStyles.forEach(styleId => {
        const styleElement = document.getElementById(styleId);
        if (styleElement) {
          styleElement.remove();
        }
      });
      this.injectedStyles.clear();

    } catch (error) {
      console.error('LayoutRenderer: Error clearing template cache', error);
    }
  }

  // ======================================================================
  // END TEMPLATE JSON PROCESSING ENGINE  
  // ======================================================================

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

      const widgetType = this.templateRenderer.escapeHtml(widget.type || 'Unknown Widget');
      const configText = widget.config ? this.templateRenderer.escapeHtml(JSON.stringify(widget.config, null, 2)) : '';

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
      element.innerHTML = `<div class="text-sm text-red-700">Widget Error: ${message}</div>`;
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
        <div class="text-xs text-gray-600">${this.templateRenderer.escapeHtml(this.currentVersion.description || 'No description')}</div>
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
    const publishedVersion = this.pageVersions.find(v => v.is_current_published);
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