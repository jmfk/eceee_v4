/**
 * Layouts Main Export
 * 
 * Uses eceee-layouts only. The default-layouts have been removed from the system.
 */

// Export everything from eceee layouts
export * from './eceee-layouts';

// Import eceee layout registry
import { ECEEE_LAYOUT_REGISTRY } from './eceee-layouts';

// Use ECEEE layouts as the main registry
export const LAYOUT_REGISTRY = ECEEE_LAYOUT_REGISTRY;

// Utility functions that work with the layout registry
export const getLayoutComponent = (layoutName) => {
    const layout = LAYOUT_REGISTRY[layoutName];
    return layout ? layout.component : null;
};

export const getLayoutMetadata = (layoutName) => {
    return LAYOUT_REGISTRY[layoutName] || null;
};

export const getAvailableLayouts = () => {
    return Object.values(LAYOUT_REGISTRY);
};

export const layoutExists = (layoutName) => {
    return layoutName in LAYOUT_REGISTRY;
};

// Export eceee layout components for easy access
export {
    MainLayout,
    LandingPage,
    WidgetSlot
} from './eceee-layouts';
