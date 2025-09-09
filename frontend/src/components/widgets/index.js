/**
 * LEGACY WIDGET EXPORTS - DEPRECATED
 * 
 * This directory contains the old widget implementations.
 * For new development, use the shared widgets from /frontend/src/widgets/
 * 
 * These exports are kept for backward compatibility during migration.
 * They will be removed in a future version.
 */

// Export legacy widget implementations (DEPRECATED - use /frontend/src/widgets/ instead)
export { default as ContentWidget } from './ContentWidget'
export { default as ImageWidget } from './ImageWidget'
export { default as TableWidget } from './TableWidget'
export { default as FooterWidget } from './FooterWidget'
export { default as HeaderWidget } from './HeaderWidget'
export { default as NavigationWidget } from './NavigationWidget'
export { default as SidebarWidget } from './SidebarWidget'
export { default as FormsWidget } from './FormsWidget'

// REMOVED: Old shared framework components
// - WidgetFactory (replaced by PageWidgetFactory and ObjectWidgetFactory)
// - WidgetHeader (replaced by PageWidgetHeader and ObjectWidgetHeader)
// - widgetRegistry (replaced by /frontend/src/widgets/registry.js)

// For new development, import from the new shared widgets:
// import { ContentWidget, PageWidgetFactory, ObjectWidgetFactory } from '../../widgets'
// import { PageWidgetFactory } from '../../editors/page-editor'
// import { ObjectWidgetFactory } from '../../editors/object-editor'