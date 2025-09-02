/**
 * Page Widgets - Page-specific widget implementations
 * 
 * Exports page-specific widget wrappers and utilities for
 * page editing contexts with layout inheritance support.
 */

export {
    PageWidgetRenderer,
    PageSlotContainer,
    PageWidgetProvider
} from './PageWidgetWrapper'

// Re-export shared components with page-specific defaults
export {
    WidgetRenderer,
    WidgetConfigPanel,
    WidgetLibraryPanel,
    WidgetToolbar,
    SlotContainer,
    WithSharedWidgets,
    WIDGET_CONTEXTS
} from '../shared'

/**
 * Create page-specific widget renderer with default configuration
 */
export function createPageWidgetRenderer(defaultProps = {}) {
    return function ConfiguredPageWidgetRenderer(props) {
        return (
            <PageWidgetRenderer
                editable={true}
                showInheritance={true}
                {...defaultProps}
                {...props}
            />
        )
    }
}

/**
 * Page widget context configuration
 */
export const PAGE_WIDGET_CONFIG = {
    context: 'page',
    supportsInheritance: true,
    templateBased: true,
    allowOverride: true,
    defaultEditable: true,
    showBorders: true
}
