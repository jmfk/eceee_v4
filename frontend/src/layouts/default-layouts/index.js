/**
 * Default Layouts Package
 * 
 * Core layout implementations that can be extended or replaced
 */

export {
    SingleColumnLayout,
    SidebarLayout,
    ThreeColumnLayout,
    TwoColumnLayout,
    LAYOUT_REGISTRY
} from './LayoutRegistry';

export { default as WidgetSlot } from './WidgetSlot';

// Re-export utilities
export * from './LayoutRegistry';
