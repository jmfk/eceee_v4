/**
 * Editors - Main Export File
 * 
 * This file exports both editor frameworks and shared widgets,
 * providing a unified interface to the hybrid widget system.
 */

// Export PageEditor framework
export * as PageEditor from './page-editor'

// Export ObjectEditor framework  
export * as ObjectEditor from './object-editor'

// Export shared widgets directly for convenience
export * from '../widgets'

// Convenience re-exports for common use cases
export { PageWidgetFactory } from './page-editor'
export { ObjectWidgetFactory } from './object-editor'

// Export shared components that both editors can use
export {
    getCoreWidgetComponent,
    getCoreWidgetDisplayName,
    validateWidgetConfig,
    createDefaultWidgetConfig,
    generateWidgetId
} from '../widgets'
