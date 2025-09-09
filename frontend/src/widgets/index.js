/**
 * Shared Widgets - Main Export File
 * 
 * This file exports all shared widget implementations and utilities
 * that can be used by any editor framework.
 */

// Export all core widget components
export { default as ContentWidget } from './core/ContentWidget'
export { default as ImageWidget } from './core/ImageWidget'
export { default as TableWidget } from './core/TableWidget'
export { default as FooterWidget } from './core/FooterWidget'
export { default as HeaderWidget } from './core/HeaderWidget'
export { default as NavigationWidget } from './core/NavigationWidget'
export { default as SidebarWidget } from './core/SidebarWidget'
export { default as FormsWidget } from './core/FormsWidget'

// Export the shared registry and all its utilities
export {
    CORE_WIDGET_REGISTRY,
    getCoreWidgetComponent,
    getCoreWidgetDefaultConfig,
    getCoreWidgetDisplayName,
    getCoreWidgetMetadata,
    getCoreWidgetIcon,
    getCoreWidgetCategory,
    getCoreWidgetDescription,
    getCoreWidgetTags,
    isCoreWidgetTypeSupported,
    getAvailableCoreWidgetTypes,
    getAllCoreWidgetMetadata,
    searchCoreWidgets,
    filterCoreWidgetsByCategory,
    getAvailableCoreCategories
} from './registry'

// Export all validation utilities
export {
    validateWidgetConfig,
    validateWidgets,
    createDefaultWidgetConfig,
    generateWidgetId,
    sanitizeWidget
} from './validation'

// Re-export the registry as default for direct access
export { default } from './registry'
