/**
 * Layout Registry - Manual React Layout Definitions
 * 
 * This file imports layout components from individual files and creates the registry.
 * No backend protocol, no Django templates, no complex parsing - just React.
 */

// Import layout components from individual files
import { SingleColumnLayout } from './SingleColumnLayout';
import { SidebarLayout } from './SidebarLayout';
import { TwoColumnLayout } from './TwoColumnLayout';
import { ThreeColumnLayout } from './ThreeColumnLayout';

// Re-export layout components for backward compatibility
export { SingleColumnLayout, SidebarLayout, TwoColumnLayout, ThreeColumnLayout };

/**
 * Layout Registry - Maps layout names to React components
 */
export const LAYOUT_REGISTRY = {
    'single_column': {
        component: SingleColumnLayout,
        name: 'single_column',
        label: 'Single Column',
        description: 'Simple single column layout for articles and content',
        slots: ['main'],
        responsive: true
    },
    'sidebar_layout': {
        component: SidebarLayout,
        name: 'sidebar_layout',
        label: 'Sidebar Layout',
        description: 'Main content with sidebar for complementary content',
        slots: ['header', 'main', 'sidebar', 'footer'],
        responsive: true
    },
    'two_column': {
        component: TwoColumnLayout,
        name: 'two_column',
        label: 'Two Column',
        description: 'Equal two column layout',
        slots: ['header', 'left', 'right', 'footer'],
        responsive: true
    },
    'three_column': {
        component: ThreeColumnLayout,
        name: 'three_column',
        label: 'Three Column',
        description: 'Three column layout with header and footer',
        slots: ['header', 'left', 'center', 'right', 'footer'],
        responsive: true
    }
};

/**
 * Get layout component by name
 */
export const getLayoutComponent = (layoutName) => {
    const layout = LAYOUT_REGISTRY[layoutName];
    return layout ? layout.component : null;
};

/**
 * Get layout metadata
 */
export const getLayoutMetadata = (layoutName) => {
    return LAYOUT_REGISTRY[layoutName] || null;
};

/**
 * Get all available layouts
 */
export const getAvailableLayouts = () => {
    return Object.values(LAYOUT_REGISTRY);
};

/**
 * Check if layout exists
 */
export const layoutExists = (layoutName) => {
    return layoutName in LAYOUT_REGISTRY;
};
