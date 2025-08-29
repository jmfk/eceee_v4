// Base widget editor
export { default as BaseWidgetEditor } from './BaseWidgetEditor'

// Core widget editors
import TextBlockEditor from './TextBlockEditor'
import ImageEditor from './ImageEditor'
import ButtonEditor from './ButtonEditor'
import SpacerEditor from './SpacerEditor'
import HTMLBlockEditor from './HTMLBlockEditor'

// Content widget editors
import NewsEditor from './NewsEditor'
import EventsEditor from './EventsEditor'
import CalendarEditor from './CalendarEditor'
import FormsEditor from './FormsEditor'
import GalleryEditor from './GalleryEditor'

// Object storage widget editors
import ObjectListEditor from './ObjectListEditor'

// Export individual editors
export { TextBlockEditor, ImageEditor, ButtonEditor, SpacerEditor, HTMLBlockEditor }
export { NewsEditor, EventsEditor, CalendarEditor, FormsEditor, GalleryEditor }
export { ObjectListEditor }

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
    'Forms': FormsEditor,
    'Gallery': GalleryEditor,
    // Object storage widgets
    'Object List': ObjectListEditor,
}

/**
 * Get the appropriate editor component for a widget type
 * @param {string} widgetTypeName - The name of the widget type
 * @returns {React.Component|null} - The editor component or null if not found
 */
export const getWidgetEditor = (widgetTypeName) => {
    return WIDGET_EDITORS[widgetTypeName] || null
} 