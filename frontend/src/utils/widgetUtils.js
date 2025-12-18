import { isEqual } from 'lodash';

/**
 * Looks up a widget from state and widgets array
 * @param {Object} state - The unified data state object
 * @param {string} widgetId - The ID of the widget to find
 * @param {string} slotName - slot where the widget is located (for top-level widgets)
 * @param {string} contextType - 'page' or 'object' context type
 * @param {Array<string>} widgetPath - Optional path for nested widgets [slot, widgetId, slot, widgetId, ..., targetWidgetId]
 * @returns {Object|null} The widget object with cleaned config, or null if not found
 */
export const lookupWidget = (state, widgetId, slotName, contextType = 'page', widgetPath = null) => {
    if (!state || !widgetId) {
        return null;
    }

    // If widgetPath is provided, use path-based lookup (supports nested widgets)
    if (widgetPath && Array.isArray(widgetPath) && widgetPath.length >= 2) {
        return lookupWidgetByPath(state, widgetPath, contextType);
    }

    // Legacy: Top-level widget lookup by slot name
    if (!slotName) {
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
 * Looks up a widget using a path for nested widgets
 * @param {Object} state - The unified data state object
 * @param {Array<string>} path - Widget path [slot, widgetId, slot, widgetId, ..., targetWidgetId]
 * @param {string} contextType - 'page' or 'object' context type
 * @returns {Object|null} The widget object, or null if not found
 */
const lookupWidgetByPath = (state, path, contextType = 'page') => {
    if (!path || path.length < 2) {
        return null;
    }

    // Get root widgets collection
    let rootWidgets = null;
    if (contextType === 'page') {
        const version = state.versions[state.metadata.currentVersionId];
        if (!version) return null;
        rootWidgets = version.widgets;
    } else if (contextType === 'object') {
        const objectId = state.metadata.currentObjectId;
        if (!objectId) return null;
        const objectData = state.objects[objectId];
        if (!objectData) return null;
        rootWidgets = objectData.widgets;
    } else {
        return null;
    }

    // Start from top-level slot
    const topSlot = path[0];
    let currentWidgets = rootWidgets[topSlot];
    if (!currentWidgets) return null;

    // Traverse the path: [slot, widgetId, slot, widgetId, ..., targetWidgetId]
    for (let i = 1; i < path.length; i++) {
        const segment = path[i];

        // Odd index = widget ID
        if (i % 2 === 1) {
            const widget = currentWidgets.find(w => w.id === segment);
            if (!widget) return null;

            // If this is the last segment, return the widget
            if (i === path.length - 1) {
                const cleanedConfig = cleanNestedConfig(widget.config, 'lookupWidget');
                return {
                    ...widget,
                    config: cleanedConfig
                };
            }

            // Otherwise, prepare to descend into widget's slots
            // The next segment should be a slot name
            const nextSlotName = path[i + 1];
            if (!nextSlotName) return null;

            // Get the nested slot's widgets
            currentWidgets = widget.config?.slots?.[nextSlotName];
            if (!currentWidgets) return null;

            // Skip the next iteration since we already processed the slot name
            i++;
        }
    }

    return null;
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
 * Convert snake_case to camelCase
 * @param {string} name - The snake_case name
 * @returns {string} - The camelCase name
 */
const snakeToCamelCase = (name) => {
    if (!name || typeof name !== 'string') return name;
    return name.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
};

/**
 * Recalculates active variants for a widget based on its configuration and metadata
 * 
 * @param {Object} widget - The widget object
 * @param {Object} widgetMeta - The widget type metadata (with variants list)
 * @returns {Array<string>} - Array of active variant IDs
 */
export const calculateActiveVariants = (widget, widgetMeta) => {
    if (!widgetMeta?.variants || !widget?.config) return widget?.activeVariants || [];

    return widgetMeta.variants
        .filter(v => {
            const configField = v.config_field || v.configField;
            if (!configField) return false;

            // Check both snake_case and camelCase field names
            const camelField = snakeToCamelCase(configField);
            return !!(widget.config[configField] || widget.config[camelField]);
        })
        .map(v => v.id);
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
