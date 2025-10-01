/**
 * Layouts Main Export
 * 
 * Re-exports from default-layouts package and combines with eceee-layouts.
 */

// Export everything from default layouts
export * from './default-layouts';
export * from './eceee-layouts';

// Import registries
import { LAYOUT_REGISTRY as DEFAULT_REGISTRY } from './default-layouts';
import { ECEEE_LAYOUT_REGISTRY } from './eceee-layouts';

// Configuration: Set which layout apps are enabled (should match backend INSTALLED_APPS)
const ENABLE_DEFAULT_LAYOUTS = false; // Set to false when default_layouts is disabled in backend
const ENABLE_ECEEE_LAYOUTS = true;

// Create combined registry based on configuration
export const COMBINED_LAYOUT_REGISTRY = {
    ...(ENABLE_DEFAULT_LAYOUTS ? DEFAULT_REGISTRY : {}),
    ...(ENABLE_ECEEE_LAYOUTS ? ECEEE_LAYOUT_REGISTRY : {})
};

// Export the combined registry as the main one
export const LAYOUT_REGISTRY = COMBINED_LAYOUT_REGISTRY;

// Combined utility functions that work with the combined registry
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

// For backward compatibility and easy access
export {
    SingleColumnLayout,
    SidebarLayout,
    ThreeColumnLayout,
    TwoColumnLayout,
    WidgetSlot
} from './default-layouts';

export {
    MainLayout,
    LandingPage
} from './eceee-layouts';