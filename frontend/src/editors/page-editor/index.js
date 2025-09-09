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
export { default as PageEditorCore } from './PageEditorCore'
export { default as PageLayoutRenderer } from './PageLayoutRenderer'
export { default as PageLayoutRendererWithReact } from './PageLayoutRendererWithReact'
export { default as SimplifiedLayoutRenderer } from './SimplifiedLayoutRenderer'
export { default as ReactLayoutRenderer } from './ReactLayoutRenderer'
export * from './reactToDomRenderer'
export * from './layouts/LayoutRegistry'
export { default as WidgetSlot } from './layouts/WidgetSlot'

// Export test components for development
export { default as PageEditorMigrationTest } from './PageEditorMigrationTest'
export { default as HybridLayoutTest } from './HybridLayoutTest'
export { default as SimplifiedLayoutTest } from './SimplifiedLayoutTest'
export { default as DebugLayoutTest } from './DebugLayoutTest'
export { default as ManualReactLayoutTest } from './ManualReactLayoutTest'

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
