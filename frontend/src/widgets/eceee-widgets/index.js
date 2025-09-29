/**
 * ECEEE Widgets Package
 * 
 * ECEEE-specific widget implementations that mirror the backend eceee_widgets app
 * This is a placeholder for future ECEEE-specific widget components.
 */

// Placeholder - no ECEEE-specific widgets implemented yet
// Future widgets will be exported here

export const ECEEE_WIDGET_REGISTRY = {
    // Future ECEEE-specific widgets will be registered here
};

export const getEceeeWidget = (widgetName) => {
    const widget = ECEEE_WIDGET_REGISTRY[widgetName];
    return widget ? widget.component : null;
};

export const getAvailableEceeeWidgets = () => {
    return Object.values(ECEEE_WIDGET_REGISTRY);
};
