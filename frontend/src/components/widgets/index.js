// Export individual widget components
export { default as TextBlockWidget } from './TextBlockWidget'
export { default as ImageWidget } from './ImageWidget'
export { default as ButtonWidget } from './ButtonWidget'
export { default as SpacerWidget } from './SpacerWidget'
export { default as HtmlBlockWidget } from './HtmlBlockWidget'
export { default as GalleryWidget } from './GalleryWidget'

// Export main components
export { default as WidgetRenderer } from './WidgetRenderer'
export { default as WidgetFactory } from './WidgetFactory'

// Export widget registry utilities
export {
    WIDGET_COMPONENTS,
    getWidgetComponent,
    getAvailableWidgetTypes,
    isWidgetTypeSupported,
    // Legacy aliases for backward compatibility
    getNewFormatWidgetComponent,
    getNewFormatWidgetTypes,
    isNewFormatWidgetTypeSupported
} from './widgetRegistry'
