/**
 * Layouts Main Export
 * 
 * Re-exports from default-layouts package.
 * In the future, this can be enhanced to support multiple layout packages.
 */

// Export everything from default layouts
export * from './default-layouts';

// For backward compatibility and easy access
export {
    SingleColumnLayout,
    SidebarLayout,
    ThreeColumnLayout,
    TwoColumnLayout,
    HeaderFooterLayout,
    LAYOUT_REGISTRY,
    WidgetSlot
} from './default-layouts';
