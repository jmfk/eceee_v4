/**
 * Widgets Main Export
 * 
 * Unified widget system using easy-widgets.
 * The default-widgets have been removed from the system.
 */

import widgetRegistryManager from './WidgetRegistryManager';
import { EASY_WIDGET_REGISTRY } from './easy-widgets';

// Register easy widgets registry
widgetRegistryManager.registerRegistry(
    EASY_WIDGET_REGISTRY,
    widgetRegistryManager.priorities.THIRD_PARTY,
    'easy-widgets'
);

// Export eceeasyee widgets
export * from './easy-widgets';

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

// Backward compatibility aliases (for code still using "Core" prefix from default-widgets era)
export const searchCoreWidgets = searchWidgets;
export const filterCoreWidgetsByCategory = filterWidgetsByCategory;
export const getAvailableCoreCategories = getAvailableCategories;

// Helper functions that extract from metadata
export const getWidgetIcon = (widgetType) => {
    const metadata = widgetRegistryManager.getWidgetMetadata(widgetType);
    return metadata?.metadata?.icon || null;
};

export const getWidgetCategory = (widgetType) => {
    const metadata = widgetRegistryManager.getWidgetMetadata(widgetType);
    return metadata?.metadata?.category || 'other';
};

export const getWidgetDescription = (widgetType) => {
    const metadata = widgetRegistryManager.getWidgetMetadata(widgetType);
    return metadata?.metadata?.description || '';
};

export const getWidgetTags = (widgetType) => {
    const metadata = widgetRegistryManager.getWidgetMetadata(widgetType);
    return metadata?.metadata?.tags || [];
};

// Export the registry manager for advanced usage
export { widgetRegistryManager };

// Export individual widget components from easy-widgets
// Direct exports with clean names
export {
    ContentWidget,
    ImageWidget,
    TableWidget,
    HeaderWidget,
    HeroWidget,
    FooterWidget,
    NavigationWidget,
    NavbarWidget,
    SidebarWidget,
    FormsWidget,
    NewsListWidget,
    NewsDetailWidget,
    PathDebugWidget,
    SidebarTopNewsWidget,
    TopNewsPlugWidget,
    // Container widgets
    TwoColumnsWidget,
    ThreeColumnsWidget,
    registerWidget  // Export utility for custom widget packages
} from './easy-widgets';

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
