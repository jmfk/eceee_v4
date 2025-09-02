/**
 * Widget Format Converter
 * Converts legacy widget formats to the new core_widgets format
 */

// Mapping from legacy format to new format
const LEGACY_TO_NEW_FORMAT_MAP = {
    'text': 'core_widgets.TextBlockWidget',
    'text-block': 'core_widgets.TextBlockWidget',
    'image': 'core_widgets.ImageWidget',
    'button': 'core_widgets.ButtonWidget',
    'spacer': 'core_widgets.SpacerWidget',
    'html-block': 'core_widgets.HtmlBlockWidget',
    'gallery': 'core_widgets.GalleryWidget'
}

// Mapping from new format to legacy format (for backwards compatibility)
const NEW_TO_LEGACY_FORMAT_MAP = {
    'core_widgets.TextBlockWidget': 'text-block',
    'core_widgets.ImageWidget': 'image',
    'core_widgets.ButtonWidget': 'button',
    'core_widgets.SpacerWidget': 'spacer',
    'core_widgets.HtmlBlockWidget': 'html-block',
    'core_widgets.GalleryWidget': 'gallery'
}

/**
 * Convert a widget from legacy format to new format
 * @param {Object} widget - Widget object
 * @returns {Object} Widget with new format type
 */
export const convertWidgetToNewFormat = (widget) => {
    if (!widget || !widget.type) {
        return widget
    }

    const newType = LEGACY_TO_NEW_FORMAT_MAP[widget.type]
    if (newType) {
        return {
            ...widget,
            type: newType
        }
    }

    // Already in new format or unknown type
    return widget
}

/**
 * Convert a widget from new format to legacy format
 * @param {Object} widget - Widget object
 * @returns {Object} Widget with legacy format type
 */
export const convertWidgetToLegacyFormat = (widget) => {
    if (!widget || !widget.type) {
        return widget
    }

    const legacyType = NEW_TO_LEGACY_FORMAT_MAP[widget.type]
    if (legacyType) {
        return {
            ...widget,
            type: legacyType
        }
    }

    // Already in legacy format or unknown type
    return widget
}

/**
 * Convert all widgets in a widgets object to new format
 * @param {Object} widgets - Widgets object with slots as keys
 * @returns {Object} Widgets with all types in new format
 */
export const convertAllWidgetsToNewFormat = (widgets) => {
    if (!widgets || typeof widgets !== 'object') {
        return widgets
    }

    const convertedWidgets = {}

    Object.entries(widgets).forEach(([slotName, slotWidgets]) => {
        if (Array.isArray(slotWidgets)) {
            convertedWidgets[slotName] = slotWidgets.map(convertWidgetToNewFormat)
        } else {
            convertedWidgets[slotName] = slotWidgets
        }
    })

    return convertedWidgets
}

/**
 * Convert all widgets in a widgets object to legacy format
 * @param {Object} widgets - Widgets object with slots as keys
 * @returns {Object} Widgets with all types in legacy format
 */
export const convertAllWidgetsToLegacyFormat = (widgets) => {
    if (!widgets || typeof widgets !== 'object') {
        return widgets
    }

    const convertedWidgets = {}

    Object.entries(widgets).forEach(([slotName, slotWidgets]) => {
        if (Array.isArray(slotWidgets)) {
            convertedWidgets[slotName] = slotWidgets.map(convertWidgetToLegacyFormat)
        } else {
            convertedWidgets[slotName] = slotWidgets
        }
    })

    return convertedWidgets
}

/**
 * Check if a widget type is in legacy format
 * @param {string} widgetType - Widget type string
 * @returns {boolean} True if legacy format
 */
export const isLegacyFormat = (widgetType) => {
    return widgetType in LEGACY_TO_NEW_FORMAT_MAP
}

/**
 * Check if a widget type is in new format
 * @param {string} widgetType - Widget type string
 * @returns {boolean} True if new format
 */
export const isNewFormat = (widgetType) => {
    return widgetType in NEW_TO_LEGACY_FORMAT_MAP
}

/**
 * Get the new format equivalent of a widget type
 * @param {string} widgetType - Widget type string
 * @returns {string} New format widget type
 */
export const getNewFormatType = (widgetType) => {
    return LEGACY_TO_NEW_FORMAT_MAP[widgetType] || widgetType
}

/**
 * Get the legacy format equivalent of a widget type
 * @param {string} widgetType - Widget type string
 * @returns {string} Legacy format widget type
 */
export const getLegacyFormatType = (widgetType) => {
    return NEW_TO_LEGACY_FORMAT_MAP[widgetType] || widgetType
}

export default {
    convertWidgetToNewFormat,
    convertWidgetToLegacyFormat,
    convertAllWidgetsToNewFormat,
    convertAllWidgetsToLegacyFormat,
    isLegacyFormat,
    isNewFormat,
    getNewFormatType,
    getLegacyFormatType
}
