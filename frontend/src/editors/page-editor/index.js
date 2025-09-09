/**
 * PageEditor Framework - Main Export File
 * 
 * This file exports all PageEditor-specific framework components
 * that wrap shared widget implementations with PageEditor behaviors.
 */

// Export PageEditor-specific components
export { default as PageWidgetFactory } from './PageWidgetFactory'
export { default as PageWidgetHeader } from './PageWidgetHeader'
export { default as PageContentEditor } from './PageContentEditor'
// Layout renderers removed - now using ReactLayoutRenderer only
export { default as ReactLayoutRenderer } from './ReactLayoutRenderer'
export * from './layouts/LayoutRegistry'
export { default as WidgetSlot } from './layouts/WidgetSlot'

// Test components removed after refactoring completion

// Export PageEditor event system
export {
    PAGE_EDITOR_EVENTS,
    PAGE_EDITOR_CHANGE_TYPES,
    PageEditorEventEmitter,
    PageEditorEventListener,
    createPageEditorEventSystem
} from './PageEditorEventSystem'

// Re-export shared widgets for convenience
export * from '../../widgets'
