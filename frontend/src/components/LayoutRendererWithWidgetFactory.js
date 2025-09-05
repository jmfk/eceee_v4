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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationProvider } from './NotificationManager';
import { GlobalNotificationProvider } from '../contexts/GlobalNotificationContext';

class LayoutRendererWithWidgetFactory extends LayoutRenderer {
    constructor(options = {}) {
        super(options);

        // Store React-specific properties
        // Note: Individual React roots are stored on each container as container._reactRoot
        this.widgetFactoryComponent = null; // Will be set externally
        this.widgetActionHandlers = {
            onEdit: null,
            onDelete: null,
            onMoveUp: null,
            onMoveDown: null
        };

        // Track slots currently being updated to prevent overlapping updates
        this.slotsBeingUpdated = new Set();

        // Create a QueryClient for isolated React roots
        this.queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: 1,
                    refetchOnWindowFocus: false,
                    staleTime: 5 * 60 * 1000, // 5 minutes
                },
            },
        });
    }

    /**
     * Create a provider wrapper component for isolated React roots
     * @param {React.Component} children - The component to wrap
     * @returns {React.Element} Wrapped component with providers
     */
    createProviderWrapper(children) {
        return React.createElement(
            QueryClientProvider,
            { client: this.queryClient },
            React.createElement(
                GlobalNotificationProvider,
                {},
                React.createElement(
                    NotificationProvider,
                    {},
                    children
                )
            )
        );
    }

    /**
     * Override render method to handle React cleanup properly
     * @param {Object} layoutJson - Layout JSON structure
     * @param {React.RefObject} containerRef - React ref to container element
     */
    render(layoutJson, containerRef) {
        try {
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
     * Clean up React roots by finding them in the DOM
     */
    cleanupReactRoots() {
        // Find all widget containers with React roots
        const allWidgetContainers = document.querySelectorAll('.widget-factory-container[data-widget-key]');

        allWidgetContainers.forEach(container => {
            if (container._reactRoot) {
                try {
                    container._reactRoot.unmount();
                    container._reactRoot = null;
                } catch (error) {
                    console.warn('Error unmounting React root:', error);
                }
            }
        });
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
     * @param {Object} handlers - Object with onEdit, onDelete functions
     */
    setWidgetActionHandlers(handlers) {
        this.widgetActionHandlers = { ...this.widgetActionHandlers, ...handlers };
    }

    /**
     * Create a stable config change handler for a widget
     * @param {Object} widget - Widget instance
     * @returns {Function} Config change handler
     */
    createConfigChangeHandler(widget) {
        // Use a WeakMap to cache handlers per widget to avoid recreating them
        if (!this.configChangeHandlers) {
            this.configChangeHandlers = new WeakMap();
        }

        if (!this.configChangeHandlers.has(widget)) {
            const handler = (newConfig) => {
                // Handle widget configuration changes
                const updatedWidget = {
                    ...widget,
                    config: newConfig
                };
                this.executeCallback('widgetDataChanged', 'UPDATE', widget.slotName || 'unknown', updatedWidget);
            };
            this.configChangeHandlers.set(widget, handler);
        }

        return this.configChangeHandlers.get(widget);
    }

    /**
     * Override renderWidgetInstance - this is the method actually called for slot widgets
     * @param {Object} widgetInstance - Widget instance to render
     * @param {Array} slotWidgets - Array of current slot widgets (for move calculations)
     * @returns {HTMLElement} DOM element containing the React-rendered widget
     */
    async renderWidgetInstance(widgetInstance, slotWidgets) {
        try {
            // Use provided slot widgets for move button calculations
            const currentSlotWidgets = slotWidgets;
            return await this.renderWidgetWithFactory(widgetInstance, widgetInstance._renderIndex || 0, currentSlotWidgets);

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
     * @param {number} index - Index of widget within its slot
     * @param {Array} slotWidgets - All widgets in the slot (for determining move capabilities)
     * @returns {HTMLElement} DOM element containing the React component
     */
    async renderWidgetWithFactory(widget, index = 0, slotWidgets = []) {
        try {
            // Always use the current index to ensure fresh data after moves
            const actualIndex = widget._renderIndex !== undefined ? widget._renderIndex : index;

            // Use passed slot widgets for move button calculations
            const slotName = widget.slotName || 'unknown';

            // Create container element
            const container = document.createElement('div');
            container.className = 'widget-factory-container';
            container.setAttribute('data-widget-id', widget.id || 'unknown');

            // Create React root
            const root = createRoot(container);

            // Render WidgetFactory component
            const WidgetFactoryComponent = this.widgetFactoryComponent;

            // Store root for cleanup on the container BEFORE rendering
            const widgetKey = widget.id || Date.now();
            container._reactRoot = root;
            container.setAttribute('data-widget-key', widgetKey);

            // Render React component wrapped with providers
            const wrappedComponent = this.createProviderWrapper(
                React.createElement(WidgetFactoryComponent, {
                    key: `${widget.id}-${actualIndex}`, // Force re-render when index changes
                    widget: widget,
                    slotName: widget.slotName || 'unknown',
                    index: actualIndex,
                    onEdit: this.widgetActionHandlers.onEdit,
                    onDelete: this.widgetActionHandlers.onDelete,
                    onMoveUp: this.widgetActionHandlers.onMoveUp,
                    onMoveDown: this.widgetActionHandlers.onMoveDown,
                    onConfigChange: this.createConfigChangeHandler(widget),
                    canMoveUp: actualIndex > 0,
                    canMoveDown: actualIndex < slotWidgets.length - 1,
                    mode: this.editable ? 'editor' : 'preview',
                    showControls: this.editable
                })
            );
            console.log("createElement(WidgetFactoryComponent", this.widgetActionHandlers)
            root.render(wrappedComponent);

            // Wait for React to render (but root is already stored)
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });

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
     * Also provides proper index and slot context for widget ordering
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

        // Prevent overlapping updates for the same slot
        if (this.slotsBeingUpdated.has(slotName)) {
            return; // Skip this update if slot is already being updated
        }

        this.slotsBeingUpdated.add(slotName);

        try {
            await this._actualUpdateSlot(slotName, container, widgets);
        } finally {
            this.slotsBeingUpdated.delete(slotName);
        }
    }

    /**
     * Internal method that does the actual slot update
     */
    async _actualUpdateSlot(slotName, container, widgets) {
        try {
            // Validate widgets array
            if (!Array.isArray(widgets)) {
                throw new Error('Widgets must be an array');
            }

            // Preserve slot menu state before cleanup
            let wasMenuOpen = false;
            const existingDropdown = container.querySelector('.slot-menu-dropdown');
            if (existingDropdown) {
                wasMenuOpen = !existingDropdown.classList.contains('hidden');
            }

            // Clean up existing React roots in this slot SYNCHRONOUSLY
            const existingWidgets = container.querySelectorAll('.widget-factory-container');
            existingWidgets.forEach((widgetContainer, index) => {
                const widgetKey = widgetContainer.getAttribute('data-widget-key');

                if (widgetContainer._reactRoot) {
                    try {
                        widgetContainer._reactRoot.unmount();
                        widgetContainer._reactRoot = null;
                    } catch (error) {
                        console.warn('Error unmounting React root:', error);
                    }
                }
            });

            // Clear all existing content from container (this removes the slot menu too)
            container.innerHTML = '';


            if (widgets.length > 0) {

                // Render provided widgets with proper index and slot context
                for (let index = 0; index < widgets.length; index++) {
                    const widget = widgets[index];

                    try {
                        // Use renderWidgetInstance for full widget instances with controls
                        widget.slotName = slotName;

                        // Store index for renderWidgetWithFactory
                        // Always use fresh data to avoid stale data after moves
                        widget._renderIndex = index;

                        const widgetElement = await this.renderWidgetInstance(widget, widgets);
                        if (widgetElement) {
                            container.appendChild(widgetElement);
                        } else {
                            console.warn(`⚠️ Widget ${index + 1} (${widget.id}) returned null element`);
                        }

                    } catch (error) {
                        console.error(`❌ Error rendering widget ${index + 1} (${widget.id}) in slot ${slotName}:`, error);
                        const errorElement = this.createErrorWidgetElement(`Widget ${index + 1}: ${error.message}`);
                        container.appendChild(errorElement);
                    }
                }
            } else {
                // No widgets provided, show empty state
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'text-gray-500 text-sm text-center py-4';
                emptyMessage.textContent = 'No widgets in this slot';
                container.appendChild(emptyMessage);
            }

            // Recreate the slot menu with proper event listeners
            if (this.uiConfig.showIconMenu) {
                this.addSlotIconMenu(slotName, {
                    showAddWidget: this.uiConfig.showAddWidget,
                    showClearSlot: true
                });

                // Restore the menu state if it was open before cleanup
                if (wasMenuOpen) {
                    const newDropdown = container.querySelector('.slot-menu-dropdown');
                    if (newDropdown) {
                        newDropdown.classList.remove('hidden');
                    }
                }
            }

        } catch (error) {
            console.error(`LayoutRendererWithWidgetFactory: Error updating slot ${slotName}`, error);

            // Show error in slot
            const errorElement = this.createErrorWidgetElement(`Slot Error: ${error.message}`);
            container.appendChild(errorElement);
        }
    }

    /**
     * Override cleanup method to handle React roots safely
     */
    cleanup() {
        // Cleanup React roots
        this.cleanupReactRoots();

        // Clear QueryClient cache to prevent memory leaks
        if (this.queryClient) {
            this.queryClient.clear();
        }
    }

    /**
     * Override destroy method to handle React roots
     */
    destroy() {
        try {
            // Cleanup React roots
            this.cleanupReactRoots();

            // Clear QueryClient cache to prevent memory leaks
            if (this.queryClient) {
                this.queryClient.clear();
            }

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
