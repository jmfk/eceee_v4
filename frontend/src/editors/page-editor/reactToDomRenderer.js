/**
 * React to DOM Renderer - Utility for rendering React components to DOM elements
 * 
 * This utility allows us to render React components (like PageWidgetFactory) 
 * into DOM elements that can be used by the LayoutRenderer.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { WidgetEventProvider } from '../../contexts/WidgetEventContext';

/**
 * Render a React component to a DOM element
 * @param {React.Component} component - React component to render
 * @param {Object} eventSystem - Widget event system to provide context
 * @returns {Object} { element, root, cleanup } - DOM element, React root, and cleanup function
 */
export const renderReactComponentToDOM = (component, eventSystem = null) => {
    try {
        // Create container element
        const container = document.createElement('div');
        container.className = 'react-widget-container';

        // Create React root
        const root = createRoot(container);

        // Wrap component with event provider if needed
        const wrappedComponent = eventSystem ?
            React.createElement(
                WidgetEventProvider,
                { sharedEventBus: eventSystem },
                component
            ) : component;

        // Render component
        root.render(wrappedComponent);

        // Return container, root, and cleanup function
        return {
            element: container,
            root: root,
            cleanup: () => {
                try {
                    root.unmount();
                } catch (error) {
                    console.warn('reactToDomRenderer: Error unmounting React root:', error);
                }
            }
        };
    } catch (error) {
        console.error('reactToDomRenderer: Error rendering React component to DOM:', error);

        // Return error element
        const errorElement = document.createElement('div');
        errorElement.className = 'react-widget-error bg-red-50 border border-red-200 rounded p-4';
        errorElement.innerHTML = `
            <div class="text-red-600 text-sm">
                <strong>React Rendering Error:</strong> ${error.message}
            </div>
        `;

        return {
            element: errorElement,
            root: null,
            cleanup: () => { }
        };
    }
};

/**
 * Render a PageWidgetFactory to a DOM element
 * @param {Object} widget - Widget configuration
 * @param {Object} props - Additional props for PageWidgetFactory
 * @param {Object} eventSystem - PageEditor event system
 * @param {React.Component} PageWidgetFactoryComponent - PageWidgetFactory component
 * @returns {Object} { element, root, cleanup }
 */
export const renderPageWidgetToDOM = (widget, props = {}, eventSystem = null, PageWidgetFactoryComponent = null) => {
    if (!PageWidgetFactoryComponent) {
        throw new Error('PageWidgetFactory component is required');
    }

    const component = React.createElement(PageWidgetFactoryComponent, {
        widget,
        mode: 'editor',
        showControls: true,
        ...props
    });

    return renderReactComponentToDOM(component, eventSystem);
};

/**
 * Batch render multiple widgets to DOM elements
 * @param {Array} widgets - Array of widget configurations
 * @param {Object} sharedProps - Props shared by all widgets
 * @param {Object} eventSystem - PageEditor event system
 * @returns {Array} Array of { widget, element, root, cleanup }
 */
export const renderMultipleWidgetsToDOM = (widgets, sharedProps = {}, eventSystem = null) => {
    return widgets.map(widget => {
        const result = renderPageWidgetToDOM(widget, {
            ...sharedProps,
            widgetId: widget.id,
            slotName: widget.slotName
        }, eventSystem);

        return {
            widget,
            ...result
        };
    });
};

/**
 * Cleanup multiple rendered widgets
 * @param {Array} renderedWidgets - Array from renderMultipleWidgetsToDOM
 */
export const cleanupRenderedWidgets = (renderedWidgets) => {
    renderedWidgets.forEach(({ cleanup }) => {
        if (cleanup) {
            cleanup();
        }
    });
};
