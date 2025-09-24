import { isEqual } from 'lodash';

/**
 * Gets widget content from state and widgets array
 * @param {Object} state - The unified data state object
 * @param {string} widgetId - The ID of the widget to find
 * @param {string} slotName - slot where the widget is located
 * @returns {Object} Object containing content and optionally the widget
 */
export const getWidgetContent = (state, widgetId, slotName) => {
    if (!state || !widgetId || !slotName) {
        return { content: null, slotName: null };
    }

    const version = state.versions[state.metadata.currentVersionId];
    if (!version) {
        return { content: null, widget: null };
    }

    const widgets = version.widgets[slotName];
    const widget = widgets?.find(w => w.id === widgetId);
    const newContent = widget?.config?.content;
    return {
        content: newContent,
        widget
    };
};

/**
 * Checks if widget content has changed
 * @param {string} currentContent - Current content value
 * @param {string} newContent - New content value
 * @returns {boolean} True if content has changed
 */
export const hasWidgetContentChanged = (currentContent, newContent) => {
    return !isEqual(currentContent, newContent);
};
