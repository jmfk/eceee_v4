import { isEqual } from 'lodash';

/**
 * Looks up a widget from state and widgets array
 * @param {Object} state - The unified data state object
 * @param {string} widgetId - The ID of the widget to find
 * @param {string} slotName - slot where the widget is located
 * @param {string} contextType - 'page' or 'object' context type
 * @returns {Object|null} The widget object with cleaned config, or null if not found
 */
export const lookupWidget = (state, widgetId, slotName, contextType = 'page') => {
    if (!state || !widgetId || !slotName) {
        return null;
    }

    let widgets = null;

    if (contextType === 'page') {
        // Look up widget in page version
        const version = state.versions[state.metadata.currentVersionId];
        if (!version) {
            return null;
        }
        widgets = version.widgets[slotName];
    } else if (contextType === 'object') {
        // Look up widget in object
        const objectId = state.metadata.currentObjectId;
        if (!objectId) {
            return null;
        }
        const objectData = state.objects[objectId];
        if (!objectData) {
            return null;
        }
        widgets = objectData.widgets?.[slotName];
    } else {
        // Unknown context type
        return null;
    }

    const widget = widgets?.find(w => w.id === widgetId);
    if (!widget) {
        return null;
    }

    // Clean any nested config objects and return widget with cleaned config
    const cleanedConfig = cleanNestedConfig(widget.config, 'lookupWidget');

    return {
        ...widget,
        config: cleanedConfig
    };
};

/**
 * Checks if widget content has changed
 * @param {string} currentContent - Current content value
 * @param {string} newContent - New content value
 * @returns {boolean} True if content has changed
 */
export const hasWidgetContentChanged = (currentContent, newContent) => {
    return !isEqual(currentContent, newContent);
};

/**
 * Cleans up nested config objects by removing extra levels of nesting
 * @param {Object} config - The config object to clean
 * @param {string} source - Source context for logging (optional)
 * @returns {Object} Cleaned config object
 */
export const cleanNestedConfig = (config, source = 'unknown') => {
    if (!config || typeof config !== 'object') {
        return config;
    }

    // Recursively remove extra levels of config nesting
    let cleanConfig = config;
    let nestingLevel = 0;
    const maxNestingLevels = 5; // Prevent infinite loops

    while (cleanConfig?.config && nestingLevel < maxNestingLevels) {
        console.warn(`[${source}] Removing config nesting level ${nestingLevel + 1}`);
        cleanConfig = cleanConfig.config;
        nestingLevel++;
    }

    if (nestingLevel > 0) {
        console.warn(`[${source}] Cleaned ${nestingLevel} levels of config nesting`);
    }

    // Check for widget properties that shouldn't be in config
    if (cleanConfig && typeof cleanConfig === 'object') {
        const widgetProperties = ['id', 'name', 'type', 'widget_type', 'order', 'created_at', 'updated_at', 'slotName'];
        const foundWidgetProps = widgetProperties.filter(prop => cleanConfig.hasOwnProperty(prop));

        if (foundWidgetProps.length > 2) { // Allow some overlap but not full widget
            console.warn(`[${source}] Config contains widget properties: ${foundWidgetProps.join(', ')}`);

            // If it has a config property, extract it
            if (cleanConfig.config) {
                console.warn(`[${source}] Extracting inner config from widget-like object`);
                cleanConfig = cleanConfig.config;
            } else {
                // Remove widget properties from config
                const purifiedConfig = { ...cleanConfig };
                widgetProperties.forEach(prop => {
                    delete purifiedConfig[prop];
                });
                console.warn(`[${source}] Removed widget properties from config`);
                cleanConfig = purifiedConfig;
            }
        }
    }

    return cleanConfig;
};
