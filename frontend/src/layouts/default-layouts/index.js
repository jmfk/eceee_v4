/**
 * Default Layouts Package
 * 
 * Core layout implementations that can be extended or replaced
 */

// Export individual layout components
export { SingleColumnLayout } from './SingleColumnLayout';
export { SidebarLayout } from './SidebarLayout';
export { TwoColumnLayout } from './TwoColumnLayout';
export { ThreeColumnLayout } from './ThreeColumnLayout';

// Export registry and utilities
export { LAYOUT_REGISTRY } from './LayoutRegistry';
export * from './LayoutRegistry';

// Export WidgetSlot
export { default as WidgetSlot } from './WidgetSlot';
