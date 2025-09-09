/**
 * PageLayoutRendererWithReact - Hybrid layout renderer for PageEditor
 * 
 * This extends the base LayoutRenderer to keep all layout functionality
 * but overrides widget rendering to use PageWidgetFactory with shared React widgets.
 */

import LayoutRenderer from '../../components/LayoutRenderer';
import { renderPageWidgetToDOM } from './reactToDomRenderer';

class PageLayoutRendererWithReact extends LayoutRenderer {
    constructor(options = {}) {
        super(options);

        // PageEditor-specific properties
        this.pageContext = {
            versionId: null,
            isPublished: false,
            pageId: null,
            currentVersion: null,
            availableVersions: []
        };

        this.pageEventSystem = null;
        this.widgetActionHandlers = {};
        this.reactRoots = new Map(); // Track React roots for cleanup
        this.currentWidgetData = {}; // Store current widget data
        this.externalWidgetDataAccessor = null; // External widget data accessor
        this.slotContainers = new Map(); // Track slot containers
        this.slotConfigs = new Map(); // Track slot configurations
        this.PageWidgetFactoryComponent = null; // Store PageWidgetFactory component
        this.containerElement = null; // Store container element reference
    }

    /**
     * Set PageEditor-specific context
     */
    setPageContext(context) {
        this.pageContext = { ...this.pageContext, ...context };
    }

    /**
     * Set PageEditor event system
     */
    setPageEventSystem(eventSystem) {
        this.pageEventSystem = eventSystem;
    }

    /**
     * Set widget action handlers for PageWidgetFactory
     */
    setWidgetActionHandlers(handlers) {
        this.widgetActionHandlers = handlers;
    }

    /**
     * Set PageWidgetFactory component
     */
    setPageWidgetFactory(PageWidgetFactoryComponent) {
        this.PageWidgetFactoryComponent = PageWidgetFactoryComponent;
    }

    /**
     * Override widget rendering to use PageWidgetFactory with React widgets
     * This is the key method that replaces Django template rendering with React
     */
    async renderWidget(widget) {
        try {
            // Validate widget object
            if (!widget || typeof widget !== 'object') {
                throw new Error('Invalid widget object');
            }

            if (!widget.type || typeof widget.type !== 'string') {
                throw new Error('Widget missing valid type');
            }

            if (!this.PageWidgetFactoryComponent) {
                throw new Error('PageWidgetFactory component not set');
            }

            // Get slot widgets for move button state
            const slotName = widget.slotName || 'main';
            const slotWidgets = this.getSlotWidgetData(slotName) || [];
            const widgetIndex = slotWidgets.findIndex(w => w.id === widget.id);

            // Import the renderPageWidgetToDOM function
            const { renderPageWidgetToDOM } = await import('./reactToDomRenderer');

            // Render React widget to DOM using PageWidgetFactory
            const renderResult = renderPageWidgetToDOM(widget, {
                slotName: slotName,
                index: widgetIndex,
                onEdit: this.widgetActionHandlers.onEdit,
                onDelete: this.widgetActionHandlers.onDelete,
                onMoveUp: this.widgetActionHandlers.onMoveUp,
                onMoveDown: this.widgetActionHandlers.onMoveDown,
                onConfigChange: this.widgetActionHandlers.onConfigChange,
                canMoveUp: widgetIndex > 0,
                canMoveDown: widgetIndex < slotWidgets.length - 1,
                // PageEditor-specific props
                versionId: this.pageContext.versionId,
                isPublished: this.pageContext.isPublished,
                onVersionChange: this.widgetActionHandlers.onVersionChange,
                onPublishingAction: this.widgetActionHandlers.onPublishingAction
            }, this.pageEventSystem, this.PageWidgetFactoryComponent);

            // Store React root for cleanup
            if (renderResult.root && widget.id) {
                this.reactRoots.set(widget.id, renderResult.root);
            }

            // Return the DOM element (LayoutRenderer expects HTMLElement)
            return renderResult.element;

        } catch (error) {
            console.error('PageLayoutRendererWithReact: Error rendering widget', error, widget);
            return this.createErrorWidgetElement(`React widget render error: ${error.message}`);
        }
    }

    /**
     * Create error widget element (fallback for failed renders)
     */
    createErrorWidgetElement(errorMessage) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'page-widget-error bg-red-50 border border-red-200 rounded p-4 m-2';
        errorDiv.innerHTML = `
            <div class="flex items-center space-x-2">
                <div class="bg-red-100 rounded-full w-6 h-6 flex items-center justify-center">
                    <span class="text-red-600 text-sm">!</span>
                </div>
                <div>
                    <div class="text-sm font-medium text-red-800">PageEditor Widget Error</div>
                    <div class="text-xs text-red-600">${errorMessage}</div>
                </div>
            </div>
        `;
        return errorDiv;
    }

    /**
     * Get widget data for a specific slot
     */
    getSlotWidgetData(slotName) {
        // Use stored widget data or external accessor
        if (this.currentWidgetData && this.currentWidgetData[slotName]) {
            return this.currentWidgetData[slotName];
        }

        // Fallback to external accessor if available
        if (this.externalWidgetDataAccessor) {
            return this.externalWidgetDataAccessor(slotName);
        }

        return [];
    }

    /**
     * Override cleanup to handle React roots and prevent base cleanup errors
     */
    cleanup(container = null) {
        try {
            // Clean up React roots first
            this.reactRoots.forEach((root, widgetId) => {
                try {
                    root.unmount();
                } catch (error) {
                    console.warn('PageLayoutRendererWithReact: Error unmounting React root for widget:', widgetId, error);
                }
            });
            this.reactRoots.clear();

            // Safe container cleanup (avoid base LayoutRenderer cleanup issues)
            if (container && container.nodeType === Node.ELEMENT_NODE) {
                try {
                    // Safe cleanup approach
                    while (container.firstChild) {
                        container.removeChild(container.firstChild);
                    }
                } catch (error) {
                    console.warn('PageLayoutRendererWithReact: Error during container cleanup, using fallback:', error);
                    try {
                        container.innerHTML = '';
                    } catch (fallbackError) {
                        console.warn('PageLayoutRendererWithReact: Fallback cleanup also failed:', fallbackError);
                    }
                }
            }

            // Clear internal maps safely
            if (this.slotContainers) {
                this.slotContainers.clear();
            }
            if (this.slotConfigs) {
                this.slotConfigs.clear();
            }
            if (this.eventListeners) {
                this.eventListeners.clear();
            }

        } catch (error) {
            console.error('PageLayoutRendererWithReact: Error during cleanup:', error);
        }

        // Clear PageEditor-specific data
        this.pageContext = {
            versionId: null,
            isPublished: false,
            pageId: null,
            currentVersion: null,
            availableVersions: []
        };
        this.pageEventSystem = null;
        this.widgetActionHandlers = {};
        this.isDestroyed = true;
    }

    /**
     * Update widget with React re-rendering
     */
    updateWidgetReact(widget) {
        const existingRoot = this.reactRoots.get(widget.id);
        if (existingRoot) {
            // Re-render the existing widget
            const slotName = widget.slotName || 'main';
            const slotWidgets = this.getSlotWidgetData(slotName) || [];
            const widgetIndex = slotWidgets.findIndex(w => w.id === widget.id);

            // Import PageWidgetFactory
            const PageWidgetFactory = require('./PageWidgetFactory').default;

            const component = React.createElement(PageWidgetFactory, {
                widget,
                slotName: slotName,
                index: widgetIndex,
                onEdit: this.widgetActionHandlers.onEdit,
                onDelete: this.widgetActionHandlers.onDelete,
                onMoveUp: this.widgetActionHandlers.onMoveUp,
                onMoveDown: this.widgetActionHandlers.onMoveDown,
                onConfigChange: this.widgetActionHandlers.onConfigChange,
                canMoveUp: widgetIndex > 0,
                canMoveDown: widgetIndex < slotWidgets.length - 1,
                mode: 'editor',
                showControls: this.editable,
                // PageEditor-specific props
                versionId: this.pageContext.versionId,
                isPublished: this.pageContext.isPublished,
                onVersionChange: this.widgetActionHandlers.onVersionChange,
                onPublishingAction: this.widgetActionHandlers.onPublishingAction
            });

            const wrappedComponent = this.pageEventSystem ?
                React.createElement(
                    require('../../contexts/WidgetEventContext').WidgetEventProvider,
                    { sharedEventBus: this.pageEventSystem },
                    component
                ) : component;

            existingRoot.render(wrappedComponent);
        }
    }

    /**
     * Set widget data accessor (called by PageEditorCore)
     */
    setWidgetDataAccessor(accessor) {
        this.externalWidgetDataAccessor = accessor;
    }

    /**
     * Override render method to avoid base LayoutRenderer cleanup issues
     */
    async render(layout, targetRef) {
        if (this.isDestroyed) {
            console.warn('PageLayoutRendererWithReact: Cannot render on destroyed instance');
            return;
        }

        if (!targetRef || !targetRef.current) {
            console.warn('PageLayoutRendererWithReact: Target ref is not available');
            return;
        }

        try {
            // Store container element reference
            this.containerElement = targetRef.current;

            // Safe cleanup of container without calling full cleanup
            this.safeContainerCleanup(targetRef.current);

            // Reset internal maps
            if (this.slotContainers) {
                this.slotContainers.clear();
            }
            if (this.slotConfigs) {
                this.slotConfigs.clear();
            }

            // DON'T call parent render - it uses Django templates
            // Instead, create our own React-based layout rendering
            await this.renderLayoutWithReactWidgets(layout, targetRef.current);

        } catch (error) {
            console.error('PageLayoutRendererWithReact: Error in render method:', error);
            this.createErrorLayout(targetRef.current, error.message);
        }
    }

    /**
     * Render layout using React widgets (no Django templates)
     */
    async renderLayoutWithReactWidgets(layout, container) {
        try {
            // Create layout structure
            const layoutElement = this.createLayoutStructure(layout);
            container.appendChild(layoutElement);

            // Find and render widgets in slots
            const slots = this.findSlotsInLayout(layoutElement);

            for (const [slotName, slotElement] of slots) {
                const slotWidgets = this.getSlotWidgetData(slotName) || [];

                // Store slot container for future updates
                this.slotContainers.set(slotName, slotElement);

                // Render widgets in this slot
                for (let i = 0; i < slotWidgets.length; i++) {
                    const widget = { ...slotWidgets[i], slotName };
                    try {
                        const widgetElement = await this.renderWidget(widget);
                        if (widgetElement) {
                            slotElement.appendChild(widgetElement);
                        }
                    } catch (widgetError) {
                        console.error('PageLayoutRendererWithReact: Error rendering widget:', widgetError);
                        const errorElement = this.createErrorWidgetElement(`Widget render error: ${widgetError.message}`);
                        slotElement.appendChild(errorElement);
                    }
                }
            }

        } catch (error) {
            console.error('PageLayoutRendererWithReact: Error in renderLayoutWithReactWidgets:', error);
            throw error;
        }
    }

    /**
     * Create basic layout structure from layout JSON (no Django templates)
     */
    createLayoutStructure(layout) {
        const layoutContainer = document.createElement('div');
        layoutContainer.className = 'page-layout-container';

        // Handle different layout JSON formats
        if (layout.structure) {
            // Parse layout structure recursively
            const structureElement = this.createElementFromStructure(layout.structure);
            layoutContainer.appendChild(structureElement);
        } else {
            // Simple fallback layout
            const mainSlot = document.createElement('div');
            mainSlot.className = 'layout-slot main-slot';
            mainSlot.setAttribute('data-widget-slot', 'main');
            layoutContainer.appendChild(mainSlot);
        }

        return layoutContainer;
    }

    /**
     * Create DOM element from layout structure (simplified, no Django templates)
     */
    createElementFromStructure(structure) {
        if (!structure || typeof structure !== 'object') {
            return document.createElement('div');
        }

        const element = document.createElement(structure.tag || 'div');

        // Add attributes safely (no Django template processing)
        if (structure.attributes) {
            Object.entries(structure.attributes).forEach(([key, value]) => {
                try {
                    // Only set safe, simple attributes
                    if (typeof value === 'string' && key.match(/^[a-zA-Z-]+$/)) {
                        element.setAttribute(key, value);
                    }
                } catch (error) {
                    console.warn('PageLayoutRendererWithReact: Skipping unsafe attribute:', key, value);
                }
            });
        }

        // Add CSS classes
        if (structure.class) {
            element.className = structure.class;
        }

        // Process children recursively
        if (structure.children && Array.isArray(structure.children)) {
            structure.children.forEach(child => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else {
                    element.appendChild(this.createElementFromStructure(child));
                }
            });
        }

        return element;
    }

    /**
     * Find widget slots in the layout
     */
    findSlotsInLayout(layoutElement) {
        const slots = new Map();

        // Find all elements with data-widget-slot attribute
        const slotElements = layoutElement.querySelectorAll('[data-widget-slot]');

        slotElements.forEach(slotElement => {
            const slotName = slotElement.getAttribute('data-widget-slot');
            if (slotName) {
                slots.set(slotName, slotElement);
            }
        });

        // If no slots found, create a default main slot
        if (slots.size === 0) {
            const defaultSlot = document.createElement('div');
            defaultSlot.className = 'layout-slot default-slot';
            defaultSlot.setAttribute('data-widget-slot', 'main');
            layoutElement.appendChild(defaultSlot);
            slots.set('main', defaultSlot);
        }

        return slots;
    }

    /**
     * Update a specific slot with new widget data
     */
    async updateSlot(slotName, widgets) {
        let slotElement = this.slotContainers.get(slotName);
        
        // If slot doesn't exist, try to find it or create it
        if (!slotElement) {
            // Try to find the slot in the DOM
            if (this.containerElement) {
                slotElement = this.containerElement.querySelector(`[data-widget-slot="${slotName}"]`);
                if (slotElement) {
                    this.slotContainers.set(slotName, slotElement);
                }
            }
        }

        // If still not found, create a default slot
        if (!slotElement) {
            console.warn('PageLayoutRendererWithReact: Creating default slot for:', slotName);
            slotElement = document.createElement('div');
            slotElement.className = 'layout-slot default-slot';
            slotElement.setAttribute('data-widget-slot', slotName);
            
            // Add to container if available
            if (this.containerElement) {
                this.containerElement.appendChild(slotElement);
                this.slotContainers.set(slotName, slotElement);
            } else {
                console.warn('PageLayoutRendererWithReact: No container available for default slot');
                return;
            }
        }

        // Clear existing widgets in slot
        this.safeContainerCleanup(slotElement);

        // Render new widgets
        for (let i = 0; i < widgets.length; i++) {
            const widget = { ...widgets[i], slotName };
            try {
                const widgetElement = await this.renderWidget(widget);
                if (widgetElement) {
                    slotElement.appendChild(widgetElement);
                }
            } catch (error) {
                console.error('PageLayoutRendererWithReact: Error rendering widget in updateSlot:', error);
                const errorElement = this.createErrorWidgetElement(`Widget render error: ${error.message}`);
                slotElement.appendChild(errorElement);
            }
        }
    }

    /**
     * Load widget data (for compatibility with base LayoutRenderer interface)
     */
    loadWidgetData(widgets) {
        // Store widgets for access by getSlotWidgetData
        this.currentWidgetData = widgets;
    }

    /**
     * Safe container cleanup without calling parent cleanup
     */
    safeContainerCleanup(container) {
        if (!container || container.nodeType !== Node.ELEMENT_NODE) {
            return;
        }

        try {
            // Clean up React roots first
            this.reactRoots.forEach((root, widgetId) => {
                try {
                    root.unmount();
                } catch (error) {
                    console.warn('PageLayoutRendererWithReact: Error unmounting React root during container cleanup:', widgetId, error);
                }
            });
            this.reactRoots.clear();

            // Safe DOM cleanup
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
        } catch (error) {
            console.warn('PageLayoutRendererWithReact: Error during safe container cleanup, using fallback:', error);
            try {
                container.innerHTML = '';
            } catch (fallbackError) {
                console.warn('PageLayoutRendererWithReact: Fallback container cleanup also failed:', fallbackError);
            }
        }
    }

    /**
     * Create a simple fallback layout when base LayoutRenderer fails
     */
    createFallbackLayout(container, layout) {
        const fallbackDiv = document.createElement('div');
        fallbackDiv.className = 'page-layout-fallback p-4 border border-yellow-300 bg-yellow-50 rounded';
        fallbackDiv.innerHTML = `
            <div class="text-yellow-800">
                <div class="font-medium">Layout Fallback Mode</div>
                <div class="text-sm mt-1">Using simplified layout due to rendering issues</div>
            </div>
        `;
        container.appendChild(fallbackDiv);
    }

    /**
     * Create error layout when rendering completely fails
     */
    createErrorLayout(container, errorMessage) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'page-layout-error p-4 border border-red-300 bg-red-50 rounded';
        errorDiv.innerHTML = `
            <div class="text-red-800">
                <div class="font-medium">Layout Rendering Error</div>
                <div class="text-sm mt-1">${errorMessage}</div>
            </div>
        `;
        container.appendChild(errorDiv);
    }

    /**
     * Mark as clean after successful save
     */
    markAsClean() {
        this.isDirty = false;

        // Emit clean state event
        if (this.pageEventSystem) {
            this.pageEventSystem.emitPageSaved(
                { clean: true },
                {
                    versionId: this.pageContext.versionId,
                    isPublished: this.pageContext.isPublished,
                    pageId: this.pageContext.pageId
                }
            );
        }
    }
}

export default PageLayoutRendererWithReact;
