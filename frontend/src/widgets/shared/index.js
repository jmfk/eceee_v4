/**
 * Shared Widget Library - Main Entry Point
 * 
 * Exports all shared widget components, hooks, utilities, and contexts
 * for use by both ContentEditor and ObjectContentEditor.
 */

// Components
export { default as WidgetRenderer } from './components/WidgetRenderer'
export { default as WidgetConfigPanel } from './components/WidgetConfigPanel'
export { default as WidgetLibraryPanel } from './components/WidgetLibraryPanel'
export { default as WidgetToolbar } from './components/WidgetToolbar'
export { default as SlotContainer } from './components/SlotContainer'

// Context Providers and Hooks
export {
    WidgetProvider,
    useWidgetContext,
    useWidgetOperations as useWidgetOperationsContext
} from './context/WidgetContext'

export {
    EditorProvider,
    useEditorContext,
    useDragAndDrop,
    useClipboard,
    useEditorHistory,
    EDITOR_MODES,
    DRAG_STATES
} from './context/EditorContext'

// Utility Functions
export {
    createWidget,
    cloneWidget,
    updateWidgetConfig,
    getWidgetDisplayName,
    getWidgetsByCategory,
    getWidgetCategories,
    hasWidgetEditor,
    getWidgetEditorComponent,
    validateWidget,
    WIDGET_TYPE_REGISTRY
} from './utils/widgetFactory'

export {
    validateWidgetConfig,
    validateWidgetsInSlot,
    getValidationSummary,
    createValidationResult,
    VALIDATION_ERROR_TYPES,
    VALIDATION_SEVERITY
} from './utils/validation'

export {
    createWidgetAdapter,
    detectWidgetContext,
    convertWidgetContext,
    PageWidgetAdapter,
    ObjectWidgetAdapter,
    WIDGET_CONTEXTS
} from './utils/adapters'

// Hooks
export {
    useWidgetCRUD,
    useWidgetValidation as useWidgetValidationOps,
    useWidgetDragDrop,
    useWidgetClipboard,
    useWidgetSearch,
    useWidgetHistory
} from './hooks/useWidgetOperations'

export {
    useOptimisticWidgets,
    useWidgetCache,
    useWidgetSync,
    useWidgetPersistence
} from './hooks/useWidgetState'

export {
    useRealTimeValidation,
    useValidationErrorTracking,
    useValidationRules,
    useValidationPerformance
} from './hooks/useWidgetValidation'

// Constants
export const SHARED_WIDGET_VERSION = '1.0.0'

/**
 * Initialize shared widget library with context providers
 * @param {React.Component} children - Child components
 * @param {Object} options - Configuration options
 * @returns {React.Component} Wrapped component with providers
 */
export function WithSharedWidgets({
    children,
    context = 'page',
    widgets = {},
    onWidgetChange,
    editorMode = 'edit'
}) {
    return (
        <EditorProvider initialMode={editorMode}>
            <WidgetProvider
                initialContext={context}
                initialWidgets={widgets}
                onWidgetChange={onWidgetChange}
            >
                {children}
            </WidgetProvider>
        </EditorProvider>
    )
}

/**
 * Utility function to create a configured widget renderer
 * @param {Object} config - Renderer configuration
 * @returns {React.Component} Configured WidgetRenderer
 */
export function createConfiguredRenderer(config = {}) {
    const {
        context = 'page',
        editable = true,
        showBorders = true,
        emptySlotMessage = 'No widgets in this slot',
        ...otherProps
    } = config

    return function ConfiguredWidgetRenderer(props) {
        return (
            <WidgetRenderer
                editable={editable}
                showSlotBorders={showBorders}
                showWidgetBorders={showBorders}
                emptySlotMessage={emptySlotMessage}
                {...otherProps}
                {...props}
            />
        )
    }
}

/**
 * Utility function to create context-specific widget operations
 * @param {string} context - Widget context ('page' or 'object')
 * @returns {Object} Context-specific operations
 */
export function createContextOperations(context) {
    const adapter = createWidgetAdapter(context)

    return {
        context,
        adapter,
        createWidget: (widgetSlug, options = {}) =>
            adapter.createWidget(widgetSlug, options),
        adaptSlotConfig: (slotData) =>
            adapter.adaptSlotConfig(slotData),
        handleOperation: (operation, params) =>
            adapter.handleOperation(operation, params),
        getAvailableTypes: (slotConfig) =>
            adapter.getAvailableWidgetTypes(slotConfig)
    }
}

/**
 * Default configuration for different contexts
 */
export const DEFAULT_CONFIGS = {
    page: {
        context: 'page',
        editable: true,
        showBorders: true,
        supportsInheritance: true,
        templateBased: true
    },
    object: {
        context: 'object',
        editable: true,
        showBorders: true,
        supportsInheritance: false,
        templateBased: false,
        strictTypes: true
    }
}

/**
 * Get default configuration for a context
 * @param {string} context - Widget context
 * @returns {Object} Default configuration
 */
export function getDefaultConfig(context) {
    return DEFAULT_CONFIGS[context] || DEFAULT_CONFIGS.page
}
