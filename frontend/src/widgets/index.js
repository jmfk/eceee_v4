/**
 * Widgets Main Export
 * 
 * Unified widget system with override support.
 * ECEEE widgets and other third-party widgets can override default widgets.
 */

import widgetRegistryManager from './WidgetRegistryManager';
import { CORE_WIDGET_REGISTRY } from './default-widgets/registry';
import { ECEEE_WIDGET_REGISTRY } from './eceee-widgets';

// Register all widget registries with priority levels
// Higher priority numbers override lower priority numbers
widgetRegistryManager.registerRegistry(CORE_WIDGET_REGISTRY, widgetRegistryManager.priorities.DEFAULT, 'default-widgets');
widgetRegistryManager.registerRegistry(ECEEE_WIDGET_REGISTRY, widgetRegistryManager.priorities.THIRD_PARTY, 'eceee-widgets');

// Export everything from default widgets for backward compatibility
export * from './default-widgets';

// Export eceee widgets
export * from './eceee-widgets';

// Export the unified widget functions that support overrides
export const getWidgetComponent = (widgetType) => {
    return widgetRegistryManager.getWidgetComponent(widgetType);
};

export const getWidgetMetadata = (widgetType) => {
    return widgetRegistryManager.getWidgetMetadata(widgetType);
};

export const getWidgetDefaultConfig = (widgetType) => {
    return widgetRegistryManager.getWidgetDefaultConfig(widgetType);
};

export const getWidgetDisplayName = (widgetTypeOrData, widgetTypes = []) => {
    return widgetRegistryManager.getWidgetDisplayName(widgetTypeOrData, widgetTypes);
};

export const isWidgetTypeSupported = (widgetType) => {
    return widgetRegistryManager.isWidgetTypeSupported(widgetType);
};

export const getAvailableWidgetTypes = () => {
    return widgetRegistryManager.getAvailableWidgetTypes();
};

export const getAllWidgetMetadata = () => {
    return widgetRegistryManager.getAllWidgetMetadata();
};

export const searchWidgets = (searchTerm = '') => {
    return widgetRegistryManager.searchWidgets(searchTerm);
};

export const filterWidgetsByCategory = (category = 'all') => {
    return widgetRegistryManager.filterWidgetsByCategory(category);
};

export const getAvailableCategories = () => {
    return widgetRegistryManager.getAvailableCategories();
};

// Export the registry manager for advanced usage
export { widgetRegistryManager };

// Export individual widget components for backward compatibility
export {
    ContentWidget,
    ImageWidget,
    TableWidget,
    HeaderWidget,
    FooterWidget,
    NavigationWidget,
    SidebarWidget,
    FormsWidget,
    ContentWidgetEditorRenderer,
    // Container widgets
    TwoColumnsWidget,
    registerWidget  // Export utility for custom widget packages
} from './default-widgets';

/**
 * Register a third-party widget registry
 * 
 * @param {Object} registry - Widget registry object
 * @param {string} name - Registry name
 * @param {number} priority - Priority level (optional, defaults to THIRD_PARTY)
 */
export const registerWidgetRegistry = (registry, name, priority = widgetRegistryManager.priorities.THIRD_PARTY) => {
    widgetRegistryManager.registerRegistry(registry, priority, name);
};
