/**
 * LayoutRendererWithWidgetFactory.js
 * Extended LayoutRenderer that integrates directly with React WidgetFactory components
 * 
 * This renderer extends the base LayoutRenderer but overrides widget rendering
 * to use React components instead of DOM manipulation.
 */

import LayoutRenderer from './LayoutRenderer';
import React from 'react';
import { createRoot } from 'react-dom/client';

class LayoutRendererWithWidgetFactory extends LayoutRenderer {
    constructor(options = {}) {
        super(options);

        // Store React-specific properties
        this.reactRoots = new Map(); // Map of widget IDs to React roots
        this.widgetFactoryComponent = null; // Will be set externally
        this.widgetActionHandlers = {
            onEdit: null,
            onDelete: null,
            onPreview: null
        };

        // Override parent cleanup behavior to avoid errors
        this.skipParentCleanupOnRender = true;
    }

    /**
     * Override render method to handle React cleanup properly
     * @param {Object} layoutJson - Layout JSON structure
     * @param {React.RefObject} containerRef - React ref to container element
     */
    render(layoutJson, containerRef) {
        try {
            // Clean up React roots before rendering
            this.cleanupReactRoots();

            // Call parent render without triggering problematic cleanup
            const originalCleanup = this.cleanup;
            this.cleanup = () => { }; // Temporarily disable cleanup

            super.render(layoutJson, containerRef);

            // Restore original cleanup
            this.cleanup = originalCleanup;

        } catch (error) {
            console.error('LayoutRendererWithWidgetFactory: Error during render', error);
            throw error;
        }
    }

    /**
     * Clean up only React roots without touching parent cleanup
     */
    cleanupReactRoots() {
        this.reactRoots.forEach((root, widgetId) => {
            try {
                root.unmount();
            } catch (error) {
                console.warn(`Error unmounting React root for widget ${widgetId}:`, error);
            }
        });
        this.reactRoots.clear();
    }

    /**
     * Set the WidgetFactory component to use for rendering
     * @param {React.Component} WidgetFactoryComponent - The WidgetFactory component
     */
    setWidgetFactoryComponent(WidgetFactoryComponent) {
        this.widgetFactoryComponent = WidgetFactoryComponent;
    }

    /**
     * Set widget action handlers
     * @param {Object} handlers - Object with onEdit, onDelete, onPreview functions
     */
    setWidgetActionHandlers(handlers) {
        this.widgetActionHandlers = { ...this.widgetActionHandlers, ...handlers };
    }

    /**
     * Override the renderWidget method to use WidgetFactory
     * @param {Object} widget - Widget configuration object
     * @returns {HTMLElement} DOM element containing the React-rendered widget
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

            // Use WidgetFactory if available
            if (this.widgetFactoryComponent) {

                return this.renderWidgetWithFactory(widget);
            }

            // No WidgetFactory available - this shouldn't happen

            const errorContainer = document.createElement('div');
            errorContainer.className = 'widget-factory-container widget-error';
            errorContainer.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div class="text-red-800 font-medium">Configuration Error</div>
                    <div class="text-red-600 text-sm mt-1">WidgetFactory component not set</div>
                </div>
            `;
            return errorContainer;

        } catch (error) {
            console.error('LayoutRendererWithWidgetFactory: Error rendering widget', error, widget);

            // Create error widget without falling back to legacy
            const errorContainer = document.createElement('div');
            errorContainer.className = 'widget-factory-container widget-error';
            errorContainer.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div class="text-red-800 font-medium">Widget Error</div>
                    <div class="text-red-600 text-sm mt-1">${error.message}</div>
                </div>
            `;
            return errorContainer;
        }
    }

    /**
     * Override renderWidgetInstance - this is the method actually called for slot widgets
     * @param {Object} widgetInstance - Widget instance to render
     * @returns {HTMLElement} DOM element containing the React-rendered widget
     */
    async renderWidgetInstance(widgetInstance) {
        try {
            // Use WidgetFactory if available
            if (this.widgetFactoryComponent) {
                return this.renderWidgetWithFactory(widgetInstance);
            }

            // No WidgetFactory available - this shouldn't happen

            const errorContainer = document.createElement('div');
            errorContainer.className = 'widget-factory-container widget-error';
            errorContainer.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div class="text-red-800 font-medium">Configuration Error</div>
                    <div class="text-red-600 text-sm mt-1">WidgetFactory component not set</div>
                </div>
            `;
            return errorContainer;

        } catch (error) {
            console.error('LayoutRendererWithWidgetFactory: Error rendering widget instance', error, widgetInstance);

            // Create error widget without falling back to legacy
            const errorContainer = document.createElement('div');
            errorContainer.className = 'widget-factory-container widget-error';
            errorContainer.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div class="text-red-800 font-medium">Widget Instance Error</div>
                    <div class="text-red-600 text-sm mt-1">${error.message}</div>
                </div>
            `;
            return errorContainer;
        }
    }

    /**
     * Render widget using React WidgetFactory
     * @param {Object} widget - Widget configuration object
     * @returns {HTMLElement} DOM element containing the React component
     */
    renderWidgetWithFactory(widget) {
        try {
            // Create container element
            const container = document.createElement('div');
            container.className = 'widget-factory-container';
            container.setAttribute('data-widget-id', widget.id || 'unknown');

            // Create React root
            const root = createRoot(container);

            // Render WidgetFactory component
            const WidgetFactoryComponent = this.widgetFactoryComponent;

            root.render(
                React.createElement(WidgetFactoryComponent, {
                    widget: widget,
                    slotName: widget.slotName || 'unknown',
                    index: 0, // LayoutRenderer doesn't track index
                    onEdit: this.widgetActionHandlers.onEdit,
                    onDelete: this.widgetActionHandlers.onDelete,
                    onPreview: null, // Disable preview button in PageEditor
                    mode: this.editable ? 'editor' : 'preview',
                    showControls: this.editable
                })
            );

            // Store root for cleanup
            this.reactRoots.set(widget.id || Date.now(), root);
            container._reactRoot = root;

            return container;

        } catch (error) {
            console.error('LayoutRendererWithWidgetFactory: Error rendering widget with factory', error);

            // Create error widget using WidgetFactory approach instead of falling back to legacy
            const errorContainer = document.createElement('div');
            errorContainer.className = 'widget-factory-container widget-error';
            errorContainer.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div class="text-red-800 font-medium">Widget Error</div>
                    <div class="text-red-600 text-sm mt-1">Failed to render widget: ${error.message}</div>
                </div>
            `;
            return errorContainer;
        }
    }

    /**
     * Override updateSlot to handle React component cleanup and placeholder visibility
     * @param {string} slotName - Name of the slot to update
     * @param {Array} widgets - Array of widget objects to render
     */
    async updateSlot(slotName, widgets = []) {
        // Clean up existing React roots in this slot
        const container = this.slotContainers.get(slotName);
        if (container) {
            const existingWidgets = container.querySelectorAll('.widget-factory-container');
            existingWidgets.forEach(widgetContainer => {
                if (widgetContainer._reactRoot) {
                    try {
                        widgetContainer._reactRoot.unmount();
                    } catch (error) {
                        console.warn('Error unmounting React root:', error);
                    }
                }
            });
        }

        // Call parent updateSlot method
        const result = await super.updateSlot(slotName, widgets);

        // Hide placeholder when widgets are present, show when empty
        if (container) {
            const placeholder = container.querySelector('.slot-placeholder');
            if (placeholder) {
                if (widgets && widgets.length > 0) {
                    placeholder.style.display = 'none';
                } else {
                    placeholder.style.display = 'block';
                }
            }
        }

        return result;
    }

    /**
     * Override cleanup method to handle React roots safely
     */
    cleanup() {
        // Only cleanup React roots, don't call parent cleanup which has issues
        this.cleanupReactRoots();
    }

    /**
     * Override destroy method to handle React roots
     */
    destroy() {
        try {
            // Cleanup React roots
            this.cleanupReactRoots();

            // Call parent destroy only if safe
            if (this.slotContainers && this.slotContainers.size > 0) {
                super.destroy();
            }
        } catch (error) {
            console.error('LayoutRendererWithWidgetFactory: Error during destroy', error);
        }
    }
}

export default LayoutRendererWithWidgetFactory;
