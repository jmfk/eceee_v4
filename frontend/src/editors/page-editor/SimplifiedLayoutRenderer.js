/**
 * SimplifiedLayoutRenderer - React-optimized layout renderer
 * 
 * This renderer processes simplified layout JSON (v2.0) that eliminates
 * Django template complexity and is designed for React widget integration.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { WidgetEventProvider } from '../../contexts/WidgetEventContext';

class SimplifiedLayoutRenderer {
    constructor(options = {}) {
        this.editable = options.editable || false;
        this.isDestroyed = false;

        // Track components and cleanup
        this.reactRoots = new Map();
        this.slotContainers = new Map();
        this.containerElement = null;

        // PageEditor context
        this.pageContext = {};
        this.widgetActionHandlers = {};
        this.pageEventSystem = null;
        this.PageWidgetFactoryComponent = null;
        this.currentWidgets = {};
        this.externalWidgetDataAccessor = null;
    }

    /**
     * Set PageEditor context
     */
    setPageContext(context) {
        this.pageContext = { ...this.pageContext, ...context };
    }

    /**
     * Set widget action handlers
     */
    setWidgetActionHandlers(handlers) {
        this.widgetActionHandlers = handlers;
    }

    /**
     * Set PageEditor event system
     */
    setPageEventSystem(eventSystem) {
        this.pageEventSystem = eventSystem;
    }

    /**
     * Set PageWidgetFactory component
     */
    setPageWidgetFactory(PageWidgetFactoryComponent) {
        this.PageWidgetFactoryComponent = PageWidgetFactoryComponent;
    }

    /**
     * Load widget data
     */
    loadWidgetData(widgets) {
        this.currentWidgets = widgets;
    }

    /**
     * Set widget data accessor (for compatibility with PageEditorCore)
     */
    setWidgetDataAccessor(accessor) {
        this.externalWidgetDataAccessor = accessor;
    }

    /**
     * Get widget data for a specific slot
     */
    getSlotWidgetData(slotName) {
        // Use external accessor if available, otherwise use stored data
        if (this.externalWidgetDataAccessor) {
            return this.externalWidgetDataAccessor(slotName);
        }
        return this.currentWidgets[slotName] || [];
    }

    /**
     * Main render method - process simplified layout JSON
     */
    async render(layoutJson, targetRef) {
        console.log('SimplifiedLayoutRenderer: Starting render with:', { layoutJson, targetRef: !!targetRef?.current });

        if (this.isDestroyed) {
            console.warn('SimplifiedLayoutRenderer: Cannot render on destroyed instance');
            return;
        }

        if (!targetRef || !targetRef.current) {
            console.warn('SimplifiedLayoutRenderer: Target ref is not available');
            return;
        }

        try {
            // Store container reference
            this.containerElement = targetRef.current;
            console.log('SimplifiedLayoutRenderer: Container element set');

            // Clear existing content
            this.cleanup(targetRef.current);
            console.log('SimplifiedLayoutRenderer: Container cleaned');

            // Check if we have a simplified layout or need to create a fallback
            let layoutToRender = layoutJson;

            // If layoutJson doesn't have the v2.0 structure, create a simple fallback
            if (!layoutJson || !layoutJson.version || layoutJson.version !== '2.0') {
                console.warn('SimplifiedLayoutRenderer: Layout is not v2.0 format, creating fallback');
                layoutToRender = this._createSimpleFallbackLayout(layoutJson);
            }

            console.log('SimplifiedLayoutRenderer: Layout to render:', layoutToRender);

            // Validate layout JSON
            if (!this._validateLayoutJson(layoutToRender)) {
                console.error('SimplifiedLayoutRenderer: Layout validation failed');
                throw new Error('Invalid simplified layout JSON');
            }

            // Render based on layout type
            console.log(`SimplifiedLayoutRenderer: Rendering ${layoutToRender.type} layout`);
            switch (layoutToRender.type) {
                case 'css-grid':
                    await this._renderCssGridLayout(layoutToRender, targetRef.current);
                    break;
                case 'flexbox':
                    await this._renderFlexboxLayout(layoutToRender, targetRef.current);
                    break;
                case 'custom':
                    await this._renderCustomLayout(layoutToRender, targetRef.current);
                    break;
                default:
                    console.error(`SimplifiedLayoutRenderer: Unsupported layout type: ${layoutToRender.type}`);
                    throw new Error(`Unsupported layout type: ${layoutToRender.type}`);
            }

            console.log(`SimplifiedLayoutRenderer: Successfully rendered ${layoutToRender.name} layout`);

        } catch (error) {
            console.error('SimplifiedLayoutRenderer: Error rendering layout:', error);
            this._renderErrorLayout(targetRef.current, error.message);
        }
    }

    /**
     * Render CSS Grid layout
     */
    async _renderCssGridLayout(layoutJson, container) {
        console.log('SimplifiedLayoutRenderer: Rendering CSS Grid layout');
        const { structure, slots } = layoutJson;

        // Create grid container
        const gridContainer = document.createElement('div');
        gridContainer.className = 'simplified-layout-grid';

        console.log('SimplifiedLayoutRenderer: Grid structure:', structure);

        // Apply CSS Grid styles
        const gridStyles = {
            display: 'grid',
            gridTemplateColumns: structure.gridTemplateColumns || '1fr',
            gridTemplateRows: structure.gridTemplateRows || 'auto',
            gap: structure.gap || '1.5rem',
            padding: structure.padding || '1.5rem',
            minHeight: structure.minHeight || '100vh',
            backgroundColor: '#f9fafb' // Light background to make it visible
        };

        Object.assign(gridContainer.style, gridStyles);
        console.log('SimplifiedLayoutRenderer: Applied grid styles:', gridStyles);

        // Set grid template areas if specified
        if (structure.gridTemplateAreas && Array.isArray(structure.gridTemplateAreas)) {
            gridContainer.style.gridTemplateAreas =
                structure.gridTemplateAreas.map(area => `"${area}"`).join(' ');
            console.log('SimplifiedLayoutRenderer: Set grid areas:', gridContainer.style.gridTemplateAreas);
        }

        // Create slot elements
        console.log('SimplifiedLayoutRenderer: Creating slots:', slots);
        for (const slot of slots) {
            console.log('SimplifiedLayoutRenderer: Creating slot:', slot.name);
            const slotElement = await this._createSlotElement(slot);
            gridContainer.appendChild(slotElement);
            console.log('SimplifiedLayoutRenderer: Slot element created and added:', slot.name);
        }

        container.appendChild(gridContainer);
        console.log('SimplifiedLayoutRenderer: Grid container added to parent');
    }

    /**
     * Render Flexbox layout
     */
    async _renderFlexboxLayout(layoutJson, container) {
        const { structure, slots } = layoutJson;

        // Create flex container
        const flexContainer = document.createElement('div');
        flexContainer.className = 'simplified-layout-flex';

        // Apply Flexbox styles
        Object.assign(flexContainer.style, {
            display: 'flex',
            flexDirection: structure.flexDirection || 'column',
            gap: structure.gap || '2rem',
            maxWidth: structure.maxWidth || '1024px',
            margin: structure.margin || '0 auto',
            padding: structure.padding || '2rem',
            minHeight: structure.minHeight || '100vh'
        });

        // Create slot elements
        for (const slot of slots) {
            const slotElement = await this._createSlotElement(slot);
            flexContainer.appendChild(slotElement);
        }

        container.appendChild(flexContainer);
    }

    /**
     * Render custom layout
     */
    async _renderCustomLayout(layoutJson, container) {
        const { structure, slots } = layoutJson;

        if (structure.html) {
            // Create layout from HTML string
            container.innerHTML = structure.html;

            // Apply custom CSS if provided
            if (structure.css) {
                const style = document.createElement('style');
                style.textContent = structure.css;
                document.head.appendChild(style);
            }
        } else {
            // Fallback to flexbox
            await this._renderFlexboxLayout(layoutJson, container);
        }

        // Create slot elements in specified containers
        for (const slot of slots) {
            const slotContainer = slot.container ?
                container.querySelector(slot.container) : container;

            if (slotContainer) {
                const slotElement = await this._createSlotElement(slot);
                slotContainer.appendChild(slotElement);
            }
        }
    }

    /**
     * Create a slot element with widgets
     */
    async _createSlotElement(slot) {
        console.log('SimplifiedLayoutRenderer: Creating slot element for:', slot);

        const slotElement = document.createElement('div');

        // Set slot attributes
        slotElement.setAttribute('data-widget-slot', slot.name);
        slotElement.setAttribute('data-slot-label', slot.label);
        slotElement.className = slot.className || `slot-${slot.name}`;

        // Apply grid area if specified
        if (slot.area) {
            slotElement.style.gridArea = slot.area;
            console.log('SimplifiedLayoutRenderer: Set grid area:', slot.area);
        }

        // Apply slot styles
        if (slot.style && typeof slot.style === 'object') {
            Object.assign(slotElement.style, slot.style);
            console.log('SimplifiedLayoutRenderer: Applied slot styles:', slot.style);
        }

        // Add minimum height and border for visibility
        slotElement.style.minHeight = '100px';
        slotElement.style.border = '2px dashed #d1d5db';
        slotElement.style.borderRadius = '0.5rem';

        console.log('SimplifiedLayoutRenderer: Slot element styled');

        // Store slot container
        this.slotContainers.set(slot.name, slotElement);

        // Add slot header if in edit mode
        if (this.editable) {
            const slotHeader = this._createSlotHeader(slot);
            slotElement.appendChild(slotHeader);
            console.log('SimplifiedLayoutRenderer: Slot header added');
        }

        // Render widgets in this slot
        const widgets = this.getSlotWidgetData(slot.name);
        console.log('SimplifiedLayoutRenderer: Widgets for slot', slot.name, ':', widgets);

        for (let i = 0; i < widgets.length; i++) {
            const widget = { ...widgets[i], slotName: slot.name };
            console.log('SimplifiedLayoutRenderer: Rendering widget:', widget);
            try {
                const widgetElement = await this._renderWidget(widget, i, widgets);
                if (widgetElement) {
                    slotElement.appendChild(widgetElement);
                    console.log('SimplifiedLayoutRenderer: Widget element added to slot');
                }
            } catch (error) {
                console.error('SimplifiedLayoutRenderer: Error rendering widget:', error);
                const errorElement = this._createErrorWidget(error.message);
                slotElement.appendChild(errorElement);
            }
        }

        // Add empty slot placeholder if no widgets and in edit mode
        if (this.editable && widgets.length === 0) {
            const placeholder = this._createEmptySlotPlaceholder(slot);
            slotElement.appendChild(placeholder);
            console.log('SimplifiedLayoutRenderer: Empty slot placeholder added');
        }

        console.log('SimplifiedLayoutRenderer: Slot element complete:', slotElement);
        return slotElement;
    }

    /**
     * Create slot header for edit mode
     */
    _createSlotHeader(slot) {
        const header = document.createElement('div');
        header.className = 'slot-header bg-gray-100 border border-gray-300 rounded-t-lg px-4 py-2 text-sm font-medium text-gray-700';
        header.innerHTML = `
            <div class="flex items-center justify-between">
                <span>${slot.label}</span>
                <span class="text-xs text-gray-500">
                    ${this.getSlotWidgetData(slot.name).length}/${slot.maxWidgets || '∞'} widgets
                </span>
            </div>
        `;
        return header;
    }

    /**
     * Create empty slot placeholder
     */
    _createEmptySlotPlaceholder(slot) {
        const placeholder = document.createElement('div');
        placeholder.className = 'empty-slot-placeholder border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500';
        placeholder.innerHTML = `
            <div class="text-gray-400 mb-2">
                <svg class="h-8 w-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
            </div>
            <p class="text-sm font-medium">${slot.label}</p>
            <p class="text-xs mt-1">${slot.description}</p>
            <p class="text-xs mt-2 text-blue-600">Click to add widgets</p>
        `;
        return placeholder;
    }

    /**
     * Render a widget using PageWidgetFactory
     */
    async _renderWidget(widget, index, slotWidgets) {
        if (!this.PageWidgetFactoryComponent) {
            throw new Error('PageWidgetFactory component not set');
        }

        try {
            // Create container for widget
            const container = document.createElement('div');
            container.className = 'simplified-widget-container';

            // Create React root
            const root = createRoot(container);

            // Store root for cleanup
            this.reactRoots.set(widget.id, root);

            // Create PageWidgetFactory component
            const component = React.createElement(this.PageWidgetFactoryComponent, {
                key: widget.id,
                widget: widget,
                slotName: widget.slotName,
                index: index,
                onEdit: this.widgetActionHandlers.onEdit,
                onDelete: this.widgetActionHandlers.onDelete,
                onMoveUp: this.widgetActionHandlers.onMoveUp,
                onMoveDown: this.widgetActionHandlers.onMoveDown,
                onConfigChange: this.widgetActionHandlers.onConfigChange,
                canMoveUp: index > 0,
                canMoveDown: index < slotWidgets.length - 1,
                mode: this.editable ? 'editor' : 'preview',
                showControls: this.editable,
                // PageEditor-specific props
                versionId: this.pageContext.versionId,
                isPublished: this.pageContext.isPublished,
                onVersionChange: this.widgetActionHandlers.onVersionChange,
                onPublishingAction: this.widgetActionHandlers.onPublishingAction
            });

            // Wrap with event provider
            const wrappedComponent = this.pageEventSystem ?
                React.createElement(
                    WidgetEventProvider,
                    { sharedEventBus: this.pageEventSystem },
                    component
                ) : component;

            // Render component
            root.render(wrappedComponent);

            return container;

        } catch (error) {
            console.error('SimplifiedLayoutRenderer: Error rendering widget:', error);
            return this._createErrorWidget(`Widget render error: ${error.message}`);
        }
    }

    /**
     * Update a specific slot with new widgets
     */
    async updateSlot(slotName, widgets) {
        const slotElement = this.slotContainers.get(slotName);
        if (!slotElement) {
            console.warn('SimplifiedLayoutRenderer: Slot not found for update:', slotName);
            return;
        }

        // Clear existing widgets (keep slot header if present)
        const slotHeader = slotElement.querySelector('.slot-header');
        slotElement.innerHTML = '';
        if (slotHeader) {
            slotElement.appendChild(slotHeader);
        }

        // Render new widgets
        for (let i = 0; i < widgets.length; i++) {
            const widget = { ...widgets[i], slotName };
            try {
                const widgetElement = await this._renderWidget(widget, i, widgets);
                if (widgetElement) {
                    slotElement.appendChild(widgetElement);
                }
            } catch (error) {
                console.error('SimplifiedLayoutRenderer: Error rendering widget in updateSlot:', error);
                const errorElement = this._createErrorWidget(`Widget render error: ${error.message}`);
                slotElement.appendChild(errorElement);
            }
        }

        // Add empty placeholder if no widgets and in edit mode
        if (this.editable && widgets.length === 0) {
            const slot = this._findSlotConfig(slotName);
            if (slot) {
                const placeholder = this._createEmptySlotPlaceholder(slot);
                slotElement.appendChild(placeholder);
            }
        }
    }

    /**
     * Find slot configuration by name
     */
    _findSlotConfig(slotName) {
        // This would need to be stored from the original layout JSON
        // For now, return a basic config
        return {
            name: slotName,
            label: slotName.charAt(0).toUpperCase() + slotName.slice(1),
            description: `Content area for ${slotName}`,
            maxWidgets: 10
        };
    }

    /**
     * Create error widget element
     */
    _createErrorWidget(errorMessage) {
        const errorElement = document.createElement('div');
        errorElement.className = 'widget-error bg-red-50 border border-red-200 rounded p-4 m-2';
        errorElement.innerHTML = `
            <div class="flex items-center space-x-2">
                <div class="bg-red-100 rounded-full w-6 h-6 flex items-center justify-center">
                    <span class="text-red-600 text-sm">!</span>
                </div>
                <div>
                    <div class="text-sm font-medium text-red-800">Widget Error</div>
                    <div class="text-xs text-red-600">${errorMessage}</div>
                </div>
            </div>
        `;
        return errorElement;
    }

    /**
     * Render error layout when rendering fails
     */
    _renderErrorLayout(container, errorMessage) {
        container.innerHTML = '';
        const errorLayout = document.createElement('div');
        errorLayout.className = 'error-layout bg-red-50 border border-red-200 rounded p-6 text-center';
        errorLayout.innerHTML = `
            <div class="text-red-600 mb-4">
                <svg class="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            </div>
            <h3 class="text-lg font-medium text-red-800 mb-2">Layout Rendering Error</h3>
            <p class="text-sm text-red-600">${errorMessage}</p>
        `;
        container.appendChild(errorLayout);
    }

    /**
     * Create a simple fallback layout for any input
     */
    _createSimpleFallbackLayout(originalLayout) {
        console.log('SimplifiedLayoutRenderer: Creating simple fallback layout');

        return {
            name: originalLayout?.layout?.name || originalLayout?.name || 'fallback',
            label: 'Fallback Layout',
            description: 'Simple fallback layout with main content area',
            version: '2.0',
            type: 'flexbox',
            structure: {
                display: 'flex',
                flexDirection: 'column',
                gap: '2rem',
                maxWidth: '1024px',
                margin: '0 auto',
                padding: '2rem',
                minHeight: '100vh'
            },
            slots: [
                {
                    name: 'main',
                    label: 'Main Content',
                    description: 'Primary content area',
                    required: true,
                    maxWidgets: 20,
                    allowedWidgetTypes: ['*'],
                    className: 'main-slot bg-white p-6 rounded-lg shadow border border-gray-200',
                    style: {
                        flex: '1',
                        backgroundColor: '#ffffff',
                        padding: '2rem',
                        borderRadius: '0.75rem',
                        border: '1px solid #e5e7eb',
                        minHeight: '400px'
                    }
                }
            ],
            css: {
                framework: 'tailwind',
                customClasses: ['layout-fallback']
            },
            metadata: {
                source: 'fallback',
                originalLayout: originalLayout
            }
        };
    }

    /**
     * Validate simplified layout JSON
     */
    _validateLayoutJson(layoutJson) {
        console.log('SimplifiedLayoutRenderer: Validating layout JSON:', layoutJson);

        if (!layoutJson || typeof layoutJson !== 'object') {
            console.error('SimplifiedLayoutRenderer: Layout JSON is not an object');
            return false;
        }

        // Check required fields
        const required = ['name', 'type', 'structure', 'slots'];
        for (const field of required) {
            if (!layoutJson[field]) {
                console.error(`SimplifiedLayoutRenderer: Missing required field: ${field}`);
                return false;
            }
        }

        // Validate version
        if (layoutJson.version !== '2.0') {
            console.warn(`SimplifiedLayoutRenderer: Unexpected version: ${layoutJson.version}`);
        }

        console.log('SimplifiedLayoutRenderer: Layout validation passed');
        return true;
    }

    /**
     * Cleanup method
     */
    cleanup(container = null) {
        try {
            // Clean up React roots
            this.reactRoots.forEach((root, widgetId) => {
                try {
                    root.unmount();
                } catch (error) {
                    console.warn('SimplifiedLayoutRenderer: Error unmounting React root:', widgetId, error);
                }
            });
            this.reactRoots.clear();

            // Clear container if provided
            if (container && container.nodeType === Node.ELEMENT_NODE) {
                try {
                    while (container.firstChild) {
                        container.removeChild(container.firstChild);
                    }
                } catch (error) {
                    console.warn('SimplifiedLayoutRenderer: Error during container cleanup:', error);
                    container.innerHTML = '';
                }
            }

            // Clear internal state
            this.slotContainers.clear();
            this.currentWidgets = {};

        } catch (error) {
            console.error('SimplifiedLayoutRenderer: Error during cleanup:', error);
        }
    }

    /**
     * Mark renderer as clean (for save operations)
     */
    markAsClean() {
        this.isDirty = false;

        if (this.pageEventSystem) {
            this.pageEventSystem.emitPageSaved(
                { clean: true },
                {
                    versionId: this.pageContext.versionId,
                    isPublished: this.pageContext.isPublished,
                    pageId: this.pageContext.pageId,
                    renderer: 'simplified'
                }
            );
        }
    }

    /**
     * Check if renderer is destroyed
     */
    isDestroyed() {
        return this.isDestroyed;
    }

    /**
     * Destroy renderer and cleanup resources
     */
    destroy() {
        this.cleanup();
        this.isDestroyed = true;
        this.pageEventSystem = null;
        this.PageWidgetFactoryComponent = null;
        this.widgetActionHandlers = {};
        this.pageContext = {};
    }
}

export default SimplifiedLayoutRenderer;
