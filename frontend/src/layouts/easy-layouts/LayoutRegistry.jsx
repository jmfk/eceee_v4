/**
 * EASY Layout Registry - ECEEE-specific Layout Definitions
 * 
 * This file imports ECEEE-specific layout definitions that mirror the backend easy_layouts app.
 * These layouts are designed for specialized ECEEE use cases and extend the default layout system.
 */

// Import layout components from individual files
import { MainLayout } from './MainLayout';
import { LandingPage } from './LandingPage';

// Re-export layout components for backward compatibility
export { MainLayout, LandingPage };


/**
 * EASY Layout Registry - Maps layout names to React components
 */
export const EASY_LAYOUT_REGISTRY = {
    'mainLayout': {
        component: MainLayout,
        name: 'mainLayout',
        label: 'Main Layout',
        description: 'Optimized layout for blog posts with featured image, content, and sidebar',
        slots: ['header', 'navbar', 'main', 'sidebar', 'footer'],
        responsive: true
    },
    'landingPage': {
        component: LandingPage,
        name: 'landingPage',
        label: 'Landing Page',
        description: 'Full-width landing page layout with hero section and conversion focus',
        slots: ['header', 'navbar', 'hero', 'landingPage', 'footer'],
        responsive: true
    }
};

/**
 * Get layout component by name
 */
export const getLayoutComponent = (layoutName) => {
    const layout = EASY_LAYOUT_REGISTRY[{ main_layout: 'mainLayout', landing_page: 'landingPage' }[layoutName] || layoutName];
    return layout ? layout.component : null;
};

/**
 * Get layout metadata
 */
export const getLayoutMetadata = (layoutName) => {
    return EASY_LAYOUT_REGISTRY[{ main_layout: 'mainLayout', landing_page: 'landingPage' }[layoutName] || layoutName] || null;
};

/**
 * Get all available ECEEE layouts
 */
export const getAvailableLayouts = () => {
    return Object.values(EASY_LAYOUT_REGISTRY);
};

/**
 * Check if ECEEE layout exists
 */
export const layoutExists = (layoutName) => {
    return Boolean(getLayoutMetadata(layoutName));
};
