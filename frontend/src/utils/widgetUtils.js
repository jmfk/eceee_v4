import { isEqual } from 'lodash';

/**
 * Gets widget content from state and widgets array
 * @param {Object} state - The unified data state object
 * @param {string} widgetId - The ID of the widget to find
 * @param {string} slotName - slot where the widget is located
 * @param {string} contextType - 'page' or 'object' context type
 * @returns {Object} Object containing content and optionally the widget
 */
export const getWidgetContent = (state, widgetId, slotName, contextType = 'page') => {
    if (!state || !widgetId || !slotName) {
        return { content: null, slotName: null };
    }

    let widgets = null;
    let widget = null;

    if (contextType === 'page') {
        // Look up widget in page version
        const version = state.versions[state.metadata.currentVersionId];
        if (!version) {
            return { content: null, widget: null };
        }
        widgets = version.widgets[slotName];
    } else if (contextType === 'object') {
        // Look up widget in object
        const objectId = state.metadata.currentObjectId;
        if (!objectId) {
            return { content: null, widget: null };
        }
        const objectData = state.objects[objectId];
        if (!objectData) {
            return { content: null, widget: null };
        }
        widgets = objectData.widgets?.[slotName];
    } else {
        // Unknown context type
        return { content: null, widget: null };
    }

    widget = widgets?.find(w => w.id === widgetId);
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
