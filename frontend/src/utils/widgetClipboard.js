/**
 * Widget Clipboard Utilities
 * 
 * Functions for copying and pasting widgets using the Clipboard API
 */

import toast from 'react-hot-toast';

/**
 * Generate a unique widget ID
 */
const generateWidgetId = () => {
    return `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Validate widget structure
 */
export const validateWidgetStructure = (data) => {
    if (!data || typeof data !== 'object') {
        return false;
    }
    
    // Single widget validation
    if (data.type && data.config) {
        return true;
    }
    
    // Array of widgets validation
    if (Array.isArray(data)) {
        return data.every(widget => 
            widget && 
            typeof widget === 'object' && 
            widget.type && 
            widget.config
        );
    }
    
    return false;
};

/**
 * Recursively generate new IDs for widgets and nested widgets in slots
 */
export const generateNewWidgetIds = (widget) => {
    const newWidget = { ...widget };
    
    // Generate new ID for the widget
    newWidget.id = generateWidgetId();
    
    // If widget has slots with nested widgets, generate new IDs for them too
    if (newWidget.config && newWidget.config.slots) {
        newWidget.config = { ...newWidget.config };
        newWidget.config.slots = { ...newWidget.config.slots };
        
        Object.keys(newWidget.config.slots).forEach(slotName => {
            const slotWidgets = newWidget.config.slots[slotName];
            if (Array.isArray(slotWidgets)) {
                newWidget.config.slots[slotName] = slotWidgets.map(w => generateNewWidgetIds(w));
            }
        });
    }
    
    return newWidget;
};

/**
 * Copy a single widget to clipboard
 */
export const copyWidgetToClipboard = async (widget) => {
    try {
        if (!widget) {
            toast.error('No widget to copy');
            return false;
        }
        
        const widgetJson = JSON.stringify(widget, null, 2);
        await navigator.clipboard.writeText(widgetJson);
        toast.success('Widget copied to clipboard');
        return true;
    } catch (error) {
        console.error('Failed to copy widget:', error);
        toast.error('Failed to copy widget to clipboard');
        return false;
    }
};

/**
 * Copy multiple widgets to clipboard
 */
export const copyWidgetsToClipboard = async (widgets) => {
    try {
        if (!widgets || !Array.isArray(widgets) || widgets.length === 0) {
            toast.error('No widgets to copy');
            return false;
        }
        
        const widgetsJson = JSON.stringify(widgets, null, 2);
        await navigator.clipboard.writeText(widgetsJson);
        
        const count = widgets.length;
        const message = count === 1 ? 'Widget copied to clipboard' : `${count} widgets copied to clipboard`;
        toast.success(message);
        return true;
    } catch (error) {
        console.error('Failed to copy widgets:', error);
        toast.error('Failed to copy widgets to clipboard');
        return false;
    }
};

/**
 * Read widget(s) from clipboard and validate
 * Returns { data, isArray } where data is the parsed widget(s)
 */
export const readFromClipboard = async () => {
    try {
        const text = await navigator.clipboard.readText();
        
        if (!text || !text.trim()) {
            toast.error('Clipboard is empty');
            return null;
        }
        
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (parseError) {
            toast.error('Clipboard does not contain valid JSON');
            return null;
        }
        
        if (!validateWidgetStructure(parsed)) {
            toast.error('Clipboard does not contain valid widget data');
            return null;
        }
        
        const isArray = Array.isArray(parsed);
        const data = isArray ? parsed : [parsed];
        
        return { data, isArray };
    } catch (error) {
        console.error('Failed to read from clipboard:', error);
        toast.error('Failed to read from clipboard');
        return null;
    }
};

/**
 * Read a single widget from clipboard
 */
export const readWidgetFromClipboard = async () => {
    const result = await readFromClipboard();
    if (!result) return null;
    
    // Return first widget if array, or the single widget
    return result.data[0] || null;
};

/**
 * Read widgets array from clipboard
 */
export const readWidgetsFromClipboard = async () => {
    const result = await readFromClipboard();
    if (!result) return null;
    
    return result.data;
};

