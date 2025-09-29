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

// TODO: make sure we can import eceee-widget (and add to the existing widgets)
// - How should we handle if a widget is reimplemented (using the same name)? 
//   How should precedings be handled?
