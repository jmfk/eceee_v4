/**
 * Widgets Main Export
 * 
 * Unified widget system using eceee-widgets.
 * The default-widgets have been removed from the system.
 */

import widgetRegistryManager from './WidgetRegistryManager';
import { ECEEE_WIDGET_REGISTRY } from './eceee-widgets';

// Register eceee widgets registry
widgetRegistryManager.registerRegistry(
    ECEEE_WIDGET_REGISTRY,
    widgetRegistryManager.priorities.THIRD_PARTY,
    'eceee-widgets'
);

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

// Export individual widget components from eceee-widgets
// Using aliases to maintain backward compatibility
export {
    eceeeContentWidget as ContentWidget,
    eceeeImageWidget as ImageWidget,
    eceeeTableWidget as TableWidget,
    eceeeHeaderWidget as HeaderWidget,
    eceeeFooterWidget as FooterWidget,
    eceeeNavigationWidget as NavigationWidget,
    eceeeNavbarWidget as NavbarWidget,
    eceeeSidebarWidget as SidebarWidget,
    eceeeFormsWidget as FormsWidget,
    eceeeNewsListWidget as NewsListWidget,
    eceeeNewsDetailWidget as NewsDetailWidget,
    eceeePathDebugWidget as PathDebugWidget,
    eceeeSidebarTopNewsWidget as SidebarTopNewsWidget,
    eceeeTopNewsPlugWidget as TopNewsPlugWidget,
    // Container widgets
    eceeeTwoColumnsWidget as TwoColumnsWidget,
    eceeeThreeColumnsWidget as ThreeColumnsWidget,
    registerWidget  // Export utility for custom widget packages
} from './eceee-widgets';

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
