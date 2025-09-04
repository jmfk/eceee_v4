// Export all new core widgets
export { default as ContentWidget } from './ContentWidget'
export { default as ImageWidget } from './ImageWidget'
export { default as TableWidget } from './TableWidget'
export { default as FooterWidget } from './FooterWidget'
export { default as HeaderWidget } from './HeaderWidget'
export { default as NavigationWidget } from './NavigationWidget'
export { default as SidebarWidget } from './SidebarWidget'
export { default as FormsWidget } from './FormsWidget'

// Re-export the widget registry and utilities
export * from './widgetRegistry'
export { default as WidgetFactory } from './WidgetFactory'
export { default as WidgetRenderer } from './WidgetRenderer'