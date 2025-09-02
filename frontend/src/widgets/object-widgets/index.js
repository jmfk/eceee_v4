/**
 * Object Widgets - Object-specific widget implementations
 * 
 * Exports object-specific widget wrappers and utilities for
 * object editing contexts with widget control restrictions.
 */

export {
    ObjectWidgetRenderer,
    ObjectSlotContainer,
    ObjectTypeWidgetSelector,
    ObjectWidgetProvider
} from './ObjectWidgetWrapper'

// Re-export shared components with object-specific defaults
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
 * Create object-specific widget renderer with default configuration
 */
export function createObjectWidgetRenderer(defaultProps = {}) {
    return function ConfiguredObjectWidgetRenderer(props) {
        return (
            <ObjectWidgetRenderer
                editable={true}
                showRestrictions={true}
                {...defaultProps}
                {...props}
            />
        )
    }
}

/**
 * Object widget context configuration
 */
export const OBJECT_WIDGET_CONFIG = {
    context: 'object',
    supportsInheritance: false,
    strictTypes: true,
    templateBased: false,
    defaultEditable: true,
    showBorders: true,
    maxWidgets: 1 // Default for object slots
}
