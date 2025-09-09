/**
 * ObjectEditor Framework - Main Export File
 * 
 * This file exports all ObjectEditor-specific framework components
 * that wrap shared widget implementations with ObjectEditor behaviors.
 */

// Export ObjectEditor-specific components
export { default as ObjectWidgetFactory } from './ObjectWidgetFactory'
export { default as ObjectWidgetHeader } from './ObjectWidgetHeader'

// Export test component for development
export { default as ObjectEditorMigrationTest } from './ObjectEditorMigrationTest'

// Export ObjectEditor event system
export {
    OBJECT_EDITOR_EVENTS,
    OBJECT_EDITOR_CHANGE_TYPES,
    ObjectEditorEventEmitter,
    ObjectEditorEventListener,
    createObjectEditorEventSystem
} from './ObjectEditorEventSystem'

// Re-export shared widgets for convenience
export * from '../../widgets'
