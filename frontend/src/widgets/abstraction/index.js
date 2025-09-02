/**
 * Widget System Abstraction Layer - Main Export
 * 
 * Provides the complete abstraction layer that allows widgets to work
 * seamlessly in both page and object contexts without requiring knowledge
 * of which editor they're in.
 */

// Core Interfaces
export {
    IWidgetContext,
    ISlot,
    IWidgetHost,
    IConfigurationManager,
    IDataFlowManager,
    IApiClient
} from './interfaces'

// Context Implementations
export {
    PageWidgetContext,
    TemplateSlot
} from './contexts/PageWidgetContext'

export {
    ObjectWidgetContext,
    ConfiguredSlot
} from './contexts/ObjectWidgetContext'

// Components
export {
    WidgetHost,
    useWidgetContext,
    useWidgetOperations,
    useSlotOperations,
    withWidgetContext,
    ContextAwareWidgetRenderer
} from './components/WidgetHost'

// Managers
export {
    ConfigurationManager,
    createConfigurationManager,
    DEFAULT_VALIDATION_RULES,
    DEFAULT_TRANSFORMATION_RULES
} from './managers/ConfigurationManager'

export {
    DataFlowManager,
    createDataFlowManager
} from './managers/DataFlowManager'

export {
    ApiClient,
    PageApiClient,
    ObjectApiClient,
    createApiClient
} from './managers/ApiClient'

// Utility Functions
export {
    createWidgetContext,
    detectContextFromProps,
    createContextFactory,
    validateContextTransition,
    extractContextData,
    mergeContextConfig,
    ContextValidation,
    ContextComparison
} from './utils/contextFactory'

/**
 * Main abstraction layer version
 */
export const ABSTRACTION_LAYER_VERSION = '1.0.0'

/**
 * Context types supported by the abstraction layer
 */
export const SUPPORTED_CONTEXTS = {
    PAGE: 'page',
    OBJECT: 'object'
}

/**
 * Default configuration for different contexts
 */
export const DEFAULT_CONTEXT_CONFIG = {
    page: {
        editable: true,
        supportsInheritance: true,
        templateBased: true,
        renderingMode: 'edit'
    },
    object: {
        editable: true,
        supportsInheritance: false,
        strictTypes: true,
        renderingMode: 'edit'
    }
}

/**
 * Create a widget context instance
 * 
 * @param {string} type - Context type ('page' | 'object')
 * @param {Object} options - Context options
 * @returns {IWidgetContext} Context instance
 */
export function createWidgetContext(type, options = {}) {
    const config = {
        ...DEFAULT_CONTEXT_CONFIG[type],
        ...options
    }

    switch (type) {
        case SUPPORTED_CONTEXTS.PAGE:
            return new PageWidgetContext(config)
        case SUPPORTED_CONTEXTS.OBJECT:
            return new ObjectWidgetContext(config)
        default:
            throw new Error(`Unsupported context type: ${type}`)
    }
}

/**
 * Higher-order component that provides widget context abstraction
 * 
 * @param {React.Component} WrappedComponent - Component to wrap
 * @param {Object} contextOptions - Context configuration options
 * @returns {React.Component} Component with abstraction layer
 */
export function withAbstractionLayer(WrappedComponent, contextOptions = {}) {
    return function ComponentWithAbstraction(props) {
        return (
            <WidgetHost {...contextOptions} {...props}>
                <WrappedComponent {...props} />
            </WidgetHost>
        )
    }
}

/**
 * Universal widget editor that works in any context
 * 
 * This is the main component that should be used by applications
 * to render widgets in a context-agnostic way.
 */
export function UniversalWidgetEditor(props) {
    const {
        // Page-specific props
        layoutJson,
        pageVersionData,
        webpageData,
        onUpdate,

        // Object-specific props
        objectType,
        objectInstance,
        objectWidgets,
        onWidgetChange,

        // Common props
        editable = true,
        renderingMode = 'edit',
        onError,
        className = '',

        // Context override
        forceContext = null,

        // Children or render prop
        children,
        render,

        ...otherProps
    } = props

    return (
        <WidgetHost
            // Context detection props
            layoutJson={layoutJson}
            pageVersionData={pageVersionData}
            webpageData={webpageData}
            onUpdate={onUpdate}
            objectType={objectType}
            objectInstance={objectInstance}
            objectWidgets={objectWidgets}
            onWidgetChange={onWidgetChange}

            // Common props
            editable={editable}
            renderingMode={renderingMode}
            onError={onError}
            forceContext={forceContext}

            className={`universal-widget-editor ${className}`}
            {...otherProps}
        >
            {render ? render() : children}
        </WidgetHost>
    )
}

/**
 * Abstraction layer utilities
 */
export const AbstractionUtils = {
    /**
     * Check if abstraction layer is available
     */
    isAvailable: () => true,

    /**
     * Get abstraction layer version
     */
    getVersion: () => ABSTRACTION_LAYER_VERSION,

    /**
     * Get supported context types
     */
    getSupportedContexts: () => Object.values(SUPPORTED_CONTEXTS),

    /**
     * Validate context configuration
     */
    validateContextConfig: (type, config) => {
        if (!SUPPORTED_CONTEXTS[type.toUpperCase()]) {
            return {
                valid: false,
                error: `Unsupported context type: ${type}`
            }
        }

        return {
            valid: true,
            config: {
                ...DEFAULT_CONTEXT_CONFIG[type],
                ...config
            }
        }
    },

    /**
     * Create context factory for specific configuration
     */
    createContextFactory: (defaultConfig = {}) => {
        return (type, options = {}) => {
            const mergedConfig = {
                ...defaultConfig,
                ...options
            }
            return createWidgetContext(type, mergedConfig)
        }
    }
}

/**
 * Migration utilities for transitioning to the abstraction layer
 */
export const MigrationUtils = {
    /**
     * Convert legacy page widget data to abstraction layer format
     */
    convertPageWidgets: (pageData) => {
        return {
            context: SUPPORTED_CONTEXTS.PAGE,
            layoutJson: pageData.layoutJson,
            pageVersionData: pageData.pageVersionData,
            webpageData: pageData.webpageData,
            widgets: pageData.widgets || {}
        }
    },

    /**
     * Convert legacy object widget data to abstraction layer format
     */
    convertObjectWidgets: (objectData) => {
        return {
            context: SUPPORTED_CONTEXTS.OBJECT,
            objectType: objectData.objectType,
            objectInstance: objectData.objectInstance,
            widgets: objectData.widgets || {}
        }
    },

    /**
     * Detect if data needs migration
     */
    needsMigration: (data) => {
        return !data.context || !SUPPORTED_CONTEXTS[data.context.toUpperCase()]
    }
}

export default {
    // Main exports
    WidgetHost,
    UniversalWidgetEditor,
    createWidgetContext,
    withAbstractionLayer,

    // Context implementations
    PageWidgetContext,
    ObjectWidgetContext,

    // Hooks
    useWidgetContext,
    useWidgetOperations,
    useSlotOperations,

    // Utilities
    AbstractionUtils,
    MigrationUtils,

    // Constants
    SUPPORTED_CONTEXTS,
    DEFAULT_CONTEXT_CONFIG,
    ABSTRACTION_LAYER_VERSION
}
