/**
 * ECEEE Layouts Package
 * 
 * ECEEE-specific layout implementations that mirror the backend easy_layouts app
 */

// Export individual layout components
export { MainLayout } from './MainLayout';
export { LandingPage } from './LandingPage';

// Export registry and utilities
export { ECEEE_LAYOUT_REGISTRY } from './LayoutRegistry';
export * from './LayoutRegistry';

// Export WidgetSlot component
export { default as WidgetSlot } from './WidgetSlot';
