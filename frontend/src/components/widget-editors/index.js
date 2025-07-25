// Base widget editor
export { default as BaseWidgetEditor } from './BaseWidgetEditor'

// Core widget editors
export { default as TextBlockEditor } from './TextBlockEditor'
export { default as ImageEditor } from './ImageEditor'
export { default as ButtonEditor } from './ButtonEditor'
export { default as SpacerEditor } from './SpacerEditor'
export { default as HTMLBlockEditor } from './HTMLBlockEditor'

// Content widget editors
export { default as NewsEditor } from './NewsEditor'
export { default as EventsEditor } from './EventsEditor'
export { default as CalendarEditor } from './CalendarEditor'
// export { default as FormsEditor } from './FormsEditor'
// export { default as GalleryEditor } from './GalleryEditor'

/**
 * Widget Editor Registry
 * Maps widget type names to their specialized editor components
 */
export const WIDGET_EDITORS = {
    'Text Block': TextBlockEditor,
    'Image': ImageEditor,
    'Button': ButtonEditor,
    'Spacer': SpacerEditor,
    'HTML Block': HTMLBlockEditor,
    // Content widgets
    'News': NewsEditor,
    'Events': EventsEditor,
    'Calendar': CalendarEditor,
    // 'Forms': FormsEditor,
    // 'Gallery': GalleryEditor,
}

/**
 * Get the appropriate editor component for a widget type
 * @param {string} widgetTypeName - The name of the widget type
 * @returns {React.Component|null} - The editor component or null if not found
 */
export const getWidgetEditor = (widgetTypeName) => {
    return WIDGET_EDITORS[widgetTypeName] || null
} 