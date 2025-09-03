// Widget Registry - maps widget types to components
import TextBlockWidget from './TextBlockWidget'
import ImageWidget from './ImageWidget'
import ButtonWidget from './ButtonWidget'
import SpacerWidget from './SpacerWidget'
import HtmlBlockWidget from './HtmlBlockWidget'
import GalleryWidget from './GalleryWidget'

// Widget components registry - all widgets now use new format
export const WIDGET_COMPONENTS = {
    'core_widgets.TextBlockWidget': TextBlockWidget,
    'core_widgets.ImageWidget': ImageWidget,
    'core_widgets.ButtonWidget': ButtonWidget,
    'core_widgets.SpacerWidget': SpacerWidget,
    'core_widgets.HTMLBlockWidget': HtmlBlockWidget,
    'core_widgets.GalleryWidget': GalleryWidget
}

// Get widget component by type
export const getWidgetComponent = (widgetType) => {
    return WIDGET_COMPONENTS[widgetType] || null
}

// Get all available widget types
export const getAvailableWidgetTypes = () => {
    return Object.keys(WIDGET_COMPONENTS)
}

// Check if widget type is supported
export const isWidgetTypeSupported = (widgetType) => {
    return widgetType in WIDGET_COMPONENTS
}

// Legacy aliases for backward compatibility during transition
export const getNewFormatWidgetComponent = getWidgetComponent
export const getNewFormatWidgetTypes = getAvailableWidgetTypes
export const isNewFormatWidgetTypeSupported = isWidgetTypeSupported
