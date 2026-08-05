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
export * from '../../layouts'
export { WidgetSlot } from '../../layouts'

// Test components removed after refactoring completion

// Re-export shared widgets for convenience
export * from '../../widgets'
