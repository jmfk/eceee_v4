/**
 * Widgets Main Export
 * 
 * Re-exports from default-widgets package.
 * In the future, this can be enhanced to support multiple widget packages.
 */

// Export everything from default widgets
export * from './default-widgets';

// For backward compatibility and easy access
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
    registerWidget  // Export utility for custom widget packages
} from './default-widgets';