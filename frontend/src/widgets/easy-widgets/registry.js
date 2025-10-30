/**
 * EASY Widget Registry
 * 
 * Registry for ECEEE-specific widget implementations.
 * This is independent of default-widgets.
 */

/**
 * Auto-collect metadata from widget components with optional override
 * This ensures consistency and reduces boilerplate while allowing manual control
 * 
 * @param {React.Component} WidgetComponent - The widget component
 * @param {string} [overrideWidgetType] - Optional manual widget type override
 */
const collectWidgetMetadata = (WidgetComponent, overrideWidgetType = null) => {
    return {
        component: WidgetComponent,
        displayName: WidgetComponent.displayName,
        // Use override if provided, otherwise use component's widgetType, otherwise generate default
        widgetType: overrideWidgetType || WidgetComponent.widgetType || `easy_widgets.${WidgetComponent.displayName}`,
        defaultConfig: WidgetComponent.defaultConfig || {},
        actionHandlers: WidgetComponent.actionHandlers || {},
        metadata: WidgetComponent.metadata || {
            name: WidgetComponent.displayName,
            description: '',
            category: 'other',
            icon: null,
            tags: [],
            menuItems: []
        }
    }
}

/**
 * Register a widget with automatic or manual widget type
 * 
 * @param {React.Component} WidgetComponent - The widget component
 * @param {string} [customWidgetType] - Optional custom widget type (e.g., 'easy_widgets.ContentWidget')
 * @returns {Object} Widget metadata object
 */
export const registerWidget = (WidgetComponent, customWidgetType = null) => {
    return collectWidgetMetadata(WidgetComponent, customWidgetType)
}

