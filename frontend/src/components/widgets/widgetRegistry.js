// Widget Registry - maps widget types to components
import TextBlockWidget from './TextBlockWidget'
import ImageWidget from './ImageWidget'
import ButtonWidget from './ButtonWidget'
import SpacerWidget from './SpacerWidget'
import HtmlBlockWidget from './HtmlBlockWidget'
import GalleryWidget from './GalleryWidget'

// NEW FORMAT ONLY - Used by ObjectContentEditor
export const NEW_FORMAT_WIDGET_COMPONENTS = {
    'core_widgets.TextBlockWidget': TextBlockWidget,
    'core_widgets.ImageWidget': ImageWidget,
    'core_widgets.ButtonWidget': ButtonWidget,
    'core_widgets.SpacerWidget': SpacerWidget,
    'core_widgets.HtmlBlockWidget': HtmlBlockWidget,
    'core_widgets.GalleryWidget': GalleryWidget
}

// FULL REGISTRY - Used by ContentEditor (includes legacy support)
export const WIDGET_COMPONENTS = {
    ...NEW_FORMAT_WIDGET_COMPONENTS,

    // Legacy support for ContentEditor only (DOM rendering)
    'text': TextBlockWidget,
    'text-block': TextBlockWidget,
    'image': ImageWidget,
    'button': ButtonWidget,
    'spacer': SpacerWidget,
    'html-block': HtmlBlockWidget,
    'gallery': GalleryWidget
}

// Get widget component by type (supports both formats)
export const getWidgetComponent = (widgetType) => {
    return WIDGET_COMPONENTS[widgetType] || null
}

// Get widget component by type (NEW FORMAT ONLY)
export const getNewFormatWidgetComponent = (widgetType) => {
    return NEW_FORMAT_WIDGET_COMPONENTS[widgetType] || null
}

// Get all available widget types (NEW FORMAT ONLY)
export const getNewFormatWidgetTypes = () => {
    return Object.keys(NEW_FORMAT_WIDGET_COMPONENTS)
}

// Get all available widget types (includes legacy)
export const getAvailableWidgetTypes = () => {
    return Object.keys(WIDGET_COMPONENTS)
}

// Check if widget type is supported (NEW FORMAT ONLY)
export const isNewFormatWidgetTypeSupported = (widgetType) => {
    return widgetType in NEW_FORMAT_WIDGET_COMPONENTS
}

// Check if widget type is supported (includes legacy)
export const isWidgetTypeSupported = (widgetType) => {
    return widgetType in WIDGET_COMPONENTS
}
