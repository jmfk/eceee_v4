/**
 * EASY Layouts Package
 * 
 * EASY-specific layout implementations that mirror the backend easy_layouts app
 */

// Export individual layout components
export { MainLayout } from './MainLayout';
export { LandingPage } from './LandingPage';

// Export registry and utilities
export { EASY_LAYOUT_REGISTRY } from './LayoutRegistry';
export * from './LayoutRegistry';

// Export WidgetSlot component
export { default as WidgetSlot } from './WidgetSlot';
