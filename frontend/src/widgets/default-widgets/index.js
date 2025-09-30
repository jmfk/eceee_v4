/**
 * Default Widgets Package
 * 
 * Core widget implementations that can be extended or replaced
 */

// Export all widget components
export { default as ContentWidget } from './ContentWidget';
export { default as ImageWidget } from './ImageWidget';
export { default as TableWidget } from './TableWidget';
export { default as HeaderWidget } from './HeaderWidget';
export { default as FooterWidget } from './FooterWidget';
export { default as NavigationWidget } from './NavigationWidget';
export { default as SidebarWidget } from './SidebarWidget';
export { default as FormsWidget } from './FormsWidget';

// Export container widgets
export { default as TwoColumnsWidget } from './TwoColumnsWidget';
export { default as TwoColumnsEditor } from './TwoColumnsEditor';

// Export utilities
export * from './registry';
export * from './validation';

// Export editor renderer if it exists
export { default as ContentWidgetEditorRenderer } from './ContentWidgetEditorRenderer';
